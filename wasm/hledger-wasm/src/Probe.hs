{-# LANGUAGE OverloadedStrings #-}

-- | The smallest slice of hledger that is still useful to a ledger UI: read a
-- journal and produce a balance report.
--
-- Both probe binaries go through this module, so the WASI build and the browser
-- build differ only in how they receive input and hand back output. That keeps
-- the size comparison between them meaningful.
--
-- Only the modules actually needed are imported. In particular the @Hledger@
-- umbrella module is avoided, since it re-exports everything and would defeat
-- the linker's dead code elimination.
module Probe
  ( balanceFromFile
  , balanceFromText
  ) where

import Data.Text (Text)
import qualified Data.Text as T

import Hledger.Data.Amount (showMixedAmountOneLine)
import Hledger.Read (definputopts, readJournal'', readJournalFile, runExceptT)
import Hledger.Reports.BalanceReport (BalanceReport, balanceReport)
import Hledger.Reports.ReportOptions (defreportspec)

-- | Read a journal from a path on the WASI filesystem.
--
-- This is the route that keeps hledger unmodified: the host writes the journal
-- into the (virtual) filesystem and hledger reads it exactly as it always does.
balanceFromFile :: FilePath -> IO Text
balanceFromFile path = do
  ej <- runExceptT (readJournalFile definputopts path)
  pure $ case ej of
    Left err -> "error: " <> T.pack err
    Right j  -> render (balanceReport defreportspec j)

-- | Read a journal straight from a Text value.
--
-- More convenient for a browser host, but hledger implements the Text entry
-- point with createPipe and forkIO. WASI has no pipe(2), so this probe exists
-- to find out whether that survives on wasm32-wasi at all.
balanceFromText :: Text -> IO Text
balanceFromText t = render . balanceReport defreportspec <$> readJournal'' t

render :: BalanceReport -> Text
render (items, total) = T.unlines (map row items <> ["---", amount total])
  where
    row (_full, display, indent, amt) =
      T.replicate indent "  " <> display <> "  " <> amount amt
    amount = T.strip . T.pack . showMixedAmountOneLine
