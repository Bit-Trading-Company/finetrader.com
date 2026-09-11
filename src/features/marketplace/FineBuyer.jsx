import React, { useState, useEffect, useMemo } from 'react';
import OrdinalsCollections from './OrdinalsCollections';
import CollectionDetails from './CollectionDetails';
import BuyOrdinal from './BuyOrdinal';
import SellOrdinals from './SellOrdinals';
import SellOrdinal from './SellOrdinal';
import NavigationTree from './NavigationTree';

const FineBuyer = ({ glEventHub: glEventHubProp }) => {
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedOrdinal, setSelectedOrdinal] = useState(null);
  const [mode, setMode] = useState('buy'); // 'buy' or 'sell'

  // Use provided event hub or create a fallback one
  const glEventHub = useMemo(() => {
    if (glEventHubProp) {
      return glEventHubProp;
    }
    // Fallback: create a simple event emitter if none provided
    const events = {};
    return {
      on: (event, handler) => {
        if (!events[event]) events[event] = [];
        events[event].push(handler);
      },
      off: (event, handler) => {
        if (events[event]) {
          events[event] = events[event].filter((h) => h !== handler);
        }
      },
      emit: (event, data) => {
        if (events[event]) {
          events[event].forEach((handler) => handler(data));
        }
      },
    };
  }, [glEventHubProp]);

  // Listen for collection selection
  useEffect(() => {
    const handleCollectionSelect = (collection) => {
      setSelectedCollection(collection);
      setSelectedOrdinal(null);
    };

    const handleOrdinalSelect = (ordinal) => {
      setSelectedOrdinal(ordinal);
    };

    glEventHub.on('collection-selected', handleCollectionSelect);
    glEventHub.on('ordinal-selected', handleOrdinalSelect);

    return () => {
      glEventHub.off('collection-selected', handleCollectionSelect);
      glEventHub.off('ordinal-selected', handleOrdinalSelect);
    };
  }, [glEventHub]);

  // Handle mode change (buy/sell toggle)
  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Clear selections when switching modes
    setSelectedCollection(null);
    setSelectedOrdinal(null);
  };

  // Navigation handlers
  const handleNavigateToCollections = () => {
    setSelectedCollection(null);
    setSelectedOrdinal(null);
  };

  const handleNavigateToCollection = () => {
    // Go back to collection view (keep collection, clear ordinal)
    setSelectedOrdinal(null);
    // Re-emit collection selection to refresh the collection view
    if (selectedCollection && glEventHub) {
      glEventHub.emit('collection-selected', selectedCollection);
    }
  };

  const handleBackToCollections = () => {
    handleNavigateToCollections();
  };

  // Get collection name for navigation tree
  const getCollectionName = () => {
    if (!selectedCollection) return null;
    return (
      selectedCollection.name ||
      selectedCollection.collectionSymbol ||
      selectedCollection.symbol ||
      'Collection'
    );
  };

  // Get ordinal name for navigation tree
  const getOrdinalName = () => {
    if (!selectedOrdinal) return null;
    return (
      selectedOrdinal.meta?.name ||
      selectedOrdinal.displayName ||
      (selectedOrdinal.inscriptionId
        ? `${selectedOrdinal.inscriptionId.slice(0, 10)}…`
        : null) ||
      `#${selectedOrdinal.inscriptionNumber || 'Unknown'}`
    );
  };

  // Determine current view
  // In sell mode, we only have collections (SellOrdinals) and ordinal (SellOrdinal) views
  // In buy mode, we have collections, collection, and ordinal views
  const currentView =
    mode === 'sell'
      ? selectedOrdinal
        ? 'ordinal'
        : 'collections'
      : selectedOrdinal
        ? 'ordinal'
        : selectedCollection
          ? 'collection'
          : 'collections';

  // Determine which back handler to use based on current view
  const getBackHandler = () => {
    if (currentView === 'ordinal') {
      // In sell mode, go back to collections (SellOrdinals)
      // In buy mode, go back to collection details
      return mode === 'sell'
        ? handleNavigateToCollections
        : handleNavigateToCollection;
    } else if (currentView === 'collection') {
      return handleBackToCollections;
    }
    return null;
  };

  return (
    <div className="fine-buyer-container">
      {/* Navigation Tree - Always shown, content changes based on view */}
      <NavigationTree
        collectionName={getCollectionName()}
        ordinalName={getOrdinalName()}
        onNavigateToCollections={handleNavigateToCollections}
        onNavigateToCollection={handleNavigateToCollection}
        onBack={getBackHandler()}
        mode={mode}
        onModeChange={handleModeChange}
      />

      {/* Buy Mode Views */}
      {mode === 'buy' && (
        <>
          {/* Collections View */}
          {currentView === 'collections' && (
            <div className="fine-buyer-collections-view">
              <OrdinalsCollections glEventHub={glEventHub} />
            </div>
          )}

          {/* Collection Details View */}
          {currentView === 'collection' && (
            <div className="fine-buyer-details-view">
              <CollectionDetails
                glEventHub={glEventHub}
                selectedCollection={selectedCollection}
              />
            </div>
          )}

          {/* Buy Ordinal View - Show in content section instead of popup */}
          {currentView === 'ordinal' && (
            <div className="fine-buyer-ordinal-view">
              <BuyOrdinal
                glEventHub={glEventHub}
                selectedOrdinal={selectedOrdinal}
              />
            </div>
          )}
        </>
      )}

      {/* Sell Mode Views */}
      {mode === 'sell' && (
        <>
          {/* Sell Ordinals View */}
          {currentView === 'collections' && (
            <div className="fine-buyer-sell-view">
              <SellOrdinals glEventHub={glEventHub} />
            </div>
          )}

          {/* Sell Ordinal View - Show when ordinal is selected */}
          {currentView === 'ordinal' && (
            <div className="fine-buyer-ordinal-view">
              <SellOrdinal
                glEventHub={glEventHub}
                selectedOrdinal={selectedOrdinal}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FineBuyer;
