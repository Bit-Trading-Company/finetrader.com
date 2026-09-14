import React, { useState, useEffect, useCallback } from 'react';
import CollectionOfferModal from './CollectionOfferModal';
import {
  fetchSatflowActivityListings,
  enrichSatflowListingItemForDisplay,
} from '../../trading/satflow/satflowApi';
import { formatSatsAsBtc, formatCompactNumber } from '../../lib/format';
import './CollectionDetails.css';

const ENRICH_CONCURRENCY = 6;

async function enrichListingsInBatches(listings) {
  const out = [];
  for (let i = 0; i < listings.length; i += ENRICH_CONCURRENCY) {
    const chunk = listings.slice(i, i + ENRICH_CONCURRENCY);
    const done = await Promise.all(
      chunk.map((row) => enrichSatflowListingItemForDisplay(row))
    );
    out.push(...done);
  }
  return out;
}

const CollectionDetails = ({ glEventHub, selectedCollection }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collectionSymbol, setCollectionSymbol] = useState(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortDirection, setSortDirection] = useState('asc');

  const setCollectionFromData = (collection) => {
    if (collection) {
      const symbol =
        collection.collectionSymbol ||
        collection.symbol ||
        collection.collectionId;
      if (symbol) {
        const cleanSymbol = String(symbol).trim();
        setCollectionSymbol(cleanSymbol);
        setPage(1);
      } else {
        console.error('No collection symbol found in collection:', collection);
      }
    }
  };

  useEffect(() => {
    if (selectedCollection) {
      setCollectionFromData(selectedCollection);
    } else {
      setCollectionSymbol(null);
    }
  }, [selectedCollection]);

  useEffect(() => {
    const handleCollectionSelect = (collection) => {
      setCollectionFromData(collection);
    };

    if (glEventHub) {
      glEventHub.on('collection-selected', handleCollectionSelect);
      return () => {
        glEventHub.off('collection-selected', handleCollectionSelect);
      };
    }
  }, [glEventHub]);

  const fetchItems = useCallback(async () => {
    if (!collectionSymbol) {
      setItems([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { items: rawItems, total: apiTotal } =
        await fetchSatflowActivityListings(collectionSymbol, true, {
          page,
          pageSize,
          sortDirection,
          sortBy: 'unitPrice',
        });

      const enriched = await enrichListingsInBatches(rawItems);
      setItems(enriched);
      setTotal(apiTotal);
    } catch (err) {
      console.error('Error fetching collection listings:', err);
      setError(err.message || 'Failed to fetch collection listings');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [collectionSymbol, page, pageSize, sortDirection]);

  useEffect(() => {
    if (collectionSymbol) {
      fetchItems();
    }
  }, [collectionSymbol, fetchItems]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const handleOpenBuyOrdinal = (item) => {
    if (!item?.listed || !item?.listedPrice) return;
    if (glEventHub) {
      glEventHub.emit('ordinal-selected', {
        ...item,
        _satflowListing: true,
      });
    }
  };

  if (!collectionSymbol) {
    return (
      <div className="collection-details-container">
        <div className="collection-details-empty">
          <p className="collection-details-empty-text">
            Select a collection from Ordinals Collections to view its items
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-details-container">
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 className="component-header">Collection: {collectionSymbol}</h2>
            <p
              style={{
                fontSize: '13px',
                color: '#a0aec0',
                marginTop: '6px',
                marginBottom: 0,
              }}
            >
              Listings from Satflow (cheapest first on the API). Click an item
              to open Buy Ordinal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOfferModalOpen(true)}
            style={{
              backgroundColor: '#ed8936',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#dd6b20';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#ed8936';
            }}
          >
            Collection Offers
          </button>
        </div>

        <div className="collection-details-controls">
          <div className="collection-details-form-group">
            <label
              htmlFor="page-size-select"
              className="collection-details-form-label"
            >
              Page size:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              className="collection-details-form-select"
            >
              {[20, 40, 60, 80, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="collection-details-form-group">
            <label
              htmlFor="sort-select"
              className="collection-details-form-label"
            >
              Sort by price:
            </label>
            <select
              id="sort-select"
              value={sortDirection}
              onChange={(e) => {
                setPage(1);
                setSortDirection(e.target.value);
              }}
              className="collection-details-form-select"
            >
              <option value="asc">Low to high</option>
              <option value="desc">High to low</option>
            </select>
          </div>

          <div
            className="collection-details-form-group"
            style={{ alignSelf: 'flex-end' }}
          >
            <button
              type="button"
              className="collection-details-button"
              disabled={!canGoPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ marginRight: '8px' }}
            >
              Previous
            </button>
            <button
              type="button"
              className="collection-details-button"
              disabled={!canGoNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <p
          style={{
            fontSize: '13px',
            color: '#a0aec0',
            marginBottom: '16px',
          }}
        >
          Page {page} of {totalPages}
          {total > 0 ? ` · ${total} listing(s) reported` : ''}
        </p>

        {error && <div className="collection-details-error-box">{error}</div>}

        {items.length > 0 ? (
          <div className="collection-details-grid">
            {items.map((item, index) => (
              <div
                key={item.inscriptionId || item.tokenId || `row-${index}`}
                role="button"
                tabIndex={0}
                className="collection-details-item"
                onClick={() => handleOpenBuyOrdinal(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenBuyOrdinal(item);
                  }
                }}
                style={{
                  cursor: item.listed ? 'pointer' : 'default',
                }}
              >
                <div className="collection-details-image-section">
                  {item.contentURI || item.contentPreviewURI ? (
                    item.contentType === 'text/html' ||
                    item.contentType?.includes('text/html') ||
                    item.contentType?.includes('html') ? (
                      <iframe
                        src={item.contentURI || item.contentPreviewURI}
                        className="collection-details-image collection-details-iframe"
                        title={
                          item.meta?.name ||
                          `Item #${item.inscriptionNumber || index}`
                        }
                        sandbox="allow-scripts allow-same-origin"
                      />
                    ) : (
                      <img
                        src={item.contentURI || item.contentPreviewURI}
                        alt={
                          item.meta?.name ||
                          `Item #${item.inscriptionNumber || index}`
                        }
                        className="collection-details-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (!e.target.nextSibling) {
                            const placeholder = document.createElement('div');
                            placeholder.className =
                              'collection-details-image-placeholder';
                            placeholder.textContent = '🖼️';
                            e.target.parentNode.appendChild(placeholder);
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="collection-details-image-placeholder">
                      🖼️
                    </div>
                  )}
                </div>

                <div className="collection-details-info">
                  <div className="collection-details-name">
                    {item.meta?.name ||
                      (item.inscriptionId
                        ? `${item.inscriptionId.slice(0, 8)}…`
                        : `#${item.inscriptionNumber || 'Unknown'}`)}
                  </div>

                  {item.listed && item.listedPrice != null && (
                    <div className="collection-details-price">
                      {formatSatsAsBtc(item.listedPrice)} BTC
                    </div>
                  )}

                  <div className="collection-details-meta">
                    <div className="collection-details-meta-item">
                      <span className="collection-details-meta-label">
                        Inscription:
                      </span>
                      <span className="collection-details-meta-value">
                        {formatCompactNumber(item.inscriptionNumber) || 'N/A'}
                      </span>
                    </div>

                    {item.satRarity && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Sat Rarity:
                        </span>
                        <span className="collection-details-meta-value">
                          {item.satRarity}
                        </span>
                      </div>
                    )}

                    {item.listed && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Status:
                        </span>
                        <span className="collection-details-meta-value listed">
                          Listed (Satflow)
                        </span>
                      </div>
                    )}

                    {item.outputValue != null && (
                      <div className="collection-details-meta-item">
                        <span className="collection-details-meta-label">
                          Value:
                        </span>
                        <span className="collection-details-meta-value">
                          {formatCompactNumber(item.outputValue)} sats
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading && !error ? (
          <div className="collection-details-no-data">
            <p className="collection-details-no-data-text">
              No listings found for this collection.
            </p>
          </div>
        ) : null}

        {loading && (
          <div className="collection-details-loading">
            <p className="collection-details-loading-text">Loading listings…</p>
          </div>
        )}
      </div>

      <CollectionOfferModal
        glEventHub={glEventHub}
        collectionSymbol={collectionSymbol}
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
      />
    </div>
  );
};

export default CollectionDetails;
