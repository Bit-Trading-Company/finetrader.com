/**
 * Lets ord.net fall back to the connected browser wallet for reads.
 *
 * ord.net authenticates even its read calls, so with no Fine Trader wallet
 * over its funding floor there is nothing to sign a session with and the
 * order book cannot be shown at all. This hands the trading layer a signer
 * backed by the connected wallet so browsing still works.
 *
 * Registered once, from the app shell, rather than passed through every read:
 * reads happen deep inside the auto-trade engine and the collection picker,
 * and there is only ever one connected wallet.
 *
 * Reads only, deliberately. A purchase spends from the signed-in wallet's
 * payment address, so a proxy wallet can only buy once it is itself funded
 * and signed in — trading as the user would mean a wallet popup per trade.
 */
import { useEffect } from 'react';
import { useOrdConnect, useSignMessage } from '@ordzaar/ord-connect';
import { setOrdNetProviderSigner } from '../../trading/ordnet/ordnetTrading';

export const useOrdNetProviderSigner = () => {
  const { address } = useOrdConnect();
  const { signMsg } = useSignMessage();

  const ordinalsAddress = address?.ordinals || null;
  const paymentAddress = address?.payments || null;

  useEffect(() => {
    if (!ordinalsAddress) {
      setOrdNetProviderSigner(null);
      return undefined;
    }

    setOrdNetProviderSigner({
      ordinalsAddress,
      paymentAddress,
      // ord-connect requests a BIP-322 simple signature, which is the form
      // ord.net's /auth/verify expects.
      signMessage: (signingAddress, message) =>
        signMsg(signingAddress, message),
    });

    return () => setOrdNetProviderSigner(null);
  }, [ordinalsAddress, paymentAddress, signMsg]);
};
