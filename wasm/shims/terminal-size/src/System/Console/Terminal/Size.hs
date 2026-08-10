{-# LANGUAGE DeriveFoldable #-}
{-# LANGUAGE DeriveFunctor #-}
{-# LANGUAGE DeriveTraversable #-}

-- | Stand-in for the terminal-size package on wasm32-wasi.
--
-- See terminal-size.cabal for why this exists. Every query reports that there
-- is no terminal, which is what a browser or a tty-less wasm runtime actually
-- offers; callers already handle that case because it is what the real package
-- returns for a redirected stdout.
module System.Console.Terminal.Size
  ( Window (..)
  , size
  , fdSize
  , hSize
  ) where

import System.IO (Handle)
import System.Posix.Types (Fd)

data Window a = Window { height :: !a, width :: !a }
  deriving (Show, Eq, Read, Functor, Foldable, Traversable)

size :: Integral n => IO (Maybe (Window n))
size = pure Nothing

fdSize :: Integral n => Fd -> IO (Maybe (Window n))
fdSize _ = pure Nothing

hSize :: Integral n => Handle -> IO (Maybe (Window n))
hSize _ = pure Nothing
