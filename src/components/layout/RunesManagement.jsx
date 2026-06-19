import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';

const RunesManagement = () => {
  const [runes, setRunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({
    window: '1d',
    limit: '20',
    offset: '0',
    sort: 'floorPrice',
    direction: 'desc',
    searchTerm: '',
    walletAddress: '',
    allCollections: false,
  });

  // Fetch runes data from Magic Eden API
  const fetchRunes = useCallback(
    async (customParams = {}) => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          ...params,
          ...customParams,
        });

        // Remove empty parameters to avoid API issues
        Object.keys(queryParams).forEach((key) => {
          if (!queryParams.get(key) || queryParams.get(key) === '') {
            queryParams.delete(key);
          }
        });

        const data = await apiClient.get(
          `/collection_stats/search?${queryParams}`
        );
        setRunes(data.runes || []);
      } catch (err) {
        console.error('Error fetching runes:', err);
        setError(err.message || 'Failed to fetch runes');
        setRunes([]);
      } finally {
        setLoading(false);
      }
    },
    [params]
  );

  // Initial fetch on component mount
  useEffect(() => {
    fetchRunes();
  }, [fetchRunes]);

  // Handle parameter changes
  const handleParamChange = (key, value) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchRunes();
  };

  // Handle search
  const handleSearch = () => {
    fetchRunes();
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toString() || '0';
  };

  // Format percentage
  const formatPercentage = (num) => {
    if (num === null || num === undefined) return 'N/A';
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  return (
    <div className="runes-management-container">
      <div>
        <h2 className="component-header">Runes Management</h2>

        {/* Controls */}
        <div className="runes-controls-grid">
          {/* Window Selection */}
          <div className="runes-form-group">
            <label htmlFor="window-select" className="runes-form-label">
              Time Window:
            </label>
            <select
              id="window-select"
              value={params.window}
              onChange={(e) => handleParamChange('window', e.target.value)}
              className="runes-form-select"
            >
              <option value="10m">10 Minutes</option>
              <option value="1h">1 Hour</option>
              <option value="6h">6 Hours</option>
              <option value="1d">1 Day</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
            </select>
          </div>

          {/* Limit */}
          <div className="runes-form-group">
            <label htmlFor="limit-input" className="runes-form-label">
              Limit (1-2000):
            </label>
            <input
              id="limit-input"
              type="number"
              min="1"
              max="2000"
              value={params.limit}
              onChange={(e) => handleParamChange('limit', e.target.value)}
              className="runes-form-input"
            />
          </div>

          {/* Offset */}
          <div className="runes-form-group">
            <label htmlFor="offset-input" className="runes-form-label">
              Offset (0-15000):
            </label>
            <input
              id="offset-input"
              type="number"
              min="0"
              max="15000"
              value={params.offset}
              onChange={(e) => handleParamChange('offset', e.target.value)}
              className="runes-form-input"
            />
          </div>

          {/* Sort */}
          <div className="runes-form-group">
            <label htmlFor="sort-select" className="runes-form-label">
              Sort By:
            </label>
            <select
              id="sort-select"
              value={params.sort}
              onChange={(e) => handleParamChange('sort', e.target.value)}
              className="runes-form-select"
            >
              <option value="floorPrice">Floor Price</option>
              <option value="volume">Volume</option>
              <option value="holderCount">Holder Count</option>
              <option value="unitPriceSats">Unit Price</option>
              <option value="txnCount">Transaction Count</option>
            </select>
          </div>

          {/* Direction */}
          <div className="runes-form-group">
            <label htmlFor="direction-select" className="runes-form-label">
              Direction:
            </label>
            <select
              id="direction-select"
              value={params.direction}
              onChange={(e) => handleParamChange('direction', e.target.value)}
              className="runes-form-select"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          {/* Search Term */}
          <div className="runes-form-group">
            <label htmlFor="search-input" className="runes-form-label">
              Search Term:
            </label>
            <input
              id="search-input"
              type="text"
              value={params.searchTerm}
              onChange={(e) => handleParamChange('searchTerm', e.target.value)}
              placeholder="Search runes..."
              className="runes-form-input"
            />
          </div>

          {/* Wallet Address */}
          <div className="runes-form-group">
            <label htmlFor="wallet-input" className="runes-form-label">
              Wallet Address:
            </label>
            <input
              id="wallet-input"
              type="text"
              value={params.walletAddress}
              onChange={(e) =>
                handleParamChange('walletAddress', e.target.value)
              }
              placeholder="Filter by wallet..."
              className="runes-form-input"
            />
          </div>

          {/* All Collections Checkbox */}
          <div className="runes-form-group">
            <label className="runes-form-label">Include All Collections:</label>
            <div className="runes-checkbox-group">
              <input
                type="checkbox"
                checked={params.allCollections}
                onChange={(e) =>
                  handleParamChange('allCollections', e.target.checked)
                }
                className="runes-checkbox"
              />
              <span className="runes-checkbox-label">
                Include inactive collections
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="runes-actions">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="runes-search-button"
          >
            {loading ? 'Loading...' : 'Search Runes'}
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="runes-refresh-button"
          >
            Refresh
          </button>
        </div>

        {/* Error Display */}
        {error && <div className="runes-error-box">{error}</div>}

        {/* Runes List */}
        {runes.length > 0 ? (
          <div className="runes-list-container">
            <div className="runes-list-scroll">
              {runes.map((rune, index) => (
                <div key={index} className="runes-item">
                  {/* Image Section */}
                  <div className="runes-image-section">
                    {rune.imageURI ? (
                      <img
                        src={rune.imageURI}
                        alt={rune.rune || 'Rune'}
                        className="runes-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="runes-image-placeholder">🪙</div>
                    )}
                    <div className="runes-image-name">
                      {rune.rune || 'Unknown'}
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="runes-details-section">
                    {/* Volume */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Volume</div>
                      <div className="runes-detail-value">
                        {formatNumber(rune.vol || 0)}
                      </div>
                    </div>

                    {/* Total Volume */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Total Volume</div>
                      <div className="runes-detail-value">
                        {formatNumber(rune.totalVol || 0)}
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">
                        Unit Price (Sats)
                      </div>
                      <div className="runes-detail-value">
                        {formatNumber(rune.unitPriceSats || 0)}
                      </div>
                      {rune.formattedUnitPriceSats && (
                        <div className="runes-detail-subvalue">
                          {rune.formattedUnitPriceSats}
                        </div>
                      )}
                    </div>

                    {/* Price Change */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Price Change</div>
                      <div
                        className={`runes-detail-value ${
                          (rune.unitPriceChange || 0) >= 0
                            ? 'positive'
                            : 'negative'
                        }`}
                      >
                        {formatPercentage(rune.unitPriceChange || 0)}
                      </div>
                    </div>

                    {/* Transaction Count */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Transactions</div>
                      <div className="runes-detail-value">
                        {formatNumber(rune.txnCount || 0)}
                      </div>
                    </div>

                    {/* Holder Count */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Holders</div>
                      <div className="runes-detail-value">
                        {formatNumber(rune.holderCount || 0)}
                      </div>
                    </div>

                    {/* Pending Count */}
                    <div className="runes-detail-item">
                      <div className="runes-detail-label">Pending</div>
                      <div className="runes-detail-value warning">
                        {formatNumber(rune.pendingCount || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Etching Details Section */}
                  {rune.etching && (
                    <div className="runes-etching-section">
                      <div className="runes-etching-label">Etching Details</div>
                      <div className="runes-etching-details">
                        {JSON.stringify(rune.etching, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !loading && !error ? (
          <div className="runes-no-data">
            <p className="runes-no-data-text">
              No runes data available. Try adjusting your search parameters.
            </p>
          </div>
        ) : null}

        {/* Loading State */}
        {loading && (
          <div className="runes-loading">
            <p className="runes-loading-text">Loading runes data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunesManagement;
