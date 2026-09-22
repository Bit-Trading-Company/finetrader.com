import {
  DEFAULT_FEE_TIER,
  FALLBACK_FEE_RATE,
  fetchFeeRates,
  rateForTier,
  tierForRate,
} from './feeRates';

const okJson = (body) => ({ ok: true, json: async () => body });

describe('fetchFeeRates', () => {
  it('reads the three tiers from mempool.space recommended fees', async () => {
    const fetchImpl = jest.fn(async () =>
      okJson({
        fastestFee: 42,
        halfHourFee: 18,
        hourFee: 9,
        economyFee: 3,
        minimumFee: 1,
      })
    );

    await expect(fetchFeeRates('mainnet', { fetchImpl })).resolves.toEqual({
      high: 42,
      medium: 18,
      low: 9,
    });
  });

  it('falls back to Esplora fee estimates when recommended fees fail', async () => {
    const fetchImpl = jest.fn(async (url) =>
      String(url).includes('recommended')
        ? { ok: false, status: 404, json: async () => ({}) }
        : okJson({ 1: 30.5, 3: 12.2, 6: 12.2, 25: 2.1 })
    );

    // Rates are rounded up: a fractional rate that rounds down underpays.
    await expect(fetchFeeRates('mainnet', { fetchImpl })).resolves.toEqual({
      high: 31,
      medium: 13,
      low: 3,
    });
  });

  it('returns null when no provider answers', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    });

    await expect(fetchFeeRates('mainnet', { fetchImpl })).resolves.toBeNull();
  });

  it('keeps the tiers in order even when the provider inverts them', async () => {
    const fetchImpl = jest.fn(async () =>
      okJson({ fastestFee: 2, halfHourFee: 7, hourFee: 9 })
    );

    const rates = await fetchFeeRates('mainnet', { fetchImpl });
    expect(rates.high).toBeGreaterThanOrEqual(rates.medium);
    expect(rates.medium).toBeGreaterThanOrEqual(rates.low);
  });

  it('fills missing tiers rather than reporting a partial set', async () => {
    const fetchImpl = jest.fn(async () => okJson({ halfHourFee: 6 }));

    await expect(fetchFeeRates('mainnet', { fetchImpl })).resolves.toEqual({
      high: 6,
      medium: 6,
      low: 6,
    });
  });

  it('never returns a rate below one sat/vB', async () => {
    const fetchImpl = jest.fn(async () =>
      okJson({ fastestFee: 0.4, halfHourFee: 0.2, hourFee: 0.1 })
    );

    const rates = await fetchFeeRates('mainnet', { fetchImpl });
    expect(rates.low).toBeGreaterThanOrEqual(1);
  });
});

describe('rateForTier', () => {
  const rates = { high: 40, medium: 12, low: 4 };

  it('defaults to the middle tier, not the fastest', () => {
    expect(DEFAULT_FEE_TIER).toBe('medium');
    expect(rateForTier(rates)).toBe(12);
  });

  it('falls back to one sat/vB when rates are unavailable', () => {
    expect(rateForTier(null, 'high')).toBe(FALLBACK_FEE_RATE);
    expect(FALLBACK_FEE_RATE).toBe(1);
  });
});

describe('tierForRate', () => {
  const rates = { high: 40, medium: 12, low: 4 };

  it('identifies a rate that matches a tier', () => {
    expect(tierForRate(rates, 12)).toBe('medium');
  });

  it('reports no tier for a rate the user typed themselves', () => {
    expect(tierForRate(rates, 17)).toBeNull();
    expect(tierForRate(null, 12)).toBeNull();
  });
});
