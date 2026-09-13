/**
 * Choose the collection to trade.
 *
 * Shows the most active collections by default and searches Satflow by name
 * on demand. The advanced controls (sort, direction, how many, and a filter
 * over the loaded list) live behind a toggle so the common case stays a
 * search box and a click.
 *
 * `variant="table"` lays the same data out as rows with every statistic the
 * API returns, for the dashboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTopCollections,
  getCollectionSlug,
  searchCollections,
} from '../../../features/marketplace/collectionsApi';
import { formatCompactNumber, formatSatsAsBtc } from '../../../lib/format';
import { Alert, Button, Loading, Select, Table, TextInput } from '../../../ui';
import styles from './CollectionPicker.module.css';

/** Sortable fields, and how to read each one off a collection. */
const SORTS = [
  { id: 'name', label: 'Name', read: (c) => (c.name || '').toLowerCase() },
  { id: 'fp', label: 'Floor price', read: (c) => c.fp || 0 },
  { id: 'listedCount', label: 'Listed', read: (c) => c.listedCount || 0 },
  { id: 'vol1d', label: 'Volume 24h', read: (c) => c.vol1d || 0 },
  { id: 'vol7d', label: 'Volume 7d', read: (c) => c.vol7d || 0 },
  { id: 'totalVol', label: 'Total volume', read: (c) => c.totalVol || 0 },
  { id: 'totalSupply', label: 'Supply', read: (c) => c.totalSupply || 0 },
];

const LIMITS = [25, 50, 100];

/** Signed percentage, or null when the API did not report one. */
const changePercent = (value) => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(n) ? null : n;
};

const Change = ({ value }) => {
  const n = changePercent(value);
  if (n === null) return null;
  const tone = n > 0 ? styles.up : n < 0 ? styles.down : styles.flat;
  return (
    <span className={tone}>
      {n > 0 ? '+' : ''}
      {n.toFixed(1)}%
    </span>
  );
};

/**
 * @param {object} props
 * @param {object|null} props.selected
 * @param {(collection: object) => void} props.onSelect
 * @param {'grid'|'table'} [props.variant]
 */
const CollectionPicker = ({ selected, onSelect, variant = 'grid' }) => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [term, setTerm] = useState('');
  const [isSearchResult, setIsSearchResult] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('vol1d');
  const [direction, setDirection] = useState('desc');
  const [limit, setLimit] = useState(50);
  const [filterText, setFilterText] = useState('');

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

  // Sorting and filtering are applied to whatever list is loaded, so they work
  // the same over the default collections and over search results.
  const visible = useMemo(() => {
    const sort = SORTS.find((s) => s.id === sortBy) || SORTS[0];
    const needle = filterText.trim().toLowerCase();

    const filtered = needle
      ? collections.filter((c) =>
          `${c.name || ''} ${getCollectionSlug(c) || ''}`
            .toLowerCase()
            .includes(needle)
        )
      : collections;

    const sorted = [...filtered].sort((a, b) => {
      const av = sort.read(a);
      const bv = sort.read(b);
      if (av === bv) return 0;
      const order = av > bv ? 1 : -1;
      return direction === 'asc' ? order : -order;
    });

    return sorted.slice(0, limit);
  }, [collections, sortBy, direction, limit, filterText]);

  const selectedSlug = getCollectionSlug(selected);
  const activeFilters =
    (filterText ? 1 : 0) + (sortBy !== 'vol1d' || direction !== 'desc' ? 1 : 0);

  const columns = [
    {
      key: 'name',
      header: 'Collection',
      render: (c) => (
        <span className={styles.rowName}>
          {c.image ? (
            <img
              src={c.image}
              alt=""
              className={styles.rowThumb}
              loading="lazy"
            />
          ) : (
            <span className={styles.rowThumb} aria-hidden="true" />
          )}
          <span className={styles.name}>{c.name || getCollectionSlug(c)}</span>
        </span>
      ),
    },
    {
      key: 'fp',
      header: 'Floor',
      align: 'right',
      numeric: true,
      render: (c) => (c.fp ? formatSatsAsBtc(c.fp) : '—'),
    },
    {
      key: 'listedCount',
      header: 'Listed',
      align: 'right',
      numeric: true,
      render: (c) =>
        c.listedCount != null ? formatCompactNumber(c.listedCount) : '—',
    },
    {
      key: 'totalSupply',
      header: 'Supply',
      align: 'right',
      numeric: true,
      render: (c) => (c.totalSupply ? formatCompactNumber(c.totalSupply) : '—'),
    },
    {
      key: 'vol1d',
      header: 'Vol 24h',
      align: 'right',
      numeric: true,
      render: (c) => (
        <span className={styles.volCell}>
          {c.vol1d != null ? formatSatsAsBtc(c.vol1d) : '—'}
          <Change value={c.vol1dChangePercent} />
        </span>
      ),
    },
    {
      key: 'vol7d',
      header: 'Vol 7d',
      align: 'right',
      numeric: true,
      render: (c) => (
        <span className={styles.volCell}>
          {c.vol7d != null ? formatSatsAsBtc(c.vol7d) : '—'}
          <Change value={c.vol7dChangePercent} />
        </span>
      ),
    },
    {
      key: 'totalVol',
      header: 'Total vol',
      align: 'right',
      numeric: true,
      render: (c) => (c.totalVol ? formatSatsAsBtc(c.totalVol) : '—'),
    },
  ];

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
        <Button
          type="button"
          variant={showFilters ? 'secondary' : 'ghost'}
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
        >
          Filters{activeFilters ? ` (${activeFilters})` : ''}
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

      {showFilters && (
        <div className={styles.filters}>
          <label className={styles.filter}>
            <span className={styles.filterLabel}>Sort by</span>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>

          <label className={styles.filter}>
            <span className={styles.filterLabel}>Order</span>
            <Select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="desc">High to low</option>
              <option value="asc">Low to high</option>
            </Select>
          </label>

          <label className={styles.filter}>
            <span className={styles.filterLabel}>Show</span>
            <Select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>

          <label className={styles.filter}>
            <span className={styles.filterLabel}>Filter loaded</span>
            <TextInput
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Name contains…"
            />
          </label>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <Loading>Loading collections…</Loading>
      ) : visible.length === 0 ? (
        <p className={styles.none}>
          {isSearchResult || filterText
            ? 'No collections matched.'
            : 'No collections available right now.'}
        </p>
      ) : variant === 'table' ? (
        <div className={styles.tableWrap}>
          <Table
            columns={columns}
            rows={visible}
            getRowKey={(c) => getCollectionSlug(c) || c.name}
            onRowClick={onSelect}
            isRowSelected={(c) => getCollectionSlug(c) === selectedSlug}
          />
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((collection) => {
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
                      {collection.totalSupply ? (
                        <span className={styles.stat}>
                          of {formatCompactNumber(collection.totalSupply)}
                        </span>
                      ) : null}
                    </span>
                    {collection.vol1d != null && (
                      <span className={styles.stats}>
                        <span className={styles.stat}>
                          24h <b>{formatSatsAsBtc(collection.vol1d)}</b>
                        </span>
                        <Change value={collection.vol1dChangePercent} />
                      </span>
                    )}
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
