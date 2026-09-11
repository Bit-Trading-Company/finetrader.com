import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useSign } from '@ordzaar/ord-connect';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import WalletManagement from '../../features/wallet/WalletManagement';
import {
  fetchAllInscriptionUtxos,
  buildInscriptionExtractionPsbtBase64,
  broadcastTxHex,
  extractInscriptionFromProxyWallet,
  pickLargestNonOrdinalFeeUtxo,
} from './extractorUtils';
import {
  fetchUtxos,
  isValidBitcoinAddress,
} from '../WalletConsolidator/consolidatorUtils';
import background_8 from '../../assets/images/png/backgrounds/background_8.PNG';
import { selectActiveWallets } from '../../features/wallet/walletSelection';
import '../WalletConsolidator/WalletConsolidator.css';
import { useEventHub } from '../../lib/eventHub';
import { CONNECT_WALLET_LIST } from '../../features/wallet/walletOptions';
import WizardStep from '../../components/WizardStep';

const StepStatus = {
  PENDING: null,
  COMPLETE: 'complete',
  IN_PROGRESS: 'in_progress',
};

const OrdinalExtractor = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatuses, setStepStatuses] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  // Wallet connection (connect/disconnect reload the page on success)
  const {
    network,
    address: connectedAddress,
    publicKey: connectedPublicKey,
    isWalletConnected,
    connect,
    disconnect,
  } = useWalletConnection();

  const { sign } = useSign();

  // Proxy wallets from WalletManagement
  const [wallets, setWallets] = useState([]);

  // Destination config (where the 546 output is sent)
  const [useConnectedWalletAsDestination, setUseConnectedWalletAsDestination] =
    useState(true);
  const [customDestination, setCustomDestination] = useState('');
  const [destinationError, setDestinationError] = useState('');

  // Extraction config
  const [feeRate, setFeeRate] = useState(1);
  const [useCustomWalletSubset, setUseCustomWalletSubset] = useState(false);
  const [selectedWalletIndices, setSelectedWalletIndices] = useState(new Set());
  const [includeConnectedWallet, setIncludeConnectedWallet] = useState(true);

  // Inscription data
  const [isScanning, setIsScanning] = useState(false);
  const [inscriptionUtxosByWallet, setInscriptionUtxosByWallet] = useState({});
  const [selectedInscriptionIds, setSelectedInscriptionIds] = useState(
    () => new Set()
  );

  // Run state
  const [isExtracting, setIsExtracting] = useState(false);
  const stopRequestedRef = useRef(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const consoleRef = useRef(null);

  const glEventHub = useEventHub();

  const addLog = useCallback((message, link = null) => {
    setConsoleLogs((prev) => {
      const next = [
        ...prev,
        { message, link, timestamp: new Date().toLocaleTimeString() },
      ];
      return next.slice(-1200);
    });
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      requestAnimationFrame(() => {
        if (consoleRef.current)
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      });
    }
  }, [consoleLogs]);

  // Listen for wallet generation
  useEffect(() => {
    const handleWalletsGenerated = (generatedWallets) => {
      setWallets(generatedWallets);
      setSelectedWalletIndices(new Set(generatedWallets.map((_, i) => i)));
      setStepStatuses((prev) => ({ ...prev, 2: StepStatus.COMPLETE }));
      setInscriptionUtxosByWallet({});
    };
    glEventHub.on('wallets-generated', handleWalletsGenerated);
    return () => glEventHub.off('wallets-generated', handleWalletsGenerated);
  }, [glEventHub]);

  // Keep all wallets selected when custom subset is off
  useEffect(() => {
    if (wallets.length > 0 && !useCustomWalletSubset) {
      setSelectedWalletIndices(new Set(wallets.map((_, i) => i)));
    }
  }, [wallets, useCustomWalletSubset]);

  // Step 1 status from wallet connection
  useEffect(() => {
    if (isWalletConnected) {
      setStepStatuses((prev) => ({ ...prev, 1: StepStatus.COMPLETE }));
    } else {
      setStepStatuses((prev) => ({ ...prev, 1: null }));
    }
  }, [isWalletConnected]);

  const getDestinationAddress = () => {
    if (useConnectedWalletAsDestination)
      return connectedAddress?.ordinals || '';
    return customDestination.trim();
  };

  // Sync destination validity
  useEffect(() => {
    const dest = getDestinationAddress();
    if (dest && isValidBitcoinAddress(dest, network)) {
      setStepStatuses((prev) => ({ ...prev, 3: StepStatus.COMPLETE }));
      setDestinationError('');
    } else if (!useConnectedWalletAsDestination && customDestination.trim()) {
      setDestinationError('Invalid Bitcoin address');
      setStepStatuses((prev) => ({ ...prev, 3: null }));
    } else {
      setStepStatuses((prev) => ({ ...prev, 3: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useConnectedWalletAsDestination,
    customDestination,
    connectedAddress,
    network,
  ]);

  const handleConnect = async (wallet) => {
    try {
      await connect(wallet);
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    }
  };

  const getActiveProxyWallets = useCallback(
    () =>
      selectActiveWallets(wallets, {
        useCustomSubset: useCustomWalletSubset,
        selectedIndices: selectedWalletIndices,
      }),
    [wallets, useCustomWalletSubset, selectedWalletIndices]
  );

  const selectableInscriptions = useMemo(() => {
    const rows = [];
    for (const [walletKey, entry] of Object.entries(inscriptionUtxosByWallet)) {
      const address = entry?.address;
      const utxos = Array.isArray(entry?.utxos) ? entry.utxos : [];
      for (const u of utxos) {
        const ins = Array.isArray(u.inscriptions) ? u.inscriptions : [];
        for (const one of ins) {
          if (!one?.inscriptionId) continue;
          rows.push({
            walletKey,
            address,
            txid: u.txid,
            vout: u.vout,
            satoshi: u.satoshi,
            scriptPk: u.scriptPk,
            inscriptionsCount: ins.length,
            inscription: one,
          });
        }
      }
    }
    return rows;
  }, [inscriptionUtxosByWallet]);

  const toggleSelection = useCallback((inscriptionId, checked) => {
    setSelectedInscriptionIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(inscriptionId) : next.delete(inscriptionId);
      return next;
    });
  }, []);

  const selectAllSingles = useCallback(() => {
    setSelectedInscriptionIds((prev) => {
      const next = new Set(prev);
      for (const row of selectableInscriptions) {
        if (row.inscriptionsCount === 1 && row.inscription?.inscriptionId) {
          next.add(row.inscription.inscriptionId);
        }
      }
      return next;
    });
  }, [selectableInscriptions]);

  const clearSelection = useCallback(() => {
    setSelectedInscriptionIds(new Set());
  }, []);

  const handleScan = async () => {
    const dest = getDestinationAddress();
    if (!dest || !isValidBitcoinAddress(dest, network)) {
      addLog('✗ Set a valid destination address first.');
      return;
    }

    setIsScanning(true);
    setInscriptionUtxosByWallet({});
    setSelectedInscriptionIds(new Set());

    try {
      const map = {};
      const tasks = [];

      // Connected wallet scan
      if (includeConnectedWallet && connectedAddress?.ordinals) {
        tasks.push(async () => {
          const addr = connectedAddress.ordinals;
          addLog(`Scanning connected wallet for inscription UTXOs...`);
          const utxos = await fetchAllInscriptionUtxos(addr, {
            pageSize: 16,
          });
          map[`connected:${addr}`] = { address: addr, utxos };
          addLog(
            `Found ${utxos.length} inscription UTXO(s) in connected wallet.`
          );
        });
      }

      // Proxy wallets scan
      const activeProxyWallets = getActiveProxyWallets();
      for (const w of activeProxyWallets) {
        tasks.push(async () => {
          addLog(
            `Scanning proxy wallet ${w.address.slice(0, 8)}... for inscription UTXOs...`
          );
          const utxos = await fetchAllInscriptionUtxos(w.address, {
            pageSize: 16,
          });
          map[`proxy:${w.address}`] = { address: w.address, utxos };
          addLog(
            `Found ${utxos.length} inscription UTXO(s) in proxy wallet ${w.address.slice(0, 8)}...`
          );
        });
      }

      // Run sequentially to reduce rate limiting. Tasks are queued as
      // functions: invoking them while queueing would start every scan at once.
      for (const task of tasks) await task();

      setInscriptionUtxosByWallet(map);
      // Default selection: select all inscriptions from UTXOs that have exactly 1 inscription.
      // For multi-inscription UTXOs, require explicit user selection.
      const nextSelected = new Set();
      for (const entry of Object.values(map)) {
        const utxos = Array.isArray(entry.utxos) ? entry.utxos : [];
        for (const u of utxos) {
          const ins = Array.isArray(u.inscriptions) ? u.inscriptions : [];
          if (ins.length === 1 && ins[0]?.inscriptionId) {
            nextSelected.add(ins[0].inscriptionId);
          }
        }
      }
      setSelectedInscriptionIds(nextSelected);
      setStepStatuses((prev) => ({ ...prev, 4: StepStatus.COMPLETE }));
    } catch (e) {
      addLog(`✗ Scan failed: ${e?.message || String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const extractOneConnected = async ({
    address,
    inscriptionUtxo,
    destinationAddress,
  }) => {
    // Build a PSBT using mempool utxos for fee input selection.
    const allUtxos = await fetchUtxos(address, network);
    const feeUtxo = await pickLargestNonOrdinalFeeUtxo(allUtxos, {
      exclude: [{ txid: inscriptionUtxo.txid, vout: inscriptionUtxo.vout }],
    });

    const { psbtBase64 } = await buildInscriptionExtractionPsbtBase64({
      inscriptionUtxo: {
        txid: inscriptionUtxo.txid,
        vout: inscriptionUtxo.vout,
        value: inscriptionUtxo.satoshi,
        scriptPk: inscriptionUtxo.scriptPk,
        inscriptions: inscriptionUtxo.inscriptions,
      },
      inscription: inscriptionUtxo.inscription,
      feeUtxo: feeUtxo || null,
      destinationAddress,
      changeAddress: address,
      feeRate,
      network,
      walletPublicKeyHex: connectedPublicKey?.ordinals || null,
    });

    const result = await sign(address, psbtBase64, {
      finalize: true,
      extractTx: true,
    });

    const txHex = result?.hex;
    if (!txHex) throw new Error('Connected wallet signing returned no tx hex');
    return await broadcastTxHex({ txHex, network });
  };

  const handleStartExtraction = async () => {
    const destinationAddress = getDestinationAddress();
    if (
      !destinationAddress ||
      !isValidBitcoinAddress(destinationAddress, network)
    ) {
      addLog('✗ Invalid destination address');
      return;
    }

    stopRequestedRef.current = false;
    setIsExtracting(true);
    setConsoleLogs([]);

    try {
      addLog(`Starting extraction...`);
      addLog(`Destination (546 outputs): ${destinationAddress}`);
      addLog(`Fee rate: ${feeRate} sat/vbyte`);

      const entries = Object.entries(inscriptionUtxosByWallet);
      if (entries.length === 0) {
        addLog('✗ No scanned inscription data. Run "Scan" first.');
        return;
      }

      const selectedRows = selectableInscriptions.filter((row) =>
        selectedInscriptionIds.has(row.inscription.inscriptionId)
      );

      if (selectedRows.length === 0) {
        addLog(
          '✗ No inscriptions selected. Select inscriptions to extract first.'
        );
        return;
      }

      addLog(`Selected ${selectedRows.length} inscription(s) to extract.`);

      for (const row of selectedRows) {
        if (stopRequestedRef.current) break;

        const addr = row.address;
        const key = row.walletKey;
        const ins = row.inscription;
        const label =
          ins?.inscriptionNumber != null
            ? `#${ins.inscriptionNumber}`
            : ins.inscriptionId;

        if (row.inscriptionsCount > 1) {
          addLog(
            `  ⚠ Multi-inscription UTXO: extracting ${label} will move other inscriptions in ${row.txid.slice(0, 8)}...:${row.vout} too.`
          );
        }

        addLog(
          `  Extracting ${label} from ${row.txid.slice(0, 8)}...:${row.vout} (${row.satoshi} sats)...`
        );

        try {
          if (key.startsWith('connected:')) {
            const { txid, txUrl } = await extractOneConnected({
              address: addr,
              inscriptionUtxo: {
                txid: row.txid,
                vout: row.vout,
                satoshi: row.satoshi,
                scriptPk: row.scriptPk,
                inscriptions: [ins],
                inscription: ins,
              },
              destinationAddress,
            });
            addLog(
              `  ✓ Extracted ${label}. TXID: ${txid.slice(0, 16)}...`,
              txUrl
            );
          } else if (key.startsWith('proxy:')) {
            const w = wallets.find((x) => x.address === addr);
            if (!w?.privateKey)
              throw new Error('Proxy wallet missing privateKey');
            const { txid, txUrl } = await extractInscriptionFromProxyWallet({
              wallet: w,
              inscriptionUtxo: {
                txid: row.txid,
                vout: row.vout,
                value: row.satoshi,
                satoshi: row.satoshi,
                scriptPk: row.scriptPk,
                scriptpubkey: row.scriptPk,
                inscriptions: [ins],
              },
              inscription: ins,
              destinationAddress,
              feeRate,
              network,
            });
            addLog(
              `  ✓ Extracted ${label}. TXID: ${txid.slice(0, 16)}...`,
              txUrl
            );
          }
        } catch (e) {
          addLog(`  ✗ Failed to extract ${label}: ${e?.message || String(e)}`);
        }

        if (!stopRequestedRef.current) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      addLog(`\n✓ Extraction run complete.`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    addLog('Stop requested...');
  };

  const destinationAddress = getDestinationAddress();
  const isDestinationValid =
    destinationAddress && isValidBitcoinAddress(destinationAddress, network);

  return (
    <div
      className="consolidator-container"
      style={{ backgroundImage: `url(${background_8})` }}
    >
      <div className="consolidator-content">
        <h1 className="consolidator-title">Ordinal Extractor</h1>
        <p className="consolidator-subtitle">
          Extract inscriptions into 546-sat UTXOs (postage) and send them to a
          destination
        </p>

        {/* Step 1: Connect Wallet */}
        <WizardStep
          classPrefix="consolidator"
          number={1}
          title="Connect Wallet"
          isActive={currentStep === 1}
          isComplete={stepStatuses[1] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(1)}
        >
          {!isWalletConnected ? (
            <div className="consolidator-wallet-list">
              {CONNECT_WALLET_LIST.map((w, i) => (
                <button
                  key={i}
                  className="consolidator-wallet-item"
                  onClick={() => handleConnect(w.wallet)}
                >
                  <img
                    src={w.icon}
                    alt={w.wallet}
                    className="consolidator-wallet-icon"
                  />
                  <span>{w.wallet}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="consolidator-connected-info">
              <p className="consolidator-connected-address">
                ✓ Connected: {connectedAddress?.ordinals?.slice(0, 10)}...
                {connectedAddress?.ordinals?.slice(-8)}
              </p>
              <button
                onClick={handleDisconnect}
                className="consolidator-btn consolidator-btn--secondary"
              >
                Disconnect
              </button>
              {stepStatuses[1] === StepStatus.COMPLETE && (
                <button
                  onClick={() => setCurrentStep(2)}
                  className="consolidator-btn"
                >
                  Continue to Step 2 →
                </button>
              )}
            </div>
          )}
        </WizardStep>

        {/* Step 2: Load Proxy Wallets */}
        <WizardStep
          classPrefix="consolidator"
          number={2}
          title={
            <>
              Load Proxy Wallets (optional)
              {wallets.length > 0 && (
                <span className="consolidator-badge">{wallets.length}</span>
              )}
            </>
          }
          isActive={currentStep === 2}
          isComplete={stepStatuses[2] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(2)}
        >
          <WalletManagement glEventHub={glEventHub} />

          <div style={{ marginTop: '14px' }}>
            <label className="consolidator-checkbox-label">
              <input
                type="checkbox"
                checked={includeConnectedWallet}
                onChange={(e) => setIncludeConnectedWallet(e.target.checked)}
                disabled={isExtracting || !isWalletConnected}
              />
              <span>Include connected wallet in scan/extraction</span>
            </label>
          </div>

          {wallets.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <label className="consolidator-checkbox-label">
                <input
                  type="checkbox"
                  checked={useCustomWalletSubset}
                  onChange={(e) => {
                    setUseCustomWalletSubset(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedWalletIndices(
                        new Set(wallets.map((_, i) => i))
                      );
                    }
                  }}
                  disabled={isExtracting}
                />
                <span>Select specific proxy wallets</span>
              </label>

              {useCustomWalletSubset && wallets.length > 0 && (
                <div className="consolidator-wallet-checkboxes">
                  <div className="consolidator-wallet-check-actions">
                    <button
                      className="consolidator-btn consolidator-btn--tiny"
                      onClick={() =>
                        setSelectedWalletIndices(
                          new Set(wallets.map((_, i) => i))
                        )
                      }
                      disabled={isExtracting}
                    >
                      Select all
                    </button>
                    <button
                      className="consolidator-btn consolidator-btn--tiny consolidator-btn--secondary"
                      onClick={() => setSelectedWalletIndices(new Set())}
                      disabled={isExtracting}
                    >
                      Deselect all
                    </button>
                  </div>
                  {wallets.map((wallet, i) => (
                    <label key={i} className="consolidator-wallet-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedWalletIndices.has(i)}
                        onChange={(e) => {
                          const next = new Set(selectedWalletIndices);
                          e.target.checked ? next.add(i) : next.delete(i);
                          setSelectedWalletIndices(next);
                        }}
                        disabled={isExtracting}
                      />
                      <span className="consolidator-wallet-label">
                        Wallet #{i + 1}: {wallet.address.slice(0, 8)}...
                        {wallet.address.slice(-6)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setCurrentStep(3)}
            className="consolidator-btn"
            style={{ marginTop: '16px' }}
            disabled={!isWalletConnected}
          >
            Continue to Step 3 →
          </button>
        </WizardStep>

        {/* Step 3: Destination */}
        <WizardStep
          classPrefix="consolidator"
          number={3}
          title="Set Destination Address"
          isActive={currentStep === 3}
          isComplete={stepStatuses[3] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(3)}
        >
          <div className="consolidator-destination-section">
            <label className="consolidator-radio-label">
              <input
                type="radio"
                name="destMode"
                checked={useConnectedWalletAsDestination}
                onChange={() => {
                  setUseConnectedWalletAsDestination(true);
                  setDestinationError('');
                }}
                disabled={isExtracting}
              />
              <span>
                Send extracted 546 UTXOs to connected ordinals address
              </span>
            </label>

            {useConnectedWalletAsDestination && connectedAddress?.ordinals && (
              <div className="consolidator-address-preview">
                <span className="consolidator-address-label">Address:</span>
                <span className="consolidator-address-value">
                  {connectedAddress.ordinals}
                </span>
              </div>
            )}

            <label
              className="consolidator-radio-label"
              style={{ marginTop: '16px' }}
            >
              <input
                type="radio"
                name="destMode"
                checked={!useConnectedWalletAsDestination}
                onChange={() => setUseConnectedWalletAsDestination(false)}
                disabled={isExtracting}
              />
              <span>Use custom destination address</span>
            </label>

            {!useConnectedWalletAsDestination && (
              <div className="consolidator-custom-address">
                <input
                  type="text"
                  className={`consolidator-address-input ${destinationError ? 'error' : ''}`}
                  placeholder="Enter Bitcoin address"
                  value={customDestination}
                  onChange={(e) => {
                    setCustomDestination(e.target.value);
                    setDestinationError('');
                  }}
                  disabled={isExtracting}
                />
                {destinationError && (
                  <p className="consolidator-error-text">{destinationError}</p>
                )}
              </div>
            )}

            {isDestinationValid && (
              <button
                onClick={() => setCurrentStep(4)}
                className="consolidator-btn"
                style={{ marginTop: '20px' }}
              >
                Continue to Step 4 →
              </button>
            )}
          </div>
        </WizardStep>

        {/* Step 4: Scan + Extract */}
        <WizardStep
          classPrefix="consolidator"
          number={4}
          title="Scan and Extract"
          isActive={currentStep === 4}
          isComplete={stepStatuses[4] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(4)}
        >
          <div className="consolidator-controls">
            <div className="consolidator-control-group">
              <label className="consolidator-label">
                Fee Rate (sat/vbyte):
              </label>
              <input
                type="number"
                value={feeRate}
                onChange={(e) =>
                  setFeeRate(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={isExtracting || isScanning}
                min="1"
                max="500"
                className="consolidator-number-input"
              />
              <p className="consolidator-hint">
                First version uses estimated fee; if you see “insufficient
                change”, lower fee rate or ensure there’s a fee UTXO.
              </p>
            </div>

            <button
              onClick={handleScan}
              className="consolidator-btn consolidator-btn--secondary"
              disabled={
                !isWalletConnected ||
                !isDestinationValid ||
                isScanning ||
                isExtracting
              }
            >
              {isScanning ? 'Scanning...' : '🔎 Scan for inscription UTXOs'}
            </button>

            {selectableInscriptions.length > 0 && (
              <div className="consolidator-preview-card">
                <h4 className="consolidator-preview-title">
                  Select inscriptions to extract
                </h4>
                <p className="consolidator-hint" style={{ marginTop: 0 }}>
                  Singles are auto-selected after scan. Multi-inscription UTXOs
                  require explicit selection; extracting one will move the
                  others too.
                </p>

                <div className="consolidator-wallet-check-actions">
                  <button
                    className="consolidator-btn consolidator-btn--tiny"
                    onClick={selectAllSingles}
                    disabled={isExtracting || isScanning}
                  >
                    Select all singles
                  </button>
                  <button
                    className="consolidator-btn consolidator-btn--tiny consolidator-btn--secondary"
                    onClick={clearSelection}
                    disabled={isExtracting || isScanning}
                  >
                    Clear selection
                  </button>
                  <span
                    className="consolidator-hint"
                    style={{ marginLeft: '8px' }}
                  >
                    Selected: {selectedInscriptionIds.size}
                  </span>
                </div>

                <div
                  className="consolidator-preview-wallets"
                  style={{ maxHeight: 260 }}
                >
                  {selectableInscriptions.map((row, i) => {
                    const ins = row.inscription;
                    const id = ins.inscriptionId;
                    const checked = selectedInscriptionIds.has(id);
                    return (
                      <label
                        key={`${row.walletKey}:${row.txid}:${row.vout}:${id}:${i}`}
                        className="consolidator-wallet-checkbox-row"
                        style={{ padding: '6px 4px' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            toggleSelection(id, e.target.checked)
                          }
                          disabled={isExtracting || isScanning}
                        />
                        <span className="consolidator-wallet-label">
                          {ins.inscriptionNumber != null
                            ? `#${ins.inscriptionNumber}`
                            : id.slice(0, 10)}
                          {' — '}
                          {row.address?.slice(0, 8)}...
                          {row.address?.slice(-6)}
                          {' — '}
                          {row.txid.slice(0, 8)}...:{row.vout}
                          {' — '}
                          size {row.satoshi} sats
                          {row.inscriptionsCount > 1 ? ' — MULTI' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="consolidator-action-row">
              <button
                onClick={isExtracting ? handleStop : handleStartExtraction}
                className={`consolidator-btn consolidator-btn--large ${
                  isExtracting
                    ? 'consolidator-btn--stop'
                    : 'consolidator-btn--start'
                }`}
                disabled={
                  !isWalletConnected ||
                  !isDestinationValid ||
                  (!isExtracting && isScanning)
                }
              >
                {isExtracting ? '⏹ Stop Extraction' : '⚡ Start Extraction'}
              </button>
            </div>
          </div>

          {/* Console */}
          <div className="consolidator-console">
            <div className="consolidator-console-header">
              <h3>Console Output</h3>
              {consoleLogs.length > 0 && (
                <button
                  className="consolidator-btn consolidator-btn--tiny consolidator-btn--secondary"
                  onClick={() => setConsoleLogs([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="consolidator-console-logs" ref={consoleRef}>
              {consoleLogs.length === 0 ? (
                <p className="consolidator-console-empty">
                  No logs yet. Scan and start extraction to see output here.
                </p>
              ) : (
                consoleLogs.map((log, i) => (
                  <div key={i} className="consolidator-console-log">
                    <span className="consolidator-console-time">
                      {log.timestamp}
                    </span>
                    <span className="consolidator-console-message">
                      {log.message}
                    </span>
                    {log.link && (
                      <a
                        href={log.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="consolidator-console-link"
                      >
                        View tx
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </WizardStep>
      </div>
    </div>
  );
};

export default OrdinalExtractor;
