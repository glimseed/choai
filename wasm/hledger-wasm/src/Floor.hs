-- | The size floor: a reactor module with the same shape as the real probe but
-- with no hledger in it at all.
--
-- Without this baseline a measurement of the probe cannot be interpreted. It is
-- the difference between "hledger is too big" and "a Haskell runtime in wasm is
-- too big", and those two answers point at completely different decisions.
module Main (main) where

import GHC.Wasm.Prim (JSString (..), toJSString)

foreign export javascript "floorEcho" floorEcho :: JSString -> IO JSString

floorEcho :: JSString -> IO JSString
floorEcho _ = pure (toJSString "floor")

main :: IO ()
main = pure ()
