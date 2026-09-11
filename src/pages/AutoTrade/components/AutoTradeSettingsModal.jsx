/**
 * Auto-trading settings: mempool provider, trading fees, purchase prep
 * delay, custom wallet subset and wallet randomizer.
 */
import React from 'react';
import {
  MEMPOOL_PROVIDERS,
  getMempoolProviderLabel,
} from '../../../lib/mempoolProvider';
import { FINE_TRADING_USE_FEES_KEY } from '../constants';

const AutoTradeSettingsModal = ({
  onClose,
  mempoolProvider,
  handleMempoolProviderChange,
  isTrading,
  useFees,
  setUseFees,
  prepDelay,
  setPrepDelay,
  useCustomWalletSubset,
  setUseCustomWalletSubset,
  setSelectedWalletIndices,
  wallets,
  selectedWalletIndices,
  walletRandomizer,
  setWalletRandomizer,
}) => (
  <div className="auto-trade-modal-overlay" onClick={() => onClose()}>
    <div
      className="auto-trade-modal-content"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="auto-trade-modal-header">
        <h2>Auto-Trading Settings</h2>
        <button className="auto-trade-modal-close" onClick={() => onClose()}>
          ×
        </button>
      </div>
      <div className="auto-trade-modal-body">
        {/* Mempool API Provider Setting */}
        <div className="auto-trade-settings-group">
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Mempool API provider
          </label>
          <div className="auto-trade-radio-group">
            <label className="auto-trade-radio-label">
              <input
                type="radio"
                name="mempoolProvider"
                value={MEMPOOL_PROVIDERS.MEMPOOL_SPACE}
                checked={mempoolProvider === MEMPOOL_PROVIDERS.MEMPOOL_SPACE}
                onChange={() =>
                  handleMempoolProviderChange(MEMPOOL_PROVIDERS.MEMPOOL_SPACE)
                }
                disabled={isTrading}
              />
              <span>mempool.space (default)</span>
            </label>
            <label className="auto-trade-radio-label">
              <input
                type="radio"
                name="mempoolProvider"
                value={MEMPOOL_PROVIDERS.BLOCKSTREAM}
                checked={mempoolProvider === MEMPOOL_PROVIDERS.BLOCKSTREAM}
                onChange={() =>
                  handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM)
                }
                disabled={isTrading}
              />
              <span>blockstream.info</span>
            </label>
          </div>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '4px',
            }}
          >
            Current: {getMempoolProviderLabel(mempoolProvider)}
          </p>
        </div>

        {/* Use Fees Setting */}
        <div className="auto-trade-settings-group">
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={useFees}
              onChange={(e) => {
                const on = e.target.checked;
                setUseFees(on);
                try {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem(
                      FINE_TRADING_USE_FEES_KEY,
                      on ? '1' : '0'
                    );
                  }
                } catch {
                  /* ignore */
                }
              }}
              disabled={isTrading}
            />
            <span>Use fees</span>
          </label>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '24px',
            }}
          >
            Send 1% of each purchase price to fee receiver address
          </p>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '24px',
            }}
          >
            Fee inputs are always checked against the UniSat inscription index
            and are only spent when confirmed to have no inscriptions or rune
            payloads. Small purchases still send the minimum relay-safe fee
            output.
          </p>
        </div>

        {/* Prep Delay Setting */}
        <div
          className="auto-trade-settings-group"
          style={{ marginTop: '20px' }}
        >
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Purchase prep delay (seconds)
          </label>
          <input
            type="number"
            value={prepDelay / 1000}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              const delayMs = isNaN(value)
                ? 3000
                : Math.max(1, Math.min(10, value)) * 1000;
              setPrepDelay(delayMs);
            }}
            disabled={isTrading}
            min="1"
            max="10"
            step="0.5"
            style={{ width: '100px' }}
          />
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '4px',
            }}
          >
            Delay between purchase preparations to prevent UTXO conflicts (1-10
            seconds, default: 3s)
          </p>
        </div>

        {/* Custom Wallet Subset Selection */}
        <div
          className="auto-trade-settings-group"
          style={{ marginTop: '20px' }}
        >
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={useCustomWalletSubset}
              onChange={(e) => {
                setUseCustomWalletSubset(e.target.checked);
                if (!e.target.checked) {
                  // Reset to all wallets selected when disabled
                  setSelectedWalletIndices(
                    new Set(wallets.map((_, index) => index))
                  );
                }
              }}
              disabled={isTrading || wallets.length === 0}
            />
            <span>Custom wallet subset selection</span>
          </label>
          {useCustomWalletSubset && wallets.length > 0 && (
            <div
              className="auto-trade-wallet-selection"
              style={{ marginTop: '12px', marginLeft: '24px' }}
            >
              {wallets.map((wallet, index) => (
                <label
                  key={index}
                  className="auto-trade-checkbox-label"
                  style={{ display: 'block', marginBottom: '8px' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedWalletIndices.has(index)}
                    onChange={(e) => {
                      const newIndices = new Set(selectedWalletIndices);
                      if (e.target.checked) {
                        newIndices.add(index);
                      } else {
                        newIndices.delete(index);
                      }
                      setSelectedWalletIndices(newIndices);
                    }}
                    disabled={isTrading}
                  />
                  <span>
                    Wallet #{index + 1}: {wallet.address.slice(0, 8)}...
                    {wallet.address.slice(-6)}
                  </span>
                </label>
              ))}
              {selectedWalletIndices.size === 0 && (
                <p
                  style={{
                    color: '#fc8181',
                    fontSize: '0.875rem',
                    marginTop: '8px',
                  }}
                >
                  ⚠ At least one wallet must be selected
                </p>
              )}
            </div>
          )}
        </div>

        {/* Wallet Randomizer */}
        <div
          className="auto-trade-settings-group"
          style={{ marginTop: '20px' }}
        >
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={walletRandomizer}
              onChange={(e) => setWalletRandomizer(e.target.checked)}
              disabled={isTrading}
            />
            <span>Wallet randomizer</span>
          </label>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '24px',
            }}
          >
            Randomize wallet order each auto-trading cycle
          </p>
        </div>
      </div>
      <div className="auto-trade-modal-footer">
        <button className="auto-trade-button" onClick={() => onClose()}>
          Close
        </button>
      </div>
    </div>
  </div>
);

export default AutoTradeSettingsModal;
