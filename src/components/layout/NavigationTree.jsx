import React from 'react';
import './NavigationTree.css';

const NavigationTree = ({
  collectionName,
  ordinalName,
  onNavigateToCollections,
  onNavigateToCollection,
  onBack,
  mode = 'buy', // 'buy' or 'sell'
  onModeChange,
}) => {
  const hasCollection = !!collectionName;
  const hasOrdinal = !!ordinalName;
  const isOnCollectionsView = !hasCollection && !hasOrdinal;
  const showBackButton = !isOnCollectionsView && onBack;

  return (
    <nav className="navigation-tree">
      <div className="navigation-tree-content">
        {isOnCollectionsView ? (
          <span className="navigation-tree-item navigation-tree-current">
            {mode === 'buy' ? 'Ordinals Collections' : 'My Ordinals'}
          </span>
        ) : (
          <button
            className="navigation-tree-item navigation-tree-link"
            onClick={onNavigateToCollections}
            type="button"
          >
            {mode === 'buy' ? 'Ordinals Collections' : 'My Ordinals'}
          </button>
        )}
        {hasCollection && (
          <>
            <span className="navigation-tree-separator">›</span>
            {hasOrdinal ? (
              <button
                className="navigation-tree-item navigation-tree-link"
                onClick={onNavigateToCollection}
                type="button"
              >
                {collectionName}
              </button>
            ) : (
              <span className="navigation-tree-item navigation-tree-current">
                {collectionName}
              </span>
            )}
          </>
        )}
        {hasOrdinal && (
          <>
            <span className="navigation-tree-separator">›</span>
            <span className="navigation-tree-item navigation-tree-current">
              {ordinalName}
            </span>
          </>
        )}
      </div>
      <div className="navigation-tree-right">
        {/* Buy/Sell Toggle */}
        {onModeChange && (
          <div className="navigation-tree-mode-toggle">
            <span
              className={`navigation-tree-mode-label ${
                mode === 'buy' ? 'active' : ''
              }`}
            >
              Buy
            </span>
            <button
              onClick={() => onModeChange(mode === 'buy' ? 'sell' : 'buy')}
              className={`navigation-tree-toggle-button ${
                mode === 'sell' ? 'active' : ''
              }`}
              type="button"
              aria-label={`Switch to ${mode === 'buy' ? 'sell' : 'buy'} mode`}
            >
              <div
                className={`navigation-tree-toggle-slider ${
                  mode === 'sell' ? 'active' : ''
                }`}
              />
            </button>
            <span
              className={`navigation-tree-mode-label ${
                mode === 'sell' ? 'active' : ''
              }`}
            >
              Sell
            </span>
          </div>
        )}
        {showBackButton && (
          <button
            className="navigation-tree-back-button"
            onClick={onBack}
            type="button"
            aria-label="Back"
          >
            ← Back
          </button>
        )}
      </div>
    </nav>
  );
};

export default NavigationTree;
