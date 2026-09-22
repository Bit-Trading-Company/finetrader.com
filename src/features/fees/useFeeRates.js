/**
 * Live network fee rates, and the rate a flow should use.
 *
 * Every transaction-building flow asks for this: funding, consolidating,
 * extracting inscriptions. The hook owns the fetch and the tier choice so the
 * pages only have to render a control and pass the number on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FEE_TIER,
  FALLBACK_FEE_RATE,
  fetchFeeRates,
  rateForTier,
  tierForRate,
} from '../../lib/feeRates';

/**
 * @param {{network?: string, enabled?: boolean}} [options]
 * @returns {{
 *   feeRate: number,
 *   tier: 'high'|'medium'|'low'|null,
 *   rates: {high: number, medium: number, low: number}|null,
 *   isLoading: boolean,
 *   unavailable: boolean,
 *   selectTier: (tier: 'high'|'medium'|'low') => void,
 *   setFeeRate: (rate: number) => void,
 *   refresh: () => void,
 * }}
 */
export const useFeeRates = (options = {}) => {
  const { network = 'mainnet', enabled = true } = options;

  const [rates, setRates] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [nonce, setNonce] = useState(0);

  /*
   * The chosen rate, and whether the user typed it. Until the first fetch
   * lands there is nothing to be on the middle tier *of*, so the rate starts
   * at the fallback and follows the network once it answers — unless the user
   * has already set their own number, which is never overwritten.
   */
  const [feeRate, setFeeRateState] = useState(FALLBACK_FEE_RATE);
  const isCustomRef = useRef(false);

  /*
   * Which tier the user is on, remembered rather than inferred from the rate.
   * When the mempool is quiet all three tiers are the same number, and reading
   * the tier back off the rate would light up "High" for someone who chose
   * "Medium" — telling them they are paying top rate when they are not.
   */
  const [chosenTier, setChosenTier] = useState(DEFAULT_FEE_TIER);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    setIsLoading(true);

    fetchFeeRates(network)
      .then((next) => {
        if (cancelled) return;
        setRates(next);
        setUnavailable(!next);
        if (next && !isCustomRef.current) {
          setFeeRateState(rateForTier(next, DEFAULT_FEE_TIER));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [network, enabled, nonce]);

  const selectTier = useCallback(
    (next) => {
      isCustomRef.current = false;
      setChosenTier(next);
      setFeeRateState(rateForTier(rates, next));
    },
    [rates]
  );

  const setFeeRate = useCallback((rate) => {
    isCustomRef.current = true;
    setChosenTier(null);
    setFeeRateState(Math.max(1, Math.round(rate) || 1));
  }, []);

  const tier = useMemo(() => {
    if (!rates) return null;
    // The remembered choice holds as long as its rate is still the one in the
    // box; otherwise fall back to whichever tier the number matches, so a
    // typed rate that happens to equal a tier still lights that tier up.
    if (chosenTier && rates[chosenTier] === feeRate) return chosenTier;
    return tierForRate(rates, feeRate);
  }, [rates, feeRate, chosenTier]);

  return {
    feeRate,
    tier,
    rates,
    isLoading,
    unavailable,
    selectTier,
    setFeeRate,
    refresh,
  };
};
