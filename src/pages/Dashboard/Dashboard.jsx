import React, { useState, useEffect, useRef } from 'react';
import WalletManagement from '../../features/wallet/WalletManagement';
import FineBuyer from '../../features/marketplace/FineBuyer';
import { useOrdConnect, OrdConnectProvider } from '@ordzaar/ord-connect';
import { useConnect } from '../../features/wallet/useConnect.ts';
import {
  useBitprint,
  BitprintProvider,
} from '../../features/wallet/bitprint.tsx';
import './Dashboard.css';
import lineImage from '../../assets/images/png/line.png';
import { truncateMiddle, shortenAddress } from '../../lib/format';
import { useEventHub } from '../../lib/eventHub';
import { CONNECT_WALLET_LIST } from '../../features/wallet/walletOptions';

// Inner component that uses the hooks
const DashboardInner = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dropdownRef = useRef(null);

  // Create a shared event hub for WalletManagement and FineBuyer
  const glEventHub = useEventHub();

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
    onClose: () => {},
    onError: (err) => {
      setErrorMessage(err);
    },
  });

  // Check if wallet is connected
  const isWalletConnected =
    connectedAddress &&
    connectedAddress.ordinals &&
    !(bitprint && bitprint.isDisconnected);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle wallet connection
  const handleConnect = async (wallet) => {
    console.log('Attempting to connect wallet:', wallet);
    setErrorMessage('');

    if (bitprint) {
      bitprint.isDisconnected = false;
    }

    localStorage.removeItem('wallet-disconnected');

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
        setIsDropdownOpen(false);

        // Always refresh the page after a successful wallet connection
        // This ensures all components see the new connection state
        window.location.reload();
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      setErrorMessage('Failed to connect wallet. Please try again.');
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      console.log('Attempting to disconnect wallet');

      if (bitprint && bitprint.disconnect) {
        bitprint.disconnect();
      }

      localStorage.setItem('wallet-disconnected', 'true');
      disconnectWallet();
      setIsDropdownOpen(false);

      // Always refresh the page after disconnecting the wallet
      // This ensures all components reset to the disconnected state
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setErrorMessage('Failed to disconnect wallet. Please try again.');
    }
  };

  // Handle network change
  const handleNetworkChange = async (event) => {
    const selectedNetwork = event.target.value;
    updateNetwork(selectedNetwork);

    try {
      await connectWallet(connectedWallet);
    } catch {
      // Error reconnecting wallet
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-container-content">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">FINE TRADING DASHBOARD</h1>

            <div className="dashboard-wallet-section" ref={dropdownRef}>
              <button
                className="dashboard-connect-button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {isWalletConnected
                  ? shortenAddress(connectedAddress.ordinals)
                  : 'Connect'}
              </button>

              {isDropdownOpen && (
                <div className="dashboard-dropdown">
                  {!isWalletConnected ? (
                    <>
                      <div className="dashboard-dropdown-header">
                        Connect Wallet
                      </div>
                      <div className="dashboard-wallet-list">
                        {CONNECT_WALLET_LIST.map((walletItem, i) => (
                          <button
                            key={i}
                            className="dashboard-wallet-item"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleConnect(walletItem.wallet);
                            }}
                          >
                            <img
                              src={walletItem.icon}
                              alt={`${walletItem.wallet} icon`}
                              className="dashboard-wallet-icon"
                            />
                            <span className="dashboard-wallet-name">
                              {walletItem.wallet}
                            </span>
                          </button>
                        ))}
                      </div>
                      {errorMessage && (
                        <div className="dashboard-error-message">
                          {errorMessage}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="dashboard-dropdown-header">
                        Wallet Info
                      </div>
                      <div className="dashboard-wallet-info">
                        <div className="dashboard-info-row">
                          <span className="dashboard-info-label">Address:</span>
                          <span className="dashboard-info-value">
                            {truncateMiddle(connectedAddress.ordinals)}
                          </span>
                        </div>
                        <div className="dashboard-info-row">
                          <span className="dashboard-info-label">
                            Public Key:
                          </span>
                          <span className="dashboard-info-value">
                            {truncateMiddle(connectedPublicKey.ordinals)}
                          </span>
                        </div>
                        <div className="dashboard-info-row">
                          <span className="dashboard-info-label">Format:</span>
                          <span className="dashboard-info-value">
                            {connectedFormat.ordinals}
                          </span>
                        </div>
                        <div className="dashboard-info-row">
                          <span className="dashboard-info-label">Chain:</span>
                          <span className="dashboard-info-value">{chain}</span>
                        </div>
                        <div className="dashboard-info-row">
                          <span className="dashboard-info-label">Network:</span>
                          <select
                            onChange={handleNetworkChange}
                            className="dashboard-network-select"
                            value={network}
                          >
                            <option value="mainnet">mainnet</option>
                            <option value="testnet">testnet</option>
                            <option value="signet">signet</option>
                          </select>
                        </div>
                        <button
                          onClick={handleDisconnect}
                          className="dashboard-disconnect-button"
                        >
                          Disconnect
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <img
            src={lineImage}
            alt="separator"
            className="dashboard-header-separator"
          />
        </header>

        {/* Main Content */}
        <div className="dashboard-main">
          {/* Sidebar */}
          <aside className="dashboard-sidebar">
            <WalletManagement glEventHub={glEventHub} />
          </aside>
          <div className="dashboard-sidebar-separator-container">
            <img
              src={lineImage}
              alt="separator"
              className="dashboard-sidebar-separator"
            />
          </div>

          {/* Content Area */}
          <main className="dashboard-content">
            <FineBuyer glEventHub={glEventHub} />
          </main>
        </div>
      </div>
    </div>
  );
};

// Main component with providers
const Dashboard = () => {
  return (
    <BitprintProvider>
      <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
        <DashboardInner />
      </OrdConnectProvider>
    </BitprintProvider>
  );
};

export default Dashboard;
