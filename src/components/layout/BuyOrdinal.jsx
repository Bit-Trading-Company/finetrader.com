import React, { useState, useEffect } from 'react';
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
import {
  prepareSecurePurchase,
  completeSecurePurchase,
} from '../../utils/autoTradingUtils';

const isSatflowMarketplaceListing = (ordinal) =>
  Boolean(ordinal && (ordinal._satflowListing || ordinal._satflowRaw));

// Inner component that uses the hooks
const BuyOrdinalInner = ({
  glEventHub,
  selectedOrdinal: selectedOrdinalProp,
}) => {
  const [selectedOrdinal, setSelectedOrdinal] = useState(null);
  const [getSweepingResponse, setGetSweepingResponse] = useState(null);
  const [unsignedPsbt, setUnsignedPsbt] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [purchaseResponse, setPurchaseResponse] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFetchingPsbt, setIsFetchingPsbt] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  // Store the wallet info used when fetching PSBT to ensure consistency
  const [psbtWalletInfo, setPsbtWalletInfo] = useState(null);

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

  // Helper function to set ordinal and clear previous state
  const setOrdinalAndClearState = (ordinal) => {
    setSelectedOrdinal(ordinal);
    // Clear previous state when new ordinal is selected
    setGetSweepingResponse(null);
    setUnsignedPsbt('');
    setSignedPsbt('');
    setPurchaseResponse(null);
    setError('');
    setSuccess('');
    setPsbtWalletInfo(null); // Clear stored wallet info
  };

  // Initialize from prop when component mounts or prop changes
  useEffect(() => {
    if (selectedOrdinalProp) {
      console.log(
        'BuyOrdinal: Ordinal received via prop:',
        selectedOrdinalProp
      );
      setOrdinalAndClearState(selectedOrdinalProp);
    } else {
      // Clear ordinal if prop is cleared
      setSelectedOrdinal(null);
    }
  }, [selectedOrdinalProp]);

  // Restore selected wallet state on mount
  useEffect(() => {
    // Check if there's a stored wallet selection
    const storedWallet = localStorage.getItem('selected-proxy-wallet');
    if (storedWallet) {
      try {
        const walletData = JSON.parse(storedWallet);
        // Reconstruct wallet object from stored data
        const restoredWallet = {
          index: walletData.index,
          address: walletData.address,
          publicKey: walletData.publicKey,
          privateKey: walletData.privateKey,
        };
        setSelectedWallet(restoredWallet);
        setUseProxyWallet(true);
        console.log(
          'BuyOrdinal: Restored wallet selection from localStorage:',
          restoredWallet
        );
      } catch (err) {
        console.error('Error restoring wallet from localStorage:', err);
      }
    }

    // Also request current wallet state from WalletManagement
    if (glEventHub) {
      glEventHub.emit('request-wallet-state');
    }
  }, [glEventHub]);

  // Listen for ordinal selection events from CollectionDetails (for dynamic updates)
  useEffect(() => {
    const handleOrdinalSelect = (ordinal) => {
      console.log('BuyOrdinal: Ordinal selected via event:', ordinal);
      setOrdinalAndClearState(ordinal);
    };

    // Listen for wallet selection events from WalletManagement
    const handleWalletSelect = (wallet) => {
      console.log('BuyOrdinal: Wallet selected:', wallet);
      setSelectedWallet(wallet);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('BuyOrdinal: Connection state changed:', newConnectionState);
      // Clear form when wallet disconnects
      if (!newConnectionState.isConnected) {
        setSelectedOrdinal(null);
        setGetSweepingResponse(null);
        setUnsignedPsbt('');
        setSignedPsbt('');
        setPurchaseResponse(null);
        setError('');
        setSuccess('');
        setSelectedWallet(null);
        setUseProxyWallet(false);
        setPsbtWalletInfo(null);
        // Clear persisted wallet selection
        localStorage.removeItem('selected-proxy-wallet');
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('BuyOrdinal: Wallet disconnected:', disconnectState);
      setSelectedOrdinal(null);
      setGetSweepingResponse(null);
      setUnsignedPsbt('');
      setSignedPsbt('');
      setPurchaseResponse(null);
      setError('');
      setSuccess('');
      setSelectedWallet(null);
      setUseProxyWallet(false);
      setPsbtWalletInfo(null);
      // Clear persisted wallet selection
      localStorage.removeItem('selected-proxy-wallet');
    };

    if (glEventHub) {
      glEventHub.on('ordinal-selected', handleOrdinalSelect);
      glEventHub.on('wallet-selected', handleWalletSelect);
      glEventHub.on('wallet-connection-changed', handleConnectionChange);
      glEventHub.on('wallet-disconnected', handleDisconnect);
    }

    return () => {
      if (glEventHub) {
        glEventHub.off('ordinal-selected', handleOrdinalSelect);
        glEventHub.off('wallet-selected', handleWalletSelect);
        glEventHub.off('wallet-connection-changed', handleConnectionChange);
        glEventHub.off('wallet-disconnected', handleDisconnect);
      }
    };
  }, [glEventHub]);

  // Handle sign error changes
  useEffect(() => {
    if (signError) {
      setError(signError);
    }
  }, [signError]);

  // Get the active wallet address and public key (proxy or connected)
  // For proxy wallets, derive the public key from the private key using ECPair
  // to ensure it matches what will be used for signing
  const getActiveWalletInfo = () => {
    if (useProxyWallet && selectedWallet) {
      // Use proxy wallet - derive public key from private key to ensure consistency
      try {
        const derivedPublicKey = derivePublicKeyFromPrivateKey(
          selectedWallet.privateKey,
          connectedNetwork || 'mainnet'
        );

        // Use the derived public key (authoritative for signing)
        // If it differs from stored public key, regenerate the address to match
        let addressToUse = selectedWallet.address;

        if (
          selectedWallet.publicKey &&
          selectedWallet.publicKey.toLowerCase() !==
            derivedPublicKey.toLowerCase()
        ) {
          console.warn(
            'Proxy wallet public key mismatch: Regenerating address from ECPair-derived public key for consistency.',
            {
              stored: selectedWallet.publicKey.substring(0, 20) + '...',
              derived: derivedPublicKey.substring(0, 20) + '...',
            }
          );

          // Regenerate address from the derived public key to ensure consistency
          try {
            addressToUse = generateAddressFromPublicKey(derivedPublicKey);
            console.log('Regenerated address from derived public key:', {
              oldAddress: selectedWallet.address?.substring(0, 20) + '...',
              newAddress: addressToUse?.substring(0, 20) + '...',
            });
          } catch (err) {
            console.error('Error regenerating address from public key:', err);
            // Fallback to stored address if regeneration fails
            addressToUse = selectedWallet.address;
          }
        }

        return {
          address: addressToUse, // Use regenerated address if public key changed
          publicKey: derivedPublicKey, // Use derived public key (matches signing method)
        };
      } catch (err) {
        console.error('Error deriving public key from private key:', err);
        // Fallback to stored public key if derivation fails
        return {
          address: selectedWallet.address,
          publicKey: selectedWallet.publicKey,
        };
      }
    } else {
      // Use connected wallet
      return {
        address: connectedAddress?.ordinals,
        publicKey: connectedPublicKey?.ordinals,
      };
    }
  };

  // Get tokenId from ordinal - try multiple possible field names
  const getTokenId = (ordinal) => {
    if (!ordinal) return null;
    if (isSatflowMarketplaceListing(ordinal) && ordinal.inscriptionId) {
      return ordinal.inscriptionId;
    }
    return (
      ordinal.tokenId ||
      ordinal.id ||
      ordinal.inscriptionId ||
      (ordinal.inscriptionNumber
        ? `${ordinal.txid || ''}i${ordinal.inscriptionNumber}`
        : null)
    );
  };

  const runSatflowSecurePurchase = async () => {
    if (!useProxyWallet || !selectedWallet?.privateKey) {
      throw new Error(
        'Satflow marketplace purchases use a Fine proxy wallet. Open Wallet Status and select a proxy wallet.'
      );
    }

    const network = connectedNetwork || 'mainnet';

    const prepareResult = await prepareSecurePurchase(
      selectedOrdinal,
      selectedWallet,
      network,
      null,
      null
    );

    if (!prepareResult.success) {
      throw new Error(prepareResult.error || 'Satflow prepare failed');
    }

    const completeOptions = {};
    if (prepareResult.noPrepNeeded && prepareResult.intentData) {
      completeOptions.intentData = prepareResult.intentData;
    }
    if (prepareResult.signedPaymentPrepPSBT) {
      completeOptions.signedPaymentPrepPSBT =
        prepareResult.signedPaymentPrepPSBT;
    }

    const completeResult = await completeSecurePurchase(
      selectedOrdinal,
      selectedWallet,
      network,
      null,
      null,
      completeOptions
    );

    if (!completeResult.success || !completeResult.txid) {
      throw new Error(
        completeResult.error || 'Satflow purchase broadcast failed'
      );
    }

    setPurchaseResponse({
      ok: true,
      fundsPreparationTxid: completeResult.txid,
    });
    setSuccess(
      `Purchase successful! Transaction ID: ${completeResult.txid.slice(0, 16)}…`
    );
  };

  // Combined handler that runs all three steps sequentially
  const handlePurchaseOrdinal = async () => {
    try {
      setError('');
      setSuccess('');
      setIsProcessingPurchase(true);
      setIsFetchingPsbt(true);

      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (!selectedOrdinal) {
        throw new Error(
          'Please select an ordinal from the Collection Details page'
        );
      }

      const tokenId = getTokenId(selectedOrdinal);
      if (!tokenId) {
        throw new Error('Could not determine token ID from selected ordinal');
      }

      if (!selectedOrdinal.listed || !selectedOrdinal.listedPrice) {
        throw new Error('Selected ordinal is not listed for sale');
      }

      if (isSatflowMarketplaceListing(selectedOrdinal)) {
        setIsFetchingPsbt(false);
        setIsSigning(true);
        setIsPurchasing(true);
        await runSatflowSecurePurchase();
        return;
      }

      const { address, publicKey } = getActiveWalletInfo();
      if (!address || !publicKey) {
        throw new Error('Could not get wallet address or public key');
      }

      // Store wallet info for consistency
      setPsbtWalletInfo({ address, publicKey, useProxyWallet });

      const priceInSats = Math.round(
        parseFloat(selectedOrdinal.listedPrice) || 0
      );

      const payload = {
        buyerAddress: address,
        buyerPublicKey: publicKey,
        buyerTokenReceiveAddress: address,
        buyerTokenReceivePublicKey: publicKey,
        creatorTipsType: 'none',
        enableRBFProtection: true,
        feerateTier: 'halfHourFee',
        mintRune: false,
        tokens: [
          {
            price: priceInSats,
            tokenId: tokenId,
          },
        ],
        useUnconfirmedUTXO: false,
      };

      // Magic Eden is always called through the same-origin proxy
      // (server/magiceden.js); browsers cannot call magiceden.us directly.
      const apiUrl = '/api/magiceden-psbt?endpoint=get_sweeping';

      const fetchResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(payload),
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorMessage = `HTTP error! status: ${fetchResponse.status}`;
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

      const fetchData = await fetchResponse.json();
      setGetSweepingResponse(fetchData);

      const unsignedPsbtValue =
        fetchData.unsignedFundsPreparationPSBTBase64 || '';
      setUnsignedPsbt(unsignedPsbtValue);

      setIsFetchingPsbt(false);
      setIsSigning(true);

      // Step 2: Sign PSBT
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
            finalize: true,
            extractTx: false,
            expectedPublicKey: selectedWallet.publicKey,
            walletAddress: currentWalletInfo.address,
          }
        );

        if (result && result.base64) {
          signedPsbtValue = result.base64;
          setSignedPsbt(signedPsbtValue);
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
            finalize: true,
            extractTx: false,
          }
        );

        if (result && result.base64) {
          signedPsbtValue = result.base64;
          setSignedPsbt(signedPsbtValue);
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
          setSignedPsbt(signedPsbtValue);
        } else {
          throw new Error('Failed to sign PSBT - no result returned');
        }
      }

      if (!signedPsbtValue) {
        throw new Error('Failed to sign PSBT');
      }

      setIsSigning(false);
      setIsPurchasing(true);

      // Step 3: Purchase

      const walletAddressToUse = psbtWalletInfo?.address || address;
      const walletPublicKeyToUse = psbtWalletInfo?.publicKey || publicKey;

      if (!walletAddressToUse || !walletPublicKeyToUse) {
        throw new Error('Could not get wallet address or public key');
      }

      const purchasePayload = {
        buyerAddress: walletAddressToUse,
        buyerPublicKey: walletPublicKeyToUse,
        buyerTokenReceiveAddress: walletAddressToUse,
        conflictOffers: fetchData.conflictOffers || [],
        creatorTipsType: 'none',
        dryRun: false,
        failedTokenIds: fetchData.failedTokenIds || [],
        feerateTier: 'halfHourFee',
        kind: 'buying_broadcasted',
        makerFee: fetchData.makerFee || 0,
        rbfProtectedTokenIds: fetchData.rbfProtectedTokenIds || [],
        signature: fetchData.signature || [],
        signedFundsPreparationPSBTBase64: signedPsbtValue,
        takerFee: fetchData.takerFee || 0,
        toSignInputs: fetchData.toSignInputs || [],
        toSignSigHash: fetchData.toSignSigHash || 1,
        tokens: fetchData.tokens || [],
        unsignedFundsPreparationPSBTBase64:
          fetchData.unsignedFundsPreparationPSBTBase64 || '',
        walletSource: connectedWallet?.toLowerCase() || 'unisat',
      };

      const purchaseApiUrl = '/api/magiceden-psbt?endpoint=sweeping';

      const purchaseResponse = await fetch(purchaseApiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(purchasePayload),
      });

      if (!purchaseResponse.ok) {
        const errorText = await purchaseResponse.text();
        let errorMessage = `HTTP error! status: ${purchaseResponse.status}`;
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

      const purchaseData = await purchaseResponse.json();
      setPurchaseResponse(purchaseData);
      setSuccess(
        `Purchase successful! Transaction ID: ${purchaseData.fundsPreparationTxid || 'N/A'}`
      );
    } catch (err) {
      console.error('Error in combined purchase process:', err);
      setError(err.message || 'Failed to process purchase');
    } finally {
      setIsProcessingPurchase(false);
      setIsFetchingPsbt(false);
      setIsSigning(false);
      setIsPurchasing(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  };

  // Format price - converts sats to BTC for display
  const formatPrice = (priceInSats) => {
    if (!priceInSats && priceInSats !== 0) return 'N/A';
    // Convert sats to BTC (divide by 100000000)
    const btcPrice = priceInSats / 100000000;
    return btcPrice.toFixed(8);
  };

  const formatString = (str) => {
    if (str && str.length > 14) {
      return `${str.slice(0, 7)}...${str.slice(-7)}`;
    }
    return str || '';
  };

  const handleWalletSourceChange = (useProxy) => {
    setUseProxyWallet(useProxy);
  };

  return (
    <div className="buy-ordinal-container component-container">
      <div>
        <h2 className="component-header">Buy Ordinal</h2>

        {/* Wallet Status Component */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={handleWalletSourceChange}
        />

        {!isWalletConnected ? (
          <div
            style={{
              padding: '40px',
              backgroundColor: '#2d3748',
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid #4a5568',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: '#a0aec0',
                margin: 0,
              }}
            >
              Please connect a wallet to buy ordinals
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#2d3748',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid #4a5568',
            }}
          >
            {/* Selected Ordinal Info */}
            {selectedOrdinal ? (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    color: '#f7fafc',
                  }}
                >
                  Selected Ordinal
                  {isSatflowMarketplaceListing(selectedOrdinal) && (
                    <span
                      style={{
                        marginLeft: '10px',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#63b3ed',
                      }}
                    >
                      (Satflow listing — use proxy wallet to purchase)
                    </span>
                  )}
                </h3>
                <div
                  style={{
                    backgroundColor: '#1a202c',
                    borderRadius: '6px',
                    padding: '12px',
                    border: '1px solid #4a5568',
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
                        Name:
                      </span>{' '}
                      {selectedOrdinal.meta?.name ||
                        `#${selectedOrdinal.inscriptionNumber || 'Unknown'}`}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Price:
                      </span>{' '}
                      <span style={{ color: '#ed8936', fontWeight: '600' }}>
                        {formatPrice(selectedOrdinal.listedPrice)} BTC
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Inscription:
                      </span>{' '}
                      {selectedOrdinal.inscriptionNumber || 'N/A'}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Token ID:
                      </span>{' '}
                      {formatString(getTokenId(selectedOrdinal) || '')}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#1a202c',
                  borderRadius: '6px',
                  textAlign: 'center',
                  border: '1px solid #4a5568',
                  marginBottom: '20px',
                }}
              >
                <p style={{ fontSize: '14px', color: '#a0aec0', margin: 0 }}>
                  Select an ordinal from the Collection Details page to purchase
                </p>
              </div>
            )}

            {/* Wallet Information */}
            {isWalletConnected && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  {useProxyWallet && selectedWallet
                    ? 'Proxy Wallet Information'
                    : 'Connected Wallet Information'}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#a0aec0',
                  }}
                >
                  {useProxyWallet && selectedWallet ? (
                    <>
                      <div>
                        <span style={{ fontWeight: '500' }}>Wallet Index:</span>{' '}
                        #{selectedWallet.index + 1}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Address:</span>{' '}
                        {formatString(getActiveWalletInfo().address || '')}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Public Key:</span>{' '}
                        {formatString(selectedWallet.publicKey || '')}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Network:</span>{' '}
                        {connectedNetwork}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontWeight: '500' }}>Address:</span>{' '}
                        {formatString(getActiveWalletInfo().address || '')}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Format:</span>{' '}
                        {connectedFormat?.ordinals || 'N/A'}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Network:</span>{' '}
                        {connectedNetwork}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Wallet:</span>{' '}
                        {connectedWallet}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handlePurchaseOrdinal}
                disabled={
                  !selectedOrdinal ||
                  !selectedOrdinal.listed ||
                  (isSatflowMarketplaceListing(selectedOrdinal) &&
                    (!useProxyWallet || !selectedWallet?.privateKey)) ||
                  isProcessingPurchase ||
                  isFetchingPsbt ||
                  isSigning ||
                  isPurchasing ||
                  signLoading
                }
                style={{
                  backgroundColor:
                    isProcessingPurchase ||
                    isFetchingPsbt ||
                    isSigning ||
                    isPurchasing ||
                    signLoading
                      ? '#4a5568'
                      : '#38a169',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor:
                    isProcessingPurchase ||
                    isFetchingPsbt ||
                    isSigning ||
                    isPurchasing ||
                    signLoading
                      ? 'not-allowed'
                      : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '120px',
                }}
              >
                {isProcessingPurchase ||
                isFetchingPsbt ||
                isSigning ||
                isPurchasing
                  ? isFetchingPsbt
                    ? 'Fetching PSBT...'
                    : isSigning
                      ? 'Signing PSBT...'
                      : isPurchasing
                        ? 'Purchasing...'
                        : 'Processing...'
                  : 'Purchase'}
              </button>
            </div>

            {/* Get Sweeping Response Info */}
            {getSweepingResponse && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Purchase Information
                </h3>
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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Maker Fee:
                      </span>{' '}
                      {getSweepingResponse.makerFee || 0} sats
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Taker Fee:
                      </span>{' '}
                      {getSweepingResponse.takerFee || 0} sats
                    </div>
                  </div>
                  {getSweepingResponse.rbfProtectedTokenIds &&
                    getSweepingResponse.rbfProtectedTokenIds.length > 0 && (
                      <div style={{ marginTop: '8px', color: '#ed8936' }}>
                        <strong>RBF Protected:</strong>{' '}
                        {getSweepingResponse.rbfProtectedTokenIds.join(', ')}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Unsigned PSBT Display - Hidden */}
            {false && unsignedPsbt && (
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#f7fafc',
                    }}
                  >
                    Unsigned PSBT (Base64):
                  </label>
                  <button
                    onClick={() => copyToClipboard(unsignedPsbt)}
                    style={{
                      backgroundColor: '#4a5568',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  value={unsignedPsbt}
                  readOnly
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Signed PSBT Display - Hidden */}
            {false && signedPsbt && (
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#f7fafc',
                    }}
                  >
                    Signed PSBT:
                  </label>
                  <button
                    onClick={() => copyToClipboard(signedPsbt)}
                    style={{
                      backgroundColor: '#4a5568',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  value={signedPsbt}
                  readOnly
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Purchase Response */}
            {purchaseResponse && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Purchase Result
                </h3>
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
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                      Status:
                    </span>{' '}
                    <span style={{ color: '#48bb78', fontWeight: '600' }}>
                      {purchaseResponse.ok ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {purchaseResponse.fundsPreparationTxid && (
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Transaction ID:
                      </span>{' '}
                      <a
                        href={getMempoolTxUrl(
                          purchaseResponse.fundsPreparationTxid,
                          'mainnet'
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#3182ce',
                          textDecoration: 'none',
                        }}
                      >
                        {formatString(purchaseResponse.fundsPreparationTxid)}
                      </a>
                    </div>
                  )}
                </div>
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
                  marginBottom: '16px',
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
                  marginBottom: '16px',
                  fontSize: '14px',
                }}
              >
                {success}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper component that provides the context
const BuyOrdinal = ({ glContainer, glEventHub, selectedOrdinal }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <BuyOrdinalInner
        glContainer={glContainer}
        glEventHub={glEventHub}
        selectedOrdinal={selectedOrdinal}
      />
    </OrdConnectProvider>
  );
};

export default BuyOrdinal;
