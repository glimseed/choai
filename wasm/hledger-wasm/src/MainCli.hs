-- | WASI command probe. Run under wasmtime to check that the wasm build
-- produces the same balances a native hledger would.
--
--   probe-cli <journal-file>            -- read via the filesystem
--   probe-cli <journal-file> --text     -- read via hledger's Text entry point
module Main (main) where

import Control.Exception (SomeException, displayException, try)
import qualified Data.Text as T
import qualified Data.Text.IO as TIO
import System.Environment (getArgs)
import System.Exit (exitFailure)

import Probe (balanceFromFile, balanceFromText)

main :: IO ()
main = do
  args <- getArgs
  case args of
    [path]           -> run (balanceFromFile path)
    [path, "--text"] -> run (TIO.readFile path >>= balanceFromText)
    _                -> do
      TIO.putStrLn "usage: probe-cli <journal-file> [--text]"
      exitFailure
  where
    -- Failures are reported rather than left to the RTS, so that a WASI-level
    -- problem (a missing syscall, say) is distinguishable from a parse error.
    run act = do
      result <- try act
      case result of
        Right out -> TIO.putStr out
        Left e    -> do
          TIO.putStrLn (T.pack ("exception: " <> displayException (e :: SomeException)))
          exitFailure
