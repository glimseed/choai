{-# LANGUAGE OverloadedStrings #-}

-- | The hledger engine the PWA drives: two exports and one piece of state.
--
-- The journal is parsed once and kept. Measurement showed parse cost scales
-- linearly with journal size (~0.27 ms per transaction, so ~275 ms for a
-- thousand), while answering a report from an already-parsed journal does not.
-- Re-reading the file per screen would make that cost recur on every
-- navigation, which is exactly what the UI must not do.
--
-- Reports go out through hledger's own ToJSON instances rather than shapes
-- invented here. That keeps this module thin, and makes the wire format the
-- same one `hledger --output-format=json` produces, so it tracks upstream
-- instead of drifting from it.
module Main (main) where

import Control.Exception (SomeException, displayException, try)
import Data.Aeson ((.:), (.:?), (.=))
import qualified Data.Aeson as A
import qualified Data.Aeson.Text as A (encodeToLazyText)
import qualified Data.Aeson.Types as A
import Data.IORef (IORef, newIORef, readIORef, writeIORef)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Text.Lazy as TL
import GHC.Wasm.Prim (JSString (..), fromJSString, toJSString)
import System.IO.Unsafe (unsafePerformIO)

import Hledger
import Hledger.Data.Json ()

-- | The parsed journal, held across calls. A reactor module lives for the
-- lifetime of the page, so this survives between queries.
{-# NOINLINE journalRef #-}
journalRef :: IORef (Maybe Journal)
journalRef = unsafePerformIO (newIORef Nothing)

foreign export javascript "hledgerLoad" jsLoad :: JSString -> IO JSString
foreign export javascript "hledgerQuery" jsQuery :: JSString -> IO JSString

-- | Parse the journal at this path on the WASI filesystem and keep it.
--
-- The host writes journal files into the virtual filesystem first. hledger then
-- resolves @include@ directives against that filesystem itself, so multi-file
-- journals need no special handling on either side.
jsLoad :: JSString -> IO JSString
jsLoad path = respond $ do
  result <- runExceptT (readJournalFile definputopts (fromJSString path))
  case result of
    Left e -> pure (Left (T.pack e))
    Right j -> do
      writeIORef journalRef (Just j)
      pure . Right $ A.object
        [ "transactions" .= length (jtxns j)
        , "accounts" .= journalAccountNames j
        ]

jsQuery :: JSString -> IO JSString
jsQuery raw = respond $ do
  let bytes = TE.encodeUtf8 (T.pack (fromJSString raw))
  case A.eitherDecodeStrict' bytes >>= A.parseEither parseRequest of
    Left e -> pure (Left ("bad request: " <> T.pack e))
    Right request -> do
      loaded <- readIORef journalRef
      case loaded of
        Nothing -> pure (Left "no journal loaded")
        Just j -> runRequest j request

data Request = Request
  { reqKind :: Text
  -- ^ Which report to run.
  , reqQuery :: Text
  -- ^ A raw hledger query string, eg @acct:expenses date:2024@. Passed through
  -- rather than reinvented: the intended users already know this language, and
  -- hledger's own parser is the only thing that gets its semantics right.
  , reqLimit :: Maybe Int
  , reqOffset :: Int
  -- ^ Windowing for the row-per-item reports. Measurement showed the reports
  -- themselves are cheap (a balance sheet is ~19 ms) while serialising every
  -- transaction to JSON is not (~580 ms for a thousand, 1.2 MB of output).
  -- Handing the UI a page at a time is what keeps it responsive, so the default
  -- is a window rather than everything.
  , reqTransaction :: Maybe Transaction
  -- ^ For @renderTransaction@. hledger has FromJSON instances, so this accepts
  -- exactly the shape its own reports emit.
  }

parseRequest :: A.Value -> A.Parser Request
parseRequest = A.withObject "request" $ \o ->
  Request
    <$> o .: "kind"
    <*> (maybe "" id <$> o .:? "query")
    <*> o .:? "limit"
    <*> (maybe 0 id <$> o .:? "offset")
    <*> o .:? "transaction"

-- | Take a window of a report, and say how many rows there were in total so the
-- caller can page through without asking again.
--
-- Newest first: a ledger is read from the recent end, and hledger reports come
-- out oldest first.
page :: A.ToJSON a => Request -> [a] -> A.Value
page request rows =
  A.object
    [ "total" .= length rows
    , "offset" .= reqOffset request
    , "items" .= window (reverse rows)
    ]
  where
    window = maybe id take (reqLimit request) . drop (reqOffset request)

runRequest :: Journal -> Request -> IO (Either Text A.Value)
runRequest j request = case reqKind request of
  -- The main screen: whole transactions, in hledger's own JSON, newest first
  -- and windowed.
  "entries" -> withSpec [] PerPeriod (\s -> page request (entriesReport s j))
  -- Account drill-down: one row per posting, with a running total.
  "register" -> withSpec [] PerPeriod (\s -> page request (postingsReport s j))
  "balance" -> withSpec [] PerPeriod (\s -> A.toJSON (multiBalanceReport s j))
  -- Balance sheet and income statement are the same report with a different
  -- account-type filter and accumulation, which is how hledger's own
  -- balancesheet and incomestatement commands are defined.
  "balancesheet" -> withSpec ["type:ALE"] Historical (\s -> A.toJSON (multiBalanceReport s j))
  "incomestatement" -> withSpec ["type:RX"] PerPeriod (\s -> A.toJSON (multiBalanceReport s j))
  "accounts" -> pure (Right (A.toJSON (journalAccountNames j)))
  -- Rendering a new transaction back to journal syntax is hledger's job too,
  -- so what gets written to the file matches what hledger would have written.
  "renderTransaction" -> pure $ case reqTransaction request of
    Nothing -> Left "renderTransaction requires a transaction"
    Just t -> Right (A.toJSON (showTransaction t))
  other -> pure (Left ("unknown kind: " <> other))
  where
    withSpec extra accum report = do
      day <- getCurrentDay
      let terms = extra <> map T.pack (words' (T.unpack (reqQuery request)))
          ropts =
            defreportopts
              { querystring_ = terms
              , balanceaccum_ = accum
              , accountlistmode_ = ALTree
              }
      pure $ case reportOptsToSpec day ropts of
        Left e -> Left (T.pack e)
        Right spec -> Right (report spec)

-- | Wrap a result in an envelope the host can branch on without guessing.
--
-- Exceptions are caught here rather than left to the runtime: an unsupported
-- WASI operation would otherwise abort the whole instance, and the page would
-- have no way to tell that apart from a bad query.
respond :: IO (Either Text A.Value) -> IO JSString
respond act = do
  result <- try act
  pure . toJSString . TL.unpack . A.encodeToLazyText $ case result of
    Right (Right value) -> A.object ["ok" .= True, "data" .= value]
    Right (Left message) -> A.object ["ok" .= False, "error" .= message]
    Left e -> A.object ["ok" .= False, "error" .= displayException (e :: SomeException)]

main :: IO ()
main = pure ()
