import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOrdConnect } from '@ordzaar/ord-connect';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';
import WalletStatus from '../wallet/WalletStatus';
import {
  loadSelectedProxyWallet,
  clearSelectedProxyWallet,
} from '../wallet/proxyWalletStorage';
import {
  derivePublicKeyFromPrivateKey,
  generateAddressFromPublicKey,
} from '../../lib/bitcoinUtils';
import { fetchWalletOrdinals } from '../../trading/satflow/satflowApi';
import { formatSatsAsBtc, formatCompactNumber } from '../../lib/format';

const SellOrdinals = ({ glEventHub }) => {
  const { address: connectedAddress, network: connectedNetwork } =
    useOrdConnect();
  const isDisconnected = useWalletDisconnectState();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ownerAddress, setOwnerAddress] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  const [params, setParams] = useState({
    limit: '100',
    showAll: 'true',
  });
  // Ref to track if component has mounted to ensure fresh data on initial load
  const hasMountedRef = useRef(false);

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Get the active wallet address (proxy or connected)
  // For proxy wallets, derive the public key from the private key using ECPair
  // to ensure it matches what will be used
  const getActiveWalletInfo = useCallback(() => {
    if (useProxyWallet && selectedWallet) {
      // Use proxy wallet - derive public key from private key to ensure consistency
      try {
        const derivedPublicKey = derivePublicKeyFromPrivateKey(
          selectedWallet.privateKey,
          connectedNetwork || 'mainnet'
        );

        // Use the derived public key (authoritative)
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
          address: addressToUse,
          publicKey: derivedPublicKey,
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
        publicKey: null,
      };
    }
  }, [useProxyWallet, selectedWallet, connectedNetwork, connectedAddress]);

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

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('SellOrdinals: Wallet selected:', wallet?.index);
      setSelectedWallet(wallet);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log(
        'SellOrdinals: Connection state changed:',
        newConnectionState
      );
      // Clear proxy wallet when wallet disconnects
      if (!newConnectionState.isConnected) {
        setSelectedWallet(null);
        setUseProxyWallet(false);
        setOwnerAddress(null);
        setItems([]);
        // Clear persisted wallet selection
        clearSelectedProxyWallet();
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('SellOrdinals: Wallet disconnected:', disconnectState);
      setSelectedWallet(null);
      setUseProxyWallet(false);
      setOwnerAddress(null);
      setItems([]);
      // Clear persisted wallet selection
      clearSelectedProxyWallet();
    };

    if (glEventHub) {
      glEventHub.on('wallet-selected', handleWalletSelect);
      glEventHub.on('wallet-connection-changed', handleConnectionChange);
      glEventHub.on('wallet-disconnected', handleDisconnect);
    }

    return () => {
      if (glEventHub) {
        glEventHub.off('wallet-selected', handleWalletSelect);
        glEventHub.off('wallet-connection-changed', handleConnectionChange);
        glEventHub.off('wallet-disconnected', handleDisconnect);
      }
    };
  }, [glEventHub]);

  // Update owner address when wallet connection or proxy wallet selection changes
  useEffect(() => {
    if (isWalletConnected) {
      const walletInfo = getActiveWalletInfo();
      if (walletInfo.address) {
        setOwnerAddress(walletInfo.address);
      } else {
        setOwnerAddress(null);
        setItems([]);
      }
    } else {
      setOwnerAddress(null);
      setItems([]);
    }
  }, [isWalletConnected, getActiveWalletInfo]);

  // Fetch the wallet's inscriptions from Satflow wallet contents (always fresh,
  // so listing state and prices are current).
  const fetchItems = useCallback(async () => {
    if (!ownerAddress) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const walletItems = await fetchWalletOrdinals(ownerAddress, null, true);
      const visibleItems =
        params.showAll === 'false'
          ? walletItems.filter((item) => item.listed)
          : walletItems;
      const limit = parseInt(params.limit, 10);
      setItems(limit > 0 ? visibleItems.slice(0, limit) : visibleItems);
    } catch (err) {
      console.error('Error fetching wallet ordinals:', err);
      setError(err.message || 'Failed to fetch wallet ordinals');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ownerAddress, params]);

  // Fetch when owner address changes
  useEffect(() => {
    if (ownerAddress) {
      fetchItems();
      hasMountedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress]); // Only depend on ownerAddress to avoid unnecessary refetches

  // Fetch fresh data when params change (limit, showAll)
  // Only fetch if component has already mounted and ownerAddress exists
  useEffect(() => {
    if (ownerAddress && hasMountedRef.current) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.limit, params.showAll]); // Only depend on params, not fetchItems to avoid loops

  // Handle parameter changes
  const handleParamChange = (key, value) => {
    setParams({ ...params, [key]: value });
  };

  // Handle wallet source change (proxy/connected toggle)
  const handleWalletSourceChange = (useProxy) => {
    setUseProxyWallet(useProxy);
  };

  if (!isWalletConnected) {
    return (
      <div className="collection-details-container">
        <div className="collection-details-empty">
          <p className="collection-details-empty-text">
            Please connect a wallet to view your ordinals
          </p>
        </div>
      </div>
    );
  }

  if (!ownerAddress) {
    return (
      <div className="collection-details-container">
        <div className="collection-details-empty">
          <p className="collection-details-empty-text">
            No wallet address available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-details-container">
      <div>
        <h2 className="component-header">My Ordinals</h2>

        {/* Wallet Status Component */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={handleWalletSourceChange}
        />

        {/* Controls */}
        <div className="collection-details-controls">
          <div className="collection-details-form-group">
            <label
              htmlFor="limit-input"
              className="collection-details-form-label"
            >
              Limit:
            </label>
            <input
              id="limit-input"
              type="number"
              min="20"
              max="200"
              step="20"
              value={params.limit}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  const num = parseInt(value, 10);
                  if (!isNaN(num)) {
                    handleParamChange('limit', num.toString());
                  }
                } else {
                  handleParamChange('limit', '100');
                }
              }}
              className="collection-details-form-input"
            />
          </div>

          <div className="collection-details-form-group">
            <label className="collection-details-form-label">Show All:</label>
            <div className="collection-details-checkbox-group">
              <input
                type="checkbox"
                checked={params.showAll === 'true'}
                onChange={(e) =>
                  handleParamChange(
                    'showAll',
                    e.target.checked ? 'true' : 'false'
                  )
                }
                className="collection-details-checkbox"
              />
              <span className="collection-details-checkbox-label">
                Show all items (listed and unlisted)
              </span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && <div className="collection-details-error-box">{error}</div>}

        {/* Items Grid */}
        {items.length > 0 ? (
          <div className="collection-details-grid">
            {items.map((item, index) => (
              <div
                key={index}
                className="collection-details-item"
                onClick={() => {
                  // Emit ordinal selection event for SellOrdinal component
                  // Also emit proxy wallet state so it transfers to SellOrdinal
                  if (glEventHub) {
                    glEventHub.emit('ordinal-selected', item);
                    // Emit proxy wallet state to transfer to SellOrdinal
                    if (useProxyWallet && selectedWallet) {
                      glEventHub.emit('proxy-wallet-state-transfer', {
                        selectedWallet,
                        useProxyWallet: true,
                      });
                    } else {
                      glEventHub.emit('proxy-wallet-state-transfer', {
                        selectedWallet: null,
                        useProxyWallet: false,
                      });
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Item Image */}
                <div className="collection-details-image-section">
                  {item.contentURI || item.contentPreviewURI ? (
                    item.contentType === 'text/html' ||
                    item.contentType?.includes('text/html') ||
                    item.contentType?.includes('html') ? (
                      <iframe
                        src={item.contentURI || item.contentPreviewURI}
                        className="collection-details-image collection-details-iframe"
                        title={
                          item.meta?.name ||
                          `Item #${item.inscriptionNumber || index}`
                        }
                        sandbox="allow-scripts allow-same-origin"
                      />
                    ) : (
                      <img
                        src={item.contentURI || item.contentPreviewURI}
                        alt={
                          item.meta?.name ||
                          `Item #${item.inscriptionNumber || index}`
                        }
                        className="collection-details-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (!e.target.nextSibling) {
                            const placeholder = document.createElement('div');
                            placeholder.className =
                              'collection-details-image-placeholder';
                            placeholder.textContent = '🖼️';
                            e.target.parentNode.appendChild(placeholder);
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="collection-details-image-placeholder">
                      🖼️
                    </div>
                  )}
                </div>

                {/* Item Details */}
                <div className="collection-details-info">
                  <div className="collection-details-name">
                    {item.meta?.name ||
                      item.displayName ||
                      item._satflowRaw?.token?.name ||
                      `#${item.inscriptionNumber || 'Unknown'}`}
                  </div>

                  {item.listed && item.listedPrice && (
                    <div className="collection-details-price">
                      {formatSatsAsBtc(item.listedPrice)} BTC
                    </div>
                  )}

                  <div className="collection-details-meta">
                    <div className="collection-details-meta-item">
                      <span className="collection-details-meta-label">
                        Inscription:
                      </span>
                      <span className="collection-details-meta-value">
                        {formatCompactNumber(item.inscriptionNumber) || 'N/A'}
                      </span>
                    </div>

                    {item.listed && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Status:
                        </span>
                        <span className="collection-details-meta-value listed">
                          Listed
                        </span>
                      </div>
                    )}

                    {item.collectionSymbol && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Collection:
                        </span>
                        <span className="collection-details-meta-value">
                          {item.collectionSymbol}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading && !error ? (
          <div className="collection-details-no-data">
            <p className="collection-details-no-data-text">
              No ordinals found in your wallet.
            </p>
          </div>
        ) : null}

        {/* Loading State */}
        {loading && (
          <div className="collection-details-loading">
            <p className="collection-details-loading-text">
              Loading ordinals...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellOrdinals;
