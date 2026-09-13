/**
 * Shared constants for the AutoTrade page.
 */

/** localStorage key for the "Use fees" setting ('1' / '0'). */
export const FINE_TRADING_USE_FEES_KEY = 'fine-trading-use-fees';

/** Step status values (rendered as icons). */
export const StepStatus = {
  PENDING: '⏳',
  COMPLETE: '✓',
  IN_PROGRESS: '⟳',
};

/**
 * The strategies the runner can execute, in the order they are offered.
 *
 * `id` is the value `settings.tradingMode` holds and what
 * `useAutoTradeRunner` branches on — these strings are load-bearing.
 * `runs` marks a mode that starts the repeating cycle; the others perform one
 * pass and stop, which changes what the Start button should say.
 */
export const TRADING_MODES = [
  {
    id: 'auto-buy-sell',
    label: 'Delta neutral',
    description: 'Buy at floor and relist, keeping exposure flat.',
    runs: true,
  },
  {
    id: 'range-trading',
    label: 'Range trading',
    description: 'Trade around a price, or anywhere in a range you set.',
    runs: true,
  },
  {
    id: 'buy-x-each',
    label: 'Buy X per wallet',
    description: 'Buy the cheapest items from each wallet once, then stop.',
    runs: false,
  },
  {
    id: 'sell-x-each',
    label: 'Sell X per wallet',
    description: 'List items held by each wallet once, then stop.',
    runs: false,
  },
  {
    id: 'bid-accept-bids',
    label: 'Bid / accept bids',
    description: 'Place and accept collection bids by hand.',
    runs: false,
  },
  {
    id: 'auto-fill',
    label: 'Auto fill order-book',
    description: 'Not available yet.',
    runs: false,
    disabled: true,
  },
];

/** @param {string} id @returns {object|undefined} */
export const findTradingMode = (id) =>
  TRADING_MODES.find((mode) => mode.id === id);
