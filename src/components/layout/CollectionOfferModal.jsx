import React, { useState, useEffect, useCallback } from 'react';
import {
  useOrdConnect,
  useSign,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import WalletStatus from './WalletStatus';
import { useWalletDisconnectState } from '../../hooks/useLocalStorage';
import {
  signPsbtWithProxyWallet,
  derivePublicKeyFromPrivateKey,
  generateAddressFromPublicKey,
} from '../../utils/bitcoinUtils';
import { getMempoolTxUrl } from '../../utils/mempoolProvider';
import { fetchSatflowCollectionBids } from '../../utils/autoTradingUtils';

/** Price in sats from a Satflow activity/bids row */
const getSatflowBidPriceSats = (bid) => {
  if (!bid) return 0;
  const u = bid.unitPrice ?? bid.price;
  if (typeof u === 'number' && u > 0) return u;
  const p = bid.bid && typeof bid.bid.price === 'number' ? bid.bid.price : 0;
  return p > 0 ? p : 0;
};

function formatDetailValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function DetailRows({ data, excludeKeys = [] }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(
    ([k]) => !excludeKeys.includes(k)
  );
  return entries.map(([key, value]) => (
    <div
      key={key}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 160px) 1fr',
        gap: '8px',
        fontSize: '11px',
        marginBottom: '6px',
        alignItems: 'start',
      }}
    >
      <span
        style={{
          color: '#a0aec0',
          wordBreak: 'break-word',
          fontWeight: 500,
        }}
      >
        {key}
      </span>
      <span
        style={{
          color: '#e2e8f0',
          fontFamily:
            value !== null && typeof value === 'object'
              ? 'ui-monospace, monospace'
              : 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: 1.35,
        }}
      >
        {formatDetailValue(value)}
      </span>
    </div>
  ));
}

// Inner component that uses the hooks
const CollectionOfferModalInner = ({
  glEventHub,
  collectionSymbol,
  isOpen,
  onClose,
}) => {
  const [existingOffers, setExistingOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFetchingPsbt, setIsFetchingPsbt] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  const [psbtWalletInfo, setPsbtWalletInfo] = useState(null);

  // Accept offer state
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [userCollectionItems, setUserCollectionItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isFulfillingOffer, setIsFulfillingOffer] = useState(false);
  const [isFetchingFulfillPsbt, setIsFetchingFulfillPsbt] = useState(false);
  const [isSigningFulfillPsbt, setIsSigningFulfillPsbt] = useState(false);
  const [isSubmittingFulfill, setIsSubmittingFulfill] = useState(false);
  const [fulfillResponse, setFulfillResponse] = useState(null);
  const [bidsTotal, setBidsTotal] = useState(0);

  const {
    address: connectedAddress,
    publicKey: connectedPublicKey,
    format: connectedFormat,
    wallet: connectedWallet,
    network: connectedNetwork,
  } = useOrdConnect();

  const { sign, error: signError, loading: signLoading } = useSign();
  const isDisconnected = useWalletDisconnectState();

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Restore selected wallet state on mount (only once)
  useEffect(() => {
    const storedWallet = localStorage.getItem('selected-proxy-wallet');
    if (storedWallet) {
      try {
        const walletData = JSON.parse(storedWallet);
        const restoredWallet = {
          index: walletData.index,
          address: walletData.address,
          publicKey: walletData.publicKey,
          privateKey: walletData.privateKey,
        };
        setSelectedWallet(restoredWallet);
        setUseProxyWallet(true);
      } catch (err) {
        console.error('Error restoring wallet from localStorage:', err);
      }
    }
    // Don't emit request-wallet-state here to avoid infinite loops
    // Wallet state will be set via wallet-selected events
  }, []); // Empty dependency array - only run once on mount

  // Listen for wallet selection events
  useEffect(() => {
    if (!glEventHub) return;

    const handleWalletSelect = (wallet) => {
      // Only update if wallet actually changed to prevent infinite loops
      if (
        wallet &&
        (!selectedWallet || selectedWallet.index !== wallet.index)
      ) {
        console.log('CollectionOfferModal: Wallet selected:', wallet);
        setSelectedWallet(wallet);
        setUseProxyWallet(true);
      }
    };

    const handleConnectionChange = (newConnectionState) => {
      if (!newConnectionState.isConnected) {
        setSelectedWallet(null);
        setUseProxyWallet(false);
        setOfferPrice('');
        setError('');
        setSuccess('');
        setPsbtWalletInfo(null);
        localStorage.removeItem('selected-proxy-wallet');
      }
    };

    const handleDisconnect = () => {
      setSelectedWallet(null);
      setUseProxyWallet(false);
      setOfferPrice('');
      setError('');
      setSuccess('');
      setPsbtWalletInfo(null);
      localStorage.removeItem('selected-proxy-wallet');
    };

    glEventHub.on('wallet-selected', handleWalletSelect);
    glEventHub.on('wallet-connection-changed', handleConnectionChange);
    glEventHub.on('wallet-disconnected', handleDisconnect);

    return () => {
      glEventHub.off('wallet-selected', handleWalletSelect);
      glEventHub.off('wallet-connection-changed', handleConnectionChange);
      glEventHub.off('wallet-disconnected', handleDisconnect);
    };
  }, [glEventHub, selectedWallet]);

  // Get the active wallet address and public key
  const getActiveWalletInfo = useCallback(() => {
    if (useProxyWallet && selectedWallet) {
      try {
        const derivedPublicKey = derivePublicKeyFromPrivateKey(
          selectedWallet.privateKey,
          connectedNetwork || 'mainnet'
        );

        let addressToUse = selectedWallet.address;

        if (
          selectedWallet.publicKey &&
          selectedWallet.publicKey.toLowerCase() !==
            derivedPublicKey.toLowerCase()
        ) {
          try {
            addressToUse = generateAddressFromPublicKey(derivedPublicKey);
          } catch (err) {
            console.error('Error regenerating address from public key:', err);
            addressToUse = selectedWallet.address;
          }
        }

        return {
          address: addressToUse,
          publicKey: derivedPublicKey,
        };
      } catch (err) {
        console.error('Error deriving public key from private key:', err);
        return {
          address: selectedWallet.address,
          publicKey: selectedWallet.publicKey,
        };
      }
    } else {
      return {
        address: connectedAddress?.ordinals,
        publicKey: connectedPublicKey?.ordinals,
      };
    }
  }, [
    useProxyWallet,
    selectedWallet,
    connectedNetwork,
    connectedAddress,
    connectedPublicKey,
  ]);

  // Fetch collection bids from Satflow GET /v1/activity/bids (proxied)
  const fetchExistingOffers = useCallback(async () => {
    if (!collectionSymbol) return;

    setLoadingOffers(true);
    setError('');

    try {
      const { bids, total } = await fetchSatflowCollectionBids(
        collectionSymbol,
        {
          bypassCache: true,
          pageSize: 100,
          page: 1,
          timeRange: '30d',
          sortBy: 'unitPrice',
          sortDirection: 'desc',
        }
      );

      const offersArray = bids.map((b) => ({
        ...b,
        _satflowActivityBid: true,
      }));

      setExistingOffers(offersArray);
      setBidsTotal(total);

      if (offersArray.length > 0) {
        const topSats = getSatflowBidPriceSats(offersArray[0]);
        if (topSats > 0) {
          setOfferPrice((topSats / 100000000).toFixed(8));
        } else {
          setOfferPrice('');
        }
      } else {
        setOfferPrice('');
      }
    } catch (err) {
      console.error('Error fetching Satflow collection bids:', err);
      setError(`Failed to fetch collection bids: ${err.message}`);
      setExistingOffers([]);
      setBidsTotal(0);
      setOfferPrice('');
    } finally {
      setLoadingOffers(false);
    }
  }, [collectionSymbol]);

  // Fetch existing offers when modal opens
  useEffect(() => {
    if (isOpen && collectionSymbol) {
      fetchExistingOffers();
    } else {
      setExistingOffers([]);
      setBidsTotal(0);
      setOfferPrice('');
      setError('');
      setSuccess('');
      setSelectedOffer(null);
      setUserCollectionItems([]);
      setSelectedItem(null);
      setFulfillResponse(null);
    }
  }, [isOpen, collectionSymbol, fetchExistingOffers]);

  // Handle sign error changes
  useEffect(() => {
    if (signError) {
      setError(signError);
    }
  }, [signError]);

  /**
   * Place a Satflow collection bid: backend tRPC non-custodial deposit PSBT → sign → POST /v1/bid/place
   * Proxied: /api/satflow-create-psbt-non-custodial-bid-deposit, /api/satflow-bid-place
   */
  const handleSubmitOffer = async () => {
    try {
      setError('');
      setSuccess('');
      setIsFetchingPsbt(true);

      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (!collectionSymbol) {
        throw new Error('Collection symbol is required');
      }

      if (!offerPrice || parseFloat(offerPrice) <= 0) {
        throw new Error('Please enter a valid price in BTC');
      }

      const walletInfo = getActiveWalletInfo();
      const { publicKey } = walletInfo;
      if (!publicKey) {
        throw new Error('Could not get wallet public key');
      }

      let paymentAddress = walletInfo.address;
      let ordinalsReceiveAddress = walletInfo.address;
      if (!useProxyWallet && connectedAddress) {
        if (connectedAddress.payment) {
          paymentAddress = connectedAddress.payment;
        }
        if (connectedAddress.ordinals) {
          ordinalsReceiveAddress = connectedAddress.ordinals;
        }
      }

      if (!paymentAddress || !ordinalsReceiveAddress) {
        throw new Error('Could not resolve payment / ordinals addresses');
      }

      setPsbtWalletInfo({
        address: paymentAddress,
        publicKey,
        useProxyWallet,
      });

      const priceSats = Math.round(parseFloat(offerPrice) * 100000000);
      const quantity = 1;
      const depositAmount = priceSats * quantity;

      const now = Date.now();
      const bidExpiry = now + expirationDays * 24 * 60 * 60 * 1000;

      // Step 1: Unsigned deposit PSBT from backend.satflow.com (proxied)
      const depositRes = await fetch(
        '/api/satflow-create-psbt-non-custodial-bid-deposit',
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-wallet-address': paymentAddress,
          },
          body: JSON.stringify({
            json: {
              senderAddress: paymentAddress,
              senderPublicKey: publicKey,
              receiveAddress: ordinalsReceiveAddress,
              amount: depositAmount,
              allowedPaymentOutpoints: [],
            },
          }),
        }
      );

      const depositText = await depositRes.text();
      let depositData;
      try {
        depositData = depositText ? JSON.parse(depositText) : {};
      } catch {
        throw new Error(
          `Invalid JSON from deposit PSBT endpoint: ${depositText?.slice(0, 200)}`
        );
      }

      if (!depositRes.ok) {
        const msg =
          depositData?.error?.message ||
          depositData?.message ||
          depositText ||
          `HTTP ${depositRes.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const trpcErr = Array.isArray(depositData)
        ? depositData[0]?.error
        : depositData?.error;
      if (trpcErr) {
        const em =
          trpcErr.message || trpcErr.json?.message || JSON.stringify(trpcErr);
        throw new Error(typeof em === 'string' ? em : JSON.stringify(em));
      }

      const depositJson =
        (Array.isArray(depositData) && depositData[0]?.result?.data?.json) ||
        depositData?.result?.data?.json ||
        depositData?.[0]?.result?.data?.json;

      if (!depositJson) {
        throw new Error('Deposit PSBT response missing result.data.json');
      }

      const unsignedPsbtValue =
        depositJson.unsignedPSBTWithFeeBase64 ||
        depositJson.unsignedPSBTBase64 ||
        '';

      if (!unsignedPsbtValue || typeof unsignedPsbtValue !== 'string') {
        throw new Error('No unsigned PSBT (base64) in deposit response');
      }

      setIsFetchingPsbt(false);
      setIsSigning(true);

      // Step 2: Sign PSBT (proxy or connected wallet)
      let signedPsbtValue = '';
      if (useProxyWallet && selectedWallet) {
        if (!selectedWallet.privateKey) {
          throw new Error('Proxy wallet private key not available');
        }

        const currentWalletInfo = getActiveWalletInfo();

        const result = await signPsbtWithProxyWallet(
          unsignedPsbtValue.trim(),
          selectedWallet.privateKey,
          connectedNetwork || 'mainnet',
          {
            finalize: false,
            extractTx: false,
            expectedPublicKey: selectedWallet.publicKey,
            walletAddress: currentWalletInfo.address,
          }
        );

        if (result && result.base64) {
          signedPsbtValue = result.base64;
        } else {
          throw new Error(
            'Failed to sign PSBT with proxy wallet - no result returned'
          );
        }
      } else {
        const walletAddressForSigning = connectedAddress?.ordinals;
        if (!walletAddressForSigning) {
          throw new Error('Could not get connected wallet address for signing');
        }

        const result = await sign(
          walletAddressForSigning,
          unsignedPsbtValue.trim(),
          {
            finalize: false,
            extractTx: false,
          }
        );

        if (result && result.base64) {
          signedPsbtValue = result.base64;
        } else if (result && result.hex) {
          const hexToBase64 = (hex) => {
            const bytes = new Uint8Array(
              hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
            );
            return btoa(
              Array.from(bytes)
                .map((byte) => String.fromCharCode(byte))
                .join('')
            );
          };
          signedPsbtValue = hexToBase64(result.hex);
        } else {
          throw new Error('Failed to sign PSBT - no result returned');
        }
      }

      if (!signedPsbtValue) {
        throw new Error('Failed to sign PSBT');
      }

      setIsSigning(false);
      setIsSubmitting(true);

      // Step 3: POST /v1/bid/place (proxied)
      const placePayload = {
        metaType: 'ordinals',
        price: priceSats,
        collectionSlug: collectionSymbol,
        bidderAddress: paymentAddress,
        bidderTokenReceiveAddress: ordinalsReceiveAddress,
        bidderAddressPublicKey: publicKey,
        quantity,
        timestamp: now,
        bidExpiry,
        signedBiddingMessage: signedPsbtValue,
        feeRate: 'halfHourFee',
      };

      const placeRes = await fetch('/api/satflow-bid-place', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(placePayload),
      });

      const placeText = await placeRes.text();
      let placeData;
      try {
        placeData = placeText ? JSON.parse(placeText) : {};
      } catch {
        throw new Error(
          `Invalid JSON from bid/place: ${placeText?.slice(0, 300)}`
        );
      }

      if (!placeRes.ok) {
        const apiErr =
          placeData?.error ||
          placeData?.message ||
          (typeof placeData?.data === 'string' ? placeData.data : null) ||
          placeText;
        throw new Error(
          typeof apiErr === 'string' ? apiErr : JSON.stringify(apiErr)
        );
      }

      if (placeData.success === false) {
        const apiErr = placeData.error || placeData.message || 'Bid failed';
        throw new Error(
          typeof apiErr === 'string' ? apiErr : JSON.stringify(apiErr)
        );
      }

      const okMsg =
        placeData?.data?.message ||
        placeData?.message ||
        'Bid placed successfully';
      setSuccess(`✓ ${okMsg}`);
      setTimeout(() => {
        fetchExistingOffers();
      }, 1000);
    } catch (err) {
      console.error('Error placing Satflow collection bid:', err);
      setError(err.message || 'Failed to place bid');
    } finally {
      setIsFetchingPsbt(false);
      setIsSigning(false);
      setIsSubmitting(false);
    }
  };

  const formatPrice = (priceInSats) => {
    if (!priceInSats && priceInSats !== 0) return 'N/A';
    const btcPrice = priceInSats / 100000000;
    return btcPrice.toFixed(8);
  };

  const formatString = (str) => {
    if (str && str.length > 14) {
      return `${str.slice(0, 7)}...${str.slice(-7)}`;
    }
    return str || '';
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  const handleWalletSourceChange = (useProxy) => {
    setUseProxyWallet(useProxy);
  };

  // Get tokenId from item - try multiple possible field names
  const getTokenId = useCallback((item) => {
    if (!item) return null;
    // Try different possible field names for token ID
    return (
      item.tokenId ||
      item.id ||
      item.inscriptionId ||
      (item.inscriptionNumber
        ? `${item.txid || item.genesisTransaction || ''}i${item.inscriptionNumber}`
        : null)
    );
  }, []);

  // Fetch user's collection items
  const fetchUserCollectionItems = useCallback(async () => {
    if (!collectionSymbol || !isWalletConnected) {
      setUserCollectionItems([]);
      return;
    }

    setLoadingItems(true);
    setError('');

    try {
      const walletInfo = getActiveWalletInfo();
      if (!walletInfo.address) {
        throw new Error('No wallet address available');
      }

      const queryParams = new URLSearchParams();
      queryParams.append('ownerAddress', walletInfo.address);
      queryParams.append('collectionSymbol', collectionSymbol);
      queryParams.append('showAll', 'true');
      queryParams.append('limit', '100');

      const apiUrl = `/api/wallet-tokens?${queryParams.toString()}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }

      const data = await response.json();
      const items = data.tokens || [];

      // Filter to only items from this collection and that are not listed
      const collectionItems = items.filter(
        (item) => item.collectionSymbol === collectionSymbol && !item.listed
      );

      setUserCollectionItems(collectionItems);
      console.log(
        `Found ${collectionItems.length} items in collection ${collectionSymbol}`
      );
    } catch (err) {
      console.error('Error fetching user collection items:', err);
      setError(`Failed to fetch your items: ${err.message}`);
      setUserCollectionItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [collectionSymbol, isWalletConnected, getActiveWalletInfo]);

  // Handle offer selection (Magic Eden accept loads wallet items; Satflow bids are view-only here)
  const handleOfferSelect = (offer) => {
    setSelectedOffer(offer);
    setSelectedItem(null);
    setError('');
    setSuccess('');
    setFulfillResponse(null);

    if (isWalletConnected && !offer._satflowActivityBid) {
      fetchUserCollectionItems();
    } else {
      setUserCollectionItems([]);
    }
  };

  // Handle fulfill offer (3-step process)
  const handleFulfillOffer = async () => {
    try {
      setError('');
      setSuccess('');
      setIsFulfillingOffer(true);
      setIsFetchingFulfillPsbt(true);

      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (!selectedOffer) {
        throw new Error('Please select an offer to fulfill');
      }

      if (selectedOffer._satflowActivityBid) {
        throw new Error(
          'Satflow collection bids cannot be fulfilled via Magic Eden from this modal.'
        );
      }

      if (!selectedItem) {
        throw new Error('Please select an item from your collection');
      }

      const tokenId = getTokenId(selectedItem);
      if (!tokenId) {
        throw new Error('Could not determine token ID from selected item');
      }

      const walletInfo = getActiveWalletInfo();
      if (!walletInfo.address || !walletInfo.publicKey) {
        throw new Error('Could not get wallet address or public key');
      }

      // Store wallet info for consistency
      setPsbtWalletInfo({
        address: walletInfo.address,
        publicKey: walletInfo.publicKey,
        useProxyWallet,
      });

      // Determine address types
      let takerOrdinalsAddressType = 'p2tr';
      let takerPaymentAddressType = 'p2tr';

      if (useProxyWallet && selectedWallet) {
        // Proxy wallets use P2TR
        takerOrdinalsAddressType = 'p2tr';
        takerPaymentAddressType = 'p2tr';
      } else if (connectedFormat?.ordinals) {
        const format = connectedFormat.ordinals.toLowerCase();
        if (format.includes('p2pkh') || format.includes('legacy')) {
          takerOrdinalsAddressType = 'p2pkh';
          takerPaymentAddressType = 'p2pkh';
        } else if (format.includes('p2wpkh') || format.includes('segwit')) {
          takerOrdinalsAddressType = 'p2wpkh';
          takerPaymentAddressType = 'p2wpkh';
        } else if (format.includes('p2tr') || format.includes('taproot')) {
          takerOrdinalsAddressType = 'p2tr';
          takerPaymentAddressType = 'p2tr';
        }
      } else if (walletInfo.address) {
        // Fallback: determine from address prefix
        if (
          walletInfo.address.startsWith('bc1p') ||
          walletInfo.address.startsWith('tb1p') ||
          walletInfo.address.startsWith('bcrt1p')
        ) {
          takerOrdinalsAddressType = 'p2tr';
          takerPaymentAddressType = 'p2tr';
        } else if (
          walletInfo.address.startsWith('bc1') ||
          walletInfo.address.startsWith('tb1') ||
          walletInfo.address.startsWith('bcrt1')
        ) {
          takerOrdinalsAddressType = 'p2wpkh';
          takerPaymentAddressType = 'p2wpkh';
        } else {
          takerOrdinalsAddressType = 'p2pkh';
          takerPaymentAddressType = 'p2pkh';
        }
      }

      const priceSats = selectedOffer.price?.amount || 0;

      // Step 1: Fetch fulfill PSBT
      const isProduction =
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';

      const fulfillPayload = {
        offers: {
          [selectedOffer.id]: {
            priceSats: priceSats,
            tokenId: tokenId,
          },
        },
        collectionSymbol: collectionSymbol,
        feeSatsPerVbyte: 1,
        takerOrdinalsPublicKey: walletInfo.publicKey,
        takerOrdinalsAddressType: takerOrdinalsAddressType,
        takerPaymentPublicKey: walletInfo.publicKey,
        takerPaymentAddressType: takerPaymentAddressType,
        takerWalletSource: connectedWallet?.toLowerCase() || 'unisat',
      };

      const fulfillPsbtUrl = isProduction
        ? '/api/collection-offers-fulfill'
        : 'https://api-mainnet.magiceden.us/v2/ord/btc/collection-offers/psbt/fulfill';

      const fulfillPsbtResponse = await fetch(fulfillPsbtUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          ...(isProduction
            ? {}
            : {
                origin: 'https://magiceden.us',
                referer: 'https://magiceden.us/',
              }),
        },
        body: JSON.stringify(fulfillPayload),
      });

      if (!fulfillPsbtResponse.ok) {
        const errorText = await fulfillPsbtResponse.text();
        let errorMessage = `HTTP error! status: ${fulfillPsbtResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && Array.isArray(errorJson.error)) {
            const errorMessages = errorJson.error
              .map((err) => err.message || JSON.stringify(err))
              .join(', ');
            errorMessage = errorMessages || errorMessage;
          } else if (errorJson.error && typeof errorJson.error === 'string') {
            errorMessage = errorJson.error;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const fulfillPsbtData = await fulfillPsbtResponse.json();

      // Check if offer is valid
      if (
        fulfillPsbtData.invalidOfferIds &&
        fulfillPsbtData.invalidOfferIds.length > 0
      ) {
        throw new Error(
          `Offer is invalid or no longer available: ${fulfillPsbtData.invalidOfferIds.join(', ')}`
        );
      }

      if (!fulfillPsbtData.psbtBase64) {
        throw new Error('No PSBT returned from fulfill API');
      }

      const unsignedFulfillPsbt = fulfillPsbtData.psbtBase64;

      setIsFetchingFulfillPsbt(false);
      setIsSigningFulfillPsbt(true);

      // Step 2: Sign PSBT
      let signedFulfillPsbt = '';
      if (useProxyWallet && selectedWallet) {
        if (!selectedWallet.privateKey) {
          throw new Error('Proxy wallet private key not available');
        }

        const currentWalletInfo = getActiveWalletInfo();

        const result = await signPsbtWithProxyWallet(
          unsignedFulfillPsbt.trim(),
          selectedWallet.privateKey,
          connectedNetwork || 'mainnet',
          {
            finalize: false, // Don't finalize - Magic Eden needs to sign buyer's inputs
            extractTx: false,
            expectedPublicKey: selectedWallet.publicKey,
            walletAddress: currentWalletInfo.address,
          }
        );

        if (result && result.base64) {
          signedFulfillPsbt = result.base64;
          console.log('Fulfill PSBT signed successfully with proxy wallet');
        } else {
          throw new Error(
            'Failed to sign fulfill PSBT with proxy wallet - no result returned'
          );
        }
      } else {
        const walletAddressForSigning = connectedAddress?.ordinals;
        if (!walletAddressForSigning) {
          throw new Error('Could not get connected wallet address for signing');
        }

        const result = await sign(
          walletAddressForSigning,
          unsignedFulfillPsbt.trim(),
          {
            finalize: false, // Don't finalize - Magic Eden needs to sign buyer's inputs
            extractTx: false,
          }
        );

        if (result && result.base64) {
          signedFulfillPsbt = result.base64;
          console.log('Fulfill PSBT signed successfully with connected wallet');
        } else if (result && result.hex) {
          const hexToBase64 = (hex) => {
            const bytes = new Uint8Array(
              hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
            );
            return btoa(
              Array.from(bytes)
                .map((byte) => String.fromCharCode(byte))
                .join('')
            );
          };
          signedFulfillPsbt = hexToBase64(result.hex);
        } else {
          throw new Error('Failed to sign fulfill PSBT - no result returned');
        }
      }

      if (!signedFulfillPsbt) {
        throw new Error('Failed to sign fulfill PSBT');
      }

      setIsSigningFulfillPsbt(false);
      setIsSubmittingFulfill(true);

      // Step 3: Submit fulfill
      const walletAddressToUse = psbtWalletInfo?.address || walletInfo.address;
      const walletPublicKeyToUse =
        psbtWalletInfo?.publicKey || walletInfo.publicKey;

      if (!walletAddressToUse || !walletPublicKeyToUse) {
        throw new Error('Could not get wallet address or public key');
      }

      const submitFulfillPayload = {
        collectionSymbol: collectionSymbol,
        offers: {
          [selectedOffer.id]: {
            priceSats: priceSats,
            tokenId: tokenId,
          },
        },
        signedPsbtBase64: signedFulfillPsbt,
        takerOrdinalsPublicKey: walletPublicKeyToUse,
        takerOrdinalsAddressType: takerOrdinalsAddressType,
        takerPaymentPublicKey: walletPublicKeyToUse,
        takerPaymentAddressType: takerPaymentAddressType,
      };

      const submitFulfillUrl = isProduction
        ? '/api/collection-offers-fulfill-submit'
        : 'https://api-mainnet.magiceden.us/v2/ord/btc/collection-offers/psbt/fulfill/submit';

      const submitFulfillResponse = await fetch(submitFulfillUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          ...(isProduction
            ? {}
            : {
                origin: 'https://magiceden.us',
                referer: 'https://magiceden.us/',
              }),
        },
        body: JSON.stringify(submitFulfillPayload),
      });

      if (!submitFulfillResponse.ok) {
        const errorText = await submitFulfillResponse.text();
        let errorMessage = `HTTP error! status: ${submitFulfillResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && Array.isArray(errorJson.error)) {
            const errorMessages = errorJson.error
              .map((err) => err.message || JSON.stringify(err))
              .join(', ');
            errorMessage = errorMessages || errorMessage;
          } else if (errorJson.error && typeof errorJson.error === 'string') {
            errorMessage = errorJson.error;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const submitFulfillData = await submitFulfillResponse.json();
      setFulfillResponse(submitFulfillData);

      if (submitFulfillData.fulfillTxId) {
        setSuccess(
          `✓ Offer fulfilled successfully! Transaction ID: ${submitFulfillData.fulfillTxId}`
        );
        // Refresh offers and items
        setTimeout(() => {
          fetchExistingOffers();
          fetchUserCollectionItems();
        }, 1000);
      } else {
        setSuccess('✓ Offer fulfilled successfully!');
      }
    } catch (err) {
      console.error('Error fulfilling collection offer:', err);
      setError(err.message || 'Failed to fulfill collection offer');
    } finally {
      setIsFulfillingOffer(false);
      setIsFetchingFulfillPsbt(false);
      setIsSigningFulfillPsbt(false);
      setIsSubmittingFulfill(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a202c',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '920px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '2px solid #4a5568',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#f7fafc',
              margin: 0,
            }}
          >
            Collection Offer: {collectionSymbol}
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a0aec0',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Wallet Status */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={handleWalletSourceChange}
        />

        {/* Collection bids from Satflow */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#f7fafc',
            }}
          >
            Collection bids (Satflow)
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: '#a0aec0',
              marginBottom: '12px',
              lineHeight: 1.45,
            }}
          >
            Loaded from{' '}
            <code style={{ fontSize: '11px' }}>/v1/activity/bids</code> via
            proxy. Expand &quot;Full bid JSON&quot; for the complete payload.
            Accepting these bids through Magic Eden in this modal is not
            supported — use Satflow to sell into a bid.
          </p>
          {loadingOffers ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#a0aec0',
              }}
            >
              Loading bids…
            </div>
          ) : existingOffers.length > 0 ? (
            <div
              style={{
                backgroundColor: '#2d3748',
                borderRadius: '8px',
                padding: '12px',
                maxHeight: 'min(480px, 55vh)',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#718096',
                  marginBottom: '10px',
                }}
              >
                Showing {existingOffers.length} bid(s)
                {bidsTotal > 0 ? ` · API total: ${bidsTotal}` : ''}
              </div>
              {existingOffers.map((offer, index) => {
                const priceSats = getSatflowBidPriceSats(offer);
                const bidder = offer.bid?.bidderAddress || '';
                const expiryRaw = offer.expiry ?? offer.bid?.expiry;
                const expiryLabel =
                  expiryRaw && !Number.isNaN(Date.parse(expiryRaw))
                    ? new Date(expiryRaw).toLocaleString()
                    : expiryRaw
                      ? String(expiryRaw)
                      : '—';
                const inscriptionId = offer.bid?.inscriptionId || '—';
                const attr = offer.bid?.attribute;

                return (
                  <div
                    key={offer.id || index}
                    onClick={() => handleOfferSelect(offer)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOfferSelect(offer);
                      }
                    }}
                    style={{
                      padding: '12px',
                      marginBottom:
                        index < existingOffers.length - 1 ? '12px' : '0',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedOffer?.id === offer.id ? '#4a5568' : '#1a202c',
                      borderRadius: '8px',
                      border:
                        selectedOffer?.id === offer.id
                          ? '1px solid #ed8936'
                          : '1px solid #4a5568',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 200px' }}>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#ed8936',
                            marginBottom: '6px',
                          }}
                        >
                          {formatPrice(priceSats)} BTC
                        </div>
                        <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                          <strong style={{ color: '#e2e8f0' }}>Bidder: </strong>
                          {bidder || '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                          <strong style={{ color: '#e2e8f0' }}>
                            Activity id:{' '}
                          </strong>
                          {formatString(offer.id || '')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                          <strong style={{ color: '#e2e8f0' }}>Expiry: </strong>
                          {expiryLabel}
                        </div>
                        <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                          <strong style={{ color: '#e2e8f0' }}>
                            Inscription:{' '}
                          </strong>
                          {typeof inscriptionId === 'string' &&
                          inscriptionId.length > 20
                            ? formatString(inscriptionId)
                            : inscriptionId}
                        </div>
                        {attr && (
                          <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                            <strong style={{ color: '#e2e8f0' }}>
                              Trait filter:{' '}
                            </strong>
                            {attr.trait_type}: {String(attr.value)}
                          </div>
                        )}
                      </div>
                    </div>

                    <details
                      style={{ marginTop: '12px' }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#63b3ed',
                          userSelect: 'none',
                        }}
                      >
                        Structured fields (activity + bid + runes)
                      </summary>
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px',
                          backgroundColor: '#2d3748',
                          borderRadius: '6px',
                          maxHeight: '240px',
                          overflow: 'auto',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#f7fafc',
                            marginBottom: '8px',
                          }}
                        >
                          Activity (top-level)
                        </div>
                        <DetailRows
                          data={offer}
                          excludeKeys={['bid', 'runes']}
                        />
                        {offer.bid && (
                          <>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#f7fafc',
                                margin: '14px 0 8px',
                              }}
                            >
                              bid
                            </div>
                            <DetailRows data={offer.bid} excludeKeys={[]} />
                          </>
                        )}
                        {offer.runes != null && (
                          <>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#f7fafc',
                                margin: '14px 0 8px',
                              }}
                            >
                              runes
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                fontSize: '10px',
                                color: '#e2e8f0',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                              }}
                            >
                              {formatDetailValue(offer.runes)}
                            </pre>
                          </>
                        )}
                      </div>
                    </details>

                    <details
                      style={{ marginTop: '8px' }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#63b3ed',
                          userSelect: 'none',
                        }}
                      >
                        Full bid JSON
                      </summary>
                      <pre
                        style={{
                          marginTop: '8px',
                          padding: '10px',
                          backgroundColor: '#1a202c',
                          borderRadius: '6px',
                          fontSize: '10px',
                          color: '#cbd5e0',
                          maxHeight: '280px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(offer, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#a0aec0',
                backgroundColor: '#2d3748',
                borderRadius: '8px',
              }}
            >
              No bids found for this collection in the selected time range.
            </div>
          )}
        </div>

        {/* Selected Satflow bid — detail panel (no Magic Eden fulfill) */}
        {selectedOffer && selectedOffer._satflowActivityBid && (
          <div
            style={{
              marginBottom: '24px',
              padding: '14px',
              backgroundColor: '#2c5282',
              borderRadius: '8px',
              border: '1px solid #4299e1',
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#f7fafc',
              }}
            >
              Selected bid summary
            </h3>
            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
              <div>
                Price:{' '}
                <strong>
                  {formatPrice(getSatflowBidPriceSats(selectedOffer))}
                </strong>{' '}
                BTC
              </div>
              <div style={{ marginTop: '4px' }}>
                Bidder: {selectedOffer.bid?.bidderAddress || '—'}
              </div>
              <div style={{ marginTop: '4px' }}>
                Use Satflow to fulfill this bid; this app does not submit
                Satflow bid fills yet.
              </div>
            </div>
          </div>
        )}

        {/* Accept Offer Section (Magic Eden offers only) */}
        {selectedOffer &&
          isWalletConnected &&
          !selectedOffer._satflowActivityBid && (
            <div style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#f7fafc',
                }}
              >
                Accept Offer: {formatPrice(selectedOffer.price?.amount || 0)}{' '}
                BTC
              </h3>

              {/* Selected Offer Info */}
              <div
                style={{
                  backgroundColor: '#2d3748',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#a0aec0',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                      Offer Price:
                    </span>{' '}
                    <span style={{ color: '#ed8936', fontWeight: '600' }}>
                      {formatPrice(selectedOffer.price?.amount || 0)} BTC
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                      Expires:
                    </span>{' '}
                    {new Date(selectedOffer.expiresAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                      Maker:
                    </span>{' '}
                    {formatString(selectedOffer.maker || '')}
                  </div>
                  <div>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                      Offer ID:
                    </span>{' '}
                    {formatString(selectedOffer.id || '')}
                  </div>
                </div>
              </div>

              {/* Select Item Section */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#e2e8f0',
                    marginBottom: '8px',
                  }}
                >
                  Select Item from Your Collection:
                </label>

                {loadingItems ? (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#a0aec0',
                      backgroundColor: '#2d3748',
                      borderRadius: '8px',
                    }}
                  >
                    Loading your items...
                  </div>
                ) : userCollectionItems.length > 0 ? (
                  <div
                    style={{
                      backgroundColor: '#2d3748',
                      borderRadius: '8px',
                      padding: '12px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    {userCollectionItems.map((item, index) => {
                      const itemTokenId = getTokenId(item);
                      const isSelected =
                        selectedItem &&
                        getTokenId(selectedItem) === itemTokenId;

                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedItem(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            marginBottom:
                              index < userCollectionItems.length - 1
                                ? '8px'
                                : '0',
                            backgroundColor: isSelected
                              ? '#4a5568'
                              : 'transparent',
                            border: isSelected
                              ? '2px solid #ed8936'
                              : '2px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = '#3a4558';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }
                          }}
                        >
                          {/* Item Image */}
                          <div
                            style={{
                              width: '60px',
                              height: '60px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              backgroundColor: '#1a202c',
                              flexShrink: 0,
                            }}
                          >
                            {item.contentURI || item.contentPreviewURI ? (
                              item.contentType === 'text/html' ||
                              item.contentType?.includes('text/html') ||
                              item.contentType?.includes('html') ? (
                                <iframe
                                  src={
                                    item.contentURI || item.contentPreviewURI
                                  }
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                  }}
                                  title={
                                    item.meta?.name ||
                                    `Item #${item.inscriptionNumber}`
                                  }
                                  sandbox="allow-scripts allow-same-origin"
                                />
                              ) : (
                                <img
                                  src={
                                    item.contentURI || item.contentPreviewURI
                                  }
                                  alt={
                                    item.meta?.name ||
                                    `Item #${item.inscriptionNumber}`
                                  }
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )
                            ) : (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '24px',
                                }}
                              >
                                🖼️
                              </div>
                            )}
                          </div>

                          {/* Item Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#f7fafc',
                                marginBottom: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.meta?.name ||
                                item.displayName ||
                                `#${item.inscriptionNumber || 'Unknown'}`}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#a0aec0',
                              }}
                            >
                              Inscription:{' '}
                              {formatNumber(item.inscriptionNumber) || 'N/A'}
                            </div>
                            {itemTokenId && (
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: '#718096',
                                  fontFamily: 'monospace',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatString(itemTokenId)}
                              </div>
                            )}
                          </div>

                          {/* Selection Indicator */}
                          {isSelected && (
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#ed8936',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{ color: 'white', fontSize: '12px' }}
                              >
                                ✓
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#a0aec0',
                      backgroundColor: '#2d3748',
                      borderRadius: '8px',
                    }}
                  >
                    No items found in your collection. You need to own an item
                    from this collection to accept the offer.
                  </div>
                )}
              </div>

              {/* Fulfill Button */}
              {selectedItem && (
                <button
                  onClick={handleFulfillOffer}
                  disabled={
                    !selectedItem ||
                    isFulfillingOffer ||
                    isFetchingFulfillPsbt ||
                    isSigningFulfillPsbt ||
                    isSubmittingFulfill ||
                    signLoading
                  }
                  style={{
                    width: '100%',
                    backgroundColor:
                      isFulfillingOffer ||
                      isFetchingFulfillPsbt ||
                      isSigningFulfillPsbt ||
                      isSubmittingFulfill ||
                      signLoading
                        ? '#4a5568'
                        : '#38a169',
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor:
                      isFulfillingOffer ||
                      isFetchingFulfillPsbt ||
                      isSigningFulfillPsbt ||
                      isSubmittingFulfill ||
                      signLoading
                        ? 'not-allowed'
                        : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {isFulfillingOffer ||
                  isFetchingFulfillPsbt ||
                  isSigningFulfillPsbt ||
                  isSubmittingFulfill
                    ? isFetchingFulfillPsbt
                      ? 'Fetching PSBT...'
                      : isSigningFulfillPsbt
                        ? 'Signing PSBT...'
                        : isSubmittingFulfill
                          ? 'Submitting...'
                          : 'Processing...'
                    : `Accept Offer (${formatPrice(selectedOffer.price?.amount || 0)} BTC)`}
                </button>
              )}

              {/* Fulfill Response */}
              {fulfillResponse && (
                <div style={{ marginTop: '16px' }}>
                  <div
                    style={{
                      backgroundColor: '#1a202c',
                      borderRadius: '6px',
                      padding: '12px',
                      border: '1px solid #4a5568',
                      fontSize: '12px',
                      color: '#a0aec0',
                    }}
                  >
                    {fulfillResponse.fulfillTxId && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                          Transaction ID:
                        </span>{' '}
                        <a
                          href={getMempoolTxUrl(
                            fulfillResponse.fulfillTxId,
                            'mainnet'
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#3182ce',
                            textDecoration: 'none',
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatString(fulfillResponse.fulfillTxId)}
                        </a>
                      </div>
                    )}
                    {fulfillResponse.offerIds &&
                      fulfillResponse.offerIds.length > 0 && (
                        <div>
                          <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                            Fulfilled Offers:
                          </span>{' '}
                          {fulfillResponse.offerIds.map((id, idx) => (
                            <span key={idx} style={{ fontFamily: 'monospace' }}>
                              {formatString(id)}
                              {idx < fulfillResponse.offerIds.length - 1
                                ? ', '
                                : ''}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Clear Selection Button */}
              <button
                onClick={() => {
                  setSelectedOffer(null);
                  setSelectedItem(null);
                  setUserCollectionItems([]);
                  setError('');
                  setSuccess('');
                  setFulfillResponse(null);
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#4a5568',
                  color: 'white',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  marginTop: '12px',
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#2d3748';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#4a5568';
                }}
              >
                Clear Selection
              </button>
            </div>
          )}

        {/* Divider */}
        {selectedOffer && isWalletConnected && (
          <div
            style={{
              height: '1px',
              backgroundColor: '#4a5568',
              margin: '24px 0',
            }}
          />
        )}

        {/* Place Satflow collection bid */}
        {isWalletConnected ? (
          <div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#f7fafc',
              }}
            >
              Place collection bid (Satflow)
            </h3>
            <p
              style={{
                fontSize: '12px',
                color: '#a0aec0',
                marginBottom: '16px',
                lineHeight: 1.45,
              }}
            >
              Fetches an unsigned deposit PSBT from{' '}
              <code style={{ fontSize: '11px' }}>
                backend.satflow.com/.../nonCustodialBidDeposit
              </code>
              , signs with your selected wallet, then posts to{' '}
              <code style={{ fontSize: '11px' }}>/v1/bid/place</code> via proxy.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#e2e8f0',
                  marginBottom: '8px',
                }}
              >
                Bid price (BTC):
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="Unit bid price in BTC"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#2d3748',
                  border: '1px solid #4a5568',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#e2e8f0',
                  marginBottom: '8px',
                }}
              >
                Expiration (days):
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={expirationDays}
                onChange={(e) =>
                  setExpirationDays(parseInt(e.target.value) || 7)
                }
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#2d3748',
                  border: '1px solid #4a5568',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleSubmitOffer}
              disabled={
                !offerPrice ||
                isFetchingPsbt ||
                isSigning ||
                isSubmitting ||
                signLoading
              }
              style={{
                width: '100%',
                backgroundColor:
                  isFetchingPsbt || isSigning || isSubmitting || signLoading
                    ? '#4a5568'
                    : '#38a169',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor:
                  isFetchingPsbt || isSigning || isSubmitting || signLoading
                    ? 'not-allowed'
                    : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {isFetchingPsbt
                ? 'Fetching deposit PSBT...'
                : isSigning
                  ? 'Signing PSBT...'
                  : isSubmitting
                    ? 'Placing bid...'
                    : 'Place bid'}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              backgroundColor: '#2d3748',
              borderRadius: '8px',
              color: '#a0aec0',
            }}
          >
            Please connect a wallet to submit an offer
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fed7d7',
              color: '#c53030',
              borderRadius: '6px',
              marginTop: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#c6f6d5',
              color: '#2f855a',
              borderRadius: '6px',
              marginTop: '16px',
              fontSize: '14px',
            }}
          >
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper component that provides the context
const CollectionOfferModal = ({
  glEventHub,
  collectionSymbol,
  isOpen,
  onClose,
}) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <CollectionOfferModalInner
        glEventHub={glEventHub}
        collectionSymbol={collectionSymbol}
        isOpen={isOpen}
        onClose={onClose}
      />
    </OrdConnectProvider>
  );
};

export default CollectionOfferModal;
