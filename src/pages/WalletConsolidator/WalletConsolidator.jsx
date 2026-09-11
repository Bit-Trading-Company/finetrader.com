import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import WalletManagement from '../../features/wallet/WalletManagement';
import {
  consolidateAllWallets,
  isValidBitcoinAddress,
  estimateConsolidationFee,
  fetchUtxos,
} from './consolidatorUtils';
import {
  MEMPOOL_PROVIDERS,
  getMempoolApiProvider,
  setMempoolApiProvider,
  getMempoolProviderLabel,
} from '../../lib/mempoolProvider';
import background_8 from '../../assets/images/png/backgrounds/background_8.PNG';
import './WalletConsolidator.css';
import { useEventHub } from '../../lib/eventHub';
import { CONNECT_WALLET_LIST } from '../../features/wallet/walletOptions';
import WizardStep from '../../components/WizardStep';

const StepStatus = {
  PENDING: null,
  COMPLETE: 'complete',
  IN_PROGRESS: 'in_progress',
};

const WalletConsolidator = () => {
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
    isWalletConnected,
    connect,
    disconnect,
  } = useWalletConnection();

  // Proxy wallets from WalletManagement
  const [wallets, setWallets] = useState([]);

  // Step 3: destination config
  const [useConnectedWallet, setUseConnectedWallet] = useState(true);
  const [customAddress, setCustomAddress] = useState('');
  const [addressError, setAddressError] = useState('');

  // Step 4: wallet selection & consolidation
  const [useCustomWalletSubset, setUseCustomWalletSubset] = useState(false);
  const [selectedWalletIndices, setSelectedWalletIndices] = useState(new Set());
  const [feeRate, setFeeRate] = useState(1);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [walletStatuses, setWalletStatuses] = useState({});
  const stopRequestedRef = useRef(false);
  const consoleRef = useRef(null);

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mempoolProvider, setMempoolProviderState] = useState(
    getMempoolApiProvider()
  );

  // Preview totals (async)
  const [previewData, setPreviewData] = useState(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // Event hub for WalletManagement communication
  const glEventHub = useEventHub();

  const addLog = useCallback((message, link = null) => {
    setConsoleLogs((prev) => {
      const newLogs = [
        ...prev,
        { message, link, timestamp: new Date().toLocaleTimeString() },
      ];
      return newLogs.slice(-1000);
    });
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      requestAnimationFrame(() => {
        if (consoleRef.current)
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      });
    }
  }, [consoleLogs]);

  // Sync mempool provider from localStorage
  useEffect(() => {
    setMempoolProviderState(getMempoolApiProvider());
  }, []);

  // Test mempool.space connectivity on load
  useEffect(() => {
    const testMempool = async () => {
      if (mempoolProvider !== MEMPOOL_PROVIDERS.MEMPOOL_SPACE) return;
      try {
        const res = await fetch('https://mempool.space/api/block-height/1');
        if (!res.ok) handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
      } catch {
        handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
      }
    };
    testMempool();
  }, [mempoolProvider]);

  // Listen for wallet generation
  useEffect(() => {
    const handleWalletsGenerated = (generatedWallets) => {
      setWallets(generatedWallets);
      setSelectedWalletIndices(new Set(generatedWallets.map((_, i) => i)));
      setStepStatuses((prev) => ({ ...prev, 2: StepStatus.COMPLETE }));
      setWalletStatuses({});
      setPreviewData(null);
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

  // Sync destination address step status
  useEffect(() => {
    const dest = useConnectedWallet
      ? connectedAddress?.ordinals || ''
      : customAddress.trim();
    if (dest && isValidBitcoinAddress(dest, network)) {
      setStepStatuses((prev) => ({ ...prev, 3: StepStatus.COMPLETE }));
      setAddressError('');
    } else if (!useConnectedWallet && customAddress.trim()) {
      setAddressError('Invalid Bitcoin address');
      setStepStatuses((prev) => ({ ...prev, 3: null }));
    } else {
      setStepStatuses((prev) => ({ ...prev, 3: null }));
    }
  }, [useConnectedWallet, customAddress, connectedAddress, network]);

  const handleMempoolProviderChange = (provider) => {
    setMempoolApiProvider(provider);
    setMempoolProviderState(provider);
  };

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

  const getDestinationAddress = () => {
    if (useConnectedWallet) return connectedAddress?.ordinals || '';
    return customAddress.trim();
  };

  const getActiveWallets = useCallback(() => {
    // An empty custom subset selects no wallets (the page asks the user to
    // select at least one). It must not widen to every wallet: consolidation
    // moves funds.
    if (useCustomWalletSubset) {
      return wallets.filter((_, i) => selectedWalletIndices.has(i));
    }
    return wallets;
  }, [wallets, useCustomWalletSubset, selectedWalletIndices]);

  // Fetch preview balances
  const handleFetchPreview = async () => {
    const activeWallets = getActiveWallets();
    if (activeWallets.length === 0) return;

    setIsFetchingPreview(true);
    setPreviewData(null);

    try {
      let totalSats = 0;
      let totalUtxos = 0;
      let walletsWithFunds = 0;
      const walletPreviews = [];

      for (const wallet of activeWallets) {
        try {
          const utxos = await fetchUtxos(wallet.address, network);
          const sats = utxos.reduce((s, u) => s + u.value, 0);
          const fee = estimateConsolidationFee(
            utxos.length,
            utxos.length,
            feeRate
          );
          const spendable = Math.max(0, sats - fee);
          totalSats += sats;
          totalUtxos += utxos.length;
          if (utxos.length > 0) walletsWithFunds++;
          walletPreviews.push({
            address: wallet.address,
            sats,
            utxos: utxos.length,
            estimatedFee: fee,
            spendable,
          });
        } catch {
          walletPreviews.push({
            address: wallet.address,
            sats: 0,
            utxos: 0,
            estimatedFee: 0,
            spendable: 0,
            error: true,
          });
        }
      }

      setPreviewData({
        totalSats,
        totalUtxos,
        walletsWithFunds,
        walletCount: activeWallets.length,
        walletPreviews,
      });
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleStartConsolidation = async () => {
    const destinationAddress = getDestinationAddress();
    if (!destinationAddress) {
      addLog('✗ No destination address set');
      return;
    }
    if (!isValidBitcoinAddress(destinationAddress, network)) {
      addLog('✗ Invalid destination address');
      return;
    }

    const activeWallets = getActiveWallets();
    if (activeWallets.length === 0) {
      addLog('✗ No wallets selected');
      return;
    }

    stopRequestedRef.current = false;
    setIsConsolidating(true);
    setConsoleLogs([]);
    setWalletStatuses({});

    addLog(`Starting consolidation of ${activeWallets.length} wallet(s)...`);
    addLog(`Destination: ${destinationAddress}`);
    addLog(`Fee rate: ${feeRate} sat/vbyte`);
    addLog(`Network: ${network}`);

    await consolidateAllWallets({
      wallets: activeWallets,
      destinationAddress,
      network,
      feeRate,
      addLog,
      // Keyed by address: `index` is the position within activeWallets, which
      // differs from the full wallet list when a custom subset is used.
      onWalletComplete: (index, result) => {
        const key = activeWallets[index]?.address ?? index;
        setWalletStatuses((prev) => ({ ...prev, [key]: result }));
      },
      isStopRequested: () => stopRequestedRef.current,
    });

    setIsConsolidating(false);
    setStepStatuses((prev) => ({ ...prev, 4: StepStatus.COMPLETE }));
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    addLog('Stop requested...');
  };

  const destinationAddress = getDestinationAddress();
  const isDestinationValid =
    destinationAddress && isValidBitcoinAddress(destinationAddress, network);
  const activeWallets = getActiveWallets();

  const canConsolidate =
    isWalletConnected &&
    wallets.length > 0 &&
    isDestinationValid &&
    activeWallets.length > 0 &&
    !isConsolidating;

  return (
    <div
      className="consolidator-container"
      style={{ backgroundImage: `url(${background_8})` }}
    >
      <div className="consolidator-content">
        <h1 className="consolidator-title">Wallet Consolidator</h1>
        <p className="consolidator-subtitle">
          Sweep all funds from proxy wallets into a single address
        </p>

        {/* Settings button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="consolidator-settings-btn"
          title="Settings"
        >
          ⚙
        </button>

        {/* ── Step 1: Connect Wallet ── */}
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

        {/* ── Step 2: Load Proxy Wallets ── */}
        <WizardStep
          classPrefix="consolidator"
          number={2}
          title={
            <>
              Load Proxy Wallets
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
          {wallets.length > 0 && (
            <button
              onClick={() => setCurrentStep(3)}
              className="consolidator-btn"
              style={{ marginTop: '16px' }}
            >
              Continue to Step 3 →
            </button>
          )}
        </WizardStep>

        {/* ── Step 3: Set Destination Address ── */}
        <WizardStep
          classPrefix="consolidator"
          number={3}
          title="Set Destination Address"
          isActive={currentStep === 3}
          isComplete={stepStatuses[3] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(3)}
        >
          <div className="consolidator-destination-section">
            {/* Use connected wallet option */}
            <label className="consolidator-radio-label">
              <input
                type="radio"
                name="destMode"
                checked={useConnectedWallet}
                onChange={() => {
                  setUseConnectedWallet(true);
                  setAddressError('');
                }}
                disabled={isConsolidating}
              />
              <span>Send to connected wallet</span>
            </label>
            {useConnectedWallet && connectedAddress?.ordinals && (
              <div className="consolidator-address-preview">
                <span className="consolidator-address-label">Address:</span>
                <span className="consolidator-address-value">
                  {connectedAddress.ordinals}
                </span>
              </div>
            )}
            {useConnectedWallet && !isWalletConnected && (
              <p className="consolidator-hint consolidator-hint--warn">
                ⚠ No wallet connected. Connect a wallet in Step 1.
              </p>
            )}

            {/* Custom address option */}
            <label
              className="consolidator-radio-label"
              style={{ marginTop: '16px' }}
            >
              <input
                type="radio"
                name="destMode"
                checked={!useConnectedWallet}
                onChange={() => setUseConnectedWallet(false)}
                disabled={isConsolidating}
              />
              <span>Use custom address</span>
            </label>
            {!useConnectedWallet && (
              <div className="consolidator-custom-address">
                <input
                  type="text"
                  className={`consolidator-address-input ${addressError ? 'error' : ''}`}
                  placeholder="Enter Bitcoin address (bc1p..., 1..., 3...)"
                  value={customAddress}
                  onChange={(e) => {
                    setCustomAddress(e.target.value);
                    setAddressError('');
                  }}
                  disabled={isConsolidating}
                />
                {addressError && (
                  <p className="consolidator-error-text">{addressError}</p>
                )}
                {!addressError &&
                  customAddress.trim() &&
                  isValidBitcoinAddress(customAddress.trim(), network) && (
                    <p className="consolidator-success-text">✓ Valid address</p>
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

        {/* ── Step 4: Consolidate ── */}
        <WizardStep
          classPrefix="consolidator"
          number={4}
          title="Consolidate Funds"
          isActive={currentStep === 4}
          isComplete={stepStatuses[4] === StepStatus.COMPLETE}
          onSelect={() => setCurrentStep(4)}
        >
          <div className="consolidator-controls">
            {/* Destination summary */}
            {isDestinationValid && (
              <div className="consolidator-summary-card">
                <div className="consolidator-summary-row">
                  <span className="consolidator-summary-label">
                    Destination:
                  </span>
                  <span className="consolidator-summary-value consolidator-address-mono">
                    {destinationAddress.slice(0, 14)}...
                    {destinationAddress.slice(-10)}
                  </span>
                </div>
                <div className="consolidator-summary-row">
                  <span className="consolidator-summary-label">
                    Active wallets:
                  </span>
                  <span className="consolidator-summary-value">
                    {activeWallets.length}
                  </span>
                </div>
                <div className="consolidator-summary-row">
                  <span className="consolidator-summary-label">Fee rate:</span>
                  <span className="consolidator-summary-value">
                    {feeRate} sat/vbyte
                  </span>
                </div>
              </div>
            )}

            {/* Fee rate input */}
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
                disabled={isConsolidating}
                min="1"
                max="500"
                className="consolidator-number-input"
              />
              <p className="consolidator-hint">
                Typical: 5–15 sat/vbyte for confirmation within a few hours
              </p>
            </div>

            {/* Custom wallet subset toggle */}
            <div className="consolidator-control-group">
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
                  disabled={isConsolidating || wallets.length === 0}
                />
                <span>Select specific wallets to consolidate</span>
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
                      disabled={isConsolidating}
                    >
                      Select all
                    </button>
                    <button
                      className="consolidator-btn consolidator-btn--tiny consolidator-btn--secondary"
                      onClick={() => setSelectedWalletIndices(new Set())}
                      disabled={isConsolidating}
                    >
                      Deselect all
                    </button>
                  </div>
                  {wallets.map((wallet, i) => {
                    const status = walletStatuses[wallet.address];
                    return (
                      <label
                        key={i}
                        className="consolidator-wallet-checkbox-row"
                      >
                        <input
                          type="checkbox"
                          checked={selectedWalletIndices.has(i)}
                          onChange={(e) => {
                            const next = new Set(selectedWalletIndices);
                            e.target.checked ? next.add(i) : next.delete(i);
                            setSelectedWalletIndices(next);
                          }}
                          disabled={isConsolidating}
                        />
                        <span className="consolidator-wallet-label">
                          Wallet #{i + 1}: {wallet.address.slice(0, 8)}...
                          {wallet.address.slice(-6)}
                        </span>
                        {status && (
                          <span
                            className={`consolidator-wallet-badge ${
                              status.skipped
                                ? 'badge--skipped'
                                : status.error
                                  ? 'badge--error'
                                  : 'badge--success'
                            }`}
                          >
                            {status.skipped
                              ? 'Skipped'
                              : status.error
                                ? 'Failed'
                                : '✓ Sent'}
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {selectedWalletIndices.size === 0 && (
                    <p className="consolidator-error-text">
                      ⚠ Select at least one wallet
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Preview balance button */}
            <button
              onClick={handleFetchPreview}
              className="consolidator-btn consolidator-btn--secondary"
              disabled={
                isFetchingPreview ||
                isConsolidating ||
                activeWallets.length === 0
              }
              style={{ marginBottom: '8px' }}
            >
              {isFetchingPreview ? 'Fetching...' : '⟳ Preview Balances'}
            </button>

            {/* Preview data */}
            {previewData && (
              <div className="consolidator-preview-card">
                <h4 className="consolidator-preview-title">Balance Preview</h4>
                <div className="consolidator-preview-stats">
                  <div className="consolidator-preview-stat">
                    <span className="consolidator-preview-stat-label">
                      Total balance
                    </span>
                    <span className="consolidator-preview-stat-value">
                      {(previewData.totalSats / 1e8).toFixed(8)} BTC
                    </span>
                    <span className="consolidator-preview-stat-sub">
                      {previewData.totalSats.toLocaleString()} sats
                    </span>
                  </div>
                  <div className="consolidator-preview-stat">
                    <span className="consolidator-preview-stat-label">
                      Total UTXOs
                    </span>
                    <span className="consolidator-preview-stat-value">
                      {previewData.totalUtxos}
                    </span>
                  </div>
                  <div className="consolidator-preview-stat">
                    <span className="consolidator-preview-stat-label">
                      Wallets with funds
                    </span>
                    <span className="consolidator-preview-stat-value">
                      {previewData.walletsWithFunds} / {previewData.walletCount}
                    </span>
                  </div>
                </div>
                <div className="consolidator-preview-wallets">
                  {previewData.walletPreviews.map((wp, i) => (
                    <div
                      key={i}
                      className={`consolidator-preview-wallet-row ${wp.sats === 0 ? 'empty' : ''}`}
                    >
                      <span className="consolidator-preview-wallet-addr">
                        Wallet #{i + 1}: {wp.address.slice(0, 8)}...
                      </span>
                      <span className="consolidator-preview-wallet-bal">
                        {wp.error
                          ? '⚠ Error'
                          : wp.sats === 0
                            ? 'Empty'
                            : `${(wp.sats / 1e8).toFixed(8)} BTC (${wp.utxos} UTXOs)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="consolidator-action-row">
              <button
                onClick={
                  isConsolidating ? handleStop : handleStartConsolidation
                }
                className={`consolidator-btn consolidator-btn--large ${
                  isConsolidating
                    ? 'consolidator-btn--stop'
                    : 'consolidator-btn--start'
                }`}
                disabled={!isConsolidating && !canConsolidate}
              >
                {isConsolidating
                  ? '⏹ Stop Consolidation'
                  : '⚡ Start Consolidation'}
              </button>
            </div>

            {!canConsolidate && !isConsolidating && (
              <div className="consolidator-requirements">
                <p className="consolidator-hint">Requirements:</p>
                <ul className="consolidator-requirements-list">
                  <li className={isWalletConnected ? 'met' : ''}>
                    {isWalletConnected ? '✓' : '○'} Wallet connected
                  </li>
                  <li className={wallets.length > 0 ? 'met' : ''}>
                    {wallets.length > 0 ? '✓' : '○'} Proxy wallets loaded
                  </li>
                  <li className={isDestinationValid ? 'met' : ''}>
                    {isDestinationValid ? '✓' : '○'} Valid destination address
                  </li>
                  <li className={activeWallets.length > 0 ? 'met' : ''}>
                    {activeWallets.length > 0 ? '✓' : '○'} At least one wallet
                    selected
                  </li>
                </ul>
              </div>
            )}
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
                  No logs yet. Start consolidation to see output here.
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

        {/* Settings Modal */}
        {showSettingsModal && (
          <div
            className="consolidator-modal-overlay"
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              className="consolidator-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="consolidator-modal-header">
                <h2>Settings</h2>
                <button
                  className="consolidator-modal-close"
                  onClick={() => setShowSettingsModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="consolidator-modal-body">
                <div className="consolidator-settings-group">
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 600,
                    }}
                  >
                    Mempool API provider
                  </label>
                  <div className="consolidator-radio-group">
                    <label className="consolidator-radio-label">
                      <input
                        type="radio"
                        name="mempoolProvider"
                        value={MEMPOOL_PROVIDERS.MEMPOOL_SPACE}
                        checked={
                          mempoolProvider === MEMPOOL_PROVIDERS.MEMPOOL_SPACE
                        }
                        onChange={() =>
                          handleMempoolProviderChange(
                            MEMPOOL_PROVIDERS.MEMPOOL_SPACE
                          )
                        }
                      />
                      <span>mempool.space (default)</span>
                    </label>
                    <label className="consolidator-radio-label">
                      <input
                        type="radio"
                        name="mempoolProvider"
                        value={MEMPOOL_PROVIDERS.BLOCKSTREAM}
                        checked={
                          mempoolProvider === MEMPOOL_PROVIDERS.BLOCKSTREAM
                        }
                        onChange={() =>
                          handleMempoolProviderChange(
                            MEMPOOL_PROVIDERS.BLOCKSTREAM
                          )
                        }
                      />
                      <span>blockstream.info</span>
                    </label>
                  </div>
                  <p
                    className="consolidator-hint"
                    style={{ marginLeft: '4px' }}
                  >
                    Current: {getMempoolProviderLabel(mempoolProvider)}
                  </p>
                </div>
              </div>
              <div className="consolidator-modal-footer">
                <button
                  className="consolidator-btn"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletConsolidator;
