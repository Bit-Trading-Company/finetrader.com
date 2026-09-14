import React, { useState, useEffect, useCallback } from 'react';
import { useOrdConnect } from '@ordzaar/ord-connect';
import WalletStatus from '../wallet/WalletStatus';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';
import { getMempoolAddressUtxoUrl } from '../../lib/mempoolProvider';

const UTXOs = ({ glEventHub }) => {
  const { network, address: connectedAddress } = useOrdConnect();
  const [selectedWallet, setSelectedWallet] = useState(null);
  const isDisconnected = useWalletDisconnectState();
  const [utxos, setUtxos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);

  // Define fetchUTXOs function
  const fetchUTXOs = useCallback(async () => {
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

      const apiUrl = getMempoolAddressUtxoUrl(address, 'mainnet');

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      setUtxos(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch UTXOs');
    } finally {
      setLoading(false);
    }
  }, [selectedWallet, connectedAddress, network, useProxyWallet]);

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('UTXOs: Wallet selected:', wallet?.index);
      setSelectedWallet(wallet);
      setUtxos([]);
      setError(null);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('UTXOs: Connection state changed:', newConnectionState);
      // Clear UTXOs when wallet disconnects
      if (!newConnectionState.isConnected) {
        setSelectedWallet(null);
        setUtxos([]);
        setError(null);
        setUseProxyWallet(false); // Reset toggle to connected wallet
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('UTXOs: Wallet disconnected:', disconnectState);
      setSelectedWallet(null);
      setUtxos([]);
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

  // Fetch UTXOs when wallet is selected or connected and network is mainnet
  useEffect(() => {
    const hasWallet =
      selectedWallet ||
      (connectedAddress && connectedAddress.ordinals && !isDisconnected);

    if (hasWallet && network === 'mainnet') {
      fetchUTXOs();
    } else if (hasWallet && network !== 'mainnet') {
      setUtxos([]);
      setError('UTXOs are only available on mainnet');
    } else if (isDisconnected) {
      // Clear UTXOs when wallet is disconnected
      setUtxos([]);
      setError(null);
    }
  }, [
    selectedWallet,
    connectedAddress,
    network,
    useProxyWallet,
    fetchUTXOs,
    isDisconnected,
  ]);

  const formatTxId = (txid) => {
    if (!txid) return '';
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  };

  const formatValue = (value) => {
    if (!value) return '0';
    return (value / 100000000).toFixed(8); // Convert satoshis to BTC
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getStatusIcon = (status) => {
    if (status?.confirmed) return '✓';
    return '⏳';
  };

  const getStatusColor = (status) => {
    if (status?.confirmed) return '#48bb78';
    return '#ed8936';
  };

  return (
    <div
      className="utxos-container"
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
          Explore UTXOs
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
              panel to view UTXOs
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
              UTXOs are only available on mainnet (current: {network})
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
                  ? `Proxy Wallet #${selectedWallet.index + 1} UTXOs`
                  : 'Connected Wallet UTXOs'}
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

            {loading && utxos.length === 0 && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#a0aec0',
                }}
              >
                Loading UTXOs...
              </div>
            )}

            {utxos.length > 0 && (
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
                    {utxos.length} UTXO{utxos.length !== 1 ? 's' : ''} found
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#48bb78',
                      margin: 0,
                      fontWeight: '500',
                    }}
                  >
                    Total:{' '}
                    {formatValue(
                      utxos.reduce((sum, utxo) => sum + utxo.value, 0)
                    )}{' '}
                    BTC
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
                  {utxos.map((utxo, index) => (
                    <div
                      key={`${utxo.txid}-${utxo.vout}`}
                      style={{
                        padding: '12px',
                        borderBottom:
                          index < utxos.length - 1
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{ color: getStatusColor(utxo.status) }}
                            >
                              {getStatusIcon(utxo.status)}
                            </span>
                            UTXO #{index + 1}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#a0aec0',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                            }}
                          >
                            {formatTxId(utxo.txid)}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(utxo.txid)}
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
                          Copy TXID
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
                          <span style={{ fontWeight: '500' }}>Value:</span>{' '}
                          <span style={{ color: '#48bb78', fontWeight: '600' }}>
                            {formatValue(utxo.value)} BTC
                          </span>
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Vout:</span>{' '}
                          {utxo.vout}
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Status:</span>{' '}
                          <span style={{ color: getStatusColor(utxo.status) }}>
                            {utxo.status?.confirmed
                              ? 'Confirmed'
                              : 'Unconfirmed'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontWeight: '500' }}>Block:</span>{' '}
                          {utxo.status?.block_height || 'Pending'}
                        </div>
                      </div>

                      {utxo.status?.confirmed && (
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            color: '#a0aec0',
                          }}
                        >
                          <span style={{ fontWeight: '500' }}>Confirmed:</span>{' '}
                          {formatTimestamp(utxo.status.block_time)}
                        </div>
                      )}

                      {utxo.status?.block_hash && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10px',
                            color: '#718096',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                          }}
                        >
                          Block: {formatTxId(utxo.status.block_hash)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && utxos.length === 0 && !error && (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#a0aec0',
                }}
              >
                <p style={{ margin: 0 }}>No UTXOs found for this wallet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UTXOs;
