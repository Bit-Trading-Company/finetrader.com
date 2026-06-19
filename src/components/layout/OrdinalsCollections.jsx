import React, { useState, useEffect, useCallback } from 'react';

const OrdinalsCollections = ({ glEventHub }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterTerm, setFilterTerm] = useState(''); // Renamed from searchTerm for clarity
  const [searchTerm, setSearchTerm] = useState(''); // New search term for Magic Eden search
  const [searchResults, setSearchResults] = useState([]); // Results from Magic Eden search
  const [isSearchMode, setIsSearchMode] = useState(false); // Track if we're showing search results
  const [searchLoading, setSearchLoading] = useState(false);
  const [params, setParams] = useState({
    limit: '100',
    sort: 'name',
    direction: 'asc',
  });

  // Fetch default (top) collections from Satflow API
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/satflow-top-collections', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data.collections) ? data.collections : [];
      setCollections(list);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err.message || 'Failed to fetch collections');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on component mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Handle parameter changes (client-side limit/sort for displayed list)
  const handleParamChange = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    fetchCollections();
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (!num && num !== 0) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  // Format percentage
  const formatPercentage = (num) => {
    if (num === null || num === undefined) return 'N/A';
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (Number.isNaN(value)) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Search collections via Satflow backend tRPC (collections.search)
  const searchCollections = useCallback(async (pattern) => {
    if (!pattern || !pattern.trim()) {
      setSearchResults([]);
      setIsSearchMode(false);
      return;
    }

    setSearchLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: pattern.trim() });
      const response = await fetch(`/api/satflow-search?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // API returns { collections, collectionsV2 }; proxy may return [ { result: { data: { json: { results: { ordinals } } } } } ]
      let collections = data.collectionsV2 ?? data.collections ?? null;
      if (
        !Array.isArray(collections) &&
        Array.isArray(data) &&
        data[0]?.result?.data?.json?.results?.ordinals
      ) {
        const ordinals = data[0].result.data.json.results.ordinals;
        collections = ordinals.map((c) => {
          const mem = c.memflowData || {};
          const meta = c.metadata || c;
          return {
            collectionSymbol: c.id,
            collectionId: c.id,
            name: c.name || meta?.name || c.id,
            image: c.image_url || meta?.image_url,
            totalSupply: c.item_count != null ? Number(c.item_count) : 0,
            totalVol: mem.totalVolume != null ? Number(mem.totalVolume) : null,
            fp: mem.floorPrice != null ? Number(mem.floorPrice) : null,
            currency: 'BTC',
          };
        });
      }
      setSearchResults(Array.isArray(collections) ? collections : []);
      setIsSearchMode(true);
    } catch (err) {
      console.error('Error searching collections:', err);
      setError(err.message || 'Failed to search collections');
      setSearchResults([]);
      setIsSearchMode(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchCollections(searchTerm);
    }
  };

  // Clear search and revert to top collections
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setIsSearchMode(false);
    setError(null);
  };

  // Filter and optionally limit/sort (client-side)
  const filteredCollections = collections
    .filter((collection) => {
      if (!filterTerm.trim()) return true;
      const filterLower = filterTerm.toLowerCase();
      const name = (collection.name || '').toLowerCase();
      const symbol = (
        collection.collectionSymbol ||
        collection.collectionId ||
        ''
      ).toLowerCase();
      return name.includes(filterLower) || symbol.includes(filterLower);
    })
    .sort((a, b) => {
      const key = params.sort || 'name';
      const dir = params.direction === 'desc' ? -1 : 1;
      const va = a[key] ?? a.name ?? '';
      const vb = b[key] ?? b.name ?? '';
      if (typeof va === 'number' && typeof vb === 'number')
        return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb));
    })
    .slice(0, Math.max(1, parseInt(params.limit, 10) || 100));

  return (
    <div className="collections-management-container">
      <div>
        <h2 className="component-header">Ordinals Collections</h2>

        {/* Controls */}
        <div className="collections-controls-grid">
          <div className="collections-form-group">
            <label htmlFor="limit-input" className="collections-form-label">
              Show (max):
            </label>
            <input
              id="limit-input"
              type="number"
              min="1"
              max="500"
              value={params.limit}
              onChange={(e) => handleParamChange('limit', e.target.value)}
              className="collections-form-input"
            />
          </div>
          <div className="collections-form-group">
            <label htmlFor="sort-select" className="collections-form-label">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={params.sort}
              onChange={(e) => handleParamChange('sort', e.target.value)}
              className="collections-form-select"
            >
              <option value="name">Name</option>
              <option value="totalSupply">Total Supply</option>
              <option value="totalVol">Volume</option>
              <option value="fp">Floor Price</option>
            </select>
          </div>
          <div className="collections-form-group">
            <label
              htmlFor="direction-select"
              className="collections-form-label"
            >
              Order:
            </label>
            <select
              id="direction-select"
              value={params.direction}
              onChange={(e) => handleParamChange('direction', e.target.value)}
              className="collections-form-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {/* Filter Collections Bar */}
        <div
          className="collections-form-group"
          style={{ width: '95%', marginTop: '1rem' }}
        >
          <label htmlFor="collection-filter" className="collections-form-label">
            Filter Collections:
          </label>
          <input
            id="collection-filter"
            type="text"
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            placeholder="Type to filter displayed collections by name..."
            className="collections-form-input"
            style={{ width: '100%', marginBottom: 16 }}
            disabled={isSearchMode}
          />
        </div>

        {/* Search Collections Section */}
        <div
          className="collections-form-group"
          style={{
            width: '95%',
            marginTop: '1rem',
            marginBottom: '1rem',
            padding: '1rem',
            border: '1px solid #4a5568',
            borderRadius: '8px',
            backgroundColor: '#2d3748',
          }}
        >
          <label htmlFor="collection-search" className="collections-form-label">
            Search Collections:
          </label>
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <input
              id="collection-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Satflow collections..."
              className="collections-form-input"
              style={{ flex: 1 }}
              disabled={searchLoading}
            />
            {isSearchMode && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="collections-refresh-button"
                style={{
                  padding: '8px 12px',
                  minWidth: 'auto',
                  backgroundColor: '#4a5568',
                  border: '1px solid #718096',
                }}
                title="Clear search and show top collections"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              disabled={searchLoading || !searchTerm.trim()}
              className="collections-search-button"
              style={{ minWidth: 'auto' }}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="collections-actions">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="collections-refresh-button"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error Display */}
        {error && <div className="collections-error-box">{error}</div>}

        {/* Collections List - Show search results or filtered collections */}
        {isSearchMode ? (
          // Search Results Display (Simplified Format)
          searchResults.length > 0 ? (
            <div className="collections-list-container">
              <div className="collections-list-scroll">
                {searchResults.map((collection, index) => (
                  <div
                    key={
                      collection.collectionId ||
                      collection.collectionSymbol ||
                      `search-collection-${index}`
                    }
                    className="collections-item"
                    onClick={() => {
                      if (glEventHub) {
                        glEventHub.emit('collection-selected', collection);
                        glEventHub.emit(
                          'menu-focus-component',
                          'collectionDetails'
                        );
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="collections-image-section">
                      {collection.image ? (
                        <img
                          src={collection.image}
                          alt={collection.name || 'Collection'}
                          className="collections-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="collections-image-placeholder">🎨</div>
                      )}
                      <div className="collections-image-name">
                        {collection.name ||
                          collection.collectionSymbol ||
                          'Unknown'}
                      </div>
                    </div>

                    <div className="collections-details-section">
                      <div className="collections-detail-item">
                        <div className="collections-detail-label">
                          Total Volume
                        </div>
                        <div className="collections-detail-value">
                          {formatNumber(parseFloat(collection.totalVol || 0))}{' '}
                          BTC
                        </div>
                      </div>
                      <div className="collections-detail-item">
                        <div className="collections-detail-label">
                          Floor Price
                        </div>
                        <div className="collections-detail-value">
                          {collection.fp != null
                            ? `${formatNumber(collection.fp)} BTC`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="collections-detail-item">
                        <div className="collections-detail-label">
                          Total Items
                        </div>
                        <div className="collections-detail-value">
                          {formatNumber(collection.totalSupply || 0)}
                        </div>
                      </div>
                      <div className="collections-detail-item">
                        <div className="collections-detail-label">
                          Collection ID
                        </div>
                        <div
                          className="collections-detail-value"
                          style={{ fontSize: '0.85rem' }}
                        >
                          {collection.collectionId ||
                            collection.collectionSymbol ||
                            'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !searchLoading ? (
            <div className="collections-no-data">
              <p className="collections-no-data-text">
                No collections found matching "{searchTerm}". Try a different
                search term.
              </p>
            </div>
          ) : null
        ) : filteredCollections.length > 0 ? (
          // Regular Collections Display
          <div className="collections-list-container">
            <div className="collections-list-scroll">
              {filteredCollections.map((collection, index) => (
                <div
                  key={
                    collection.collectionSymbol ||
                    collection.name ||
                    `collection-${index}`
                  }
                  className="collections-item"
                  onClick={() => {
                    if (glEventHub) {
                      glEventHub.emit('collection-selected', collection);
                      // Also emit event to focus the CollectionDetails tab
                      glEventHub.emit(
                        'menu-focus-component',
                        'collectionDetails'
                      );
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Image Section */}
                  <div className="collections-image-section">
                    {collection.image ? (
                      <img
                        src={collection.image}
                        alt={collection.name || 'Collection'}
                        className="collections-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="collections-image-placeholder">🎨</div>
                    )}
                    <div className="collections-image-name">
                      {collection.name ||
                        collection.collectionSymbol ||
                        'Unknown'}
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="collections-details-section">
                    {/* 24h Volume */}
                    <div className="collections-detail-item">
                      <div className="collections-detail-label">Volume 24h</div>
                      <div className="collections-detail-value">
                        {formatNumber(collection.vol1d ?? collection.vol ?? 0)}
                        {collection.currency && ` ${collection.currency}`}
                      </div>
                      {collection.vol1dChangePercent !== undefined &&
                        collection.vol1dChangePercent !== null && (
                          <div className="collections-detail-subvalue">
                            {formatPercentage(collection.vol1dChangePercent)}
                          </div>
                        )}
                    </div>

                    {/* 7d Volume */}
                    <div className="collections-detail-item">
                      <div className="collections-detail-label">Volume 7d</div>
                      <div className="collections-detail-value">
                        {formatNumber(collection.vol7d || 0)}
                        {collection.currency && ` ${collection.currency}`}
                      </div>
                      {collection.vol7dChangePercent !== undefined &&
                        collection.vol7dChangePercent !== null && (
                          <div className="collections-detail-subvalue">
                            {formatPercentage(collection.vol7dChangePercent)}
                          </div>
                        )}
                    </div>

                    {/* 30d Volume */}
                    <div className="collections-detail-item">
                      <div className="collections-detail-label">Volume 30d</div>
                      <div className="collections-detail-value">
                        {formatNumber(collection.vol30d || 0)}
                        {collection.currency && ` ${collection.currency}`}
                      </div>
                      {collection.vol30dChangePercent !== undefined &&
                        collection.vol30dChangePercent !== null && (
                          <div className="collections-detail-subvalue">
                            {formatPercentage(collection.vol30dChangePercent)}
                          </div>
                        )}
                    </div>

                    {/* Total Volume */}
                    <div className="collections-detail-item">
                      <div className="collections-detail-label">
                        Total Volume
                      </div>
                      <div className="collections-detail-value">
                        {formatNumber(
                          collection.totalVol ??
                            collection.vol30d ??
                            collection.vol7d ??
                            collection.vol1d ??
                            0
                        )}
                        {collection.currency && ` ${collection.currency}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && !error ? (
          <div className="collections-no-data">
            <p className="collections-no-data-text">
              {filterTerm.trim()
                ? 'No collections match your filter. Try a different filter term.'
                : 'No collections data available. Try adjusting your search parameters.'}
            </p>
          </div>
        ) : null}

        {/* Loading State */}
        {(loading || searchLoading) && (
          <div className="collections-loading">
            <p className="collections-loading-text">
              {searchLoading
                ? 'Searching collections...'
                : 'Loading collections data...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdinalsCollections;
