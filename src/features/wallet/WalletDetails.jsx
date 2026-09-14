import React, { useState, useEffect } from 'react';
import WalletStatus from './WalletStatus';
import { getMempoolAddressUrl } from '../../lib/mempoolProvider';
import { shortenAddress } from '../../lib/format';

const WalletDetails = ({
  glEventHub,
  wallet: walletProp,
  blurPrivateKey = false,
}) => {
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [mempoolData, setMempoolData] = useState(null);
  const [mempoolLoading, setMempoolLoading] = useState(false);
  const [mempoolError, setMempoolError] = useState(null);
  const [privateKeyHovered, setPrivateKeyHovered] = useState(false);

  // Initialize from prop when component mounts or prop changes
  useEffect(() => {
    if (walletProp) {
      setSelectedWallet(walletProp);
    } else {
      setSelectedWallet(null);
    }
  }, [walletProp]);

  useEffect(() => {
    // Listen for wallet selection events from WalletManagement (for dynamic updates)
    const handleWalletSelect = (wallet) => {
      console.log('WalletDetails: Wallet selected via event:', wallet?.index);
      // Only update if no prop is provided
      if (!walletProp) {
        setSelectedWallet(wallet);
      }
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log(
        'WalletDetails: Connection state changed:',
        newConnectionState
      );
      // Clear selected wallet when wallet disconnects (only if no prop)
      if (!newConnectionState.isConnected && !walletProp) {
        setSelectedWallet(null);
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('WalletDetails: Wallet disconnected:', disconnectState);
      // Only clear if no prop is provided
      if (!walletProp) {
        setSelectedWallet(null);
      }
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
  }, [glEventHub, walletProp]);

  // Fetch mempool API data when wallet changes
  useEffect(() => {
    const fetchMempoolData = async () => {
      if (!selectedWallet || !selectedWallet.addresses?.p2tr) {
        setMempoolData(null);
        setMempoolError(null);
        return;
      }

      setMempoolLoading(true);
      setMempoolError(null);

      try {
        const address = selectedWallet.addresses.p2tr;
        const response = await fetch(getMempoolAddressUrl(address, 'mainnet'));

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setMempoolData(data);
      } catch (err) {
        console.error('Error fetching mempool data:', err);
        setMempoolError(err.message || 'Failed to fetch address data');
        setMempoolData(null);
      } finally {
        setMempoolLoading(false);
      }
    };

    fetchMempoolData();
  }, [selectedWallet]);

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Successfully copied to clipboard
      })
      .catch(() => {
        // Failed to copy to clipboard
      });
  };

  return (
    <div className="wallet-details-container">
      <div>
        {/* Wallet Status Component - Only show if wallet is from event (not prop) */}
        {!walletProp && (
          <WalletStatus
            glEventHub={glEventHub}
            selectedWallet={selectedWallet}
            onWalletSourceChange={() => {}}
          />
        )}

        {!selectedWallet ? (
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
              Select a wallet from the Wallet Management panel to view details
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
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '20px',
                color: '#f7fafc',
                borderBottom: '1px solid #4a5568',
                paddingBottom: '8px',
              }}
            >
              Wallet #{selectedWallet.index + 1}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="index-display"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Index
              </label>
              <div
                id="index-display"
                style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  color: '#e2e8f0',
                }}
              >
                {selectedWallet.index}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="p2tr-address"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Taproot Address (P2TR) - Primary
              </label>
              <div
                id="p2tr-address"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  wordBreak: 'break-all',
                  position: 'relative',
                  color: '#e2e8f0',
                }}
              >
                {selectedWallet.addresses.p2tr}
                <button
                  onClick={() => copyToClipboard(selectedWallet.addresses.p2tr)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#2d3748';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#4a5568';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="p2wpkh-address"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Native SegWit (P2WPKH)
              </label>
              <div
                id="p2wpkh-address"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  wordBreak: 'break-all',
                  position: 'relative',
                  color: '#e2e8f0',
                }}
              >
                {selectedWallet.addresses.p2wpkh}
                <button
                  onClick={() =>
                    copyToClipboard(selectedWallet.addresses.p2wpkh)
                  }
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#2d3748';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#4a5568';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="p2pkh-address"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Legacy (P2PKH)
              </label>
              <div
                id="p2pkh-address"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  wordBreak: 'break-all',
                  position: 'relative',
                  color: '#e2e8f0',
                }}
              >
                {selectedWallet.addresses.p2pkh}
                <button
                  onClick={() =>
                    copyToClipboard(selectedWallet.addresses.p2pkh)
                  }
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#2d3748';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#4a5568';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="public-key"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Public Key
              </label>
              <div
                id="public-key"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  wordBreak: 'break-all',
                  position: 'relative',
                  color: '#e2e8f0',
                }}
              >
                {shortenAddress(selectedWallet.publicKey)}
                <button
                  onClick={() => copyToClipboard(selectedWallet.publicKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#2d3748';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#4a5568';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="private-key"
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Private Key
                {blurPrivateKey && (
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      fontWeight: '400',
                      color: '#718096',
                    }}
                  >
                    (hover field to reveal)
                  </span>
                )}
              </label>
              <div
                id="private-key"
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#1a202c',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  wordBreak: 'break-all',
                  position: 'relative',
                  color: '#e2e8f0',
                }}
                onMouseEnter={() =>
                  blurPrivateKey && setPrivateKeyHovered(true)
                }
                onMouseLeave={() =>
                  blurPrivateKey && setPrivateKeyHovered(false)
                }
              >
                <span
                  style={{
                    display: 'inline',
                    filter:
                      blurPrivateKey && !privateKeyHovered
                        ? 'blur(6px)'
                        : 'none',
                    transition: blurPrivateKey
                      ? 'filter 0.15s ease'
                      : undefined,
                    userSelect: blurPrivateKey ? 'none' : undefined,
                  }}
                >
                  {shortenAddress(selectedWallet.privateKey)}
                </span>
                <button
                  onClick={() => copyToClipboard(selectedWallet.privateKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#2d3748';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#4a5568';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Mempool.space API Data Section */}
            {selectedWallet && (
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid #4a5568',
                }}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: '#f7fafc',
                  }}
                >
                  Address Statistics (mempool.space)
                </h3>

                {mempoolLoading && (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#a0aec0',
                    }}
                  >
                    Loading address data...
                  </div>
                )}

                {mempoolError && (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#2d1b1b',
                      borderRadius: '6px',
                      border: '1px solid #e53e3e',
                      color: '#fed7d7',
                      marginBottom: '16px',
                    }}
                  >
                    Error: {mempoolError}
                  </div>
                )}

                {mempoolData && (
                  <div>
                    {/* Address */}
                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          color: '#a0aec0',
                          display: 'block',
                          marginBottom: '6px',
                          fontWeight: '500',
                        }}
                      >
                        Address
                      </label>
                      <div
                        style={{
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          backgroundColor: '#1a202c',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #4a5568',
                          wordBreak: 'break-all',
                          color: '#e2e8f0',
                        }}
                      >
                        {mempoolData.address}
                      </div>
                    </div>

                    {/* Chain Stats */}
                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          color: '#a0aec0',
                          display: 'block',
                          marginBottom: '8px',
                          fontWeight: '500',
                        }}
                      >
                        Chain Statistics (Confirmed)
                      </label>
                      <div
                        style={{
                          backgroundColor: '#1a202c',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #4a5568',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Transaction Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.chain_stats?.tx_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Funded TXO Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.chain_stats?.funded_txo_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Funded TXO Sum (sats):
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.chain_stats?.funded_txo_sum?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Spent TXO Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.chain_stats?.spent_txo_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Spent TXO Sum (sats):
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.chain_stats?.spent_txo_sum?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mempool Stats */}
                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          color: '#a0aec0',
                          display: 'block',
                          marginBottom: '8px',
                          fontWeight: '500',
                        }}
                      >
                        Mempool Statistics (Unconfirmed)
                      </label>
                      <div
                        style={{
                          backgroundColor: '#1a202c',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #4a5568',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Transaction Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.mempool_stats?.tx_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Funded TXO Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.mempool_stats?.funded_txo_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Funded TXO Sum (sats):
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.mempool_stats?.funded_txo_sum?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Spent TXO Count:
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.mempool_stats?.spent_txo_count || 0}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#a0aec0' }}>
                              Spent TXO Sum (sats):
                            </span>
                            <span
                              style={{
                                color: '#e2e8f0',
                                marginLeft: '8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {mempoolData.mempool_stats?.spent_txo_sum?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDetails;
