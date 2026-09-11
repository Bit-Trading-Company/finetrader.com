import React, { useState, useEffect } from 'react';
import { useOrdConnect, OrdConnectProvider } from '@ordzaar/ord-connect';
import { useWalletDisconnectState } from './useWalletDisconnectState';

// Inner component that uses the hooks
const WalletStatusInner = ({
  glEventHub,
  selectedWallet,
  onWalletSourceChange,
}) => {
  const { address: connectedAddress } = useOrdConnect();
  const [connectionState, setConnectionState] = useState(null);
  const [useProxyWallet, setUseProxyWallet] = useState(false);
  const isDisconnected = useWalletDisconnectState();

  // Restore selected wallet state on mount (only once)
  useEffect(() => {
    // Check if there's a stored wallet selection
    const storedWallet = localStorage.getItem('selected-proxy-wallet');
    if (storedWallet) {
      try {
        // Parse to validate it's valid JSON, but we don't need the data
        JSON.parse(storedWallet);
        // If there's a stored wallet, set useProxyWallet to true
        setUseProxyWallet(true);
        if (onWalletSourceChange) {
          onWalletSourceChange(true);
        }
        console.log(
          'WalletStatus: Restored proxy wallet preference from localStorage'
        );
      } catch (err) {
        console.error('Error reading stored wallet:', err);
      }
    }

    // Also request current wallet state from WalletManagement (only once)
    if (glEventHub) {
      glEventHub.emit('request-wallet-state');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('WalletStatus: Wallet selected:', wallet);
      // Auto-switch to proxy wallet when first selected
      setUseProxyWallet(true);
      if (onWalletSourceChange) {
        onWalletSourceChange(true);
      }
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log(
        'WalletStatus: Connection state changed:',
        newConnectionState
      );
      setConnectionState(newConnectionState);
      // Clear proxy wallet when wallet disconnects
      if (!newConnectionState.isConnected) {
        setUseProxyWallet(false);
        if (onWalletSourceChange) {
          onWalletSourceChange(false);
        }
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('WalletStatus: Wallet disconnected:', disconnectState);
      setConnectionState(disconnectState);
      setUseProxyWallet(false);
      if (onWalletSourceChange) {
        onWalletSourceChange(false);
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
  }, [glEventHub, onWalletSourceChange]);

  // Update connection state when OrdConnect state changes
  useEffect(() => {
    const newConnectionState = {
      isConnected:
        connectedAddress && connectedAddress.ordinals && !isDisconnected,
      address: connectedAddress?.ordinals,
    };
    setConnectionState(newConnectionState);
  }, [connectedAddress, isDisconnected]);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const handleToggleChange = (newUseProxyWallet) => {
    setUseProxyWallet(newUseProxyWallet);
    if (onWalletSourceChange) {
      onWalletSourceChange(newUseProxyWallet);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        backgroundColor: '#2d3748',
        borderRadius: '6px',
        marginBottom: '16px',
        border: '1px solid #4a5568',
      }}
    >
      {/* Wallet Status Section (Left) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connectionState?.isConnected
              ? '#48bb78'
              : '#e53e3e',
            transition: 'background-color 0.3s ease',
          }}
        />
        <div>
          <p
            style={{
              fontSize: '12px',
              color: connectionState?.isConnected ? '#48bb78' : '#e53e3e',
              margin: 0,
              fontWeight: '500',
            }}
          >
            {connectionState?.isConnected
              ? 'Wallet Connected'
              : 'Wallet Disconnected'}
          </p>
          {connectionState?.isConnected && connectionState.address && (
            <p
              style={{
                fontSize: '11px',
                color: '#a0aec0',
                margin: '2px 0 0 0',
                fontFamily: 'monospace',
              }}
            >
              {formatAddress(connectionState.address)}
            </p>
          )}
        </div>
      </div>

      {/* Wallet Source Section (Right) */}
      {connectionState?.isConnected && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: '#a0aec0',
              margin: 0,
              textAlign: 'right',
            }}
          >
            {useProxyWallet && selectedWallet
              ? `Proxy Wallet #${selectedWallet.index + 1}`
              : 'Connected Wallet'}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: useProxyWallet ? '#a0aec0' : '#f7fafc',
                fontWeight: '500',
              }}
            >
              Connected
            </span>
            <button
              onClick={() => handleToggleChange(!useProxyWallet)}
              disabled={!selectedWallet}
              className="wallet-toggle-button"
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: useProxyWallet ? '#ed8936' : '#4a5568',
                cursor: selectedWallet ? 'pointer' : 'not-allowed',
                position: 'relative',
                transition: 'all 0.2s ease',
                minHeight: '20px',
                padding: '0',
                opacity: selectedWallet ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  position: 'absolute',
                  top: '2px',
                  left: useProxyWallet ? '18px' : '2px',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
            <span
              style={{
                fontSize: '10px',
                color: useProxyWallet ? '#f7fafc' : '#a0aec0',
                fontWeight: '500',
              }}
            >
              Proxy
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component that provides the context
const WalletStatus = ({ glEventHub, selectedWallet, onWalletSourceChange }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <WalletStatusInner
        glEventHub={glEventHub}
        selectedWallet={selectedWallet}
        onWalletSourceChange={onWalletSourceChange}
      />
    </OrdConnectProvider>
  );
};

export default WalletStatus;
