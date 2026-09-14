/**
 * Analytics: what the Fine Trader wallets hold and what they paid for it.
 *
 * The page frame is the redesigned shell — header, navigation, wallet menu and
 * artwork all come from it, so the duplicate header and wallet dropdown this
 * page used to carry are gone, along with its own copy of the wallet manager.
 *
 * The three sections below are still pre-redesign components. They learn about
 * wallets through an event hub rather than the session, so the session is
 * mirrored onto one for them — which is what makes the wallets derived on any
 * other page the wallets reported on here.
 */
import React, { useState, useEffect, useRef } from 'react';
import WalletAnalytics from './WalletAnalytics';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import { useWalletSessionBridge } from '../../features/wallet/WalletSession';
import { fetchWalletOrdinals } from '../../trading/satflow/satflowApi';
import {
  getMempoolAddressTxsUrl,
  getMempoolAddressTxsMempoolUrl,
  getMempoolApiBaseUrl,
  getMempoolTxUrl,
} from '../../lib/mempoolProvider';
import { Page, PageHeader } from '../../ui';
import './Analytics.css';
import { useEventHub } from '../../lib/eventHub';
import styles from './Analytics.module.css';

const ordinalPreviewUrl = (item) => {
  const raw = item._satflowRaw;
  const token = raw?.token || {};
  const ct = item.contentType || token.content_type;
  if (ct && String(ct).startsWith('image/') && item.contentURI) {
    return item.contentURI;
  }
  return (
    token.image_url || raw?.collection?.image_url || item.contentURI || null
  );
};

const ordinalContentIsHtml = (item) => {
  const raw = item._satflowRaw;
  const token = raw?.token || {};
  const ct = item.contentType || token.content_type;
  if (!ct) return false;
  return String(ct).toLowerCase().includes('html');
};

const ordinalContentIsText = (item) => {
  const raw = item._satflowRaw;
  const token = raw?.token || {};
  const ct = item.contentType || token.content_type;
  if (!ct) return false;
  const s = String(ct).toLowerCase();
  if (!s.startsWith('text/')) return false;
  return !s.includes('html');
};

const OrdinalTextPreview = ({ url }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setText('');
    fetch(url, { credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.text();
      })
      .then((body) => {
        if (!cancelled) {
          setText(body);
          setStatus('ok');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (status === 'loading') {
    return (
      <div className="analytics-ordinals-card-text-loading">Loading text…</div>
    );
  }
  if (status === 'error') {
    return (
      <div className="analytics-ordinals-card-placeholder">
        Text could not be loaded (blocked or unavailable).
      </div>
    );
  }
  return (
    <textarea
      readOnly
      className="analytics-ordinals-card-text"
      value={text}
      aria-label="Inscription text content"
    />
  );
};

const ordinalDisplayName = (item) => {
  const raw = item._satflowRaw;
  const token = raw?.token || {};
  return (
    token.name ||
    (item.inscriptionNumber != null
      ? `Inscription #${item.inscriptionNumber}`
      : item.inscriptionId?.slice(0, 16) + '…') ||
    'Ordinal'
  );
};

/**
 * Fetches Satflow wallet-contents for the sidebar-selected proxy wallet only
 * (/api/satflow-wallet-contents via setupProxy).
 */
const ProxyWalletOrdinalsSection = ({ glEventHub }) => {
  const [proxyWallets, setProxyWallets] = useState([]);
  const [selectedProxyIndex, setSelectedProxyIndex] = useState(null);
  const [row, setRow] = useState(null);

  useEffect(() => {
    const onGenerated = (wallets) => {
      setProxyWallets(Array.isArray(wallets) ? wallets : []);
    };
    const onSelect = (wallet) => {
      if (wallet && typeof wallet.index === 'number') {
        setSelectedProxyIndex(wallet.index);
      } else {
        setSelectedProxyIndex(null);
      }
    };
    if (glEventHub) {
      glEventHub.on('wallets-generated', onGenerated);
      glEventHub.on('wallet-selected', onSelect);
    }
    return () => {
      if (glEventHub) {
        glEventHub.off('wallets-generated', onGenerated);
        glEventHub.off('wallet-selected', onSelect);
      }
    };
  }, [glEventHub]);

  useEffect(() => {
    let cancelled = false;

    const w = proxyWallets.find((pw) => pw.index === selectedProxyIndex);
    if (selectedProxyIndex == null || !w || proxyWallets.length === 0) {
      setRow(null);
      return;
    }

    const address = w.address || w.addresses?.p2tr;
    const label = `Proxy wallet #${w.index + 1}`;

    setRow({
      label,
      address,
      ordinals: [],
      loading: true,
      error: null,
    });

    (async () => {
      if (!address) {
        if (!cancelled) {
          setRow({
            label,
            address: null,
            ordinals: [],
            loading: false,
            error: 'No address',
          });
        }
        return;
      }
      try {
        const ordinals = await fetchWalletOrdinals(address, null, true);
        if (!cancelled) {
          setRow({
            label,
            address,
            ordinals,
            loading: false,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setRow({
            label,
            address,
            ordinals: [],
            loading: false,
            error: e?.message || 'Failed to load',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [proxyWallets, selectedProxyIndex]);

  const formatAddr = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
  };

  if (proxyWallets.length === 0) {
    return (
      <section className="analytics-ordinals-section">
        <h2 className="component-header">Wallet ordinals</h2>
        <div className="analytics-ordinals-empty">
          <p className="analytics-ordinals-empty-text">
            Generate Fine Trader wallets from the sidebar, then select one to
            view its ordinals from Satflow.
          </p>
        </div>
      </section>
    );
  }

  if (selectedProxyIndex == null) {
    return (
      <section className="analytics-ordinals-section">
        <h2 className="component-header">Wallet ordinals</h2>
        <div className="analytics-ordinals-empty">
          <p className="analytics-ordinals-empty-text">
            Select a Fine Trader wallet to load its ordinals.
          </p>
        </div>
      </section>
    );
  }

  const selectedWallet = proxyWallets.find(
    (pw) => pw.index === selectedProxyIndex
  );
  if (!selectedWallet) {
    return (
      <section className="analytics-ordinals-section">
        <h2 className="component-header">Wallet ordinals</h2>
        <div className="analytics-ordinals-empty">
          <p className="analytics-ordinals-empty-text">
            That proxy wallet is not in the current list. Select a wallet from
            the sidebar.
          </p>
        </div>
      </section>
    );
  }

  if (!row) {
    return (
      <section className="analytics-ordinals-section">
        <h2 className="component-header">Wallet ordinals</h2>
        <div className="analytics-ordinals-loading">
          Loading wallet ordinals…
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-ordinals-section">
      <h2 className="component-header">Wallet ordinals</h2>

      <div className="analytics-ordinals-wallet-block analytics-ordinals-wallet-block--selected">
        <div className="analytics-ordinals-wallet-header">
          <span className="analytics-ordinals-wallet-label">{row.label}</span>
          <span className="analytics-ordinals-wallet-address">
            {formatAddr(row.address)}
          </span>
        </div>

        {row.loading ? (
          <div className="analytics-ordinals-loading">Loading ordinals…</div>
        ) : row.error ? (
          <div className="analytics-ordinals-error">{row.error}</div>
        ) : row.ordinals.length === 0 ? (
          <div className="analytics-ordinals-none">
            No ordinals in this wallet.
          </div>
        ) : (
          <div className="analytics-ordinals-grid">
            {row.ordinals.map((item, idx) => {
              const preview = ordinalPreviewUrl(item);
              const name = ordinalDisplayName(item);
              const coll =
                item._satflowRaw?.collection?.name ||
                item.collectionSymbol ||
                '';
              const inscriptionId =
                item.inscriptionId || item._satflowRaw?.token?.inscription_id;
              return (
                <article
                  key={inscriptionId || idx}
                  className="analytics-ordinals-card"
                >
                  <div className="analytics-ordinals-card-media">
                    {preview ? (
                      ordinalContentIsHtml(item) ? (
                        <iframe
                          title={name}
                          src={preview}
                          className="analytics-ordinals-card-iframe"
                          sandbox="allow-scripts allow-same-origin"
                          loading="lazy"
                        />
                      ) : ordinalContentIsText(item) ? (
                        <OrdinalTextPreview url={preview} />
                      ) : (
                        <img
                          src={preview}
                          alt=""
                          loading="lazy"
                          className="analytics-ordinals-card-img"
                        />
                      )
                    ) : (
                      <div className="analytics-ordinals-card-placeholder">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="analytics-ordinals-card-body">
                    <div className="analytics-ordinals-card-title" title={name}>
                      {name}
                    </div>
                    {coll && (
                      <div className="analytics-ordinals-card-collection">
                        {coll}
                      </div>
                    )}
                    {item.inscriptionNumber != null && (
                      <div className="analytics-ordinals-card-meta">
                        #{item.inscriptionNumber}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const ORDINALS_API_BASE = 'https://ordinals.com/api';

const shortTx = (txid) => {
  if (!txid) return '';
  return `${txid.slice(0, 10)}…${txid.slice(-8)}`;
};

const shortAddr = (addr) => {
  if (!addr) return '';
  const s = String(addr);
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-8)}`;
};

const formatBtc = (sats) => {
  const n = Number(sats) || 0;
  return (n / 100000000).toFixed(8);
};

const pLimit = (concurrency) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active += 1;
    job()
      .catch(() => {})
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      next();
    });
};

/**
 * Detect ordinal purchases for the sidebar-selected proxy wallet.
 * Heuristic: tx where wallet has at least one inscription output coming in AND net BTC change is negative.
 */
const ProxyWalletPurchasesSection = ({ glEventHub, network = 'mainnet' }) => {
  const [proxyWallets, setProxyWallets] = useState([]);
  const [selectedProxyIndex, setSelectedProxyIndex] = useState(null);
  const [state, setState] = useState({
    label: '',
    address: null,
    purchases: [],
    loading: false,
    error: null,
    warnings: [],
  });

  const cacheRef = useRef({
    outpointToInscriptions: new Map(), // `${txid}:${vout}` -> string[]
    inscriptionToItem: new Map(), // inscriptionId -> satflow item (or null on miss)
  });

  useEffect(() => {
    const onGenerated = (wallets) => {
      setProxyWallets(Array.isArray(wallets) ? wallets : []);
    };
    const onSelect = (wallet) => {
      if (wallet && typeof wallet.index === 'number') {
        setSelectedProxyIndex(wallet.index);
      } else {
        setSelectedProxyIndex(null);
      }
    };
    if (glEventHub) {
      glEventHub.on('wallets-generated', onGenerated);
      glEventHub.on('wallet-selected', onSelect);
    }
    return () => {
      if (glEventHub) {
        glEventHub.off('wallets-generated', onGenerated);
        glEventHub.off('wallet-selected', onSelect);
      }
    };
  }, [glEventHub]);

  useEffect(() => {
    let cancelled = false;
    const w = proxyWallets.find((pw) => pw.index === selectedProxyIndex);
    if (selectedProxyIndex == null || !w || proxyWallets.length === 0) {
      setState({
        label: '',
        address: null,
        purchases: [],
        loading: false,
        error: null,
        warnings: [],
      });
      return;
    }

    const address = w.address || w.addresses?.p2tr;
    const label = `Proxy wallet #${w.index + 1}`;

    setState({
      label,
      address,
      purchases: [],
      loading: true,
      error: null,
      warnings: [],
    });

    const limit = pLimit(6);

    const safeFetchJson = async (url, options = {}) => {
      const res = await fetch(url, options);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status}${t ? `: ${t}` : ''}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    };

    const fetchTxsForAddress = async (addr) => {
      // Esplora: /address/:address/txs returns only first page. Paginate confirmed txs via /txs/chain/:last_seen_txid.
      const base = getMempoolApiBaseUrl(network);
      const fetchJson = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch txs (${res.status})`);
        return await res.json();
      };

      const mempoolTxs = await fetchJson(
        getMempoolAddressTxsMempoolUrl(addr, network)
      ).catch(() => []);

      const MAX_CHAIN_TX = 200;
      let chainTxs = await fetchJson(getMempoolAddressTxsUrl(addr, network));
      if (!Array.isArray(chainTxs)) chainTxs = [];
      while (chainTxs.length < MAX_CHAIN_TX && chainTxs.length > 0) {
        const last = chainTxs[chainTxs.length - 1];
        const lastTxid = last?.txid;
        if (!lastTxid) break;
        const nextPageUrl = `${base}address/${encodeURIComponent(
          addr
        )}/txs/chain/${encodeURIComponent(lastTxid)}`;
        // eslint-disable-next-line no-await-in-loop
        const next = await fetchJson(nextPageUrl).catch(() => []);
        if (!Array.isArray(next) || next.length === 0) break;
        chainTxs = chainTxs.concat(next);
        if (next.length < 25) break; // last page
      }
      chainTxs = chainTxs.slice(0, MAX_CHAIN_TX);

      const seen = new Set();
      const out = [];
      for (const tx of [...mempoolTxs, ...chainTxs]) {
        if (tx?.txid && !seen.has(tx.txid)) {
          seen.add(tx.txid);
          out.push(tx);
        }
      }
      return out;
    };

    const calcNetChangeSats = (tx, addr) => {
      let net = 0;
      if (Array.isArray(tx?.vout)) {
        tx.vout.forEach((o) => {
          if (o?.scriptpubkey_address === addr && Number(o.value) > 0) {
            net += Number(o.value);
          }
        });
      }
      if (Array.isArray(tx?.vin)) {
        tx.vin.forEach((i) => {
          const p = i?.prevout;
          if (p?.scriptpubkey_address === addr && Number(p.value) > 0) {
            net -= Number(p.value);
          }
        });
      }
      return net;
    };

    const didSpendFromWallet = (tx, addr) => {
      if (!Array.isArray(tx?.vin)) return false;
      return tx.vin.some(
        (i) => i?.prevout?.scriptpubkey_address === addr && i?.prevout?.value
      );
    };

    const hasOrdinalLikeVout = (tx) => {
      // Common ordinal transfer output is 546 sats. Some flows use slightly above dust.
      if (!Array.isArray(tx?.vout)) return false;
      return tx.vout.some((o) => {
        const v = Number(o?.value);
        if (!Number.isFinite(v) || v <= 0) return false;
        if (v === 546) return true;
        if (v >= 330 && v <= 600) return true;
        return false;
      });
    };

    const getInscriptionsForOutpoint = async (txid, voutIdx) => {
      const key = `${txid}:${voutIdx}`;
      const cached = cacheRef.current.outpointToInscriptions.get(key);
      if (cached !== undefined) return cached;
      try {
        const data = await safeFetchJson(`${ORDINALS_API_BASE}/output/${key}`, {
          credentials: 'omit',
        });
        const inscriptions = Array.isArray(data?.inscriptions)
          ? data.inscriptions.filter((s) => typeof s === 'string' && s.length)
          : [];
        cacheRef.current.outpointToInscriptions.set(key, inscriptions);
        return inscriptions;
      } catch (e) {
        // If ordinals.com is blocked (CORS/network), treat as unknown and cache empty.
        cacheRef.current.outpointToInscriptions.set(key, []);
        return [];
      }
    };

    const fetchSatflowItem = async (inscriptionId) => {
      const key = String(inscriptionId || '').trim();
      if (!key) return null;
      const cached = cacheRef.current.inscriptionToItem.get(key);
      if (cached !== undefined) return cached;
      try {
        const params = new URLSearchParams({
          inscriptionId: key,
          listing: 'false',
          bid: 'false',
          metadata: 'true',
        });
        const res = await fetch(`/api/satflow-item?${params.toString()}`);
        if (!res.ok) {
          cacheRef.current.inscriptionToItem.set(key, null);
          return null;
        }
        const data = await res.json();
        const item = data?.data || data;
        cacheRef.current.inscriptionToItem.set(key, item || null);
        return item || null;
      } catch {
        cacheRef.current.inscriptionToItem.set(key, null);
        return null;
      }
    };

    (async () => {
      if (!address) {
        if (!cancelled) {
          setState({
            label,
            address: null,
            purchases: [],
            loading: false,
            error: 'No address',
            warnings: [],
          });
        }
        return;
      }
      try {
        const txs = await fetchTxsForAddress(address);
        if (cancelled) return;

        // Newest first by block_time; pending last/first depending; treat missing time as now.
        const newestFirst = [...txs].sort((a, b) => {
          const ta = a?.status?.block_time
            ? a.status.block_time
            : a?.status?.confirmed
              ? 0
              : Date.now() / 1000;
          const tb = b?.status?.block_time
            ? b.status.block_time
            : b?.status?.confirmed
              ? 0
              : Date.now() / 1000;
          return tb - ta;
        });

        // Keep analysis bounded to avoid hammering ordinals API.
        const MAX_TX_TO_ANALYZE = 60;
        const toAnalyze = newestFirst.slice(0, MAX_TX_TO_ANALYZE);

        const candidatePurchases = [];

        for (const tx of toAnalyze) {
          if (cancelled) return;
          const txid = tx?.txid;
          if (!txid) continue;

          const netChange = calcNetChangeSats(tx, address);
          if (netChange >= 0) continue; // must spend more than received
          if (!didSpendFromWallet(tx, address)) continue; // ensure it's actually a spend by this wallet (vin prevouts present)

          // Purchases often send the inscription to a marketplace/script address (not the buyer address),
          // so we scan ALL outputs for inscriptions (bounded).
          const outputs = Array.isArray(tx?.vout)
            ? tx.vout.map((o, idx) => ({ o, idx }))
            : [];
          if (outputs.length === 0) continue;

          const MAX_VOUT_TO_SCAN = 20;
          const voutsToScan = outputs.slice(0, MAX_VOUT_TO_SCAN);

          const inscriptionSets = await Promise.all(
            voutsToScan.map(({ idx }) =>
              limit(() => getInscriptionsForOutpoint(txid, idx))
            )
          );
          const inscriptions = inscriptionSets.flat().filter(Boolean);
          const isHeuristicPurchase = hasOrdinalLikeVout(tx);
          if (inscriptions.length === 0 && !isHeuristicPurchase) continue;

          const timestamp = tx?.status?.block_time
            ? tx.status.block_time * 1000
            : Date.now();
          candidatePurchases.push({
            txid,
            confirmed: !!tx?.status?.confirmed,
            blockHeight: tx?.status?.block_height ?? null,
            timestamp,
            datetime: new Date(timestamp).toLocaleString(),
            feeSats: Number(tx?.fee) || 0,
            netChangeSats: netChange,
            costSats: Math.abs(netChange),
            inscriptions,
            _heuristic: inscriptions.length === 0,
          });
        }

        // Enrich inscription IDs with Satflow item data (best-effort).
        const uniqueInscriptions = Array.from(
          new Set(candidatePurchases.flatMap((p) => p.inscriptions))
        ).slice(0, 150);

        await Promise.all(
          uniqueInscriptions.map((id) => limit(() => fetchSatflowItem(id)))
        );

        if (cancelled) return;

        const purchases = candidatePurchases.map((p) => {
          const ordinalItems = p.inscriptions
            .map((id) => ({
              inscriptionId: id,
              item: cacheRef.current.inscriptionToItem.get(id) || null,
            }))
            .filter(Boolean);
          return { ...p, ordinalItems };
        });

        const warnings = [];
        if (candidatePurchases.length > 0) {
          // If we found purchases but satflow enrichment failed, nudge.
          const enrichedCount = purchases.reduce(
            (sum, p) =>
              sum +
              (p.ordinalItems || []).filter((x) => x?.item != null).length,
            0
          );
          if (enrichedCount === 0) {
            warnings.push(
              'Ordinal metadata lookup failed (Satflow item API unavailable). Showing inscription IDs only.'
            );
          }
        }

        setState({
          label,
          address,
          purchases,
          loading: false,
          error: null,
          warnings,
        });
      } catch (e) {
        if (!cancelled) {
          setState({
            label,
            address,
            purchases: [],
            loading: false,
            error: e?.message || 'Failed to load purchases',
            warnings: [],
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [proxyWallets, selectedProxyIndex, network]);

  if (proxyWallets.length === 0) return null;
  if (selectedProxyIndex == null) return null;

  return (
    <section className="analytics-ordinals-section">
      <h2 className="component-header">Ordinal purchases</h2>
      <div className="analytics-ordinals-subtitle">
        Detected as transactions where an inscription/ordinal comes in and BTC
        goes out.
      </div>

      <div className="analytics-ordinals-wallet-block analytics-ordinals-wallet-block--selected">
        <div className="analytics-ordinals-wallet-header">
          <span className="analytics-ordinals-wallet-label">{state.label}</span>
          <span className="analytics-ordinals-wallet-address">
            {shortAddr(state.address)}
          </span>
        </div>

        {state.loading ? (
          <div className="analytics-ordinals-loading">Scanning purchases…</div>
        ) : state.error ? (
          <div className="analytics-ordinals-error">{state.error}</div>
        ) : state.purchases.length === 0 ? (
          <div className="analytics-ordinals-none">
            No purchases detected in recent transactions.
          </div>
        ) : (
          <>
            {state.warnings.length > 0 && (
              <div className="analytics-ordinals-empty">
                <p className="analytics-ordinals-empty-text">
                  {state.warnings.join(' ')}
                </p>
              </div>
            )}

            <div className="wallet-analytics-transactions-list">
              <table className="wallet-analytics-transactions-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>TX</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Ordinals</th>
                  </tr>
                </thead>
                <tbody>
                  {state.purchases.map((p) => (
                    <tr key={p.txid}>
                      <td>{p.datetime}</td>
                      <td className="wallet-analytics-txid">
                        <a
                          href={getMempoolTxUrl(p.txid, network)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          title={p.txid}
                        >
                          {shortTx(p.txid)}
                        </a>
                      </td>
                      <td>
                        <span
                          className={
                            p.confirmed
                              ? 'wallet-analytics-status confirmed'
                              : 'wallet-analytics-status pending'
                          }
                        >
                          {p.confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                      <td className="wallet-analytics-negative">
                        {formatBtc(p.costSats)} BTC (
                        {p.costSats.toLocaleString()} sats)
                      </td>
                      <td>
                        {p._heuristic ? (
                          <div style={{ fontSize: 11, color: '#a0aec0' }}>
                            {`Detected via mempool heuristic (wallet spent inputs and created a dust-like output). Ordinals API didn’t return inscription IDs for this tx.`}
                          </div>
                        ) : null}
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(p.ordinalItems || []).map((x) => {
                            const inscriptionId = x?.inscriptionId;
                            const item = x?.item;
                            const name =
                              item?.name ||
                              item?.title ||
                              item?.metadata?.name ||
                              (item?.inscription_number != null
                                ? `Inscription #${item.inscription_number}`
                                : inscriptionId
                                  ? `Inscription ${shortTx(inscriptionId)}`
                                  : 'Inscription');
                            const collection =
                              item?.collection?.name ||
                              item?.collection?.slug ||
                              item?.collectionSlug ||
                              '';
                            return (
                              <div key={inscriptionId || name}>
                                <div style={{ fontWeight: 600 }}>{name}</div>
                                <div style={{ fontSize: 11, color: '#a0aec0' }}>
                                  {collection ? `${collection} • ` : ''}
                                  {inscriptionId
                                    ? shortTx(inscriptionId)
                                    : 'Unknown inscription'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const Analytics = () => {
  const { network } = useWalletConnection();
  const glEventHub = useEventHub();
  useWalletSessionBridge(glEventHub);

  return (
    <Page variant="analytics">
      <PageHeader
        title="Analytics"
        description="What the Fine Trader wallets hold, and what they paid for it."
      />

      <div className={`ds-panel ${styles.panel}`}>
        <WalletAnalytics glEventHub={glEventHub} network={network} />
      </div>

      <div className={`ds-panel ${styles.panel}`}>
        <ProxyWalletOrdinalsSection glEventHub={glEventHub} />
      </div>

      <div className={`ds-panel ${styles.panel}`}>
        <ProxyWalletPurchasesSection
          glEventHub={glEventHub}
          network={network}
        />
      </div>
    </Page>
  );
};

export default Analytics;
