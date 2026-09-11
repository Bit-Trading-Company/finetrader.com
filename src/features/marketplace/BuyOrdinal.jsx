import React, { useState, useEffect } from 'react';
import { useOrdConnect } from '@ordzaar/ord-connect';
import WalletStatus from '../wallet/WalletStatus';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';
import {
  loadSelectedProxyWallet,
  clearSelectedProxyWallet,
} from '../wallet/proxyWalletStorage';
import {
  derivePublicKeyFromPrivateKey,
  generateAddressFromPublicKey,
} from '../../lib/bitcoinUtils';
import { getMempoolTxUrl } from '../../lib/mempoolProvider';
import {
  prepareSecurePurchase,
  completeSecurePurchase,
} from '../../trading/autoTradingUtils';
import { truncateMiddle, formatSatsAsBtc } from '../../lib/format';

const isSatflowMarketplaceListing = (ordinal) =>
  Boolean(ordinal && (ordinal._satflowListing || ordinal._satflowRaw));

const BuyOrdinal = ({ glEventHub, selectedOrdinal: selectedOrdinalProp }) => {
  const [selectedOrdinal, setSelectedOrdinal] = useState(null);
  const [purchaseResponse, setPurchaseResponse] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);

  const {
    address: connectedAddress,
    publicKey: connectedPublicKey,
    format: connectedFormat,
    wallet: connectedWallet,
    network: connectedNetwork,
  } = useOrdConnect();

  const isDisconnected = useWalletDisconnectState();

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Helper function to set ordinal and clear previous state
  const setOrdinalAndClearState = (ordinal) => {
    setSelectedOrdinal(ordinal);
    setPurchaseResponse(null);
    setError('');
    setSuccess('');
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
    const restoredWallet = loadSelectedProxyWallet();
    if (restoredWallet) {
      setSelectedWallet(restoredWallet);
      setUseProxyWallet(true);
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
      console.log('BuyOrdinal: Wallet selected:', wallet?.index);
      setSelectedWallet(wallet);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    const clearPurchaseState = () => {
      setSelectedOrdinal(null);
      setPurchaseResponse(null);
      setError('');
      setSuccess('');
      setSelectedWallet(null);
      setUseProxyWallet(false);
      // Clear persisted wallet selection
      clearSelectedProxyWallet();
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('BuyOrdinal: Connection state changed:', newConnectionState);
      // Clear form when wallet disconnects
      if (!newConnectionState.isConnected) {
        clearPurchaseState();
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('BuyOrdinal: Wallet disconnected:', disconnectState);
      clearPurchaseState();
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

  // Satflow secure purchase: prepare (optional prep tx) -> purchase -> broadcast,
  // all signed locally with the selected proxy wallet.
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

  const handlePurchaseOrdinal = async () => {
    try {
      setError('');
      setSuccess('');
      setIsProcessingPurchase(true);

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

      if (!isSatflowMarketplaceListing(selectedOrdinal)) {
        throw new Error('Only Satflow listings can be purchased');
      }

      await runSatflowSecurePurchase();
    } catch (err) {
      console.error('Error in purchase process:', err);
      setError(err.message || 'Failed to process purchase');
    } finally {
      setIsProcessingPurchase(false);
    }
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
                        {formatSatsAsBtc(selectedOrdinal.listedPrice)} BTC
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
                      {truncateMiddle(getTokenId(selectedOrdinal) || '')}
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
                        {truncateMiddle(getActiveWalletInfo().address || '')}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Public Key:</span>{' '}
                        {truncateMiddle(selectedWallet.publicKey || '')}
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
                        {truncateMiddle(getActiveWalletInfo().address || '')}
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
                  !isSatflowMarketplaceListing(selectedOrdinal) ||
                  !useProxyWallet ||
                  !selectedWallet?.privateKey ||
                  isProcessingPurchase
                }
                style={{
                  backgroundColor: isProcessingPurchase ? '#4a5568' : '#38a169',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isProcessingPurchase ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '120px',
                }}
              >
                {isProcessingPurchase ? 'Purchasing...' : 'Purchase'}
              </button>
            </div>

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
                        {truncateMiddle(purchaseResponse.fundsPreparationTxid)}
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

export default BuyOrdinal;
