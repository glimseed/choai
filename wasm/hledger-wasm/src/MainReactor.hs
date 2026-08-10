-- | Browser probe. Built as a reactor module and driven from JavaScript, which
-- is the shape the PWA would actually ship.
module Main (main) where

import Control.Exception (SomeException, displayException, try)
import qualified Data.Text as T
import GHC.Wasm.Prim (JSString (..), fromJSString, toJSString)

import Probe (balanceFromFile, balanceFromText)

-- | Balance a journal already present on the WASI filesystem. The host is
-- expected to have written it there first.
foreign export javascript "hledgerBalanceFromFile"
  jsBalanceFromFile :: JSString -> IO JSString

-- | Balance a journal passed across as a string.
foreign export javascript "hledgerBalanceFromText"
  jsBalanceFromText :: JSString -> IO JSString

jsBalanceFromFile :: JSString -> IO JSString
jsBalanceFromFile = guarded (balanceFromFile . fromJSString)

jsBalanceFromText :: JSString -> IO JSString
jsBalanceFromText = guarded (balanceFromText . T.pack . fromJSString)

-- | Turn a Haskell exception into a readable string rather than trapping the
-- whole wasm instance, so the browser side can report what went wrong.
guarded :: (JSString -> IO T.Text) -> JSString -> IO JSString
guarded f s = do
  result <- try (f s)
  pure . toJSString . T.unpack $ case result of
    Right out -> out
    Left e    -> T.pack ("exception: " <> displayException (e :: SomeException))

-- A reactor module still needs a main, but it is never run.
main :: IO ()
main = pure ()
