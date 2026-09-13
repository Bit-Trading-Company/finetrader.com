/**
 * Choose the collection to trade.
 *
 * Shows the most active collections by default and searches Satflow by name
 * on demand. Selection is a single click on a card — the previous UI needed
 * the user to find a small "select" control in a dense table.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchTopCollections,
  getCollectionSlug,
  searchCollections,
} from '../../../features/marketplace/collectionsApi';
import { formatCompactNumber, formatSatsAsBtc } from '../../../lib/format';
import { Alert, Button, Loading, TextInput } from '../../../ui';
import styles from './CollectionPicker.module.css';

/**
 * @param {object} props
 * @param {object|null} props.selected
 * @param {(collection: object) => void} props.onSelect
 */
const CollectionPicker = ({ selected, onSelect }) => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [term, setTerm] = useState('');
  const [isSearchResult, setIsSearchResult] = useState(false);

  const loadTop = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCollections(await fetchTopCollections());
      setIsSearchResult(false);
    } catch (err) {
      setError(err.message || 'Could not load collections');
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTop();
  }, [loadTop]);

  const runSearch = async (event) => {
    event.preventDefault();
    if (!term.trim()) {
      loadTop();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCollections(await searchCollections(term));
      setIsSearchResult(true);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSlug = getCollectionSlug(selected);

  return (
    <div className={styles.picker}>
      <form className={styles.search} onSubmit={runSearch}>
        <TextInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search collections by name"
          aria-label="Search collections"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {isSearchResult && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTerm('');
              loadTop();
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <Loading>Loading collections…</Loading>
      ) : collections.length === 0 ? (
        <p className={styles.none}>
          {isSearchResult
            ? 'No collections matched that search.'
            : 'No collections available right now.'}
        </p>
      ) : (
        <ul className={styles.grid}>
          {collections.map((collection) => {
            const slug = getCollectionSlug(collection);
            const isSelected = slug && slug === selectedSlug;
            return (
              <li key={slug || collection.name}>
                <button
                  type="button"
                  className={[styles.card, isSelected ? styles.selected : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelect(collection)}
                  aria-pressed={isSelected}
                >
                  {collection.image ? (
                    <img
                      src={collection.image}
                      alt=""
                      className={styles.thumb}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.thumbFallback} aria-hidden="true" />
                  )}

                  <span className={styles.body}>
                    <span className={styles.name}>
                      {collection.name || slug}
                    </span>
                    <span className={styles.stats}>
                      {collection.fp ? (
                        <span className={styles.stat}>
                          Floor <b>{formatSatsAsBtc(collection.fp)}</b>
                        </span>
                      ) : null}
                      {collection.listedCount != null && (
                        <span className={styles.stat}>
                          {formatCompactNumber(collection.listedCount)} listed
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CollectionPicker;
