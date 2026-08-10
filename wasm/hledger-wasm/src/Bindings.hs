{-# LANGUAGE OverloadedStrings #-}

-- | What binds hledger to JavaScript.
--
-- hledger does the accounting; this module only makes it reachable from a
-- browser, and changes nothing about it. @foreign export javascript@ can be
-- written nowhere but in Haskell, and hledger-lib, being a library, has no entry
-- point of its own for a browser to call, so one thin layer has to exist. This
-- is that layer: it calls hledger's public API and nothing more.
--
-- It holds one piece of state, the parsed journal. Parse cost grows with the
-- size of the journal while answering a report from one already in memory does
-- not, so re-reading per screen would make that cost recur on every navigation.
--
-- Reports leave through hledger's own ToJSON instances rather than shapes
-- invented here, so the wire format is the one @hledger --output-format=json@
-- produces and follows hledger rather than drifting from it.
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
import System.Directory (doesFileExist)
import System.IO.Unsafe (unsafePerformIO)

import Hledger
import Hledger.Data.Json ()

-- | Why a call did not produce an answer.
--
-- Carried as a tag and its particulars rather than a sentence, so the caller can
-- tell the cases apart and choose its own wording. A journal that failed to
-- parse and a query that was never a query are different situations.
data Failure
  = NoJournal
  | FileMissing FilePath
  | ReadFailed Text
  | MalformedRequest Text
  | UnknownReport Text
  | MissingTransaction
  | Crashed Text

failureJson :: Failure -> A.Value
failureJson failure = case failure of
  NoJournal -> tagged "no-journal" []
  FileMissing path -> tagged "file-missing" ["path" .= path]
  ReadFailed detail -> tagged "read-failed" ["detail" .= detail]
  MalformedRequest detail -> tagged "malformed-request" ["detail" .= detail]
  UnknownReport name -> tagged "unknown-report" ["report" .= name]
  MissingTransaction -> tagged "missing-transaction" []
  Crashed detail -> tagged "crashed" ["detail" .= detail]
  where
    tagged kind rest = A.object (("kind" .= (kind :: Text)) : rest)

-- | The journal, held across calls.
--
-- A reactor module lives as long as the page does, so a journal parsed once
-- stays parsed.
{-# NOINLINE journalRef #-}
journalRef :: IORef (Maybe Journal)
journalRef = unsafePerformIO (newIORef Nothing)

foreign export javascript "hledgerLoad" jsLoad :: JSString -> IO JSString
foreign export javascript "hledgerQuery" jsQuery :: JSString -> IO JSString

-- | Parse the journal at this path on the WASI filesystem and keep it.
--
-- The host writes journal files into the filesystem first. hledger resolves
-- @include@ directives against that same filesystem itself, so a journal split
-- across files needs no special handling on either side.
jsLoad :: JSString -> IO JSString
jsLoad path = respond (fmap (fmap summarise) (readAndKeep (fromJSString path)))

-- | Read a journal, distinguishing a file that is not there from one that is
-- there and wrong.
--
-- Existence is checked first because hledger calls @error@ for a missing file
-- rather than returning, which would otherwise reach the caller as a crash and
-- hide an ordinary, expected situation.
readAndKeep :: FilePath -> IO (Either Failure Journal)
readAndKeep path = do
  present <- doesFileExist (snd (splitReaderPrefix path))
  if not present
    then pure (Left (FileMissing path))
    else do
      result <- runExceptT (readJournalFile definputopts path)
      case result of
        Left detail -> pure (Left (ReadFailed (T.pack detail)))
        Right journal -> writeIORef journalRef (Just journal) >> pure (Right journal)

summarise :: Journal -> A.Value
summarise journal =
  A.object
    [ "transactions" .= length (jtxns journal)
    , "accounts" .= journalAccountNames journal
    ]

jsQuery :: JSString -> IO JSString
jsQuery raw = respond (runRequest (decodeRequest (fromJSString raw)))

decodeRequest :: String -> Either Failure Request
decodeRequest raw =
  case A.eitherDecodeStrict' (TE.encodeUtf8 (T.pack raw)) >>= A.parseEither parseRequest of
    Left detail -> Left (MalformedRequest (T.pack detail))
    Right request -> Right request

runRequest :: Either Failure Request -> IO (Either Failure A.Value)
runRequest (Left failure) = pure (Left failure)
runRequest (Right request) = do
  loaded <- readIORef journalRef
  case loaded of
    Nothing -> pure (Left NoJournal)
    Just journal -> report journal request

data Request = Request
  { reqKind :: Text
  -- ^ Which report to run.
  , reqQuery :: Text
  -- ^ A raw hledger query, eg @acct:expenses date:2024@. Passed through rather
  -- than reinvented: the people who use this already know the language, and
  -- hledger's own parser is the only thing that gets its meaning right.
  , reqLimit :: Maybe Int
  , reqOffset :: Int
  -- ^ A window onto the reports that have one row per item. Those reports are
  -- cheap to compute and expensive to serialise, so the caller takes a page at a
  -- time.
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

-- | Run the report a request names.
--
-- The balance sheet and the income statement are the same report under a
-- different account-type filter and accumulation, which is how hledger's own
-- @balancesheet@ and @incomestatement@ commands are defined.
report :: Journal -> Request -> IO (Either Failure A.Value)
report journal request = case reqKind request of
  "entries" -> withSpec [] PerPeriod (\spec -> page request (entriesReport spec journal))
  "register" -> withSpec [] PerPeriod (\spec -> page request (postingsReport spec journal))
  "balance" -> withSpec [] PerPeriod (\spec -> A.toJSON (multiBalanceReport spec journal))
  "balancesheet" -> withSpec ["type:ALE"] Historical (\spec -> A.toJSON (multiBalanceReport spec journal))
  "incomestatement" -> withSpec ["type:RX"] PerPeriod (\spec -> A.toJSON (multiBalanceReport spec journal))
  "accounts" -> pure (Right (A.toJSON (journalAccountNames journal)))
  "renderTransaction" -> pure (renderTransaction request)
  other -> pure (Left (UnknownReport other))
  where
    withSpec extra accumulation render =
      fmap (fmap render) (specFor request extra accumulation)

-- | Build the report specification, letting hledger parse the query.
specFor :: Request -> [Text] -> BalanceAccumulation -> IO (Either Failure ReportSpec)
specFor request extra accumulation = do
  today <- getCurrentDay
  pure $ case reportOptsToSpec today options of
    Left detail -> Left (MalformedRequest (T.pack detail))
    Right spec -> Right spec
  where
    options =
      defreportopts
        { querystring_ = extra <> terms
        , balanceaccum_ = accumulation
        , accountlistmode_ = ALTree
        }
    terms = map T.pack (words' (T.unpack (reqQuery request)))

-- | Render a transaction back to journal syntax.
--
-- hledger writes it, so what is written to the file is what hledger would have
-- written.
renderTransaction :: Request -> Either Failure A.Value
renderTransaction request = case reqTransaction request of
  Nothing -> Left MissingTransaction
  Just transaction -> Right (A.toJSON (showTransaction transaction))

-- | Take a window of a report and say how many rows there were in all, so the
-- caller can page without asking again.
--
-- Newest first: a ledger is read from the recent end, and hledger's reports come
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

-- | Put a result in an envelope the host can branch on without guessing.
--
-- Exceptions are caught here rather than left to the runtime: an unsupported
-- WASI operation would otherwise abort the instance, and the page would have no
-- way to tell that apart from a query it got wrong.
respond :: IO (Either Failure A.Value) -> IO JSString
respond act = do
  result <- try act
  pure (encode (either (Left . crashed) id result))
  where
    crashed e = Crashed (T.pack (displayException (e :: SomeException)))

encode :: Either Failure A.Value -> JSString
encode outcome =
  toJSString . TL.unpack . A.encodeToLazyText $ case outcome of
    Right value -> A.object ["ok" .= True, "data" .= value]
    Left failure -> A.object ["ok" .= False, "error" .= failureJson failure]

main :: IO ()
main = pure ()
