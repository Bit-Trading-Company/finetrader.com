/**
 * @jest-environment node
 */
// Adapters import the proxy-wallet signing stack, whose ECC self-test fails
// under jsdom (same setup as src/lib/bitcoinUtils.test.js).
import {
  TRADING_EXCHANGES,
  getTradingApi,
  requireTradingApi,
  getExchangeLabel,
  getItemLink,
} from './exchanges';
import * as satflowApi from './satflow/satflowApi';
import * as satflowListing from './satflow/satflowListing';
import * as satflowPurchase from './satflow/satflowPurchase';
import * as ordnetTrading from './ordnet/ordnetTrading';

// Methods the auto-trade engine calls on an adapter (MarketplaceAdapter).
const ADAPTER_METHODS = [
  'fetchCollectionItems',
  'getFloorPrice',
  'fetchWalletOrdinals',
  'checkPurchaseConfirmed',
  'listOrdinalWithProxyWallet',
  'delistOrdinalWithProxyWallet',
  'prepareSecurePurchase',
  'completeSecurePurchase',
];

describe('exchanges registry', () => {
  test('exchange ids are unchanged (they are stored in AutoTrade settings)', () => {
    expect(TRADING_EXCHANGES).toEqual({ SATFLOW: 'satflow', ORDNET: 'ordnet' });
  });

  test.each(Object.values(TRADING_EXCHANGES))(
    '%s adapter implements the full contract',
    (id) => {
      const api = getTradingApi(id);
      expect(api.id).toBe(id);
      expect(typeof api.label).toBe('string');
      expect(typeof api.getItemUrl).toBe('function');
      ADAPTER_METHODS.forEach((method) =>
        expect(typeof api[method]).toBe('function')
      );
    }
  );

  test('adapters are wired to their own marketplace implementations', () => {
    const satflowImpl = {
      ...satflowApi,
      ...satflowListing,
      ...satflowPurchase,
    };
    const satflow = getTradingApi(TRADING_EXCHANGES.SATFLOW);
    const ordnet = getTradingApi(TRADING_EXCHANGES.ORDNET);
    ADAPTER_METHODS.forEach((method) => {
      expect(satflow[method]).toBe(satflowImpl[method]);
      expect(ordnet[method]).toBe(ordnetTrading[method]);
    });
  });

  test('unknown exchange ids fall back to Satflow', () => {
    const satflow = getTradingApi(TRADING_EXCHANGES.SATFLOW);
    expect(getTradingApi('unknown')).toBe(satflow);
    expect(getTradingApi(undefined)).toBe(satflow);
  });

  /*
   * The fallback above is right for read-only UI and wrong for anything that
   * spends coin: a run that defaulted to Satflow while the user believed they
   * were on ord.net would buy and list on the wrong marketplace with real
   * money. Everything in autoTradeEngine resolves through requireTradingApi.
   */
  test('requireTradingApi returns the named adapter', () => {
    Object.values(TRADING_EXCHANGES).forEach((id) => {
      expect(requireTradingApi(id)).toBe(getTradingApi(id));
    });
  });

  test('requireTradingApi refuses an unknown or missing exchange', () => {
    expect(() => requireTradingApi('unknown')).toThrow(/Unknown trading/);
    expect(() => requireTradingApi(undefined)).toThrow(/Unknown trading/);
    expect(() => requireTradingApi(null)).toThrow(/Unknown trading/);
    expect(() => requireTradingApi('')).toThrow(/Unknown trading/);
    // The message has to name the alternatives to be actionable.
    expect(() => requireTradingApi('magiceden')).toThrow(/satflow, ordnet/);
  });

  test('labels and console links match the previous engine output', () => {
    expect(getExchangeLabel('satflow')).toBe('Satflow');
    expect(getExchangeLabel('ordnet')).toBe('ord.net');
    expect(getExchangeLabel('unknown')).toBe('Satflow');
    expect(getItemLink('abci0', 'satflow')).toBe(
      'https://ordinals.com/inscription/abci0'
    );
    expect(getItemLink('abci0', 'ordnet')).toBe(
      'https://ord.net/inscription/abci0'
    );
    expect(getItemLink(null, 'ordnet')).toBeNull();
  });
});
