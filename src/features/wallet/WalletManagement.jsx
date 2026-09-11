import React, { useState, useEffect, useRef } from 'react';
import {
  useOrdConnect,
  useSignMessage,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import { generateDeterministicWallets } from '../../lib/bitcoinUtils';
import Dispatch from './Dispatch';
import WalletDetails from './WalletDetails';
import { shortenAddress } from '../../lib/format';

// Inner component that uses the hooks
const WalletManagementInner = ({ glEventHub }) => {
  const { address: connectedAddress, wallet: connectedWallet } =
    useOrdConnect();

  const { signMsg } = useSignMessage();

  const [wallets, setWallets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [hoveredWallet, setHoveredWallet] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ top: 0, left: 0 });
  const [error, setError] = useState(null);
  const [walletCount, setWalletCount] = useState(10);
  const [connectionState, setConnectionState] = useState(null);
  const [showDispatch, setShowDispatch] = useState(false);
  const walletListRef = useRef(null);
  const walletScrollRef = useRef(null);

  // Check if wallet is connected
  const isWalletConnected = connectedAddress && connectedAddress.ordinals;

  // Listen for wallet connection changes from other components
  useEffect(() => {
    const handleConnectionChange = (newConnectionState) => {
      console.log(
        'WalletManagement: Connection state changed:',
        newConnectionState
      );
      setConnectionState(newConnectionState);
      // Clear wallets when wallet disconnects
      if (!newConnectionState.isConnected) {
        setWallets([]);
        setSelectedWallet(null);
        setError(null);
        // Clear persisted wallet selection
        localStorage.removeItem('selected-proxy-wallet');
      }
    };

    const handleDisconnect = (disconnectState) => {
      console.log('WalletManagement: Wallet disconnected:', disconnectState);
      setConnectionState(disconnectState);
      setWallets([]);
      setSelectedWallet(null);
      setError(null);
    };

    // Listen for wallet state requests from other components
    const handleRequestWalletState = () => {
      if (selectedWallet && glEventHub) {
        // Emit current wallet state to components that request it
        glEventHub.emit('wallet-selected', selectedWallet);
      }
    };

    if (glEventHub) {
      glEventHub.on('wallet-connection-changed', handleConnectionChange);
      glEventHub.on('wallet-disconnected', handleDisconnect);
      glEventHub.on('request-wallet-state', handleRequestWalletState);
    }

    return () => {
      if (glEventHub) {
        glEventHub.off('wallet-connection-changed', handleConnectionChange);
        glEventHub.off('wallet-disconnected', handleDisconnect);
        glEventHub.off('request-wallet-state', handleRequestWalletState);
      }
    };
  }, [glEventHub, selectedWallet]);

  // Update connection state when OrdConnect state changes
  useEffect(() => {
    const newConnectionState = {
      isConnected: isWalletConnected,
      address: connectedAddress?.ordinals,
      wallet: connectedWallet,
    };
    setConnectionState(newConnectionState);

    // Clear wallets when wallet disconnects
    if (!isWalletConnected) {
      setWallets([]);
      setSelectedWallet(null);
      setError(null);
      // Clear persisted wallet selection
      localStorage.removeItem('selected-proxy-wallet');
    }
  }, [isWalletConnected, connectedAddress, connectedWallet]);

  // Restore selected wallet from localStorage when wallets are generated
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      const storedWallet = localStorage.getItem('selected-proxy-wallet');
      if (storedWallet) {
        try {
          const walletData = JSON.parse(storedWallet);
          // Find the wallet with matching index
          const restoredWallet = wallets.find(
            (w) => w.index === walletData.index
          );
          if (restoredWallet) {
            setSelectedWallet(restoredWallet);
            // Emit event to notify other components
            if (glEventHub) {
              glEventHub.emit('wallet-selected', restoredWallet);
            }
          }
        } catch (err) {
          console.error('Error restoring selected wallet:', err);
          localStorage.removeItem('selected-proxy-wallet');
        }
      }
    }
  }, [wallets, selectedWallet, glEventHub]);

  // Add visual feedback when wallets are cleared due to disconnection
  useEffect(() => {
    if (connectionState && !connectionState.isConnected && wallets.length > 0) {
      setError('Wallet disconnected - generated wallets cleared');
      // Clear the error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  }, [connectionState, wallets.length]);

  // Clear error when wallet reconnects
  useEffect(() => {
    if (
      connectionState &&
      connectionState.isConnected &&
      error &&
      error.includes('disconnected')
    ) {
      setError(null);
    }
  }, [connectionState, error]);

  const handleGenerateWallets = async () => {
    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Request signature from the connected wallet
      const message = 'Generate Fine Trading proxy wallets';
      const signature = await signMsg(connectedAddress.ordinals, message);

      if (!signature) {
        throw new Error('Failed to get signature from wallet');
      }

      // Generate deterministic wallets using the signature
      const generatedWallets = await generateDeterministicWallets(
        signature,
        walletCount
      );
      setWallets(generatedWallets);

      // Emit event with all generated wallets for other components (e.g., AutoTrade)
      if (glEventHub) {
        glEventHub.emit('wallets-generated', generatedWallets);
      }

      // Generated wallets successfully
    } catch (err) {
      // Error generating wallets
      setError(err.message || 'Failed to generate wallets');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWalletSelect = (wallet) => {
    setSelectedWallet(wallet);
    // Store selected wallet in localStorage for persistence across navigation
    if (wallet) {
      localStorage.setItem(
        'selected-proxy-wallet',
        JSON.stringify({
          index: wallet.index,
          address: wallet.address,
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey, // Store for signing operations
        })
      );
    } else {
      localStorage.removeItem('selected-proxy-wallet');
    }
    // Emit event to other components
    if (glEventHub) {
      glEventHub.emit('wallet-selected', wallet);
    }
  };

  return (
    <div className="wallet-management-container">
      <div className="wallet-management-wrapper">
        <h2 className="component-header">Multi-Wallet Management</h2>

        {/* Connection Status Indicator */}
        {connectionState && (
          <div
            className={`wallet-connection-status-box ${
              connectionState.isConnected ? 'connected' : 'disconnected'
            }`}
          >
            <p
              className={`wallet-connection-status-text ${
                connectionState.isConnected ? 'connected' : 'disconnected'
              }`}
            >
              <span className="wallet-connection-status-icon">
                {connectionState.isConnected ? '✓' : '✗'}
              </span>
              {connectionState.isConnected
                ? 'Wallet Connected'
                : 'Wallet Disconnected'}
            </p>
            {connectionState.isConnected && connectionState.address && (
              <p className="wallet-connection-address">
                {shortenAddress(connectionState.address)}
              </p>
            )}
          </div>
        )}

        {!isWalletConnected ? (
          <div className="wallet-not-connected-box">
            <p className="wallet-not-connected-text">
              Connect a wallet to manage wallets
            </p>
          </div>
        ) : (
          <div>
            <div className="wallet-connected-info">
              <p className="wallet-connected-address">
                Connected: {shortenAddress(connectedAddress.ordinals)}
              </p>

              <div className="wallet-count-controls">
                <label
                  htmlFor="wallet-count-input"
                  className="wallet-count-label"
                >
                  Number of wallets:
                </label>
                <input
                  id="wallet-count-input"
                  type="number"
                  min="1"
                  max="100"
                  value={walletCount}
                  onChange={(e) =>
                    setWalletCount(
                      Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                    )
                  }
                  className="wallet-count-input"
                />
              </div>

              <button
                onClick={handleGenerateWallets}
                disabled={isGenerating}
                className="wallet-generate-button"
              >
                {isGenerating
                  ? 'Generating...'
                  : `Generate ${walletCount} Wallets`}
              </button>
            </div>

            {error && (
              <div
                className={`wallet-error-box ${
                  error.includes('disconnected') ? 'disconnected' : 'error'
                }`}
              >
                {error}
              </div>
            )}

            {wallets.length > 0 && (
              <>
                <div className="wallet-generated-list" ref={walletListRef}>
                  <div className="wallet-generated-header-section">
                    <h3 className="wallet-generated-header">
                      Generated Wallets ({wallets.length})
                    </h3>
                    <button
                      onClick={() => setShowDispatch(true)}
                      className="wallet-dispatch-button"
                      type="button"
                    >
                      Dispatch
                    </button>
                  </div>
                  <div
                    className="wallet-generated-scroll"
                    ref={walletScrollRef}
                  >
                    {wallets.map((wallet, index) => (
                      <button
                        key={index}
                        onClick={() => handleWalletSelect(wallet)}
                        onMouseEnter={(e) => {
                          setHoveredWallet(wallet);
                          // Calculate position for tooltip relative to viewport (right side)
                          // getBoundingClientRect() already returns viewport coordinates
                          const rect = e.currentTarget.getBoundingClientRect();
                          const viewportHeight = window.innerHeight;
                          const viewportWidth = window.innerWidth;

                          // Estimate tooltip height (using max-height from CSS: 80vh)
                          const estimatedTooltipHeight = Math.min(
                            viewportHeight * 0.8,
                            600 // max-height from CSS
                          );

                          // Calculate initial position - position tooltip 150px higher than wallet button
                          // This prevents the tooltip from running off the bottom of the screen
                          let top = 100;
                          let left = rect.left + rect.width + 8;

                          // Ensure tooltip doesn't go above the top of viewport
                          if (top < 16) {
                            top = 16; // 16px margin from top
                          }

                          // Adjust top if tooltip would overflow bottom of viewport
                          if (top + estimatedTooltipHeight > viewportHeight) {
                            top = viewportHeight - estimatedTooltipHeight - 16; // 16px margin from bottom
                            // Ensure it doesn't go above the top after adjustment
                            if (top < 16) {
                              top = 16;
                            }
                          }

                          // Adjust left if tooltip would overflow right of viewport
                          const estimatedTooltipWidth = 500; // min-width from CSS
                          if (left + estimatedTooltipWidth > viewportWidth) {
                            // Position to the left of the wallet item instead
                            left = rect.left - estimatedTooltipWidth - 8;
                            // Ensure it doesn't go off the left edge
                            if (left < 16) {
                              left = 16;
                            }
                          }

                          setHoverPosition({
                            top: top,
                            left: left,
                          });
                        }}
                        onMouseLeave={() => {
                          // Don't clear on mouse leave - let the tooltip handle it
                        }}
                        type="button"
                        aria-label={`Select wallet ${wallet.index + 1}`}
                        className={`wallet-generated-item ${
                          selectedWallet?.index === wallet.index
                            ? 'selected'
                            : ''
                        }`}
                      >
                        <div className="wallet-generated-number">
                          Wallet #{wallet.index + 1}
                        </div>
                        <div className="wallet-generated-address">
                          {shortenAddress(wallet.address)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Wallet Details Tooltip - Rendered outside list container for fixed positioning */}
                {hoveredWallet && (
                  <div
                    className="wallet-details-tooltip"
                    style={{
                      position: 'fixed',
                      top: `${hoverPosition.top}px`,
                      left: `${hoverPosition.left}px`,
                      zIndex: 10000,
                    }}
                    onMouseEnter={() => {
                      // Keep tooltip visible when hovering over it
                      setHoveredWallet(hoveredWallet);
                    }}
                    onMouseLeave={() => {
                      // Hide tooltip when mouse leaves
                      setHoveredWallet(null);
                    }}
                  >
                    <WalletDetails
                      glEventHub={glEventHub}
                      wallet={hoveredWallet}
                      blurPrivateKey
                    />
                  </div>
                )}
                <Dispatch
                  isOpen={showDispatch}
                  onClose={() => setShowDispatch(false)}
                  proxyWallets={wallets}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper component that provides the context
const WalletManagement = ({ glEventHub }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <WalletManagementInner glEventHub={glEventHub} />
    </OrdConnectProvider>
  );
};

export default WalletManagement;
