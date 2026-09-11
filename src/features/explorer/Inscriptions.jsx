import React, { useState, useEffect, useCallback } from 'react';
import { useOrdConnect } from '@ordzaar/ord-connect';
import WalletStatus from '../wallet/WalletStatus';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';

const Inscriptions = ({ glEventHub }) => {
  const { network, address: connectedAddress } = useOrdConnect();
  const [selectedWallet, setSelectedWallet] = useState(null);
  const isDisconnected = useWalletDisconnectState();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
  });

  // Define fetchInscriptions function first
  const fetchInscriptions = useCallback(
    async (offset = 0) => {
      // Check if we have either a selected wallet or a connected wallet
      const hasWallet =
        selectedWallet || (connectedAddress && connectedAddress.ordinals);

      if (!hasWallet) {
        return;
      }

      if (network !== 'mainnet') {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Determine which address to use based on toggle state
        let address;
        if (useProxyWallet && selectedWallet) {
          // Use proxy wallet (selected wallet)
          address = selectedWallet.addresses.p2tr;
        } else {
          // Use connected wallet
          address = connectedAddress.ordinals;
        }

        const apiUrl = `https://api.hiro.so/ordinals/v1/inscriptions?address=${encodeURIComponent(address)}&limit=${pagination.limit}&offset=${offset}&order_by=number&order=desc`;

        const response = await fetch(apiUrl, {
          headers: {
            Accept: 'application/json',
            // Optional: Hiro serves unauthenticated requests at lower rate limits.
            ...(process.env.REACT_APP_HIRO_API_KEY
              ? { 'x-hiro-api-key': process.env.REACT_APP_HIRO_API_KEY }
              : {}),
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();

        if (offset === 0) {
          setInscriptions(data.results || []);
        } else {
          setInscriptions((prev) => [...prev, ...(data.results || [])]);
        }

        setPagination((prev) => ({
          ...prev,
          offset: data.offset || offset,
          total: data.total || 0,
        }));
      } catch (err) {
        setError(err.message || 'Failed to fetch inscriptions');
      } finally {
        setLoading(false);
      }
    },
    [
      selectedWallet,
      connectedAddress,
      network,
      pagination.limit,
      useProxyWallet,
    ]
  );

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('Inscriptions: Wallet selected:', wallet?.index);
      setSelectedWallet(wallet);
      setInscriptions([]);
      setPagination((prev) => ({ ...prev, offset: 0, total: 0 }));
      setError(null);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log(
        'Inscriptions: Connection state changed:',
        newConnectionState
      );
      // Clear inscriptions when wallet disconnects
      if (!newConnectionState.isConnected) {
        setSelectedWallet(null);
        setInscriptions([]);
        setPagination((prev) => ({ ...prev, offset: 0, total: 0 }));
        setError(null);
        setUseProxyWallet(false); // Reset toggle to connected wallet
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('Inscriptions: Wallet disconnected:', disconnectState);
      setSelectedWallet(null);
      setInscriptions([]);
      setPagination((prev) => ({ ...prev, offset: 0, total: 0 }));
      setError(null);
      setUseProxyWallet(false); // Reset toggle to connected wallet
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

  // Fetch inscriptions when wallet is selected or connected and network is mainnet
  useEffect(() => {
    const hasWallet =
      selectedWallet ||
      (connectedAddress && connectedAddress.ordinals && !isDisconnected);

    if (hasWallet && network === 'mainnet') {
      fetchInscriptions();
    } else if (hasWallet && network !== 'mainnet') {
      setInscriptions([]);
      setError('Inscriptions are only available on mainnet');
    } else if (isDisconnected) {
      // Clear inscriptions when wallet is disconnected
      setInscriptions([]);
      setError(null);
    }
  }, [
    selectedWallet,
    connectedAddress,
    network,
    useProxyWallet,
    fetchInscriptions,
    isDisconnected,
  ]);

  const loadMore = () => {
    if (!loading && inscriptions.length < pagination.total) {
      fetchInscriptions(pagination.offset + pagination.limit);
    }
  };

  const formatInscriptionId = (id) => {
    if (!id) return '';
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getMimeTypeIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.startsWith('text/')) return '📄';
    if (mimeType?.includes('json')) return '📋';
    if (mimeType?.includes('html')) return '🌐';
    return '📄';
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Successfully copied to clipboard
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div
      className="inscriptions-container"
      style={{
        height: '100%',
        padding: '16px',
        backgroundColor: '#1a202c',
        color: '#e2e8f0',
        overflow: 'auto',
      }}
    >
      <div>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#f7fafc',
          }}
        >
          Inscriptions
        </h2>

        {/* Wallet Status Component */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={setUseProxyWallet}
        />

        {!selectedWallet &&
        !(connectedAddress && connectedAddress.ordinals && !isDisconnected) ? (
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
              Connect a wallet or select a wallet from the Wallet Management
              panel to view inscriptions
            </p>
          </div>
        ) : network !== 'mainnet' ? (
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
              Inscriptions are only available on mainnet (current: {network})
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
            <div style={{ marginBottom: '16px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#f7fafc',
                }}
              >
                {useProxyWallet && selectedWallet
                  ? `Proxy Wallet #${selectedWallet.index + 1} Inscriptions`
                  : 'Connected Wallet Inscriptions'}
              </h3>
              <p
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  margin: 0,
                }}
              >
                Address:{' '}
                {(useProxyWallet && selectedWallet
                  ? selectedWallet.addresses.p2tr
                  : connectedAddress.ordinals
                ).slice(0, 20)}
                ...
              </p>
            </div>

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

            {loading && inscriptions.length === 0 && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#a0aec0',
                }}
              >
                Loading inscriptions...
              </div>
            )}

            {inscriptions.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#a0aec0',
                      margin: 0,
                    }}
                  >
                    {inscriptions.length} of {pagination.total} inscriptions
                  </p>
                </div>

                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                  }}
                >
                  {inscriptions.map((inscription, index) => (
                    <div
                      key={inscription.id || index}
                      style={{
                        padding: '12px',
                        borderBottom:
                          index < inscriptions.length - 1
                            ? '1px solid #4a5568'
                            : 'none',
                        backgroundColor: '#1a202c',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '500',
                              color: '#f7fafc',
                              marginBottom: '4px',
                            }}
                          >
                            #{inscription.number}{' '}
                            {getMimeTypeIcon(inscription.mime_type)}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#a0aec0',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                            }}
                          >
                            {formatInscriptionId(inscription.id)}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(inscription.id)}
                          style={{
                            backgroundColor: '#4a5568',
                            color: 'white',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            marginLeft: '8px',
                          }}
                        >
                          Copy ID
                        </button>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          fontSize: '11px',
                          color: '#a0aec0',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: '500' }}>Type:</span>{' '}
                          {inscription.mime_type || 'Unknown'}
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Size:</span>{' '}
                          {inscription.content_length || 0} bytes
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Block:</span>{' '}
                          {inscription.genesis_block_height || 'Unknown'}
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Date:</span>{' '}
                          {formatTimestamp(inscription.genesis_timestamp)}
                        </div>
                      </div>

                      {inscription.sat_rarity && (
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            color: '#ed8936',
                            fontWeight: '500',
                          }}
                        >
                          Rarity: {inscription.sat_rarity}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {inscriptions.length < pagination.total && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      backgroundColor: loading ? '#4a5568' : '#ed8936',
                      color: 'white',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = '#dd6b20';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = '#ed8936';
                      }
                    }}
                    onFocus={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = '#dd6b20';
                      }
                    }}
                    onBlur={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = '#ed8936';
                      }
                    }}
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </div>
            )}

            {!loading && inscriptions.length === 0 && !error && (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#a0aec0',
                }}
              >
                <p style={{ margin: 0 }}>
                  No inscriptions found for this wallet
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inscriptions;
