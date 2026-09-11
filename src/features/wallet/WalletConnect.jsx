import React, { useState, useEffect } from 'react';
import { useOrdConnect, Chain, OrdConnectProvider } from '@ordzaar/ord-connect';
import { useConnect } from './useConnect.ts';
import { useBitprint, BitprintProvider } from './bitprint.tsx';
import { truncateMiddle } from '../../lib/format';
import { CONNECT_WALLET_LIST } from './walletOptions';

// Chain tabs configuration (currently unused but kept for future use)
// const CONNECT_TABS_DATA_LIST = [
//   {
//     icon: <BtcIcon />,
//     name: 'btc',
//   },
//   {
//     icon: <EthIcon />,
//     name: 'eth',
//   },
//   {
//     icon: <SolIcon />,
//     name: 'sol',
//   },
// ];

// Inner component that uses the hooks
const WalletConnectInner = ({ glEventHub }) => {
  const [activeTab, setActiveTab] = useState('wallet');
  const [chainTab] = useState('btc');
  const [errorMessage, setErrorMessage] = useState('');
  const [previousConnectionState, setPreviousConnectionState] = useState(null);

  const {
    network,
    disconnectWallet,
    address: connectedAddress,
    publicKey: connectedPublicKey,
    format: connectedFormat,
    wallet: connectedWallet,
    chain,
    updateNetwork,
  } = useOrdConnect();

  const { globalState: bitprint } = useBitprint();

  const { connectWallet } = useConnect({
    onClose: () => {
      // Default no-op function
    },
    onError: (err) => {
      setErrorMessage(err);
    },
  });

  // Check for disconnect state on component mount and force disconnect if needed
  useEffect(() => {
    const wasDisconnected =
      localStorage.getItem('wallet-disconnected') === 'true';

    if (wasDisconnected) {
      console.log(
        'Wallet was disconnected, ensuring bitprint and ord-connect are disconnected'
      );

      // Ensure bitprint is disconnected
      if (bitprint && bitprint.disconnect) {
        bitprint.disconnect();
      }

      // Force disconnect from ord-connect if it auto-reconnected
      if (connectedAddress && connectedAddress.ordinals) {
        console.log('Forcing disconnect from ord-connect');
        disconnectWallet();
      }
    }
  }, [bitprint, connectedAddress, disconnectWallet]); // Include dependencies

  // Monitor connection state changes and emit events
  useEffect(() => {
    // Check if wallet was explicitly disconnected and stored in localStorage
    const wasDisconnected =
      localStorage.getItem('wallet-disconnected') === 'true';

    const isConnected =
      connectedAddress && connectedAddress.ordinals && !wasDisconnected;
    const connectionState = {
      isConnected,
      address: connectedAddress?.ordinals || null,
      publicKey: connectedPublicKey?.ordinals || null,
      format: connectedFormat?.ordinals || null,
      wallet: connectedWallet,
      network,
      chain,
    };

    // Check if we're in a disconnected state and ignore reconnection attempts
    if ((bitprint && bitprint.isDisconnected) || wasDisconnected) {
      if (isConnected) {
        console.log(
          'Ignoring reconnection attempt - wallet was explicitly disconnected'
        );
        return;
      }
    }

    // Only emit if the connection state has actually changed
    if (
      JSON.stringify(connectionState) !==
      JSON.stringify(previousConnectionState)
    ) {
      console.log('Wallet connection state changed:', connectionState);

      // Check if a new wallet was connected (different address)
      if (isConnected && connectionState.address) {
        const previousWalletAddress = localStorage.getItem(
          'previous-wallet-address'
        );
        const currentWalletAddress = connectionState.address;

        // If there's a previous address and it's different from the current one, refresh the page
        if (
          previousWalletAddress &&
          previousWalletAddress !== currentWalletAddress
        ) {
          console.log('New wallet connected - refreshing page');
          // Store the new address before refreshing
          localStorage.setItem('previous-wallet-address', currentWalletAddress);
          // Refresh the page
          window.location.reload();
          return; // Exit early since we're refreshing
        } else if (!previousWalletAddress) {
          // First time connecting a wallet, store the address
          localStorage.setItem('previous-wallet-address', currentWalletAddress);
        }
      } else if (!isConnected) {
        // Wallet disconnected, clear the stored address
        localStorage.removeItem('previous-wallet-address');
      }

      setPreviousConnectionState(connectionState);

      // Emit the connection state change to other components
      if (glEventHub) {
        glEventHub.emit('wallet-connection-changed', connectionState);
      }
    }
  }, [
    connectedAddress,
    connectedPublicKey,
    connectedFormat,
    connectedWallet,
    network,
    chain,
    previousConnectionState,
    glEventHub,
    bitprint,
    disconnectWallet,
  ]);

  // Handle disconnect events from other components
  useEffect(() => {
    if (!glEventHub) return;

    const handleDisconnect = () => {
      console.log('Received disconnect event from other component');
      disconnectWallet();
    };

    glEventHub.on('force-disconnect-wallet', handleDisconnect);

    return () => {
      glEventHub.off('force-disconnect-wallet', handleDisconnect);
    };
  }, [glEventHub, disconnectWallet]);

  // Function to format address or public key (first and last 7 characters)

  // Handle network change
  const handleNetworkChange = async (event) => {
    const selectedNetwork = event.target.value;
    updateNetwork(selectedNetwork);

    try {
      const success = await connectWallet(connectedWallet);
      if (success) {
        // Wallet reconnected successfully
      } else {
        // Failed to reconnect wallet
      }
    } catch {
      // Error reconnecting wallet
    }
  };

  // Filter wallets based on the active chain tab
  const filteredWallets =
    chainTab === 'btc'
      ? CONNECT_WALLET_LIST.filter((walletItem) =>
          walletItem.chains.includes(Chain.BITCOIN)
        )
      : CONNECT_WALLET_LIST.filter((walletItem) =>
          walletItem.chains.includes(Chain.ETHEREUM)
        );

  // Handle wallet connection
  const handleConnect = async (wallet) => {
    console.log('Attempting to connect wallet:', wallet);
    setErrorMessage(''); // Clear previous errors

    // Reset disconnect flag when attempting to connect
    if (bitprint) {
      bitprint.isDisconnected = false;
      console.log('Reset disconnect flag - attempting to connect');
    }

    // Clear localStorage disconnect flag when attempting to connect
    localStorage.removeItem('wallet-disconnected');

    // Dispatch custom event to notify other components
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key: 'wallet-disconnected', value: null },
      })
    );

    try {
      const walletConnectPromise = connectWallet(wallet);
      const result = await Promise.race([
        walletConnectPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000)),
      ]);

      if (typeof result === 'string') {
        setErrorMessage(
          'No wallet pop-up? The extension is not responding. Try reloading your browser.'
        );
      } else {
        console.log('Wallet connected successfully:', result);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      setErrorMessage('Failed to connect wallet. Please try again.');
    }
  };

  // Check if wallet is connected - but respect our disconnect flag
  const isWalletConnected =
    connectedAddress &&
    connectedAddress.ordinals &&
    !(bitprint && bitprint.isDisconnected);

  return (
    <div className="wallet-connect-container">
      {!isWalletConnected ? (
        // Wallet Not Connected View
        <div className="wallet-not-connected">
          <div className="wallet-list-container">
            {filteredWallets.map((walletItem, i) => (
              <button
                key={i}
                className="wallet-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConnect(walletItem.wallet);
                }}
                type="button"
                aria-label={`Connect ${walletItem.wallet} wallet`}
              >
                <div className="wallet-item-content">
                  <img
                    src={walletItem.icon}
                    alt="wallet icon"
                    className="wallet-item-icon"
                  />
                  <p className="wallet-item-name">{walletItem.wallet}</p>
                </div>
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="wallet-error-message">{errorMessage}</div>
          )}
        </div>
      ) : (
        // Wallet Connected View
        <div className="wallet-connected">
          <div className="wallet-tabs-container">
            <button
              className={`wallet-tab-button ${
                activeTab === 'wallet'
                  ? 'wallet-tab-button--active'
                  : 'wallet-tab-button--inactive'
              }`}
              onClick={() => setActiveTab('wallet')}
            >
              Wallet
            </button>
            <button
              className={`wallet-tab-button ${
                activeTab === 'portfolio'
                  ? 'wallet-tab-button--active'
                  : 'wallet-tab-button--inactive'
              }`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portfolio
            </button>
          </div>

          {activeTab === 'wallet' && (
            <>
              {/* Top bar with connection status and network selector */}
              <div className="wallet-top-bar">
                <div className="wallet-connection-status">
                  <div className="wallet-connection-dot"></div>
                  <span className="wallet-connection-text">Connected</span>
                </div>
                <div className="wallet-network-section">
                  <label className="wallet-network-label">Network:</label>
                  <select
                    onChange={handleNetworkChange}
                    className="wallet-network-select"
                    value={network}
                  >
                    <option key={'mainnet'} value={'mainnet'}>
                      {'mainnet'}
                    </option>
                    <option key={'testnet'} value={'testnet'}>
                      {'testnet'}
                    </option>
                    <option key={'signet'} value={'signet'}>
                      {'signet'}
                    </option>
                  </select>
                </div>
              </div>

              <div className="wallet-info-section">
                <p className="wallet-info-text">
                  Address: {truncateMiddle(connectedAddress.ordinals)}
                </p>
                <p className="wallet-info-text">
                  Public Key: {truncateMiddle(connectedPublicKey.ordinals)}
                </p>
                <p className="wallet-info-text">
                  Format: {connectedFormat.ordinals}
                </p>
                <p className="wallet-info-text">Chain: {chain}</p>
              </div>

              <hr className="wallet-divider"></hr>

              {/* Commented out network login section */}
              {/* <div>
                {bitprint && bitprint.wallet ? (
                  <p className="wallet-common-text">
                    Api Key: {bitprint.wallet.address}
                  </p>
                ) : (
                  <p>Not logged in</p>
                )}
                <button onClick={networkLogin} className="wallet-button">
                  Network Login
                </button>
              </div>
              <hr className="wallet-divider"></hr> */}
              <div className="disconnect-buttons">
                <button
                  onClick={async () => {
                    try {
                      console.log('Attempting to disconnect wallet');

                      // Clear local state first
                      setErrorMessage('');
                      setPreviousConnectionState(null);

                      // Disconnect from bitprint first
                      if (bitprint && bitprint.disconnect) {
                        bitprint.disconnect();
                        console.log('Bitprint wallet disconnected');
                      }

                      // Store disconnect state in localStorage to persist across refreshes
                      localStorage.setItem('wallet-disconnected', 'true');

                      // Dispatch custom event to notify other components
                      window.dispatchEvent(
                        new CustomEvent('localStorageChange', {
                          detail: { key: 'wallet-disconnected', value: 'true' },
                        })
                      );

                      // Disconnect the wallet
                      disconnectWallet();
                      console.log('Wallet disconnected successfully');

                      // Force clear the connection state by setting previous state to disconnected
                      setPreviousConnectionState({
                        isConnected: false,
                        address: null,
                        publicKey: null,
                        format: null,
                        wallet: null,
                        network,
                        chain,
                      });

                      // Emit disconnect event
                      if (glEventHub) {
                        glEventHub.emit('wallet-disconnected', {
                          isConnected: false,
                          address: null,
                          publicKey: null,
                          format: null,
                          wallet: null,
                          network,
                          chain,
                        });
                      }
                    } catch (error) {
                      console.error('Error disconnecting wallet:', error);
                      setErrorMessage(
                        'Failed to disconnect wallet. Please try again.'
                      );
                    }
                  }}
                  className="wallet-button--disconnect"
                  type="button"
                >
                  Disconnect Wallet
                </button>
              </div>
            </>
          )}

          {activeTab === 'portfolio' && (
            <div className="wallet-portfolio-section">
              <div>
                <p>Address List: </p>
              </div>
              <div className="wallet-address-list">
                <p className="wallet-address-item">
                  {truncateMiddle(connectedAddress.ordinals)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main component that wraps the inner component with providers
const WalletConnect = ({ glContainer, glEventHub }) => {
  return (
    <BitprintProvider>
      <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
        <WalletConnectInner glContainer={glContainer} glEventHub={glEventHub} />
      </OrdConnectProvider>
    </BitprintProvider>
  );
};

export default WalletConnect;
