import React, { useState, useEffect, useCallback } from 'react';
import {
  useOrdConnect,
  useSign,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import WalletStatus from './WalletStatus';
import { useWalletDisconnectState } from '../../hooks/useLocalStorage';
import apiClient from '../../utils/apiClient';
import {
  getMempoolAddressUrl,
  getMempoolAddressUtxoUrl,
} from '../../utils/mempoolProvider';

// Inner component that uses the hooks
const BuyRuneInner = ({ glEventHub }) => {
  const {
    network,
    address: connectedAddress,
    publicKey: connectedPublicKey,
  } = useOrdConnect();

  const { sign, error: signError, loading: signLoading } = useSign();
  const [runeSymbol, setRuneSymbol] = useState('DOG•GO•TO•THE•MOON');
  const [amount, setAmount] = useState('1');
  const [maxPrice, setMaxPrice] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [runeInfo, setRuneInfo] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);

  // New state for 3-step workflow
  const [unsignedPsbt, setUnsignedPsbt] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [orderIds, setOrderIds] = useState([]);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settlementInfo, setSettlementInfo] = useState(null);
  const [utxos, setUtxos] = useState([]);
  const [selectedUtxo, setSelectedUtxo] = useState(null);
  const [utxosLoading, setUtxosLoading] = useState(false);
  const isDisconnected = useWalletDisconnectState();
  const [selectedWallet, setSelectedWallet] = useState(null);

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Fetch rune market info
  const fetchRuneInfo = useCallback(async (symbol) => {
    if (!symbol) return;

    try {
      // Convert rune symbol to API format (remove bullet points and ensure uppercase)
      const apiRuneSymbol = symbol.trim().replace(/•/g, '').toUpperCase();

      const data = await apiClient.get(
        `/market/${encodeURIComponent(apiRuneSymbol)}/info`
      );
      setRuneInfo(data.data || data);
    } catch (err) {
      console.error('Error fetching rune info:', err);
    }
  }, []);

  // Fetch available orders for the rune
  const fetchAvailableOrders = useCallback(async (symbol) => {
    if (!symbol) return;

    try {
      // Convert rune symbol to API format (remove bullet points and ensure uppercase)
      const apiRuneSymbol = symbol.trim().replace(/•/g, '').toUpperCase();

      const data = await apiClient.get(
        `/orders/${encodeURIComponent(apiRuneSymbol)}?side=sell&limit=50`
      );
      setAvailableOrders(data.orders || data.data || []);
    } catch (err) {
      console.error('Error fetching available orders:', err);
    }
  }, []);

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('BuyRune: Wallet selected:', wallet);
      setSelectedWallet(wallet);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('BuyRune: Connection state changed:', newConnectionState);
      if (!newConnectionState.isConnected) {
        setError('');
        setSuccess('');
        setSelectedWallet(null);
      }
    };

    const handleDisconnect = (disconnectState) => {
      console.log('BuyRune: Wallet disconnected:', disconnectState);
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

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(
    async (address) => {
      if (!address) return;

      try {
        const response = await fetch(
          getMempoolAddressUrl(address, network || 'mainnet')
        );
        if (response.ok) {
          const data = await response.json();
          setWalletBalance({
            confirmed:
              data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
            unconfirmed:
              data.mempool_stats.funded_txo_sum -
              data.mempool_stats.spent_txo_sum,
          });
        }
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
      }
    },
    [network]
  );

  // Fetch UTXOs using configured mempool API provider
  const fetchUtxos = useCallback(
    async (address) => {
      if (!address) return;

      setUtxosLoading(true);
      try {
        const response = await fetch(
          getMempoolAddressUtxoUrl(address, network || 'mainnet')
        );
        if (response.ok) {
          const data = await response.json();
          const sortedUtxos = (data || []).sort((a, b) => b.value - a.value); // Sort by value descending
          setUtxos(sortedUtxos);

          // Auto-select the largest UTXO if available
          if (sortedUtxos.length > 0) {
            setSelectedUtxo(sortedUtxos[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching UTXOs:', err);
        setUtxos([]);
      } finally {
        setUtxosLoading(false);
      }
    },
    [network]
  );

  // Fetch rune info when symbol changes
  useEffect(() => {
    if (runeSymbol) {
      fetchRuneInfo(runeSymbol);
      fetchAvailableOrders(runeSymbol);
    }
    // Reset estimated cost when inputs change
    setEstimatedCost(null);
    setSettlementInfo(null);
  }, [runeSymbol, fetchRuneInfo, fetchAvailableOrders]);

  // Reset estimated cost when amount or maxPrice changes
  useEffect(() => {
    setEstimatedCost(null);
    setSettlementInfo(null);
  }, [amount, maxPrice]);

  // Fetch wallet balance and UTXOs when address changes
  useEffect(() => {
    if (connectedAddress && connectedAddress.ordinals) {
      fetchWalletBalance(connectedAddress.ordinals);
      fetchUtxos(connectedAddress.ordinals);
    }
  }, [connectedAddress, fetchWalletBalance, fetchUtxos]);

  // Handle sign error changes
  useEffect(() => {
    if (signError) {
      setError(signError);
    }
  }, [signError]);

  // Preview cost without getting PSBT
  const handlePreviewCost = async () => {
    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    if (!runeSymbol.trim()) {
      setError('Please enter a rune symbol');
      return;
    }

    setPreviewLoading(true);
    setError('');
    setSuccess('');

    try {
      // Convert rune symbol to API format (remove bullet points and ensure uppercase)
      const apiRuneSymbol = runeSymbol.trim().replace(/•/g, '').toUpperCase();

      // Get available orders to calculate cost
      const ordersData = await apiClient.get(
        `/orders/${encodeURIComponent(apiRuneSymbol)}?side=sell&limit=50`
      );
      const orders = ordersData.orders || ordersData.data || [];

      if (orders.length === 0) {
        throw new Error('No available orders found for this rune');
      }

      // Sort orders by price (lowest first) and select the cheapest ones
      const sortedOrders = orders
        .filter((order) => {
          if (maxPrice && order.price > parseFloat(maxPrice) * 100000000) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.price - b.price);

      // Select only the minimum number of orders needed
      const requestedAmount = parseFloat(amount);
      const selectedOrders = [];
      let totalAmount = 0;

      for (const order of sortedOrders) {
        if (totalAmount >= requestedAmount) break;

        const orderAmount = order.amount || 1;
        selectedOrders.push(order);
        totalAmount += orderAmount;

        if (selectedOrders.length >= 50) break;
      }

      const totalCost = selectedOrders.reduce(
        (sum, order) => sum + (order.price || 0),
        0
      );

      setEstimatedCost(totalCost);
      setSuccess(
        `Estimated cost: ${formatBTC(totalCost)} BTC for ${requestedAmount} runes`
      );

      console.log('Cost preview:', {
        requestedAmount,
        selectedOrders: selectedOrders.length,
        totalCost: formatBTC(totalCost),
        orders: selectedOrders.map((o) => ({
          price: formatBTC(o.price),
          amount: o.amount,
        })),
      });
    } catch (err) {
      console.error('Error previewing cost:', err);
      setError(err.message || 'Failed to preview cost');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 1: Get unsigned PSBT
  const handleGetPsbt = async () => {
    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    if (!runeSymbol.trim()) {
      setError('Please enter a rune symbol');
      return;
    }

    if (!connectedPublicKey || !connectedPublicKey.ordinals) {
      setError('Public key not available from connected wallet');
      return;
    }

    setStep1Loading(true);
    setError('');
    setSuccess('');
    setUnsignedPsbt('');
    setSignedPsbt('');
    setOrderIds([]);

    try {
      // Convert rune symbol to API format (remove bullet points and ensure uppercase)
      const apiRuneSymbol = runeSymbol.trim().replace(/•/g, '').toUpperCase();
      console.log('Original rune symbol:', runeSymbol);
      console.log('API rune symbol:', apiRuneSymbol);

      // First, get available orders to select orderIds
      const ordersData = await apiClient.get(
        `/orders/${encodeURIComponent(apiRuneSymbol)}?side=sell&limit=50`
      );
      const orders = ordersData.orders || ordersData.data || [];

      console.log('Orders API response:', ordersData);
      console.log('Available orders:', orders.length);
      console.log(
        'Sample orders:',
        orders.slice(0, 3).map((o) => ({
          id: o.id,
          price: o.price,
          priceBTC: o.price ? (o.price / 100000000).toFixed(8) : 'N/A',
          amount: o.amount,
          side: o.side,
        }))
      );

      if (orders.length === 0) {
        throw new Error('No available orders found for this rune');
      }

      // Sort orders by price (lowest first) and select the cheapest ones
      const sortedOrders = orders
        .filter((order) => {
          if (maxPrice && order.price > parseFloat(maxPrice) * 100000000) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.price - b.price); // Sort by price ascending

      // Select only the minimum number of orders needed
      const requestedAmount = parseFloat(amount);
      const selectedOrders = [];
      let totalAmount = 0;

      for (const order of sortedOrders) {
        if (totalAmount >= requestedAmount) break;

        // Each order typically represents 1 rune, but let's be safe
        const orderAmount = order.amount || 1;
        selectedOrders.push(order);
        totalAmount += orderAmount;

        // Don't exceed 50 orders (API limit)
        if (selectedOrders.length >= 50) break;
      }

      // Calculate total cost for debugging
      const totalCost = selectedOrders.reduce(
        (sum, order) => sum + (order.price || 0),
        0
      );

      console.log('Requested amount:', requestedAmount);
      console.log('Selected orders count:', selectedOrders.length);
      console.log('Total amount from selected orders:', totalAmount);
      console.log('Total cost in sats:', totalCost);
      console.log('Total cost in BTC:', (totalCost / 100000000).toFixed(8));
      console.log(
        'Selected orders:',
        selectedOrders.map((o) => ({
          id: o.id,
          price: o.price,
          priceBTC: (o.price / 100000000).toFixed(8),
          amount: o.amount,
        }))
      );

      // Safety check: if the total cost seems unreasonably high, warn the user
      if (totalCost > 0.01 * 100000000) {
        // More than 0.01 BTC
        console.warn(
          'High cost detected:',
          (totalCost / 100000000).toFixed(8),
          'BTC'
        );
        throw new Error(
          `High cost detected: ${(totalCost / 100000000).toFixed(8)} BTC for ${requestedAmount} runes. ` +
            `This seems unusually high. Please check the rune symbol and amount, or try a smaller amount.`
        );
      }

      if (selectedOrders.length === 0) {
        throw new Error('No orders available within your price range');
      }

      const selectedOrderIds = selectedOrders.map((order) => order.id);
      setOrderIds(selectedOrderIds);
      setEstimatedCost(totalCost);

      // Now get the unsigned PSBT
      const sweepRequest = {
        orderIds: selectedOrderIds,
        runeSymbol: apiRuneSymbol,
        takerPaymentAddress: connectedAddress.ordinals,
        takerPublicKey: connectedPublicKey.ordinals,
        takerReceiveAddress: connectedAddress.ordinals, // Using same address for receive
        feeRateTier: 'halfHourFee', // Default to half hour fee
        enableRBFProtection: false,
      };

      console.log('Requesting unsigned PSBT for sweeping:', sweepRequest);

      const psbtData = await apiClient.post('/psbt/get-sweeping', sweepRequest);
      console.log('Received unsigned PSBT:', psbtData);

      // Log settlement information for debugging
      if (psbtData.settlement) {
        console.log('Settlement info:', {
          amount: psbtData.settlement.amount,
          amountBTC: formatBTC(psbtData.settlement.amount),
          price: psbtData.settlement.price,
          priceBTC: formatBTC(psbtData.settlement.price),
        });
        setSettlementInfo(psbtData.settlement);
      }

      // Check for errors in the response
      if (psbtData.nonRBFProtectedSweepingError) {
        const errorMsg = psbtData.nonRBFProtectedSweepingError.message;
        if (errorMsg.includes('Not enough confirmed spendable funds')) {
          throw new Error(
            'Insufficient funds: ' +
              errorMsg +
              '\n\nPlease ensure your wallet has enough confirmed BTC to cover the purchase amount plus transaction fees. ' +
              'Some funds may be locked in pending transactions.'
          );
        }
        throw new Error(errorMsg);
      }

      if (psbtData.invalidOrders && psbtData.invalidOrders.length > 0) {
        console.warn('Invalid orders:', psbtData.invalidOrders);
      }

      if (psbtData.validOrders && psbtData.validOrders.length === 0) {
        throw new Error('No valid orders available for purchase');
      }

      // Handle different possible response formats
      const psbt =
        psbtData.psbtBase64 ||
        psbtData.psbt ||
        psbtData.unsignedPsbt ||
        psbtData.data?.psbt;
      if (!psbt) {
        throw new Error(
          'No PSBT returned from Magic Eden API. Response: ' +
            JSON.stringify(psbtData)
        );
      }

      setUnsignedPsbt(psbt);

      // Create success message with settlement info if available
      let successMessage =
        'Unsigned PSBT received successfully! You can now sign it.';
      if (psbtData.settlement) {
        successMessage += ` Cost: ${formatBTC(psbtData.settlement.price)} BTC for ${formatRuneAmount(psbtData.settlement.amount)} runes.`;
      }
      setSuccess(successMessage);
    } catch (err) {
      console.error('Error getting PSBT:', err);
      setError(err.message || 'Failed to get unsigned PSBT');
    } finally {
      setStep1Loading(false);
    }
  };

  // Step 2: Sign PSBT
  const handleSignPsbt = async () => {
    if (!unsignedPsbt) {
      setError('Please get an unsigned PSBT first');
      return;
    }

    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    setStep2Loading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Signing PSBT...');
      console.log('PSBT to sign:', unsignedPsbt.substring(0, 100) + '...');

      // Try different signing approaches based on the error
      let signResult;

      try {
        // First try: sign with extractTx: false (don't extract transaction)
        console.log('Attempting to sign without extracting transaction...');
        signResult = await sign(connectedAddress.ordinals, unsignedPsbt, {
          finalize: true,
          extractTx: false,
        });
        console.log('Sign result (no extract):', signResult);
      } catch (extractError) {
        console.log(
          'Failed to sign without extract, trying with extract...',
          extractError
        );

        // Second try: sign with extractTx: true (extract transaction)
        signResult = await sign(connectedAddress.ordinals, unsignedPsbt, {
          finalize: true,
          extractTx: true,
        });
        console.log('Sign result (with extract):', signResult);
      }

      if (!signResult) {
        throw new Error('Failed to sign PSBT - no result returned');
      }

      console.log('PSBT signed successfully:', signResult);

      // Store the signed PSBT (prioritize PSBT format over hex transaction)
      const signedPsbtHex = signResult.psbt || signResult.hex || signResult;
      if (!signedPsbtHex) {
        throw new Error('No signed PSBT returned from wallet');
      }

      console.log('Signed PSBT format:', {
        hasPsbt: !!signResult.psbt,
        hasHex: !!signResult.hex,
        resultKeys: Object.keys(signResult),
        psbtLength: signedPsbtHex.length,
      });

      setSignedPsbt(signedPsbtHex);
      setSuccess('PSBT signed successfully! You can now submit the order.');
    } catch (err) {
      console.error('Error signing PSBT:', err);
      setError(err.message || 'Failed to sign PSBT');
    } finally {
      setStep2Loading(false);
    }
  };

  // Step 3: Submit signed PSBT
  const handleSubmitOrder = async () => {
    if (!signedPsbt) {
      setError('Please sign the PSBT first');
      return;
    }

    if (orderIds.length === 0) {
      setError('No order IDs available');
      return;
    }

    setStep3Loading(true);
    setError('');
    setSuccess('');

    try {
      // Convert hex PSBT to base64 if needed
      let psbtBase64 = signedPsbt;

      // Check if the PSBT is in hex format (starts with 0x or is hex string)
      if (signedPsbt.startsWith('0x') || /^[0-9a-fA-F]+$/.test(signedPsbt)) {
        try {
          // Convert hex to base64
          const hexString = signedPsbt.startsWith('0x')
            ? signedPsbt.slice(2)
            : signedPsbt;
          const bytes = new Uint8Array(
            hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
          );
          psbtBase64 = btoa(String.fromCharCode(...bytes));
          console.log('Converted hex PSBT to base64:', {
            originalLength: signedPsbt.length,
            base64Length: psbtBase64.length,
            preview: psbtBase64.substring(0, 50) + '...',
          });
        } catch (conversionError) {
          console.error('Error converting hex to base64:', conversionError);
          throw new Error('Failed to convert signed PSBT to base64 format');
        }
      } else {
        // Assume it's already base64
        console.log('Using PSBT as-is (assuming base64):', {
          length: psbtBase64.length,
          preview: psbtBase64.substring(0, 50) + '...',
        });
      }

      const submitRequest = {
        orderIds: orderIds,
        signedPsbtBase64: psbtBase64,
        takerPaymentAddress: connectedAddress.ordinals,
        takerPublicKey: connectedPublicKey.ordinals,
        takerReceiveAddress: connectedAddress.ordinals,
        enableRBFProtection: false,
      };

      console.log('Submitting signed PSBT...', {
        orderIds: orderIds,
        takerPaymentAddress: connectedAddress.ordinals,
        takerPublicKey: connectedPublicKey.ordinals,
        takerReceiveAddress: connectedAddress.ordinals,
        psbtLength: psbtBase64.length,
        psbtPreview: psbtBase64.substring(0, 50) + '...',
      });

      const submitData = await apiClient.post('/sweeping', submitRequest);
      console.log('Buy order submitted successfully:', submitData);

      const txId =
        submitData.txId ||
        submitData.transactionId ||
        submitData.txid ||
        'Pending';
      setSuccess(
        `Successfully purchased ${amount} ${runeSymbol}! Transaction ID: ${txId}`
      );

      // Reset state for new purchase
      setUnsignedPsbt('');
      setSignedPsbt('');
      setOrderIds([]);

      // Refresh available orders
      fetchAvailableOrders(runeSymbol);
    } catch (err) {
      console.error('Error submitting order:', err);
      setError(err.message || 'Failed to submit order');
    } finally {
      setStep3Loading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return (price / 100000000).toFixed(8) + ' BTC';
  };

  const formatRuneAmount = (amount) => {
    if (!amount) return 'N/A';
    return parseFloat(amount).toLocaleString();
  };

  const formatBTC = (sats) => {
    if (!sats) return '0.00000000';
    return (sats / 100000000).toFixed(8);
  };

  // Helper functions for UTXO formatting
  const formatTxId = (txid) => {
    if (!txid) return '';
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  };

  const formatValue = (value) => {
    if (!value) return '0';
    return (value / 100000000).toFixed(8); // Convert satoshis to BTC
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
    <div className="buy-rune-container">
      <div>
        <h2 className="component-header">Buy Rune</h2>

        {/* Wallet Status Component */}
        <WalletStatus
          glEventHub={glEventHub}
          selectedWallet={selectedWallet}
          onWalletSourceChange={() => {}}
        />

        {/* Wallet Balance Display */}
        {isWalletConnected && walletBalance && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#2d3748',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #4a5568',
            }}
          >
            <h4
              style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#f7fafc',
              }}
            >
              Wallet Balance
            </h4>
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
                <span style={{ fontWeight: '500' }}>Confirmed:</span>{' '}
                <span style={{ color: '#48bb78', fontWeight: '600' }}>
                  {formatBTC(walletBalance.confirmed)} BTC
                </span>
              </div>
              <div>
                <span style={{ fontWeight: '500' }}>Unconfirmed:</span>{' '}
                <span style={{ color: '#ed8936', fontWeight: '600' }}>
                  {formatBTC(walletBalance.unconfirmed)} BTC
                </span>
              </div>
            </div>
            {walletBalance.confirmed < 0.002 && (
              <p
                style={{
                  fontSize: '11px',
                  color: '#e53e3e',
                  margin: '8px 0 0 0',
                  fontStyle: 'italic',
                }}
              >
                ⚠️ Low balance: You may need more BTC for transaction fees
              </p>
            )}
          </div>
        )}

        {/* UTXO Selection */}
        {isWalletConnected && utxosLoading && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#2d3748',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #4a5568',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '12px', color: '#a0aec0', margin: 0 }}>
              Loading UTXOs...
            </p>
          </div>
        )}

        {isWalletConnected && !utxosLoading && utxos.length > 0 && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#2d3748',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #4a5568',
            }}
          >
            <h4
              style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#f7fafc',
              }}
            >
              Select Payment UTXO
            </h4>
            <p
              style={{
                fontSize: '11px',
                color: '#a0aec0',
                margin: '0 0 8px 0',
              }}
            >
              Choose which UTXO to use for payment (largest selected by default)
            </p>
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #4a5568',
                borderRadius: '4px',
              }}
            >
              {utxos.map((utxo, index) => (
                <div
                  key={`${utxo.txid}-${utxo.vout}`}
                  onClick={() => setSelectedUtxo(utxo)}
                  style={{
                    padding: '8px 12px',
                    borderBottom:
                      index < utxos.length - 1 ? '1px solid #4a5568' : 'none',
                    backgroundColor:
                      selectedUtxo === utxo ? '#ed8936' : '#1a202c',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: '500',
                          color: selectedUtxo === utxo ? '#ffffff' : '#f7fafc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ color: getStatusColor(utxo.status) }}>
                          {getStatusIcon(utxo.status)}
                        </span>
                        UTXO #{index + 1}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: selectedUtxo === utxo ? '#e2e8f0' : '#a0aec0',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatTxId(utxo.txid)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: selectedUtxo === utxo ? '#ffffff' : '#48bb78',
                      }}
                    >
                      {formatValue(utxo.value)} BTC
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {selectedUtxo && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#1a202c',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#a0aec0',
                }}
              >
                <span style={{ fontWeight: '500' }}>Selected:</span>{' '}
                {formatValue(selectedUtxo.value)} BTC
                {selectedUtxo.status?.confirmed
                  ? ' (Confirmed)'
                  : ' (Unconfirmed)'}
              </div>
            )}
          </div>
        )}

        {isWalletConnected && !utxosLoading && utxos.length === 0 && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#2d3748',
              borderRadius: '6px',
              marginBottom: '16px',
              border: '1px solid #4a5568',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '12px', color: '#e53e3e', margin: 0 }}>
              ⚠️ No UTXOs found. You need BTC to make purchases.
            </p>
          </div>
        )}

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
              Connect a wallet to buy runes
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
              Rune trading is only available on mainnet (current: {network})
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
            {/* Rune Input Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#f7fafc',
                }}
              >
                Rune Details
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#f7fafc',
                    marginBottom: '4px',
                  }}
                >
                  Rune Symbol
                </label>
                <input
                  type="text"
                  value={runeSymbol}
                  onChange={(e) => setRuneSymbol(e.target.value)}
                  placeholder="Enter rune symbol (e.g., DOG•GO•TO•THE•MOON)"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#f7fafc',
                    marginBottom: '4px',
                  }}
                >
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount to buy"
                  min="1"
                  step="1"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#f7fafc',
                    marginBottom: '4px',
                  }}
                >
                  Max Price (BTC) - Optional
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Enter maximum price in BTC"
                  min="0"
                  step="0.00000001"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            {/* Rune Info Section */}
            {runeInfo && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Rune Information
                </h3>
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#1a202c',
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
                      color: '#a0aec0',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '500' }}>Symbol:</span>{' '}
                      {runeInfo.symbol || 'N/A'}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500' }}>Supply:</span>{' '}
                      {formatRuneAmount(runeInfo.supply)}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500' }}>Burned:</span>{' '}
                      {formatRuneAmount(runeInfo.burned)}
                    </div>
                    <div>
                      <span style={{ fontWeight: '500' }}>Holders:</span>{' '}
                      {runeInfo.holders || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Available Orders Section */}
            {availableOrders.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#f7fafc',
                  }}
                >
                  Available Orders
                </h3>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #4a5568',
                    borderRadius: '4px',
                  }}
                >
                  {availableOrders.slice(0, 5).map((order, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px',
                        borderBottom:
                          index < availableOrders.slice(0, 5).length - 1
                            ? '1px solid #4a5568'
                            : 'none',
                        backgroundColor: '#1a202c',
                        fontSize: '11px',
                        color: '#a0aec0',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Amount: {formatRuneAmount(order.amount)}</span>
                        <span>Price: {formatPrice(order.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3-Step Workflow Buttons */}
            <div style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#f7fafc',
                }}
              >
                Purchase Workflow
              </h3>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={handlePreviewCost}
                  disabled={
                    previewLoading || !runeSymbol.trim() || !isWalletConnected
                  }
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    backgroundColor: previewLoading ? '#4a5568' : '#9f7aea',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: previewLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {previewLoading ? 'Calculating...' : 'Preview Cost'}
                </button>

                <button
                  onClick={handleGetPsbt}
                  disabled={
                    step1Loading || !runeSymbol.trim() || !isWalletConnected
                  }
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    backgroundColor: step1Loading ? '#4a5568' : '#ed8936',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: step1Loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {step1Loading ? 'Getting...' : '1. Get PSBT'}
                </button>

                <button
                  onClick={handleSignPsbt}
                  disabled={
                    step2Loading ||
                    signLoading ||
                    !unsignedPsbt ||
                    !isWalletConnected
                  }
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    backgroundColor:
                      step2Loading || signLoading ? '#4a5568' : '#38a169',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor:
                      step2Loading || signLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {step2Loading || signLoading ? 'Signing...' : '2. Sign PSBT'}
                </button>

                <button
                  onClick={handleSubmitOrder}
                  disabled={step3Loading || !signedPsbt || !isWalletConnected}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    backgroundColor: step3Loading ? '#4a5568' : '#3182ce',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: step3Loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {step3Loading ? 'Submitting...' : '3. Submit Order'}
                </button>
              </div>

              {/* PSBT Display Section */}
              {unsignedPsbt && (
                <div style={{ marginBottom: '16px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#f7fafc',
                    }}
                  >
                    Unsigned PSBT
                  </h4>
                  <div
                    style={{
                      padding: '8px',
                      backgroundColor: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: '#a0aec0',
                      wordBreak: 'break-all',
                      maxHeight: '100px',
                      overflowY: 'auto',
                    }}
                  >
                    {unsignedPsbt.slice(0, 200)}...
                  </div>
                </div>
              )}

              {signedPsbt && (
                <div style={{ marginBottom: '16px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#f7fafc',
                    }}
                  >
                    Signed PSBT
                  </h4>
                  <div
                    style={{
                      padding: '8px',
                      backgroundColor: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: '#a0aec0',
                      wordBreak: 'break-all',
                      maxHeight: '100px',
                      overflowY: 'auto',
                    }}
                  >
                    {signedPsbt.slice(0, 200)}...
                  </div>
                </div>
              )}

              {/* Settlement Information Display */}
              {settlementInfo && (
                <div style={{ marginBottom: '16px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#f7fafc',
                    }}
                  >
                    Transaction Details
                  </h4>
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#a0aec0',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '500' }}>Rune Amount:</span>{' '}
                        <span style={{ color: '#48bb78', fontWeight: '600' }}>
                          {formatRuneAmount(settlementInfo.amount)}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500' }}>Total Cost:</span>{' '}
                        <span style={{ color: '#ed8936', fontWeight: '600' }}>
                          {formatBTC(settlementInfo.price)} BTC
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated Cost Display */}
              {estimatedCost && !settlementInfo && (
                <div style={{ marginBottom: '16px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#f7fafc',
                    }}
                  >
                    Estimated Cost
                  </h4>
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#48bb78',
                      fontWeight: '600',
                      textAlign: 'center',
                    }}
                  >
                    {formatBTC(estimatedCost)} BTC
                    {estimatedCost > 0.01 * 100000000 && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#e53e3e',
                          marginTop: '4px',
                        }}
                      >
                        ⚠️ High cost detected
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order IDs Display */}
              {orderIds.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: '#f7fafc',
                    }}
                  >
                    Selected Order IDs ({orderIds.length})
                  </h4>
                  <div
                    style={{
                      padding: '8px',
                      backgroundColor: '#1a202c',
                      border: '1px solid #4a5568',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: '#a0aec0',
                      wordBreak: 'break-all',
                      maxHeight: '80px',
                      overflowY: 'auto',
                    }}
                  >
                    {orderIds.map((id, index) => (
                      <div key={index} style={{ marginBottom: '2px' }}>
                        {id}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
const BuyRune = ({ glContainer, glEventHub }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <BuyRuneInner glContainer={glContainer} glEventHub={glEventHub} />
    </OrdConnectProvider>
  );
};

export default BuyRune;
