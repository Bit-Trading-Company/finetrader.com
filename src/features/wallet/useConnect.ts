import { useCallback } from 'react';
import {
  BrowserWalletNotInstalledError,
  BrowserWalletRequestCancelledByUserError,
} from '@ordzaar/ordit-sdk';
import { getAddresses as getLeatherAddresses } from '@ordzaar/ordit-sdk/leather';
import { getAddresses as getMagicEdenAddress } from '@ordzaar/ordit-sdk/magiceden';
import { getAddresses as getOKXAddresses } from '@ordzaar/ordit-sdk/okx';
import { getAddresses as getUnisatAddresses } from '@ordzaar/ordit-sdk/unisat';
import { getAddresses as getXverseAddresses } from '@ordzaar/ordit-sdk/xverse';
import { Chain, Network, useOrdConnect, Wallet } from '@ordzaar/ord-connect';
import { AddressFormat } from '@ordzaar/ordit-sdk';
// Extend Window interface to include wallet properties
declare global {
  interface Window {
    unisat?: {
      addListener: (event: string, callback: () => void) => void;
      removeListener: (event: string, callback: () => void) => void;
    };
  }
}

interface BiAddress<T> {
  payments: T | null;
  ordinals: T | null;
}
type BiAddressString = BiAddress<string>;
type BiAddressFormat = BiAddress<AddressFormat>;
type ConnectedWalletType = {
  address: BiAddressString;
  publicKey: BiAddressString;
  format: BiAddressFormat;
};

const WALLET_CHROME_EXTENSION_URL: Record<Wallet, string> = {
  [Wallet.OKX]: 'https://www.okx.com/web3',
  [Wallet.MAGICEDEN]: 'https://wallet.magiceden.io/',
  [Wallet.UNISAT]: 'https://unisat.io/download', // their www subdomain doesn't work
  [Wallet.XVERSE]: 'https://www.xverse.app/download',
  [Wallet.LEATHER]: 'https://leather.io/install-extension',
  [Wallet.PHANTOM]: 'https://phantom.app/download',
  [Wallet.OYL]: 'https://oyl.io/download',
};

const connectWallet = async (
  {
    network,
    wallet,
    chain = Chain.BITCOIN,
  }: { network: Network; wallet: string; chain?: Chain },
  { readOnly = false } = {}
): Promise<ConnectedWalletType> => {
  switch (wallet) {
    case Wallet.UNISAT: {
      const unisat = await getUnisatAddresses(network, chain, { readOnly });
      if (!unisat || unisat.length < 1) {
        throw new Error('Unisat via Ordit returned no addresses');
      }

      const unisatWallet = unisat[0];
      return {
        address: {
          ordinals: unisatWallet.address,
          payments: unisatWallet.address,
        },
        publicKey: {
          ordinals: unisatWallet.publicKey,
          payments: unisatWallet.publicKey,
        },
        format: {
          ordinals: unisatWallet.format,
          payments: unisatWallet.format,
        },
      };
    }
    case Wallet.XVERSE: {
      const xverse = await getXverseAddresses(network);
      if (!xverse || xverse.length < 1) {
        throw new Error('Xverse via Ordit returned no addresses');
      }

      // Xverse provides a nested segwit address by default for sending and receiving payments
      // Ledger wallets on Xverse will return a native segwit address for payments instead
      const paymentsAddress = xverse.find(
        (walletAddress) =>
          walletAddress.format === 'p2sh-p2wpkh' ||
          walletAddress.format === 'segwit'
      );

      if (!paymentsAddress) {
        throw new Error(
          'Xverse via Ordit did not return a P2SH or Segwit address'
        );
      }

      const ordinalsAddress = xverse.find(
        (walletAddress) => walletAddress.format === 'taproot'
      );

      if (!ordinalsAddress) {
        throw new Error('Xverse via Ordit did not return a Taproot address');
      }

      return {
        address: {
          ordinals: ordinalsAddress.address,
          payments: paymentsAddress.address,
        },
        publicKey: {
          ordinals: ordinalsAddress.publicKey,
          payments: paymentsAddress.publicKey,
        },
        format: {
          ordinals: ordinalsAddress.format,
          payments: paymentsAddress.format,
        },
      };
    }
    case Wallet.MAGICEDEN: {
      const magicEdenAddresses = await getMagicEdenAddress(network);
      if (!magicEdenAddresses || magicEdenAddresses.length < 1) {
        throw new Error('Magic Eden via Ordit returned no addresses');
      }

      // Magic Eden provides a segwit address by default for sending and receiving payments
      // Imported xverse wallets will return a p2sh address for payments by default instead
      const paymentsAddress = magicEdenAddresses.find(
        (walletAddress) =>
          walletAddress.format === 'segwit' ||
          walletAddress.format === 'p2sh-p2wpkh'
      );

      if (!paymentsAddress) {
        throw new Error(
          'Magic Eden via Ordit did not return a P2SH or Segwit address'
        );
      }

      const ordinalsAddress = magicEdenAddresses.find(
        (walletAddress) => walletAddress.format === 'taproot'
      );

      if (!ordinalsAddress) {
        throw new Error(
          'Magic Eden via Ordit did not return a Taproot address'
        );
      }

      return {
        address: {
          ordinals: ordinalsAddress.address,
          payments: paymentsAddress.address,
        },
        publicKey: {
          ordinals: ordinalsAddress.publicKey,
          payments: paymentsAddress.publicKey,
        },
        format: {
          ordinals: ordinalsAddress.format,
          payments: paymentsAddress.format,
        },
      };
    }
    case Wallet.LEATHER: {
      const leather = await getLeatherAddresses(network);
      if (!leather || leather.length < 1) {
        throw new Error('Leather via Ordit returned no addresses');
      }

      const paymentsAddress = leather.find(
        (walletAddress) => walletAddress.format === 'segwit'
      );
      if (!paymentsAddress) {
        throw new Error('Leather via Ordit did not return a Segwit address');
      }

      const ordinalsAddress = leather.find(
        (walletAddress) => walletAddress.format === 'taproot'
      );
      if (!ordinalsAddress) {
        throw new Error('Leather via Ordit did not return a Taproot address');
      }

      return {
        address: {
          ordinals: ordinalsAddress.address,
          payments: paymentsAddress.address,
        },
        publicKey: {
          ordinals: ordinalsAddress.publicKey,
          payments: paymentsAddress.publicKey,
        },
        format: {
          ordinals: ordinalsAddress.format,
          payments: paymentsAddress.format,
        },
      };
    }
    case Wallet.OKX: {
      const okx = await getOKXAddresses(network);
      if (!okx || okx.length < 1) {
        throw new Error('OKX via Ordit returned no addresses');
      }

      const okxWallet = okx[0];
      return {
        address: {
          ordinals: okxWallet.address,
          payments: okxWallet.address,
        },
        publicKey: {
          ordinals: okxWallet.publicKey,
          payments: okxWallet.publicKey,
        },
        format: {
          ordinals: okxWallet.format,
          payments: okxWallet.format,
        },
      };
    }
    default:
      throw new Error('Invalid wallet');
  }
};
/**
 * The "connect this wallet" action, for anything with a connect button.
 *
 * Restoring a remembered session on load is NOT done here — see
 * `useWalletAutoReconnect`, which is mounted once at the app root. Keeping it
 * out of this hook is what stops several copies of it racing each other.
 */
export function useConnect({
  onClose = () => {
    // Default no-op function
  },
  onError: onUserError = () => {
    // Default error handler
  },
}: {
  onClose?: () => void;
  onError?: (err: string) => void;
} = {}) {
  // Ensure the default value for the entire parameter is an empty object
  const {
    updateAddress,
    network,
    updateWallet,
    updatePublicKey,
    updateFormat,
    disconnectWallet,
    chain,
  } = useOrdConnect();

  const onError = useCallback(
    (
      walletProvider: Wallet,
      err:
        | BrowserWalletNotInstalledError
        | BrowserWalletRequestCancelledByUserError
        | Error
    ) => {
      onUserError(err.message ?? err.toString()); // Use the provided or default onError handler
      // Error while connecting to wallet
      disconnectWallet();

      if (err instanceof BrowserWalletNotInstalledError) {
        window.open(
          WALLET_CHROME_EXTENSION_URL[walletProvider],
          '_blank',
          'noopener,noreferrer'
        );
      }
    },
    [onUserError, disconnectWallet]
  );

  const onConnect = useCallback(
    async (wallet: Wallet, { readOnly = false } = {}) => {
      try {
        const { address, publicKey, format } = await connectWallet(
          { network, wallet, chain },
          { readOnly }
        );
        updateAddress({
          ordinals: address.ordinals,
          payments: address.payments,
        });
        updatePublicKey({
          ordinals: publicKey.ordinals,
          payments: publicKey.payments,
        });
        updateWallet(wallet);
        updateFormat({
          ordinals: format.ordinals,
          payments: format.payments,
        });
        onClose(); // Use the provided or default onClose handler
        return true;
      } catch (err) {
        onError(wallet, err as Error);
        return false;
      }
    },
    [
      network,
      chain,
      updateAddress,
      updatePublicKey,
      updateFormat,
      updateWallet,
      onError,
      onClose,
    ]
  );

  return { connectWallet: onConnect };
}
