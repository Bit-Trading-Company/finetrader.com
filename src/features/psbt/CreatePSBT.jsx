import React, { useState, useEffect, useCallback } from 'react';
import { Psbt, networks, payments } from 'bitcoinjs-lib';
import {
  useOrdConnect,
  useSignMessage,
  OrdConnectProvider,
} from '@ordzaar/ord-connect';
import WalletStatus from '../wallet/WalletStatus';
import { useWalletDisconnectState } from '../wallet/useWalletDisconnectState';
import { truncateMiddle } from '../../lib/format';

// Inner component that uses the hooks
const CreatePSBTInner = ({ glEventHub }) => {
  const [inputs, setInputs] = useState([
    {
      txid: '',
      vout: 0,
      value: 0,
      scriptPubKey: '',
      sequence: 0xffffffff,
    },
  ]);
  const [outputs, setOutputs] = useState([
    {
      address: '',
      value: 0,
    },
  ]);
  const [network, setNetwork] = useState('testnet');
  const [locktime, setLocktime] = useState(0);
  const [version, setVersion] = useState(2);
  const [fee, setFee] = useState(1000); // Default fee in satoshis
  const [changeAddress, setChangeAddress] = useState('');
  const [psbtHex, setPsbtHex] = useState('');
  const [signedPsbtHex, setSignedPsbtHex] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedWallet, setSelectedWallet] = useState(null);

  const {
    address: connectedAddress,
    publicKey: connectedPublicKey,
    format: connectedFormat,
    wallet: connectedWallet,
    network: connectedNetwork,
  } = useOrdConnect();

  const { signMsg } = useSignMessage();
  const isDisconnected = useWalletDisconnectState();

  const isWalletConnected =
    connectedAddress && connectedAddress.ordinals && !isDisconnected;

  // Generate sample addresses based on network
  const generateSampleAddress = useCallback(
    (addressType = 'p2wpkh') => {
      if (network === 'testnet') {
        switch (addressType) {
          case 'p2pkh':
            return 'mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef'; // Legacy testnet
          case 'p2sh':
            return '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc'; // P2SH testnet
          case 'p2wpkh':
            return 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'; // Bech32 testnet
          case 'p2tr':
            return 'tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c'; // Taproot testnet
          default:
            return 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
        }
      } else {
        switch (addressType) {
          case 'p2pkh':
            return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Legacy mainnet
          case 'p2sh':
            return '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'; // P2SH mainnet
          case 'p2wpkh':
            return 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'; // Bech32 mainnet
          case 'p2tr':
            return 'bc1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c'; // Taproot mainnet
          default:
            return 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
        }
      }
    },
    [network]
  );

  // Generate sample transaction ID based on network
  const generateSampleTxid = useCallback(() => {
    // Generate a realistic-looking but fake TXID
    const chars = '0123456789abcdefg';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }, []);

  // Set change address to connected address when wallet connects
  useEffect(() => {
    if (connectedAddress && connectedAddress.ordinals && !changeAddress) {
      setChangeAddress(connectedAddress.ordinals);
    }
  }, [connectedAddress, changeAddress]);

  // Prefill form with sample data when wallet connects
  useEffect(() => {
    if (isWalletConnected && inputs[0].txid === '') {
      // Determine address type based on connected wallet format
      const addressType = connectedFormat?.ordinals || 'p2wpkh';

      // Prefill with sample data based on network
      const sampleInput = {
        txid: generateSampleTxid(),
        vout: 0,
        value: 100000, // 0.001 BTC in satoshis
        scriptPubKey: '', // Will be auto-generated from connected wallet
        sequence: 0xffffffff,
      };

      const sampleOutput = {
        address: generateSampleAddress(addressType),
        value: 50000, // 0.0005 BTC in satoshis
      };

      setInputs([sampleInput]);
      setOutputs([sampleOutput]);
      setFee(1000); // 1000 satoshis fee
    }
  }, [
    isWalletConnected,
    inputs,
    connectedFormat,
    generateSampleAddress,
    generateSampleTxid,
  ]);

  // Set network based on connected wallet
  useEffect(() => {
    if (connectedNetwork) {
      setNetwork(connectedNetwork);
    }
  }, [connectedNetwork]);

  // Listen for wallet selection events from WalletManagement
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      console.log('CreatePSBT: Wallet selected:', wallet);
      setSelectedWallet(wallet);
    };

    // Listen for wallet connection changes
    const handleConnectionChange = (newConnectionState) => {
      console.log('CreatePSBT: Connection state changed:', newConnectionState);
      if (!newConnectionState.isConnected) {
        setSelectedWallet(null);
      }
    };

    // Listen for wallet disconnect events
    const handleDisconnect = (disconnectState) => {
      console.log('CreatePSBT: Wallet disconnected:', disconnectState);
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

  const handleInputChange = (index, field, value) => {
    const newInputs = [...inputs];
    newInputs[index][field] = value;
    setInputs(newInputs);
    setError('');
    setSuccess('');
  };

  const handleOutputChange = (index, field, value) => {
    const newOutputs = [...outputs];
    newOutputs[index][field] = value;
    setOutputs(newOutputs);
    setError('');
    setSuccess('');
  };

  const addInput = () => {
    setInputs([
      ...inputs,
      {
        txid: '',
        vout: 0,
        value: 0,
        scriptPubKey: '',
        sequence: 0xffffffff,
      },
    ]);
  };

  const removeInput = (index) => {
    if (inputs.length > 1) {
      const newInputs = inputs.filter((_, i) => i !== index);
      setInputs(newInputs);
    }
  };

  const addOutput = () => {
    setOutputs([
      ...outputs,
      {
        address: '',
        value: 0,
      },
    ]);
  };

  const removeOutput = (index) => {
    if (outputs.length > 1) {
      const newOutputs = outputs.filter((_, i) => i !== index);
      setOutputs(newOutputs);
    }
  };

  const validateInputs = () => {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input.txid || input.txid.length !== 64) {
        throw new Error(`Input ${i + 1}: TXID must be 64 characters long`);
      }
      if (!/^[0-9a-fA-F]{64}$/.test(input.txid)) {
        throw new Error(`Input ${i + 1}: TXID must be a valid hex string`);
      }
      if (input.vout < 0) {
        throw new Error(`Input ${i + 1}: Vout must be non-negative`);
      }
      if (input.value <= 0 || !Number.isInteger(input.value)) {
        throw new Error(`Input ${i + 1}: Value must be a positive integer`);
      }
      if (input.scriptPubKey && !/^[0-9a-fA-F]*$/.test(input.scriptPubKey)) {
        throw new Error(
          `Input ${i + 1}: ScriptPubKey must be a valid hex string`
        );
      }
    }
  };

  const validateOutputs = () => {
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      if (!output.address) {
        throw new Error(`Output ${i + 1}: Address is required`);
      }
      if (output.value <= 0 || !Number.isInteger(output.value)) {
        throw new Error(`Output ${i + 1}: Value must be a positive integer`);
      }
      // Basic Bitcoin address validation
      if (
        !/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^tb1[a-z0-9]{39,59}$/.test(
          output.address
        )
      ) {
        throw new Error(`Output ${i + 1}: Invalid Bitcoin address format`);
      }
    }
  };

  const calculateChange = () => {
    const totalInputValue = inputs.reduce((sum, input) => sum + input.value, 0);
    const totalOutputValue = outputs.reduce(
      (sum, output) => sum + output.value,
      0
    );
    return totalInputValue - totalOutputValue - fee;
  };

  const createPSBT = () => {
    try {
      setError('');
      setSuccess('');

      // Validate inputs
      validateInputs();
      validateOutputs();

      // Validate fee
      if (fee < 0 || !Number.isInteger(fee)) {
        throw new Error('Fee must be a non-negative integer');
      }

      // Check if change is needed
      const change = calculateChange();
      if (change < 0) {
        throw new Error('Insufficient input value to cover outputs and fee');
      }

      // Validate change address if change is needed
      if (change > 0 && changeAddress) {
        if (
          !/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^tb1[a-z0-9]{39,59}$/.test(
            changeAddress
          )
        ) {
          throw new Error('Invalid change address format');
        }
      }

      // Create PSBT
      const networkConfig =
        network === 'mainnet' ? networks.bitcoin : networks.testnet;
      const psbt = new Psbt({ network: networkConfig });

      // Add inputs
      inputs.forEach((input) => {
        const inputData = {
          hash: input.txid,
          index: input.vout,
          sequence: input.sequence,
        };

        // Add witness UTXO for SegWit inputs
        if (input.scriptPubKey) {
          try {
            const scriptBuffer = Buffer.from(input.scriptPubKey, 'hex');
            inputData.witnessUtxo = {
              script: new Uint8Array(scriptBuffer),
              value: BigInt(input.value),
            };
          } catch (e) {
            // If scriptPubKey is invalid, try to create a basic P2WPKH script
            if (connectedPublicKey && connectedPublicKey.ordinals) {
              const pubkeyBuffer = Buffer.from(
                connectedPublicKey.ordinals,
                'hex'
              );
              const p2wpkh = payments.p2wpkh({
                pubkey: pubkeyBuffer,
                network: networkConfig,
              });
              inputData.witnessUtxo = {
                script: new Uint8Array(p2wpkh.output),
                value: BigInt(input.value),
              };
            } else {
              throw new Error(
                `Input ${inputs.indexOf(input) + 1}: Invalid scriptPubKey format`
              );
            }
          }
        } else {
          // Create a basic P2WPKH script if no scriptPubKey provided
          if (connectedPublicKey && connectedPublicKey.ordinals) {
            const pubkeyBuffer = Buffer.from(
              connectedPublicKey.ordinals,
              'hex'
            );
            const p2wpkh = payments.p2wpkh({
              pubkey: pubkeyBuffer,
              network: networkConfig,
            });
            inputData.witnessUtxo = {
              script: new Uint8Array(p2wpkh.output),
              value: BigInt(input.value),
            };
          } else {
            throw new Error(
              'No scriptPubKey provided and no connected wallet public key available'
            );
          }
        }

        psbt.addInput(inputData);
      });

      // Add outputs
      outputs.forEach((output) => {
        psbt.addOutput({
          address: output.address,
          value: BigInt(output.value),
        });
      });

      // Add change output if needed
      if (change > 0 && changeAddress) {
        psbt.addOutput({
          address: changeAddress,
          value: BigInt(change),
        });
      }

      // Set locktime and version
      if (locktime > 0) {
        psbt.setLocktime(locktime);
      }
      if (version !== 2) {
        psbt.setVersion(version);
      }

      const psbtBase64 = psbt.toBase64();
      setPsbtHex(psbtBase64);
      setSuccess('PSBT created successfully!');

      return psbtBase64;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const signPSBT = async () => {
    try {
      setError('');
      setSuccess('');

      if (!psbtHex) {
        throw new Error('Please create a PSBT first');
      }

      if (!connectedWallet) {
        throw new Error('Please connect a wallet first');
      }

      // For now, we'll use the signMessage functionality as a placeholder
      // In a real implementation, you would use the wallet's signPsbt method
      const message = `Sign PSBT: ${psbtHex.substring(0, 50)}...`;

      if (signMsg && connectedAddress && connectedAddress.ordinals) {
        const signature = await signMsg(connectedAddress.ordinals, message);
        setSignedPsbtHex(`Signed: ${signature.substring(0, 50)}...`);
        setSuccess(
          'PSBT signed successfully! (Note: This is a demo signature)'
        );
      } else {
        throw new Error('Signing functionality not available');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
  };

  const clearForm = () => {
    setInputs([
      {
        txid: '',
        vout: 0,
        value: 0,
        scriptPubKey: '',
        sequence: 0xffffffff,
      },
    ]);
    setOutputs([
      {
        address: '',
        value: 0,
      },
    ]);
    setPsbtHex('');
    setSignedPsbtHex('');
    setError('');
    setSuccess('');
  };

  const generateSampleData = () => {
    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    const addressType = connectedFormat?.ordinals || 'p2wpkh';

    const sampleInput = {
      txid: generateSampleTxid(),
      vout: 0,
      value: 100000, // 0.001 BTC in satoshis
      scriptPubKey: '', // Will be auto-generated from connected wallet
      sequence: 0xffffffff,
    };

    const sampleOutput = {
      address: generateSampleAddress(addressType),
      value: 50000, // 0.0005 BTC in satoshis
    };

    setInputs([sampleInput]);
    setOutputs([sampleOutput]);
    setFee(1000);
    setError('');
    setSuccess('Sample data generated!');
  };

  const fillWithConnectedWallet = () => {
    if (!isWalletConnected) {
      setError('Please connect a wallet first');
      return;
    }

    // Use connected wallet address as output recipient
    const walletOutput = {
      address: connectedAddress.ordinals,
      value: 25000, // 0.00025 BTC in satoshis
    };

    setOutputs([walletOutput]);
    setError('');
    setSuccess('Form filled with connected wallet address!');
  };

  // Function to format address or public key (first and last 7 characters)

  return (
    <div className="create-psbt-container">
      <div className="psbt-header">
        <h2>Create PSBT</h2>
        <p>Create and sign Partially Signed Bitcoin Transactions</p>
      </div>

      {/* Wallet Status Component */}
      <WalletStatus
        glEventHub={glEventHub}
        selectedWallet={selectedWallet}
        onWalletSourceChange={() => {}}
      />

      {!isWalletConnected ? (
        <div className="psbt-warning">
          <p>⚠️ Please connect a wallet to create and sign PSBTs</p>
        </div>
      ) : (
        <div className="psbt-info">
          <h3>Connected Wallet Info</h3>
          <div className="wallet-info-grid">
            <div className="wallet-info-item">
              <strong>Address:</strong>{' '}
              {truncateMiddle(connectedAddress.ordinals)}
            </div>
            <div className="wallet-info-item">
              <strong>Format:</strong> {connectedFormat.ordinals}
            </div>
            <div className="wallet-info-item">
              <strong>Network:</strong> {network}
            </div>
            <div className="wallet-info-item">
              <strong>Wallet:</strong> {connectedWallet}
            </div>
          </div>
        </div>
      )}

      <div className="psbt-form">
        {/* Network Selection */}
        <div className="form-section">
          <h3>Network Configuration</h3>
          <div className="form-group">
            <label htmlFor="network">Network:</label>
            <select
              id="network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              disabled={!isWalletConnected}
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="version">Version:</label>
            <input
              id="version"
              type="number"
              value={version}
              onChange={(e) => setVersion(parseInt(e.target.value))}
              min="1"
              max="2"
              placeholder="2"
            />
          </div>
          <div className="form-group">
            <label htmlFor="locktime">Locktime:</label>
            <input
              id="locktime"
              type="number"
              value={locktime}
              onChange={(e) => setLocktime(parseInt(e.target.value))}
              min="0"
              placeholder="0"
            />
          </div>
        </div>

        {/* Inputs Section */}
        <div className="form-section">
          <h3>Transaction Inputs</h3>
          {inputs.map((input, index) => (
            <div key={index} className="input-group">
              <div className="input-header">
                <h4>Input {index + 1}</h4>
                {inputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInput(index)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`txid-${index}`}>
                    Transaction ID (TXID):
                  </label>
                  <input
                    id={`txid-${index}`}
                    type="text"
                    value={input.txid}
                    onChange={(e) =>
                      handleInputChange(index, 'txid', e.target.value)
                    }
                    placeholder="64-character hex string"
                    maxLength="64"
                  />
                  <small>Previous transaction hash (64 hex characters)</small>
                </div>
                <div className="form-group">
                  <label htmlFor={`vout-${index}`}>Output Index (Vout):</label>
                  <input
                    id={`vout-${index}`}
                    type="number"
                    value={input.vout}
                    onChange={(e) =>
                      handleInputChange(index, 'vout', parseInt(e.target.value))
                    }
                    min="0"
                    placeholder="0"
                  />
                  <small>Output index in the previous transaction</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`value-${index}`}>Value (Satoshis):</label>
                  <input
                    id={`value-${index}`}
                    type="number"
                    value={input.value}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        'value',
                        parseInt(e.target.value)
                      )
                    }
                    min="0"
                    placeholder="100000"
                  />
                  <small>Amount in satoshis (1 BTC = 100,000,000 sats)</small>
                </div>
                <div className="form-group">
                  <label htmlFor={`sequence-${index}`}>Sequence:</label>
                  <input
                    id={`sequence-${index}`}
                    type="number"
                    value={input.sequence}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        'sequence',
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="4294967295"
                  />
                  <small>Sequence number (default: 0xffffffff)</small>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor={`script-${index}`}>
                  ScriptPubKey (Optional):
                </label>
                <input
                  id={`script-${index}`}
                  type="text"
                  value={input.scriptPubKey}
                  onChange={(e) =>
                    handleInputChange(index, 'scriptPubKey', e.target.value)
                  }
                  placeholder="Hex-encoded script (auto-generated if empty)"
                />
                <small>
                  Output script from previous transaction (hex format)
                </small>
              </div>
            </div>
          ))}
          <button type="button" onClick={addInput} className="add-button">
            + Add Input
          </button>
        </div>

        {/* Outputs Section */}
        <div className="form-section">
          <h3>Transaction Outputs</h3>
          {outputs.map((output, index) => (
            <div key={index} className="output-group">
              <div className="output-header">
                <h4>Output {index + 1}</h4>
                {outputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOutput(index)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`address-${index}`}>Recipient Address:</label>
                  <input
                    id={`address-${index}`}
                    type="text"
                    value={output.address}
                    onChange={(e) =>
                      handleOutputChange(index, 'address', e.target.value)
                    }
                    placeholder="bc1q..."
                  />
                  <small>Bitcoin address to send to</small>
                </div>
                <div className="form-group">
                  <label htmlFor={`output-value-${index}`}>
                    Amount (Satoshis):
                  </label>
                  <input
                    id={`output-value-${index}`}
                    type="number"
                    value={output.value}
                    onChange={(e) =>
                      handleOutputChange(
                        index,
                        'value',
                        parseInt(e.target.value)
                      )
                    }
                    min="0"
                    placeholder="50000"
                  />
                  <small>Amount to send in satoshis</small>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addOutput} className="add-button">
            + Add Output
          </button>
        </div>

        {/* Fee and Change Section */}
        <div className="form-section">
          <h3>Fee & Change</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fee">Transaction Fee (Satoshis):</label>
              <input
                id="fee"
                type="number"
                value={fee}
                onChange={(e) => setFee(parseInt(e.target.value))}
                min="0"
                placeholder="1000"
              />
              <small>Fee paid to miners (recommended: 1000-5000 sats)</small>
            </div>
            <div className="form-group">
              <label htmlFor="change-address">Change Address:</label>
              <input
                id="change-address"
                type="text"
                value={changeAddress}
                onChange={(e) => setChangeAddress(e.target.value)}
                placeholder="Your address for change"
              />
              <small>
                Address to receive change (auto-filled from connected wallet)
              </small>
            </div>
          </div>
          <div className="change-info">
            <p>
              <strong>Change Amount:</strong> {calculateChange()} satoshis
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={createPSBT}
            disabled={!isWalletConnected}
            className="primary-button"
          >
            Create PSBT
          </button>
          <button
            type="button"
            onClick={signPSBT}
            disabled={!psbtHex || !isWalletConnected}
            className="secondary-button"
          >
            Sign PSBT
          </button>
          <button
            type="button"
            onClick={generateSampleData}
            disabled={!isWalletConnected}
            className="sample-button"
          >
            Generate Sample Data
          </button>
          <button
            type="button"
            onClick={fillWithConnectedWallet}
            disabled={!isWalletConnected}
            className="wallet-button"
          >
            Use My Wallet Address
          </button>
          <button type="button" onClick={clearForm} className="clear-button">
            Clear Form
          </button>
        </div>

        {/* Results Section */}
        {(psbtHex || signedPsbtHex) && (
          <div className="results-section">
            <h3>Results</h3>
            {psbtHex && (
              <div className="result-item">
                <label htmlFor="psbt-result">PSBT (Base64):</label>
                <div className="result-content">
                  <textarea
                    id="psbt-result"
                    value={psbtHex}
                    readOnly
                    rows="4"
                    className="result-textarea"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(psbtHex)}
                    className="copy-button"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            {signedPsbtHex && (
              <div className="result-item">
                <label htmlFor="signed-psbt-result">Signed PSBT:</label>
                <div className="result-content">
                  <textarea
                    id="signed-psbt-result"
                    value={signedPsbtHex}
                    readOnly
                    rows="4"
                    className="result-textarea"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(signedPsbtHex)}
                    className="copy-button"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Messages */}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
      </div>
    </div>
  );
};

// Main component that wraps the inner component with providers
const CreatePSBT = ({ glContainer, glEventHub }) => {
  return (
    <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
      <CreatePSBTInner glContainer={glContainer} glEventHub={glEventHub} />
    </OrdConnectProvider>
  );
};

export default CreatePSBT;
