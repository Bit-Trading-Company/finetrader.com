// Utility helpers for selecting and using a mempool API provider
// Supports switching between mempool.space (default) and blockstream.info

const STORAGE_KEY = 'mempoolApiProvider';

export const MEMPOOL_PROVIDERS = {
  MEMPOOL_SPACE: 'mempool.space',
  BLOCKSTREAM: 'blockstream.info',
};

const normalizeProvider = (provider) => {
  if (provider === MEMPOOL_PROVIDERS.BLOCKSTREAM) {
    return MEMPOOL_PROVIDERS.BLOCKSTREAM;
  }
  return MEMPOOL_PROVIDERS.MEMPOOL_SPACE;
};

export const getMempoolApiProvider = () => {
  if (typeof window === 'undefined') {
    return MEMPOOL_PROVIDERS.MEMPOOL_SPACE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return normalizeProvider(stored);
};

export const setMempoolApiProvider = (provider) => {
  if (typeof window === 'undefined') return;
  const value = normalizeProvider(provider);
  window.localStorage.setItem(STORAGE_KEY, value);
};

const getRootUrl = (provider) => {
  if (provider === MEMPOOL_PROVIDERS.BLOCKSTREAM) {
    return 'https://blockstream.info/';
  }
  return 'https://mempool.space/';
};

const getNetworkPrefix = (network = 'mainnet') => {
  if (!network || network === 'mainnet') return '';
  return `${network}/`;
};

// Core URL builders
export const getMempoolApiBaseUrl = (network = 'mainnet') => {
  const provider = getMempoolApiProvider();
  const root = getRootUrl(provider);
  const prefix = getNetworkPrefix(network);
  // e.g. https://mempool.space/api/ or https://blockstream.info/testnet/api/
  return `${root}${prefix}api/`;
};

export const getMempoolTxUrl = (txId, network = 'mainnet') => {
  const provider = getMempoolApiProvider();
  const root = getRootUrl(provider);
  const prefix = getNetworkPrefix(network);
  return `${root}${prefix}tx/${txId}`;
};

/** Esplora API: transaction JSON (`.../api/tx/:txid`). */
export const getMempoolTxApiUrl = (txId, network = 'mainnet') => {
  return `${getMempoolApiBaseUrl(network)}tx/${txId}`;
};

/** Esplora API: recommended fees (mempool.space only). */
export const getMempoolRecommendedFeesUrl = (network = 'mainnet') => {
  // mempool.space uses /api/v1/fees/recommended (no network prefix on mainnet),
  // blockstream.info does not support this endpoint.
  const provider = getMempoolApiProvider();
  if (provider !== MEMPOOL_PROVIDERS.MEMPOOL_SPACE) return null;
  const root = getRootUrl(provider);
  const prefix = getNetworkPrefix(network);
  return `${root}${prefix}api/v1/fees/recommended`;
};

/** Esplora API: fee estimates (blockstream.info + mempool.space). */
export const getMempoolFeeEstimatesUrl = (network = 'mainnet') => {
  // Returns a map of confirmation target -> sat/vB
  return `${getMempoolApiBaseUrl(network)}fee-estimates`;
};

export const getMempoolAddressUrl = (address, network = 'mainnet') => {
  return `${getMempoolApiBaseUrl(network)}address/${encodeURIComponent(
    address
  )}`;
};

export const getMempoolAddressUtxoUrl = (address, network = 'mainnet') => {
  return `${getMempoolAddressUrl(address, network)}/utxo`;
};

export const getMempoolAddressTxsUrl = (address, network = 'mainnet') => {
  return `${getMempoolApiBaseUrl(network)}address/${encodeURIComponent(
    address
  )}/txs`;
};

/** Unconfirmed transactions spending to or from this address (mempool.space / esplora) */
export const getMempoolAddressTxsMempoolUrl = (
  address,
  network = 'mainnet'
) => {
  return `${getMempoolApiBaseUrl(network)}address/${encodeURIComponent(
    address
  )}/txs/mempool`;
};

export const getMempoolTxStatusUrl = (txId, network = 'mainnet') => {
  return `${getMempoolApiBaseUrl(network)}tx/${txId}/status`;
};

export const getMempoolTxHexUrl = (txId, network = 'mainnet') => {
  return `${getMempoolApiBaseUrl(network)}tx/${txId}/hex`;
};

export const getMempoolBroadcastUrl = (network = 'mainnet') => {
  // .../api/tx
  return `${getMempoolApiBaseUrl(network)}tx`;
};

export const getMempoolProviderLabel = (provider) => {
  if (provider === MEMPOOL_PROVIDERS.BLOCKSTREAM) {
    return 'blockstream.info';
  }
  return 'mempool.space';
};
