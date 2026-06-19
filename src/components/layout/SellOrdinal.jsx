import React, { useState, useEffect } from 'react';
import {
  useOrdConnect,
  useSign,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import * as bitcoin from 'bitcoinjs-lib';
import WalletStatus from './WalletStatus';
import { useWalletDisconnectState } from '../../hooks/useLocalStorage';
import {
  signPsbtWithProxyWallet,
  derivePublicKeyFromPrivateKey,
  generateAddressFromPublicKey,
  deriveAddressFromPrivateKey,
} from '../../utils/bitcoinUtils';

// Expose bitcoin library to window for debugging
if (typeof window !== 'undefined') {
  window.bitcoin = bitcoin;
}

// Inner component that uses the hooks
const SellOrdinalInner = ({
  glEventHub,
  selectedOrdinal: selectedOrdinalProp,
}) => {
  const [selectedOrdinal, setSelectedOrdinal] = useState(null);
  const [getListingResponse, setGetListingResponse] = useState(null);
  const [unsignedPsbt, setUnsignedPsbt] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [listingResponse, setListingResponse] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFetchingPsbt, setIsFetchingPsbt] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [isProcessingListing, setIsProcessingListing] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  const [priceInSats, setPriceInSats] = useState('');
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
    setGetListingResponse(null);
    setUnsignedPsbt('');
    setSignedPsbt('');
    setListingResponse(null);
    setError('');
    setSuccess('');
    setPriceInSats('');
    setPsbtWalletInfo(null); // Clear stored wallet info
  };

  // Initialize from prop when component mounts or prop changes
  useEffect(() => {
    if (selectedOrdinalProp) {
      console.log(
        'SellOrdinal: Ordinal received via prop:',
        selectedOrdinalProp
      );
      setOrdinalAndClearState(selectedOrdinalProp);
      // If we have a selected wallet from SellOrdinals, use it
      // This will be set via the proxy-wallet-state-transfer event
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
          'SellOrdinal: Restored wallet selection from localStorage:',
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

  // Listen for ordinal selection events from SellOrdinals (for dynamic updates)
  useEffect(() => {
    const handleOrdinalSelect = (ordinal) => {
      console.log('SellOrdinal: Ordinal selected via event:', ordinal);
      setOrdinalAndClearState(ordinal);
    };

    // Listen for proxy wallet state transfer from SellOrdinals
    const handleProxyWalletStateTransfer = (state) => {
      console.log('SellOrdinal: Proxy wallet state transferred:', state);
      if (state.selectedWallet) {
        setSelectedWallet(state.selectedWallet);
        setUseProxyWallet(state.useProxyWallet || true); // Default to true if wallet is selected
      } else {
        // If no proxy wallet state, keep current state (don't reset)
        // This allows the user to maintain their choice
      }
    };

    // Listen for wallet selection events from WalletManagement
    const handleWalletSelect = (wallet) => {
      console.log('SellOrdinal: Wallet selected:', wallet);
      setSelectedWallet(wallet);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('SellOrdinal: Connection state changed:', newConnectionState);
      // Clear form when wallet disconnects
      if (!newConnectionState.isConnected) {
        setSelectedOrdinal(null);
        setGetListingResponse(null);
        setUnsignedPsbt('');
        setSignedPsbt('');
        setListingResponse(null);
        setError('');
        setSuccess('');
        setSelectedWallet(null);
        setUseProxyWallet(false);
        setPriceInSats('');
        setPsbtWalletInfo(null);
        // Clear persisted wallet selection
        localStorage.removeItem('selected-proxy-wallet');
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('SellOrdinal: Wallet disconnected:', disconnectState);
      setSelectedOrdinal(null);
      setGetListingResponse(null);
      setUnsignedPsbt('');
      setSignedPsbt('');
      setListingResponse(null);
      setError('');
      setSuccess('');
      setSelectedWallet(null);
      setUseProxyWallet(false);
      setPriceInSats('');
      setPsbtWalletInfo(null);
      // Clear persisted wallet selection
      localStorage.removeItem('selected-proxy-wallet');
    };

    if (glEventHub) {
      glEventHub.on('ordinal-selected', handleOrdinalSelect);
      glEventHub.on(
        'proxy-wallet-state-transfer',
        handleProxyWalletStateTransfer
      );
      glEventHub.on('wallet-selected', handleWalletSelect);
      glEventHub.on('wallet-connection-changed', handleConnectionChange);
      glEventHub.on('wallet-disconnected', handleDisconnect);
    }

    return () => {
      if (glEventHub) {
        glEventHub.off('ordinal-selected', handleOrdinalSelect);
        glEventHub.off(
          'proxy-wallet-state-transfer',
          handleProxyWalletStateTransfer
        );
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
    // Try different possible field names for token ID
    return (
      ordinal.tokenId ||
      ordinal.id ||
      ordinal.inscriptionId ||
      (ordinal.inscriptionNumber
        ? `${ordinal.genesisTransaction || ''}i${ordinal.inscriptionNumber}`
        : null)
    );
  };

  // Combined handler that runs all three steps sequentially
  const handleListOrUpdateOrdinal = async () => {
    try {
      setError('');
      setSuccess('');
      setIsProcessingListing(true);
      setIsFetchingPsbt(true);

      // Step 1: Fetch PSBT
      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (!selectedOrdinal) {
        throw new Error('Please select an ordinal from your wallet to list');
      }

      const tokenId = getTokenId(selectedOrdinal);
      if (!tokenId) {
        throw new Error('Could not determine token ID from selected ordinal');
      }

      if (!priceInSats || parseFloat(priceInSats) <= 0) {
        throw new Error('Please enter a valid price in sats');
      }

      // Get wallet info
      let address, publicKey;
      if (useProxyWallet && selectedWallet) {
        try {
          address = deriveAddressFromPrivateKey(
            selectedWallet.privateKey,
            connectedNetwork || 'mainnet'
          );
          const walletInfo = getActiveWalletInfo();
          publicKey = walletInfo.publicKey;
        } catch (err) {
          console.error('Error deriving address from private key:', err);
          address = selectedWallet.address;
          const walletInfo = getActiveWalletInfo();
          publicKey = walletInfo.publicKey;
        }
      } else {
        const walletInfo = getActiveWalletInfo();
        address = walletInfo.address;
        publicKey = walletInfo.publicKey;
      }

      if (!address || !publicKey) {
        throw new Error('Could not get wallet address or public key');
      }

      // Store wallet info for consistency
      setPsbtWalletInfo({ address, publicKey, useProxyWallet });

      // Satflow create listing intent: POST /intent/sell → sign → POST /list
      const priceInSatsInt = Math.round(parseFloat(priceInSats) || 0);
      const intentPayload = {
        price: priceInSatsInt,
        inscriptionId: tokenId,
        sellerOrdAddress: address,
        sellerReceiveAddress: address,
        tapInternalKey:
          publicKey && publicKey.length >= 64 ? publicKey : undefined,
      };

      const fetchResponse = await fetch('/api/satflow-intent-sell', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(intentPayload),
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorMessage = `Satflow intent/sell error: ${fetchResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && typeof errorJson.error === 'string') {
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
      const seller = fetchData?.data?.seller;
      if (!seller) {
        throw new Error('Satflow intent/sell did not return data.seller');
      }

      setGetListingResponse(seller);

      const unsignedListingBase64 =
        seller.unsignedListingPSBTBase64 || seller.unsignedListingPSBTHex;
      if (!unsignedListingBase64) {
        throw new Error(
          'Satflow intent/sell missing unsignedListingPSBTBase64'
        );
      }

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

      let unsignedListingPsbtB64 = unsignedListingBase64;
      if (
        unsignedListingBase64.length > 0 &&
        /^[0-9a-fA-F]+$/.test(unsignedListingBase64)
      ) {
        unsignedListingPsbtB64 = hexToBase64(unsignedListingBase64);
      }
      setUnsignedPsbt(unsignedListingPsbtB64);

      setIsFetchingPsbt(false);
      setIsSigning(true);

      // Helper function to sign a PSBT
      const signPsbtHelper = async (psbtBase64, psbtType = 'PSBT') => {
        if (useProxyWallet && selectedWallet) {
          if (!selectedWallet.privateKey) {
            throw new Error('Proxy wallet private key not available');
          }

          const currentWalletInfo = getActiveWalletInfo();
          const walletAddressToUse =
            psbtWalletInfo?.address || currentWalletInfo.address;

          const result = await signPsbtWithProxyWallet(
            psbtBase64.trim(),
            selectedWallet.privateKey,
            connectedNetwork || 'mainnet',
            {
              finalize: false,
              extractTx: false,
              expectedPublicKey: currentWalletInfo.publicKey,
              walletAddress: walletAddressToUse,
            }
          );

          if (result && result.base64) {
            return result.base64;
          } else {
            throw new Error(
              `Failed to sign ${psbtType} with proxy wallet - no result returned`
            );
          }
        } else {
          const walletAddressForSigning = connectedAddress?.ordinals;
          if (!walletAddressForSigning) {
            throw new Error(
              'Could not get connected wallet address for signing'
            );
          }

          const result = await sign(
            walletAddressForSigning,
            psbtBase64.trim(),
            {
              finalize: false,
              extractTx: false,
            }
          );

          if (result && result.base64) {
            return result.base64;
          } else if (result && result.hex) {
            return hexToBase64(result.hex);
          } else {
            throw new Error('Failed to sign PSBT - no result returned');
          }
        }
      };

      // Sign main listing PSBT (insecure/snipable)
      const signedListing = await signPsbtHelper(
        unsignedListingPsbtB64,
        'Listing PSBT'
      );
      setSignedPsbt(signedListing);

      // Sign each secure listing PSBT (non-snipable)
      const secureListingPsbtList = seller.secureListingPSBTs || [];
      const signedSecureListingPSBTs = [];
      for (let i = 0; i < secureListingPsbtList.length; i++) {
        const secureItem = secureListingPsbtList[i];
        const secureB64 = secureItem.base64 || secureItem.hex;
        if (!secureB64) continue;
        const secureB64ForSign = /^[0-9a-fA-F]+$/.test(secureB64)
          ? hexToBase64(secureB64)
          : secureB64;
        const signedSecure = await signPsbtHelper(
          secureB64ForSign,
          `Secure listing PSBT ${i + 1}`
        );
        signedSecureListingPSBTs.push(signedSecure);
      }

      setIsSigning(false);
      setIsListing(true);

      // Submit to Satflow POST /list
      const listingEntry = {
        price: priceInSatsInt,
        inscriptionId: tokenId,
        sellerOrdAddress: address,
        sellerReceiveAddress: address,
        tapInternalKey:
          publicKey && publicKey.length >= 64 ? publicKey : undefined,
      };

      const listPayload = {
        listings: [listingEntry],
        signedListingPSBT: signedListing,
        signedSecureListingPSBTs:
          signedSecureListingPSBTs.length > 0 ? signedSecureListingPSBTs : [],
        unsignedListingPSBT: unsignedListingPsbtB64,
      };

      const listResponse = await fetch('/api/satflow-list', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(listPayload),
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        let errorMessage = `Satflow /list error: ${listResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && typeof errorJson.error === 'string') {
            errorMessage = errorJson.error;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const listData = await listResponse.json();
      setListingResponse(listData);

      const isSuccess = listData?.success === true;
      const txid = listData?.data?.txid;

      if (isSuccess) {
        setSuccess(
          txid
            ? `✓ Listing successful on Satflow. TxID: ${txid}`
            : '✓ Listing successful on Satflow.'
        );
      } else if (listData?.error) {
        setError(`Satflow listing failed: ${listData.error}`);
      } else {
        setSuccess('Listing submitted; check Satflow for status.');
      }
    } catch (err) {
      console.error('Error in combined listing process:', err);
      setError(err.message || 'Failed to process listing');
    } finally {
      setIsProcessingListing(false);
      setIsFetchingPsbt(false);
      setIsSigning(false);
      setIsListing(false);
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
        <h2 className="component-header">List Ordinal for Sale</h2>

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
              Please connect a wallet to list ordinals
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
                        selectedOrdinal.displayName ||
                        `#${selectedOrdinal.inscriptionNumber || 'Unknown'}`}
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
                    {selectedOrdinal.listed && (
                      <div>
                        <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                          Currently Listed:
                        </span>{' '}
                        <span style={{ color: '#ed8936', fontWeight: '600' }}>
                          {formatPrice(selectedOrdinal.listedPrice)} BTC
                        </span>
                      </div>
                    )}
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
                  Select an ordinal from your wallet to list for sale
                </p>
              </div>
            )}

            {/* Price Input */}
            {selectedOrdinal && (
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#f7fafc',
                    marginBottom: '8px',
                    display: 'block',
                  }}
                >
                  Listing Price (in sats):
                </label>
                <input
                  type="number"
                  min="1"
                  value={priceInSats}
                  onChange={(e) => setPriceInSats(e.target.value)}
                  placeholder="Enter price in sats"
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                  }}
                />
                {selectedOrdinal?.listed && selectedOrdinal?.listedPrice && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#f6ad55',
                      marginTop: '4px',
                      fontWeight: '500',
                    }}
                  >
                    ℹ️ This ordinal is currently listed at{' '}
                    {(selectedOrdinal.listedPrice / 100000000).toFixed(8)} BTC.
                    Enter a new price to update the listing.
                  </p>
                )}
                {priceInSats && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#a0aec0',
                      marginTop: '4px',
                    }}
                  >
                    ≈ {formatPrice(parseFloat(priceInSats) || 0)} BTC
                  </p>
                )}
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
                onClick={handleListOrUpdateOrdinal}
                disabled={
                  !selectedOrdinal ||
                  !priceInSats ||
                  isProcessingListing ||
                  isFetchingPsbt ||
                  isSigning ||
                  isListing ||
                  signLoading
                }
                style={{
                  backgroundColor:
                    isProcessingListing ||
                    isFetchingPsbt ||
                    isSigning ||
                    isListing ||
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
                    isProcessingListing ||
                    isFetchingPsbt ||
                    isSigning ||
                    isListing ||
                    signLoading
                      ? 'not-allowed'
                      : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '120px',
                }}
              >
                {isProcessingListing || isFetchingPsbt || isSigning || isListing
                  ? isFetchingPsbt
                    ? 'Fetching PSBT...'
                    : isSigning
                      ? 'Signing PSBT...'
                      : isListing
                        ? 'Submitting Listing...'
                        : 'Processing...'
                  : selectedOrdinal?.listed
                    ? 'Update Listing'
                    : 'List for Sale'}
              </button>
            </div>

            {/* Get Listing Response Info */}
            {getListingResponse && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Listing Information
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
                      {getListingResponse.makerFee || 0} sats
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Price:
                      </span>{' '}
                      {formatPrice(getListingResponse.price)} BTC
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Unsigned PSBT Display - Hidden */}
            {false && unsignedPsbt && (
              <div style={{ marginBottom: '20px', display: 'none' }}>
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
                    Unsigned Listing PSBT (Base64):
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
              <div style={{ marginBottom: '20px', display: 'none' }}>
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
                    Signed Listing PSBT:
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

            {/* Listing Response */}
            {listingResponse && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Listing Result
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
                    <span
                      style={{
                        color: listingResponse.ok ? '#48bb78' : '#e53e3e',
                        fontWeight: '600',
                      }}
                    >
                      {listingResponse.ok ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {listingResponse.listed !== undefined && (
                    <div>
                      <span style={{ fontWeight: '500', color: '#e2e8f0' }}>
                        Listed:
                      </span>{' '}
                      {listingResponse.listed} ordinal(s)
                    </div>
                  )}
                  {listingResponse.failed &&
                    listingResponse.failed.length > 0 && (
                      <div style={{ marginTop: '8px', color: '#e53e3e' }}>
                        <strong>Failed:</strong>{' '}
                        {listingResponse.failed.join(', ')}
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
const SellOrdinal = ({ glContainer, glEventHub, selectedOrdinal }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <SellOrdinalInner
        glContainer={glContainer}
        glEventHub={glEventHub}
        selectedOrdinal={selectedOrdinal}
      />
    </OrdConnectProvider>
  );
};

export default SellOrdinal;
