{-# LANGUAGE OverloadedStrings #-}

-- | The size ceiling.
--
-- Probe.hs measures the slice a balance view needs, and the linker discards the
-- rest of hledger. That number would be misleading on its own: a real UI grows
-- into register views, budgets, price valuation and CSV import, and whatever it
-- touches stops being discardable.
--
-- This binary imports the @Hledger@ umbrella module and references every report
-- entry point and writer, so nothing can be garbage collected. Whatever it
-- measures is the worst case the PWA could ever reach.
module Main (main) where

import qualified Data.Text as T
import qualified Data.Text.IO as TIO
import qualified Data.Text.Lazy as TL
import System.Environment (getArgs)
import System.IO (utf8)

import Hledger
-- The umbrella module does not re-export the writers, so they are pulled in by
-- hand; without them the output side of hledger would still be discardable.
import Hledger.Write.Beancount (showTransactionBeancount)
import Hledger.Write.Csv (printCSV)
import Hledger.Write.Ods (printFods)

-- | Touch every major report and writer so the linker must keep them all.
-- The results are folded into one number purely so that none of the calls can
-- be optimised away.
weigh :: Journal -> Int
weigh j = sum
  [ length (show (balanceReport rspec j))
  , length (show (multiBalanceReport rspec j))
  , length (show (postingsReport rspec j))
  , length (show (entriesReport rspec j))
  , length (show (accountTransactionsReport rspec j Any))
  , length (show (budgetReport rspec defbalancingopts nulldatespan j))
  , length (concatMap (T.unpack . showTransactionBeancount) (jtxns j))
  , length (show (journalPriceOracle False j (nulldate, "USD", Nothing)))
  , length (TL.unpack (printCSV [["a", "b"]]))
  , length (TL.unpack (printFods utf8 mempty))
  ]
  where
    rspec = defreportspec

main :: IO ()
main = do
  args <- getArgs
  case args of
    [path] -> do
      ej <- runExceptT (readJournalFile definputopts path)
      case ej of
        Left err -> TIO.putStrLn ("error: " <> T.pack err)
        Right j  -> print (weigh j)
    _ -> TIO.putStrLn "usage: probe-full <journal-file>"
