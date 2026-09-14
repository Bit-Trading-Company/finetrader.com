import React, { useState, useCallback, useMemo } from 'react';
import FineBtcImg from '../../assets/Fine_Btc.png';

const Dispatcher = () => {
  const [wallets, setWallets] = useState([
    { id: 1, label: 'Wallet 1', amount: 50 },
    { id: 2, label: 'Wallet 2', amount: 50 },
  ]);

  const [nextId, setNextId] = useState(3);

  // Control panel state
  const [activePanel, setActivePanel] = useState(null);
  const [splitColor, setSplitColor] = useState('#ffc107');

  // Calculate total amount and proportions
  const totalAmount = useMemo(
    () => wallets.reduce((sum, wallet) => sum + wallet.amount, 0),
    [wallets]
  );

  // Add a new wallet
  const addWallet = useCallback(() => {
    const newWallet = {
      id: nextId,
      label: `Wallet ${nextId}`,
      amount: 10,
    };
    setWallets((prev) => [...prev, newWallet]);
    setNextId((prev) => prev + 1);
  }, [nextId]);

  // Remove a wallet
  const removeWallet = useCallback(
    (id) => {
      if (wallets.length > 1) {
        setWallets((prev) => prev.filter((wallet) => wallet.id !== id));
      }
    },
    [wallets.length]
  );

  // Update wallet amount
  const updateWalletAmount = useCallback((id, newAmount) => {
    setWallets((prev) =>
      prev.map((wallet) =>
        wallet.id === id
          ? { ...wallet, amount: Math.max(0, newAmount) }
          : wallet
      )
    );
  }, []);

  // Control panel functions
  const togglePanel = useCallback(
    (panelName) => {
      setActivePanel(activePanel === panelName ? null : panelName);
    },
    [activePanel]
  );

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // SVG dimensions and layout constants
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 400;
  const SOURCE_RADIUS = 40;
  const WALLET_RADIUS = 25;
  const MAIN_LINE_THICKNESS = 64;
  const SOURCE_X = 100;
  const SOURCE_Y = SVG_HEIGHT / 2;
  const WALLET_START_X = 650;
  const SPLIT_POINT_X = 400;

  // Generate SVG paths for the split lines
  const generatePaths = useMemo(() => {
    if (totalAmount === 0) return [];

    return wallets.map((wallet, index) => {
      const proportion = wallet.amount / totalAmount;
      const lineThickness = proportion * MAIN_LINE_THICKNESS;

      // Calculate wallet Y position (evenly spaced)
      const walletSpacing = Math.min(
        120,
        (SVG_HEIGHT - 100) / Math.max(1, wallets.length - 1)
      );
      const startY =
        SVG_HEIGHT / 2 - ((wallets.length - 1) * walletSpacing) / 2;
      const walletY =
        wallets.length === 1 ? SVG_HEIGHT / 2 : startY + index * walletSpacing;

      // Create smooth Bezier curve path
      const pathData = `
        M ${SOURCE_X + SOURCE_RADIUS} ${SOURCE_Y}
        C ${SPLIT_POINT_X - 50} ${SOURCE_Y},
          ${SPLIT_POINT_X + 50} ${walletY},
          ${WALLET_START_X - WALLET_RADIUS} ${walletY}
      `;

      return {
        id: wallet.id,
        path: pathData,
        thickness: lineThickness,
        walletX: WALLET_START_X,
        walletY: walletY,
        label: wallet.label,
        amount: wallet.amount,
        proportion: proportion,
      };
    });
  }, [wallets, totalAmount, SOURCE_Y]);

  return (
    <div className="bitcoin-split-wrapper">
      <div className="visualization-container">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="bitcoin-split-svg"
        >
          {/* Background grid (optional subtle enhancement) */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(255,193,7,0.1)"
                strokeWidth="0.5"
              />
            </pattern>

            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Split paths */}
          {generatePaths.map((pathData) => (
            <g key={pathData.id}>
              {/* Path line */}
              <path
                d={pathData.path}
                stroke={splitColor}
                strokeWidth={pathData.thickness}
                fill="none"
                className="split-path"
                filter="url(#glow)"
                strokeLinecap="round"
              />

              {/* Wallet image */}
              <image
                x={pathData.walletX - WALLET_RADIUS}
                y={pathData.walletY - WALLET_RADIUS}
                width={WALLET_RADIUS * 2}
                height={WALLET_RADIUS * 2}
                href={FineBtcImg}
                className="wallet-image"
                filter="url(#glow)"
              />

              {/* Amount display */}
              <text
                x={pathData.walletX}
                y={pathData.walletY + WALLET_RADIUS + 20}
                className="amount-label"
                textAnchor="middle"
              >
                {pathData.amount.toFixed(2)} BTC
              </text>

              {/* Percentage display */}
              <text
                x={pathData.walletX}
                y={pathData.walletY + WALLET_RADIUS + 35}
                className="percentage-label"
                textAnchor="middle"
              >
                ({(pathData.proportion * 100).toFixed(1)}%)
              </text>
            </g>
          ))}

          {/* Main source image - placed after paths to appear in front */}
          <image
            x={SOURCE_X - SOURCE_RADIUS}
            y={SOURCE_Y - SOURCE_RADIUS}
            width={SOURCE_RADIUS * 2}
            height={SOURCE_RADIUS * 2}
            href={FineBtcImg}
            className="source-image"
            filter="url(#glow)"
          />
        </svg>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-panel-icons">
          <button
            className={`control-icon ${activePanel === 'wallets' ? 'active' : ''}`}
            onClick={() => togglePanel('wallets')}
            title="Manage Wallets"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </button>
          <button
            className={`control-icon ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => togglePanel('settings')}
            title="Settings"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
          </button>
        </div>

        {/* Manage Wallets Panel */}
        {activePanel === 'wallets' && (
          <div
            className="control-panel-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <h3>Manage Wallets</h3>
              <button className="close-panel" onClick={closePanel}>
                ×
              </button>
            </div>
            <div className="wallet-controls">
              <div className="controls">
                <button className="add-wallet-btn" onClick={addWallet}>
                  + Add Wallet
                </button>
                <div className="total-display">
                  Total:{' '}
                  <span className="total-amount">
                    {totalAmount.toFixed(2)} BTC
                  </span>
                </div>
              </div>
              <div className="wallet-list">
                {wallets.map((wallet) => (
                  <div key={wallet.id} className="wallet-control">
                    <div className="wallet-info">
                      <span className="wallet-name">{wallet.label}</span>
                      <button
                        className="remove-wallet-btn"
                        onClick={() => removeWallet(wallet.id)}
                        disabled={wallets.length <= 1}
                      >
                        ×
                      </button>
                    </div>

                    <div className="amount-controls">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={wallet.amount}
                        onChange={(e) =>
                          updateWalletAmount(
                            wallet.id,
                            parseFloat(e.target.value)
                          )
                        }
                        className="amount-slider"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wallet.amount}
                        onChange={(e) =>
                          updateWalletAmount(
                            wallet.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="amount-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {activePanel === 'settings' && (
          <div
            className="control-panel-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <h3>Settings</h3>
              <button className="close-panel" onClick={closePanel}>
                ×
              </button>
            </div>
            <div className="settings-content">
              <div className="setting-group">
                <label htmlFor="split-color">Split Line Color</label>
                <input
                  id="split-color"
                  type="color"
                  value={splitColor}
                  onChange={(e) => setSplitColor(e.target.value)}
                  className="color-picker"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overlay for closing panels */}
      {activePanel && (
        <div className="panel-overlay" onClick={closePanel}></div>
      )}
    </div>
  );
};

export default Dispatcher;
