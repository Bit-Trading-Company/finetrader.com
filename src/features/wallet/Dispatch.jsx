import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Psbt, networks, payments } from 'bitcoinjs-lib';
import { useOrdConnect, useSign } from '@ordzaar/ord-connect';
import { useWalletDisconnectState } from './useWalletDisconnectState';
import {
  getMempoolTxHexUrl,
  getMempoolBroadcastUrl,
  getMempoolTxUrl,
} from '../../lib/mempoolProvider';
import { fetchAddressUtxos } from '../../lib/addressUtxos';
import { shortenAddress } from '../../lib/format';

/**
 * Detect Bitcoin address format from address string
 * @param {string} address - Bitcoin address
 * @returns {string} Address format: 'p2tr', 'p2wpkh', 'p2pkh', 'p2sh', or 'unknown'
 */
const detectAddressFormat = (address) => {
  if (!address) return 'unknown';

  // P2TR (Taproot): bc1p... (mainnet) or tb1p... (testnet/signet)
  if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
    return 'p2tr';
  }

  // P2WPKH (Native SegWit): bc1... (mainnet) or tb1... (testnet/signet), but not bc1p/tb1p
  // bc1 addresses are 42 chars (P2WPKH) or 62 chars (P2WSH), but P2WPKH is most common
  // tb1 addresses follow same pattern
  if (
    (address.startsWith('bc1') && address.length === 42) ||
    (address.startsWith('tb1') && address.length === 42)
  ) {
    return 'p2wpkh';
  }

  // P2PKH (Legacy): starts with 1 (mainnet) or m/n (testnet)
  if (
    address.startsWith('1') ||
    address.startsWith('m') ||
    address.startsWith('n')
  ) {
    return 'p2pkh';
  }

  // P2SH (Script Hash): starts with 3 (mainnet) or 2 (testnet)
  if (address.startsWith('3') || address.startsWith('2')) {
    return 'p2sh';
  }

  return 'unknown';
};

const Dispatch = ({ isOpen, onClose, proxyWallets }) => {
  const {
    address: connectedAddress,
    publicKey: connectedPublicKey,
    network: connectedNetwork,
  } = useOrdConnect();

  const { sign, error: signError, loading: signLoading } = useSign();
  const isDisconnected = useWalletDisconnectState();

  // For dispatching BTC we should use the payments/BTC address where available.
  // For wallets like Unisat, payments and ordinals are the same address.
  const paymentsAddress =
    connectedAddress?.payments || connectedAddress?.ordinals || null;
  const paymentsPublicKey =
    connectedPublicKey?.payments || connectedPublicKey?.ordinals || null;

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // State for mode (simple or advanced)
  const [mode, setMode] = useState('simple');
  const [simpleAmount, setSimpleAmount] = useState('');

  // State for UTXOs
  const [utxos, setUtxos] = useState([]);
  const [selectedUtxos, setSelectedUtxos] = useState([]);
  const [utxosLoading, setUtxosLoading] = useState(false);

  // State for distribution
  const [walletAmounts, setWalletAmounts] = useState({});
  const [feeRate, setFeeRate] = useState(4); // Default fee rate in sats/vbyte
  const [estimatedFee, setEstimatedFee] = useState(0); // Calculated total fee in satoshis

  // State for PSBT workflow
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreatingPsbt, setIsCreatingPsbt] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Ref to track last initialization key to prevent infinite loops
  const lastInitKeyRef = useRef('');
  // Ref to track if wallet amounts were manually edited (to prevent auto-overwrite)
  const manuallyEditedRef = useRef(false);

  // Fetch UTXOs from connected wallet
  const fetchUtxos = useCallback(async () => {
    if (!paymentsAddress || !isOpen) return;

    setUtxosLoading(true);
    try {
      const data = await fetchAddressUtxos(
        paymentsAddress,
        connectedNetwork || 'mainnet'
      );
      // Sort by value descending and filter confirmed UTXOs
      const sortedUtxos = data
        .filter((utxo) => utxo.status?.confirmed)
        .sort((a, b) => b.value - a.value);
      setUtxos(sortedUtxos);

      // Auto-select the largest UTXO by default
      if (sortedUtxos.length > 0) {
        setSelectedUtxos([sortedUtxos[0]]);
      }
    } catch (err) {
      console.error('Error fetching UTXOs:', err);
      setError(`Failed to fetch UTXOs: ${err.message}`);
      setUtxos([]);
    } finally {
      setUtxosLoading(false);
    }
  }, [paymentsAddress, connectedNetwork, isOpen]);

  // Fetch UTXOs when popup opens
  useEffect(() => {
    if (isOpen && isWalletConnected) {
      fetchUtxos();
    }
  }, [isOpen, isWalletConnected, fetchUtxos]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Estimate transaction size in vbytes and calculate total fee
  useEffect(() => {
    if (selectedUtxos.length === 0 || proxyWallets.length === 0) {
      setEstimatedFee(0);
      return;
    }

    // Estimate vbytes based on inputs, outputs, and change
    // Typical sizes (approximate):
    const TX_BASE = 10; // Base transaction overhead
    const P2WPKH_IN_VB = 68; // P2WPKH input vbytes
    const P2TR_IN_VB = 58; // P2TR input vbytes (Taproot)
    const P2PKH_IN_VB = 148; // P2PKH input vbytes (legacy, non-segwit)
    const P2WPKH_OUT_VB = 31; // P2WPKH output vbytes
    const P2TR_OUT_VB = 43; // P2TR output vbytes (if using Taproot)
    const P2PKH_OUT_VB = 34; // P2PKH output vbytes (legacy)

    // Detect address format to determine input size
    const addressFormat = paymentsAddress
      ? detectAddressFormat(paymentsAddress)
      : 'p2wpkh'; // Default to P2WPKH if unknown

    // Calculate input vbytes based on address format
    let inputVbytesPerUtxo;
    switch (addressFormat) {
      case 'p2tr':
        inputVbytesPerUtxo = P2TR_IN_VB;
        break;
      case 'p2pkh':
        inputVbytesPerUtxo = P2PKH_IN_VB;
        break;
      case 'p2wpkh':
      default:
        inputVbytesPerUtxo = P2WPKH_IN_VB;
        break;
    }
    const inputVbytes = selectedUtxos.length * inputVbytesPerUtxo;

    // Calculate output vbytes based on each wallet's address format
    const outputVbytes = proxyWallets.reduce((sum, wallet) => {
      const walletFormat = detectAddressFormat(wallet.address);
      switch (walletFormat) {
        case 'p2tr':
          return sum + P2TR_OUT_VB;
        case 'p2pkh':
          return sum + P2PKH_OUT_VB;
        case 'p2wpkh':
        default:
          return sum + P2WPKH_OUT_VB;
      }
    }, 0);

    // Add change output if needed (estimate)
    const totalInputValue = selectedUtxos.reduce(
      (sum, utxo) => sum + utxo.value,
      0
    );
    const totalOutputValue = Object.values(walletAmounts).reduce(
      (sum, amt) => sum + amt,
      0
    );
    const estimatedChange = totalInputValue - totalOutputValue;

    let changeVbytes = 0;
    if (estimatedChange > 300 && paymentsAddress) {
      const changeFormat = detectAddressFormat(paymentsAddress);
      switch (changeFormat) {
        case 'p2tr':
          changeVbytes = P2TR_OUT_VB;
          break;
        case 'p2pkh':
          changeVbytes = P2PKH_OUT_VB;
          break;
        case 'p2wpkh':
        default:
          changeVbytes = P2WPKH_OUT_VB;
          break;
      }
    }

    // Total estimated vbytes
    const estimatedVbytes = TX_BASE + inputVbytes + outputVbytes + changeVbytes;

    // Calculate total fee: feeRate * vbytes
    const calculatedFee = Math.ceil(feeRate * estimatedVbytes);
    setEstimatedFee(calculatedFee);
  }, [selectedUtxos, proxyWallets, walletAmounts, feeRate, paymentsAddress]);

  // Calculate default distribution amounts when UTXOs or fee change
  useEffect(() => {
    if (proxyWallets.length === 0 || selectedUtxos.length === 0) {
      setWalletAmounts({});
      lastInitKeyRef.current = '';
      return;
    }

    // Calculate total input value
    const totalInputValue = selectedUtxos.reduce(
      (sum, utxo) => sum + utxo.value,
      0
    );

    // In simple mode, use the simpleAmount input (converted to sats) instead of total input value
    // In advanced mode, use total input value
    let amountToDistribute;
    if (mode === 'simple' && simpleAmount) {
      const simpleAmountSats = Math.floor(parseFloat(simpleAmount) * 100000000);
      amountToDistribute = simpleAmountSats - estimatedFee;
    } else {
      amountToDistribute = totalInputValue - estimatedFee;
    }

    if (amountToDistribute <= 0) {
      setWalletAmounts({});
      setError('Fee is too high or no UTXOs selected');
      lastInitKeyRef.current = '';
      return;
    }

    // Create a unique key for this combination of wallets and UTXOs
    // Note: We exclude estimatedFee from the key so fee changes don't reset wallet amounts
    const utxoKey = selectedUtxos
      .map((u) => `${u.txid}:${u.vout}`)
      .sort()
      .join('|');
    const walletKey = proxyWallets
      .map((w) => w.index)
      .sort()
      .join(',');
    const modeKey = mode === 'simple' ? simpleAmount : '';
    // Exclude estimatedFee from init key to prevent reset when fee changes
    const currentInitKey = `${utxoKey}|${walletKey}|${modeKey}`;

    // Only initialize if this is a new combination (use ref to track, not walletAmounts state)
    // This prevents infinite loops - we only update when the init key changes
    // Don't overwrite if amounts were manually edited (unless it's a completely new selection)
    const hasWalletAmounts = Object.keys(walletAmounts).length > 0;
    const shouldInitialize =
      lastInitKeyRef.current !== currentInitKey &&
      (!hasWalletAmounts || !manuallyEditedRef.current);

    if (shouldInitialize) {
      // Calculate base amount per wallet (1/n)
      const baseAmount = Math.floor(amountToDistribute / proxyWallets.length);
      const remainder = amountToDistribute % proxyWallets.length;

      // Distribute amounts: first wallet gets remainder + base, others get base
      const newAmounts = {};
      proxyWallets.forEach((wallet, index) => {
        if (index === 0) {
          newAmounts[wallet.index] = baseAmount + remainder;
        } else {
          newAmounts[wallet.index] = baseAmount;
        }
      });

      setWalletAmounts(newAmounts);
      lastInitKeyRef.current = currentInitKey;
      manuallyEditedRef.current = false; // Reset manual edit flag after auto-calculation
      // Clear error only when we successfully recalculate amounts
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUtxos, proxyWallets, mode, simpleAmount]); // Removed estimatedFee to prevent reset on fee change

  // Calculate total available BTC from all UTXOs
  const totalAvailableBTC = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

  // Auto-select UTXOs based on amount (starting with biggest ones)
  const autoSelectUtxos = useCallback(
    (amountInBTC) => {
      if (!amountInBTC || amountInBTC <= 0 || utxos.length === 0) {
        setSelectedUtxos([]);
        return;
      }

      const amountInSats = Math.ceil(amountInBTC * 100000000); // Convert BTC to sats
      const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value); // Sort descending

      const selected = [];
      let totalSelected = 0;

      for (const utxo of sortedUtxos) {
        selected.push(utxo);
        totalSelected += utxo.value;
        if (totalSelected >= amountInSats) {
          break;
        }
      }

      setSelectedUtxos(selected);
    },
    [utxos]
  );

  // Handle simple mode amount change
  const handleSimpleAmountChange = (value) => {
    setSimpleAmount(value);
    const numValue = parseFloat(value) || 0;
    if (numValue > 0) {
      autoSelectUtxos(numValue);
      // Reset manual edit flag when user changes the input directly
      manuallyEditedRef.current = false;
    } else {
      setSelectedUtxos([]);
      setWalletAmounts({});
      manuallyEditedRef.current = false;
    }
  };

  // Handle UTXO selection toggle (for advanced mode)
  const toggleUtxo = (utxo) => {
    setSelectedUtxos((prev) => {
      const isSelected = prev.some(
        (u) => u.txid === utxo.txid && u.vout === utxo.vout
      );
      if (isSelected) {
        return prev.filter(
          (u) => !(u.txid === utxo.txid && u.vout === utxo.vout)
        );
      } else {
        return [...prev, utxo];
      }
    });
    // Reset amounts when UTXO selection changes to recalculate defaults
    setWalletAmounts({});
    // Clear simple amount when manually selecting UTXOs
    if (mode === 'simple') {
      setSimpleAmount('');
    }
  };

  // Handle wallet amount change
  const handleAmountChange = (walletIndex, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setWalletAmounts((prev) => {
      const newAmounts = {
        ...prev,
        [walletIndex]: numValue,
      };

      // In simple mode, update the simpleAmount input to reflect total being dispatched
      if (mode === 'simple') {
        const totalOutputValue = Object.values(newAmounts).reduce(
          (sum, amount) => sum + amount,
          0
        );
        // Total amount = output value + estimated fee (convert back to BTC)
        const totalAmountBTC = (totalOutputValue + estimatedFee) / 100000000;
        setSimpleAmount(totalAmountBTC > 0 ? totalAmountBTC.toFixed(8) : '');

        // Mark as manually edited to prevent auto-recalculation from overwriting
        manuallyEditedRef.current = true;

        // Auto-select UTXOs based on the new total amount
        if (totalAmountBTC > 0) {
          autoSelectUtxos(totalAmountBTC);
        }
      }

      return newAmounts;
    });
    setError('');
  };

  // Handle sign error changes
  useEffect(() => {
    if (signError) {
      setError(signError);
    }
  }, [signError]);

  // Combined handler that runs all three steps sequentially
  const handleDispatch = async () => {
    try {
      setError('');
      setSuccess('');
      setIsDispatching(true);
      setIsCreatingPsbt(true);

      // Step 1: Create PSBT
      if (!isWalletConnected) {
        throw new Error('Please connect a wallet first');
      }

      if (selectedUtxos.length === 0) {
        throw new Error('Please select at least one UTXO');
      }

      if (proxyWallets.length === 0) {
        throw new Error('No proxy wallets available');
      }

      // Validate amounts
      const totalInputValue = selectedUtxos.reduce(
        (sum, utxo) => sum + utxo.value,
        0
      );
      const totalOutputValue = Object.values(walletAmounts).reduce(
        (sum, amount) => sum + amount,
        0
      );

      if (totalInputValue < totalOutputValue + estimatedFee) {
        throw new Error('Insufficient input value to cover outputs and fee');
      }

      // Create PSBT
      const networkConfig =
        connectedNetwork === 'mainnet' ? networks.bitcoin : networks.testnet;
      const psbt = new Psbt({ network: networkConfig });

      // Detect address format for the connected wallet
      const addressFormat = detectAddressFormat(paymentsAddress);
      console.log('Detected address format:', addressFormat);

      // Add selected UTXOs as inputs
      for (const utxo of selectedUtxos) {
        const inputData = {
          hash: utxo.txid,
          index: utxo.vout,
          sequence: 0xffffffff,
        };

        // For P2PKH (legacy), we need the full transaction (nonWitnessUtxo)
        if (addressFormat === 'p2pkh') {
          try {
            const txResponse = await fetch(
              getMempoolTxHexUrl(utxo.txid, connectedNetwork || 'mainnet')
            );
            if (txResponse.ok) {
              const txHex = await txResponse.text();
              const txBuffer = Buffer.from(txHex, 'hex');
              inputData.nonWitnessUtxo = txBuffer;
            } else {
              throw new Error(
                `Failed to fetch transaction ${utxo.txid} for P2PKH input`
              );
            }
          } catch (e) {
            console.error('Error fetching transaction for P2PKH:', e);
            throw new Error(
              `Failed to fetch transaction data for P2PKH input. This is required for legacy addresses.`
            );
          }
        } else {
          // For SegWit addresses (P2WPKH, P2TR), use witnessUtxo
          if (utxo.scriptpubkey) {
            try {
              const scriptBuffer = Buffer.from(utxo.scriptpubkey, 'hex');
              inputData.witnessUtxo = {
                script: new Uint8Array(scriptBuffer),
                value: BigInt(utxo.value),
              };
            } catch (e) {
              console.warn(
                'Error using UTXO scriptPubKey, falling back to public key:',
                e
              );
            }
          }

          // If scriptPubKey wasn't available or failed, create witness UTXO from public key
          if (!inputData.witnessUtxo) {
            if (paymentsPublicKey) {
              try {
                const pubkeyBuffer = Buffer.from(paymentsPublicKey, 'hex');

                let payment;
                if (addressFormat === 'p2tr') {
                  if (pubkeyBuffer.length !== 33) {
                    throw new Error(
                      'Invalid public key length for P2TR. Expected 33 bytes (compressed).'
                    );
                  }
                  const xOnlyPubkey = pubkeyBuffer.slice(1, 33);
                  payment = payments.p2tr({
                    internalPubkey: xOnlyPubkey,
                    network: networkConfig,
                  });
                } else {
                  payment = payments.p2wpkh({
                    pubkey: pubkeyBuffer,
                    network: networkConfig,
                  });
                }

                if (payment.address !== paymentsAddress) {
                  console.warn(
                    `Address mismatch: Generated ${payment.address}, expected ${connectedAddress.ordinals}`
                  );
                }

                inputData.witnessUtxo = {
                  script: new Uint8Array(payment.output),
                  value: BigInt(utxo.value),
                };
              } catch (e) {
                console.error(
                  'Error creating witness UTXO from public key:',
                  e
                );
                throw new Error(
                  `Failed to create ${addressFormat} witness UTXO. Ensure your wallet public key is available. Error: ${e.message}`
                );
              }
            } else {
              throw new Error(
                'Connected wallet public key not available and UTXO scriptPubKey missing'
              );
            }
          }
        }

        psbt.addInput(inputData);
      }

      // Add outputs for each proxy wallet
      proxyWallets.forEach((wallet) => {
        const amount = walletAmounts[wallet.index] || 0;
        if (amount > 0) {
          psbt.addOutput({
            address: wallet.address,
            value: BigInt(amount),
          });
        }
      });

      // Calculate and add change output if needed
      const change = totalInputValue - totalOutputValue - estimatedFee;
      const DUST_THRESHOLD = 300;
      if (change >= DUST_THRESHOLD && paymentsAddress) {
        psbt.addOutput({
          address: paymentsAddress,
          value: BigInt(change),
        });
      } else if (change < 0) {
        throw new Error('Insufficient funds: calculated change is negative');
      }

      // Convert PSBT to base64
      const psbtBase64 = psbt.toBase64();

      setIsCreatingPsbt(false);
      setIsSigning(true);

      // Step 2: Sign PSBT
      const walletAddress = paymentsAddress;
      if (!walletAddress) {
        throw new Error('Could not get connected wallet address for signing');
      }

      const signResult = await sign(walletAddress, psbtBase64.trim(), {
        finalize: true,
        extractTx: true,
      });

      if (!signResult || !signResult.hex) {
        throw new Error('Failed to sign PSBT - no result returned');
      }

      const signedTxHex = signResult.hex;

      setIsSigning(false);
      setIsBroadcasting(true);

      // Step 3: Broadcast Transaction
      const broadcastResponse = await fetch(
        getMempoolBroadcastUrl(connectedNetwork || 'mainnet'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: signedTxHex,
        }
      );

      if (!broadcastResponse.ok) {
        const errorText = await broadcastResponse.text();
        throw new Error(
          `Failed to broadcast transaction: ${broadcastResponse.status} - ${errorText}`
        );
      }

      const txId = await broadcastResponse.text();
      setTxId(txId);
      setSuccess(
        `Transaction broadcasted successfully! Transaction ID: ${txId}`
      );

      console.log('Transaction broadcasted:', txId);
    } catch (err) {
      console.error('Error in dispatch process:', err);
      setError(err.message || 'Failed to dispatch transaction');
    } finally {
      setIsDispatching(false);
      setIsCreatingPsbt(false);
      setIsSigning(false);
      setIsBroadcasting(false);
    }
  };

  const formatBTC = (sats) => {
    if (!sats) return '0.00000000';
    return (sats / 100000000).toFixed(8);
  };

  const formatTxId = (txid) => {
    if (!txid) return '';
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  };

  const getStatusIcon = (status) => {
    if (status?.confirmed) return '✓';
    return '⏳';
  };

  const getStatusColor = (status) => {
    if (status?.confirmed) return '#48bb78';
    return '#ed8936';
  };

  // Calculate totals
  const totalInputValue = selectedUtxos.reduce(
    (sum, utxo) => sum + utxo.value,
    0
  );
  const totalOutputValue = Object.values(walletAmounts).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const change = totalInputValue - totalOutputValue - estimatedFee;

  if (!isOpen) return null;

  return (
    <div className="dispatch-overlay" onClick={onClose}>
      <div className="dispatch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dispatch-header">
          <h2>Dispatch BTC to Proxy Wallets</h2>
          <button className="dispatch-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dispatch-content">
          {!isWalletConnected ? (
            <div className="dispatch-error-box">
              <p>Please connect a wallet first</p>
            </div>
          ) : (
            <>
              {/* Mode Selection */}
              <div className="dispatch-section">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3 style={{ margin: 0 }}>Dispatch Mode</h3>
                  <select
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      manuallyEditedRef.current = false; // Reset manual edit flag when switching modes
                      if (e.target.value === 'simple') {
                        // Reset to simple mode
                        setSimpleAmount('');
                        setSelectedUtxos([]);
                        setWalletAmounts({});
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #4a5568',
                      backgroundColor: '#2d3748',
                      color: '#e2e8f0',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="simple">Simple</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                {utxosLoading ? (
                  <div className="dispatch-loading">
                    <p>Loading UTXOs...</p>
                  </div>
                ) : utxos.length === 0 ? (
                  <div className="dispatch-error-box">
                    <p>No confirmed UTXOs available</p>
                  </div>
                ) : (
                  <>
                    {/* Simple Mode */}
                    {mode === 'simple' && (
                      <div className="dispatch-simple-mode">
                        <div style={{ marginBottom: '16px' }}>
                          <label
                            htmlFor="simple-amount"
                            style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#e2e8f0',
                              fontSize: '14px',
                            }}
                          >
                            Amount to Dispatch (BTC)
                          </label>
                          <div
                            style={{
                              marginBottom: '8px',
                              color: '#a0aec0',
                              fontSize: '12px',
                            }}
                          >
                            Available:{' '}
                            <strong style={{ color: '#48bb78' }}>
                              {formatBTC(totalAvailableBTC)} BTC
                            </strong>
                          </div>
                          <input
                            id="simple-amount"
                            type="number"
                            value={simpleAmount}
                            onChange={(e) =>
                              handleSimpleAmountChange(e.target.value)
                            }
                            min="0"
                            max={totalAvailableBTC / 100000000}
                            step="0.00000001"
                            placeholder="0.00000000"
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '4px',
                              border: '1px solid #4a5568',
                              backgroundColor: '#1a202c',
                              color: '#e2e8f0',
                              fontSize: '16px',
                            }}
                          />
                        </div>
                        {selectedUtxos.length > 0 && (
                          <div className="dispatch-total-info">
                            <span>Auto-selected UTXOs: </span>
                            <strong>{formatBTC(totalInputValue)} BTC</strong>
                            <span
                              style={{
                                marginLeft: '16px',
                                fontSize: '12px',
                                color: '#a0aec0',
                              }}
                            >
                              ({selectedUtxos.length} UTXO
                              {selectedUtxos.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Advanced Mode */}
                    {mode === 'advanced' && (
                      <div className="dispatch-advanced-mode">
                        <h4
                          style={{
                            marginBottom: '12px',
                            color: '#e2e8f0',
                            fontSize: '14px',
                          }}
                        >
                          Select UTXOs
                        </h4>
                        <div className="dispatch-utxo-list">
                          {utxos.map((utxo, index) => {
                            const isSelected = selectedUtxos.some(
                              (u) =>
                                u.txid === utxo.txid && u.vout === utxo.vout
                            );
                            return (
                              <div
                                key={`${utxo.txid}-${utxo.vout}`}
                                className={`dispatch-utxo-item ${
                                  isSelected ? 'selected' : ''
                                }`}
                                onClick={() => toggleUtxo(utxo)}
                              >
                                <div className="dispatch-utxo-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                  />
                                </div>
                                <div className="dispatch-utxo-info">
                                  <div className="dispatch-utxo-header">
                                    <span className="dispatch-utxo-status">
                                      <span
                                        style={{
                                          color: getStatusColor(utxo.status),
                                          marginRight: '4px',
                                        }}
                                      >
                                        {getStatusIcon(utxo.status)}
                                      </span>
                                      UTXO #{index + 1}
                                    </span>
                                    <span className="dispatch-utxo-value">
                                      {formatBTC(utxo.value)} BTC
                                    </span>
                                  </div>
                                  <div className="dispatch-utxo-txid">
                                    {formatTxId(utxo.txid)}:{utxo.vout}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedUtxos.length > 0 && (
                          <div className="dispatch-total-info">
                            <span>Total Selected: </span>
                            <strong>{formatBTC(totalInputValue)} BTC</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Wallet Distribution */}
              {proxyWallets.length > 0 && selectedUtxos.length > 0 && (
                <div className="dispatch-section">
                  <h3>Distribution to Proxy Wallets</h3>
                  <div className="dispatch-wallet-distribution">
                    {proxyWallets.map((wallet) => {
                      const amount = walletAmounts[wallet.index] || 0;
                      return (
                        <div
                          key={wallet.index}
                          className="dispatch-wallet-item"
                        >
                          <div className="dispatch-wallet-header">
                            <span className="dispatch-wallet-number">
                              Wallet #{wallet.index + 1}
                            </span>
                            <div className="dispatch-wallet-amount-control">
                              <input
                                type="number"
                                value={amount}
                                onChange={(e) =>
                                  handleAmountChange(
                                    wallet.index,
                                    e.target.value
                                  )
                                }
                                min="0"
                                placeholder="0"
                                className="dispatch-amount-input"
                              />
                              <span className="dispatch-amount-btc">
                                ({formatBTC(amount)} BTC)
                              </span>
                            </div>
                          </div>
                          <div className="dispatch-wallet-address">
                            {shortenAddress(wallet.address)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dispatch-summary">
                    <div className="dispatch-summary-row">
                      <span>Total Input:</span>
                      <strong>{formatBTC(totalInputValue)} BTC</strong>
                    </div>
                    <div className="dispatch-summary-row">
                      <span>Total Output:</span>
                      <strong>{formatBTC(totalOutputValue)} BTC</strong>
                    </div>
                    <div className="dispatch-summary-row">
                      <span>Fee Rate:</span>
                      <strong>{feeRate} sats/vbyte</strong>
                    </div>
                    <div className="dispatch-summary-row">
                      <span>Total Fee:</span>
                      <strong>
                        {formatBTC(estimatedFee)} BTC ({estimatedFee} sats)
                      </strong>
                    </div>
                    {change > 0 && (
                      <div className="dispatch-summary-row">
                        <span>Change:</span>
                        <strong style={{ color: '#48bb78' }}>
                          {formatBTC(change)} BTC
                        </strong>
                      </div>
                    )}
                    <div className="dispatch-summary-row">
                      <span>Total:</span>
                      <strong
                        style={{
                          color:
                            totalOutputValue + estimatedFee > totalInputValue
                              ? '#f56565'
                              : '#e2e8f0',
                        }}
                      >
                        {formatBTC(totalOutputValue + estimatedFee)} BTC
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Fee Input */}
              {proxyWallets.length > 0 && selectedUtxos.length > 0 && (
                <div className="dispatch-section">
                  <h3>Transaction Fee</h3>
                  <div className="dispatch-fee-controls">
                    <label htmlFor="dispatch-fee-rate">
                      Fee Rate (sats/vbyte):
                    </label>
                    <input
                      id="dispatch-fee-rate"
                      type="number"
                      value={feeRate}
                      onChange={(e) =>
                        setFeeRate(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      min="1"
                      placeholder="4"
                    />
                    <span className="dispatch-fee-total">
                      Total: {estimatedFee} sats ({formatBTC(estimatedFee)} BTC)
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="dispatch-actions">
                <button
                  onClick={handleDispatch}
                  disabled={
                    isDispatching ||
                    isCreatingPsbt ||
                    isSigning ||
                    isBroadcasting ||
                    signLoading ||
                    selectedUtxos.length === 0 ||
                    proxyWallets.length === 0 ||
                    Object.keys(walletAmounts).length === 0
                  }
                  className="dispatch-button dispatch-button-primary"
                  style={{
                    backgroundColor:
                      isDispatching ||
                      isCreatingPsbt ||
                      isSigning ||
                      isBroadcasting ||
                      signLoading
                        ? '#4a5568'
                        : '#ed8936',
                    color: 'white',
                    width: '100%',
                  }}
                >
                  {isDispatching ||
                  isCreatingPsbt ||
                  isSigning ||
                  isBroadcasting
                    ? isCreatingPsbt
                      ? 'Creating PSBT...'
                      : isSigning
                        ? 'Signing PSBT...'
                        : isBroadcasting
                          ? 'Broadcasting...'
                          : 'Processing...'
                    : 'Dispatch'}
                </button>
              </div>

              {/* Results */}
              {txId && (
                <div className="dispatch-result">
                  <h3>Transaction Result</h3>
                  <div className="dispatch-txid">
                    <span>Transaction ID:</span>
                    <a
                      href={getMempoolTxUrl(
                        txId,
                        connectedNetwork || 'mainnet'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {formatTxId(txId)}
                    </a>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {error && <div className="dispatch-error-box">{error}</div>}
              {success && <div className="dispatch-success-box">{success}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dispatch;
