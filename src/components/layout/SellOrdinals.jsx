import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOrdConnect, OrdConnectProvider } from '@ordzaar/ord-connect';
import { useWalletDisconnectState } from '../../hooks/useLocalStorage';
import WalletStatus from './WalletStatus';
import {
  derivePublicKeyFromPrivateKey,
  generateAddressFromPublicKey,
} from '../../utils/bitcoinUtils';

// Inner component that uses the hooks
const SellOrdinalsInner = ({ glEventHub }) => {
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
    offset: '0',
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
          'SellOrdinals: Restored wallet selection from localStorage:',
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

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('SellOrdinals: Wallet selected:', wallet);
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
        localStorage.removeItem('selected-proxy-wallet');
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
      localStorage.removeItem('selected-proxy-wallet');
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

  // Fetch wallet ordinals
  const fetchItems = useCallback(
    async (customParams = {}, forceRefresh = false) => {
      if (!ownerAddress) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build query params manually
        const queryParams = new URLSearchParams();

        // Add required ownerAddress
        if (ownerAddress) {
          queryParams.append('ownerAddress', ownerAddress);
        }

        // Add showAll
        queryParams.append(
          'showAll',
          params.showAll === 'false' ? 'false' : 'true'
        );

        // Add limit
        if (params.limit) {
          queryParams.append('limit', params.limit);
        }

        // Add offset if provided (and not 0)
        if (params.offset && params.offset !== '0') {
          queryParams.append('offset', params.offset);
        }

        // Add cache-busting timestamp to ensure fresh data when forceRefresh is true
        // This creates a unique cache key, bypassing the 10-minute cache
        if (forceRefresh) {
          queryParams.append('_t', Date.now().toString());
        }

        // Add custom params
        if (customParams && Object.keys(customParams).length > 0) {
          Object.entries(customParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              queryParams.append(key, value.toString());
            }
          });
        }

        // Use API route (works on both localhost and Vercel)
        const queryString = queryParams.toString();
        const fetchUrl = `/api/wallet-tokens?${queryString}`;

        console.log('Fetching wallet ordinals:', {
          ownerAddress,
          url: fetchUrl,
          queryString: queryString,
        });

        const response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        console.log('Magic Eden Wallet API Response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            // Handle error array format
            if (errorJson.error && Array.isArray(errorJson.error)) {
              const errorMessages = errorJson.error
                .map((err) => err.message || JSON.stringify(err))
                .join(', ');
              errorMessage = errorMessages || errorMessage;
            } else if (errorJson.error && typeof errorJson.error === 'string') {
              errorMessage = errorJson.error;
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            } else if (typeof errorJson === 'string') {
              errorMessage = errorJson;
            }
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          console.error('API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            url: fetchUrl,
            error: errorText,
            parsedError: errorMessage,
          });
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Magic Eden Wallet API Response Data:', {
          fullResponse: data,
          itemsCount: data.tokens?.length || 0,
          itemsArray: data.tokens,
          firstItem: data.tokens?.[0],
          responseKeys: Object.keys(data),
        });
        // API returns 'tokens'
        setItems(data.tokens || []);
      } catch (err) {
        console.error('Error fetching wallet ordinals:', err);
        setError(err.message || 'Failed to fetch wallet ordinals');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [ownerAddress, params]
  );

  // Fetch when owner address changes - always force refresh to get latest prices
  useEffect(() => {
    if (ownerAddress) {
      // Always fetch with forceRefresh=true to ensure latest prices
      // This bypasses the 10-minute cache in the API route by adding a timestamp parameter
      fetchItems({}, true);
      hasMountedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress]); // Only depend on ownerAddress to avoid unnecessary refetches

  // Fetch fresh data when params change (limit, showAll, etc.)
  // Only fetch if component has already mounted and ownerAddress exists
  useEffect(() => {
    if (ownerAddress && hasMountedRef.current) {
      // Force refresh when params change to get latest prices
      fetchItems({}, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.limit, params.showAll]); // Only depend on params, not fetchItems to avoid loops

  // Handle parameter changes
  const handleParamChange = (key, value) => {
    const newParams = { ...params, [key]: value, offset: '0' }; // Reset offset when other params change
    setParams(newParams);
  };

  // Handle wallet source change (proxy/connected toggle)
  const handleWalletSourceChange = (useProxy) => {
    setUseProxyWallet(useProxy);
  };

  // Format price - converts sats to BTC for display
  const formatPrice = (priceInSats) => {
    if (!priceInSats && priceInSats !== 0) return 'N/A';
    // Convert sats to BTC (divide by 100000000)
    const btcPrice = priceInSats / 100000000;
    return btcPrice.toFixed(8);
  };

  // Format number
  const formatNumber = (num) => {
    if (!num && num !== 0) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
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
                      `#${item.inscriptionNumber || 'Unknown'}`}
                  </div>

                  {item.listed && item.listedPrice && (
                    <div className="collection-details-price">
                      {formatPrice(item.listedPrice)} BTC
                    </div>
                  )}

                  <div className="collection-details-meta">
                    <div className="collection-details-meta-item">
                      <span className="collection-details-meta-label">
                        Inscription:
                      </span>
                      <span className="collection-details-meta-value">
                        {formatNumber(item.inscriptionNumber) || 'N/A'}
                      </span>
                    </div>

                    {item.satRarity && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Sat Rarity:
                        </span>
                        <span className="collection-details-meta-value">
                          {item.satRarity}
                        </span>
                      </div>
                    )}

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

                    {item.outputValue && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Value:
                        </span>
                        <span className="collection-details-meta-value">
                          {formatNumber(item.outputValue)} sats
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

// Wrapper component that provides the context
const SellOrdinals = ({ glEventHub }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <SellOrdinalsInner glEventHub={glEventHub} />
    </OrdConnectProvider>
  );
};

export default SellOrdinals;
