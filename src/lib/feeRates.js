/**
 * Bitcoin network fee rates, in sat/vB.
 *
 * Every flow that builds a transaction needs a rate, and each used to guess
 * one: a hardcoded 4 here, a 1 there, and the trading fee transaction asking
 * for `fastestFee` — which on a busy day is 40 sat/vB and is why a run could
 * suddenly cost ten times what the user expected.
 *
 * This is the one place that asks the network what a fee costs. Callers get
 * three tiers and pick one; the middle tier is what everything defaults to.
 */
import {
  getMempoolFeeEstimatesUrl,
  getMempoolRecommendedFeesUrl,
} from './mempoolProvider';

/**
 * Used when the network cannot be reached at all. Deliberately the lowest
 * valid rate rather than a guess at what the network wants: a transaction
 * that is too cheap waits, while one built on an invented high rate
 * overpays immediately and cannot be taken back.
 */
export const FALLBACK_FEE_RATE = 1;

/**
 * @typedef {object} FeeTier
 * @property {'high'|'medium'|'low'} id
 * @property {string} label
 * @property {string} hint what choosing it means, in plain terms
 */

/** @type {FeeTier[]} Ordered fastest first, as the buttons read. */
export const FEE_TIERS = [
  { id: 'high', label: 'High', hint: 'Next block or two' },
  { id: 'medium', label: 'Medium', hint: 'Within the hour' },
  { id: 'low', label: 'Low', hint: 'When the network is quiet' },
];

/** The tier every fee control starts on. */
export const DEFAULT_FEE_TIER = 'medium';

const positiveNumber = (value) => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * mempool.space's recommended-fees shape:
 * `{ fastestFee, halfHourFee, hourFee, economyFee, minimumFee }`.
 */
const fromRecommended = (data) => {
  const high = positiveNumber(data?.fastestFee);
  const medium = positiveNumber(data?.halfHourFee);
  const low =
    positiveNumber(data?.hourFee) ??
    positiveNumber(data?.economyFee) ??
    positiveNumber(data?.minimumFee);

  if (!high && !medium && !low) return null;
  return { high, medium, low };
};

/**
 * Esplora's fee-estimates shape: confirmation target (in blocks) mapped to
 * sat/vB. Blockstream serves this and mempool.space does too, so it is the
 * fallback when the richer endpoint is unavailable.
 */
const fromEstimates = (data) => {
  if (!data || typeof data !== 'object') return null;
  const at = (target) => positiveNumber(data[target]);
  const high = at('1') ?? at('2');
  const medium = at('3') ?? at('6');
  const low = at('it') ?? at('25') ?? at('144') ?? at('10');

  if (!high && !medium && !low) return null;
  return { high, medium, low };
};

/**
 * Fill any tier the provider did not report, so callers always get three
 * usable numbers in a sane order (high >= medium >= low >= 1).
 */
const completeTiers = (partial) => {
  const high = partial.high ?? partial.medium ?? partial.low;
  const medium = partial.medium ?? partial.low ?? high;
  const low = partial.low ?? medium;

  const round = (n) => Math.max(1, Math.ceil(n));
  const orderedLow = round(low);
  const orderedMedium = Math.max(orderedLow, round(medium));
  const orderedHigh = Math.max(orderedMedium, round(high));

  return { high: orderedHigh, medium: orderedMedium, low: orderedLow };
};

/**
 * Ask the configured block explorer what the network currently costs.
 *
 * @param {string} [network]
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{high: number, medium: number, low: number}|null>}
 *   null when no provider could be reached — callers fall back to
 *   {@link FALLBACK_FEE_RATE}.
 */
export const fetchFeeRates = async (network = 'mainnet', options = {}) => {
  const doFetch = options.fetchImpl || fetch;

  const read = async (url, parse) => {
    if (!url) return null;
    try {
      const response = await doFetch(url);
      if (!response.ok) return null;
      return parse(await response.json());
    } catch {
      // An unreachable explorer is not an error worth surfacing on its own;
      // the caller decides what to do with a null.
      return null;
    }
  };

  const recommended = await read(
    getMempoolRecommendedFeesUrl(network),
    fromRecommended
  );
  if (recommended) return completeTiers(recommended);

  const estimates = await read(
    getMempoolFeeEstimatesUrl(network),
    fromEstimates
  );
  if (estimates) return completeTiers(estimates);

  return null;
};

/**
 * Floor for a transaction nobody is watching.
 *
 * {@link FALLBACK_FEE_RATE} is right where a person can see the number, read
 * the "explorer unavailable" warning and raise it. An unattended broadcast
 * has none of that: it is not shown, not adjustable, and once it is out it
 * either confirms or sits. "The explorer is unreachable" and "the network
 * genuinely costs 1 sat/vB" are not the same fact, and only the second should
 * produce a 1 sat/vB transaction.
 *
 * 5 is what the trading fee transaction used before fee rates were
 * centralised, so this restores that floor rather than inventing one.
 */
export const UNATTENDED_MIN_FEE_RATE = 5;

/**
 * The rate for a tier, or the fallback when rates are unavailable.
 * @param {{high: number, medium: number, low: number}|null} rates
 * @param {'high'|'medium'|'low'} [tier]
 * @returns {number}
 */
export const rateForTier = (rates, tier = DEFAULT_FEE_TIER) => {
  if (!rates) return FALLBACK_FEE_RATE;
  return rates[tier] ?? rates.medium ?? FALLBACK_FEE_RATE;
};

/**
 * Which tier a rate corresponds to, or null when it matches none of them —
 * that is what tells a fee control the user has typed their own number.
 * @param {{high: number, medium: number, low: number}|null} rates
 * @param {number} rate
 * @returns {'high'|'medium'|'low'|null}
 */
export const tierForRate = (rates, rate) => {
  if (!rates) return null;
  const match = FEE_TIERS.find((tier) => rates[tier.id] === rate);
  return match ? match.id : null;
};

/**
 * The rate for a transaction sent without anyone watching — the app's own
 * trading fee, say. Same middle tier as everything else while the network is
 * reachable; {@link UNATTENDED_MIN_FEE_RATE} rather than the user-facing
 * fallback when it is not.
 *
 * @param {{high: number, medium: number, low: number}|null} rates
 * @returns {number}
 */
export const unattendedRate = (rates) =>
  rates ? rateForTier(rates, DEFAULT_FEE_TIER) : UNATTENDED_MIN_FEE_RATE;
