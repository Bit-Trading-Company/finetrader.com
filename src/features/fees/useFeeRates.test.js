/**
 * The hook that turns live fee rates into the number a transaction is built
 * with. The cases that matter are the quiet-mempool one — where all three
 * tiers collapse to the same rate — and never overwriting a typed rate.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeeRates } from './useFeeRates';

const mockFees = (body) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => body,
  }));
};

const busy = {
  fastestFee: 42,
  halfHourFee: 18,
  hourFee: 9,
  economyFee: 3,
  minimumFee: 1,
};

/** What mempool.space really returns when nothing is queued. */
const quiet = {
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1,
};

afterEach(() => {
  delete global.fetch;
});

it('starts on the middle tier once the network answers', async () => {
  mockFees(busy);
  const { result } = renderHook(() => useFeeRates());

  await waitFor(() => expect(result.current.rates).not.toBeNull());
  expect(result.current.feeRate).toBe(18);
  expect(result.current.tier).toBe('medium');
  expect(result.current.unavailable).toBe(false);
});

it('falls back to 1 sat/vB when no explorer answers', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
  const { result } = renderHook(() => useFeeRates());

  await waitFor(() => expect(result.current.unavailable).toBe(true));
  expect(result.current.feeRate).toBe(1);
  expect(result.current.rates).toBeNull();
  expect(result.current.tier).toBeNull();
});

/*
 * The regression this exists for: with every tier at 1, reading the tier back
 * off the rate reported "high", telling someone who never left the default
 * that they were paying top rate.
 */
it('keeps reporting the chosen tier when all three cost the same', async () => {
  mockFees(quiet);
  const { result } = renderHook(() => useFeeRates());

  await waitFor(() => expect(result.current.rates).not.toBeNull());
  expect(result.current.rates).toEqual({ high: 1, medium: 1, low: 1 });
  expect(result.current.tier).toBe('medium');

  act(() => result.current.selectTier('low'));
  expect(result.current.tier).toBe('low');
  expect(result.current.feeRate).toBe(1);
});

it('honours a typed rate and stops calling it a tier', async () => {
  mockFees(busy);
  const { result } = renderHook(() => useFeeRates());
  await waitFor(() => expect(result.current.rates).not.toBeNull());

  act(() => result.current.setFeeRate(7));
  expect(result.current.feeRate).toBe(7);
  expect(result.current.tier).toBeNull();

  // A typed rate that lands on a tier still lights that tier up.
  act(() => result.current.setFeeRate(42));
  expect(result.current.tier).toBe('high');
});

it('never lets a refresh overwrite a rate the user typed', async () => {
  mockFees(busy);
  const { result } = renderHook(() => useFeeRates());
  await waitFor(() => expect(result.current.rates).not.toBeNull());

  act(() => result.current.setFeeRate(5));
  act(() => result.current.refresh());

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(result.current.feeRate).toBe(5);
});

it('rejects a rate below 1', async () => {
  mockFees(busy);
  const { result } = renderHook(() => useFeeRates());
  await waitFor(() => expect(result.current.rates).not.toBeNull());

  act(() => result.current.setFeeRate(0));
  expect(result.current.feeRate).toBe(1);
  act(() => result.current.setFeeRate(-9));
  expect(result.current.feeRate).toBe(1);
});
