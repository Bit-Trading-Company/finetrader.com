import React, { useState, useEffect } from 'react';
import {
  useOrdConnect,
  useSign,
  useSendV2,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import WalletStatus from '../wallet/WalletStatus';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';
import {
  getMempoolBroadcastUrl,
  getMempoolTxUrl,
} from '../../lib/mempoolProvider';

// Inner component that uses the hooks
const SignPSBTInner = ({ glEventHub }) => {
  const [psbtInput, setPsbtInput] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const {
    address: connectedAddress,
    format: connectedFormat,
    wallet: connectedWallet,
    network: connectedNetwork,
  } = useOrdConnect();

  const { sign, error: signError, loading: signLoading } = useSign();
  const { isLoading: sendV2Loading } = useSendV2();
  const isDisconnected = useWalletDisconnectState();

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('SignPSBT: Wallet selected:', wallet);
      setSelectedWallet(wallet);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('SignPSBT: Connection state changed:', newConnectionState);
      // Clear form when wallet disconnects
      if (!newConnectionState.isConnected) {
        setPsbtInput('');
        setSignedPsbt('');
        setTxId('');
        setError('');
        setSuccess('');
        setSelectedWallet(null);
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('SignPSBT: Wallet disconnected:', disconnectState);
      setPsbtInput('');
      setSignedPsbt('');
      setTxId('');
      setError('');
      setSuccess('');
      setSelectedWallet(null);
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

  // Clear messages when PSBT input changes
  useEffect(() => {
    if (psbtInput) {
      setError('');
      setSuccess('');
    }
  }, [psbtInput]);

  // Handle sign error changes
  useEffect(() => {
    if (signError) {
      setError(signError);
    }
  }, [signError]);

  const handlePsbtInputChange = (e) => {
    setPsbtInput(e.target.value);
    setSignedPsbt('');
    setTxId('');
    setError('');
    setSuccess('');
  };

  const validatePsbt = (psbtString) => {
    if (!psbtString.trim()) {
      throw new Error('Please enter a PSBT');
    }

    // Basic validation - check if it looks like a base64 PSBT
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(psbtString.trim())) {
      throw new Error('Invalid PSBT format. Please enter a valid base64 PSBT.');
    }

    // Check minimum length (PSBTs are typically much longer)
    if (psbtString.trim().length < 100) {
      throw new Error('PSBT appears to be too short. Please check the format.');
    }
  };

  const handleSignPsbt = async () => {
    try {
      setError('');
      setSuccess('');
      setIsSigning(true);

      // Validate PSBT input
      validatePsbt(psbtInput);

      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (!connectedAddress || !connectedAddress.ordinals) {
        throw new Error('No connected address available');
      }

      // Sign the PSBT using the ord-connect hook
      const result = await sign(connectedAddress.ordinals, psbtInput.trim(), {
        finalize: true,
        extractTx: true,
      });

      if (result && result.hex) {
        setSignedPsbt(result.hex);
        setSuccess('PSBT signed successfully!');
      } else {
        throw new Error('Failed to sign PSBT - no result returned');
      }
    } catch (err) {
      console.error('Error signing PSBT:', err);
      setError(err.message || 'Failed to sign PSBT');
    } finally {
      setIsSigning(false);
    }
  };

  const handleSendPsbt = async () => {
    try {
      setError('');
      setSuccess('');
      setIsSending(true);

      if (!signedPsbt) {
        throw new Error('Please sign the PSBT first');
      }

      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      // Broadcast the signed transaction to the network using configured provider
      const response = await fetch(
        getMempoolBroadcastUrl(connectedNetwork || 'mainnet'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: signedPsbt,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to broadcast transaction: ${response.status} - ${errorText}`
        );
      }

      const txId = await response.text();
      setTxId(txId);
      setSuccess(
        `Transaction broadcasted successfully to the Bitcoin ${connectedNetwork} network!`
      );
    } catch (err) {
      console.error('Error sending PSBT:', err);
      setError(err.message || 'Failed to broadcast transaction');
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const clearForm = () => {
    setPsbtInput('');
    setSignedPsbt('');
    setTxId('');
    setError('');
    setSuccess('');
  };

  // Function to format address or public key (first and last 7 characters)
  const formatString = (str) => {
    if (str && str.length > 14) {
      return `${str.slice(0, 7)}...${str.slice(-7)}`;
    }
    return str || '';
  };

  return (
    <div className="sign-psbt-container component-container">
      <div>
        <h2 className="component-header">Sign PSBT</h2>

        {/* Wallet Status Component */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={() => {}}
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
              Please connect a wallet to sign PSBTs
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
            {/* Connected Wallet Info */}
            <div style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#f7fafc',
                }}
              >
                Connected Wallet
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
                <div>
                  <span style={{ fontWeight: '500' }}>Address:</span>{' '}
                  {formatString(connectedAddress.ordinals)}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Format:</span>{' '}
                  {connectedFormat.ordinals}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Network:</span>{' '}
                  {connectedNetwork}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Wallet:</span>{' '}
                  {connectedWallet}
                </div>
              </div>
            </div>

            {/* PSBT Input Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#f7fafc',
                }}
              >
                PSBT Input
              </h3>
              <textarea
                value={psbtInput}
                onChange={handlePsbtInputChange}
                placeholder="Paste your PSBT here (base64 format)..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  backgroundColor: '#1a202c',
                  border: '1px solid #4a5568',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <p
                style={{
                  fontSize: '11px',
                  color: '#a0aec0',
                  margin: '4px 0 0 0',
                }}
              >
                Enter a PSBT in base64 format. The PSBT will be signed with your
                connected wallet.
              </p>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handleSignPsbt}
                disabled={!psbtInput.trim() || isSigning || signLoading}
                style={{
                  backgroundColor:
                    isSigning || signLoading ? '#4a5568' : '#ed8936',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isSigning || signLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '120px',
                }}
                onMouseOver={(e) => {
                  if (!isSigning && !signLoading) {
                    e.target.style.backgroundColor = '#dd6b20';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSigning && !signLoading) {
                    e.target.style.backgroundColor = '#ed8936';
                  }
                }}
              >
                {isSigning || signLoading ? 'Signing...' : 'Sign PSBT'}
              </button>

              <button
                onClick={handleSendPsbt}
                disabled={!signedPsbt || isSending || sendV2Loading}
                style={{
                  backgroundColor:
                    isSending || sendV2Loading ? '#4a5568' : '#38a169',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor:
                    isSending || sendV2Loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '120px',
                }}
                onMouseOver={(e) => {
                  if (!isSending && !sendV2Loading) {
                    e.target.style.backgroundColor = '#2f855a';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSending && !sendV2Loading) {
                    e.target.style.backgroundColor = '#38a169';
                  }
                }}
              >
                {isSending || sendV2Loading
                  ? 'Broadcasting...'
                  : 'Send Transaction'}
              </button>

              <button
                onClick={clearForm}
                style={{
                  backgroundColor: '#4a5568',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
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
                Clear
              </button>
            </div>

            {/* Results Section */}
            {(signedPsbt || txId) && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Results
                </h3>

                {signedPsbt && (
                  <div style={{ marginBottom: '16px' }}>
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
                        Signed PSBT (Hex):
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

                {txId && (
                  <div>
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
                        Transaction ID:
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => copyToClipboard(txId)}
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
                        <a
                          href={getMempoolTxUrl(
                            txId,
                            connectedNetwork || 'mainnet'
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            backgroundColor: '#ed8936',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </a>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '8px',
                        backgroundColor: '#1a202c',
                        border: '1px solid #4a5568',
                        borderRadius: '4px',
                        color: '#e2e8f0',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {txId}
                    </div>
                  </div>
                )}
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
const SignPSBT = ({ glContainer, glEventHub }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <SignPSBTInner glContainer={glContainer} glEventHub={glEventHub} />
    </OrdConnectProvider>
  );
};

export default SignPSBT;
