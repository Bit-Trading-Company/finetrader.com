import { processWalletItems, sellXFromEachWallet } from './autoTradeEngine';
import { requireTradingApi } from './exchanges';
import { fetchWalletBalance } from './chain';
import { getOwedSats } from './feeLedger';

jest.mock('./exchanges', () => ({
  requireTradingApi: jest.fn(),
  getItemLink: () => null,
  getExchangeLabel: () => 'Test market',
}));
jest.mock('./chain', () => ({
  fetchWalletBalance: jest.fn(),
  checkTransactionConfirmed: jest.fn(async () => false),
}));
jest.mock('./feeTransaction', () => ({ sendFeePayment: jest.fn() }));

const wallets = [0, 1, 2].map((index) => ({
  index,
  address: `bc1pwallet${index}`,
}));
const collection = { collectionSymbol: 'test-collection' };

const fakeApi = (overrides = {}) => ({
  getFloorPrice: jest.fn(async () => 50000),
  fetchWalletOrdinals: jest.fn(async (address) =>
    address === wallets[0].address
      ? [
          {
            inscriptionId: 'ins-1',
            listed: true,
            listedPrice: 50000,
            listingId: 'listing-1',
            mempoolTxId: '',
          },
        ]
      : []
  ),
  listOrdinalWithProxyWallet: jest.fn(async () => ({ success: true })),
  delistOrdinalWithProxyWallet: jest.fn(async () => ({ success: true })),
  prepareSecurePurchase: jest.fn(async () => ({ success: false, error: 'x' })),
  completeSecurePurchase: jest.fn(),
  checkPurchaseConfirmed: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('app fees on purchases', () => {
  const buyingApi = () =>
    fakeApi({
      prepareSecurePurchase: jest.fn(async () => ({
        success: true,
        noPrepNeeded: true,
        intentData: {},
      })),
      completeSecurePurchase: jest.fn(async () => ({
        success: true,
        txid: 'a'.repeat(64),
      })),
    });

  it('puts the fee on the buyer’s ledger instead of sending it', async () => {
    const api = buyingApi();
    requireTradingApi.mockReturnValue(api);
    fetchWalletBalance.mockResolvedValue(10000000);
    const log = jest.fn();

    const result = await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: log,
      exchange: 'test',
      useFees: true,
    });

    expect(result.itemsBought).toBe(1);
    const buyer = api.completeSecurePurchase.mock.calls[0][1];
    expect(getOwedSats(buyer.address)).toBe(500); // 1% of 50,000
    expect(log.mock.calls.flat().join('\n')).toMatch(/App fee owed: 500 sats/);
  });

  it('owes nothing when the app fee is turned off', async () => {
    const api = buyingApi();
    requireTradingApi.mockReturnValue(api);
    fetchWalletBalance.mockResolvedValue(10000000);

    await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: jest.fn(),
      exchange: 'test',
      useFees: false,
    });

    const buyer = api.completeSecurePurchase.mock.calls[0][1];
    expect(getOwedSats(buyer.address)).toBe(0);
  });

  it('will not let a buyer spend what it owes in fees', async () => {
    const api = buyingApi();
    requireTradingApi.mockReturnValue(api);
    // Enough for the purchase alone, not for it plus 100,000 sats owed.
    fetchWalletBalance.mockResolvedValue(70000);
    for (const w of wallets) {
      localStorage.setItem(
        `fine-trading-fee-ledger-v2:${w.address}`,
        JSON.stringify({
          entries: [{ purchaseTxid: `old-${w.index}`, feeSats: 100000 }],
        })
      );
    }

    await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: jest.fn(),
      exchange: 'test',
      useFees: true,
    });

    expect(api.prepareSecurePurchase).not.toHaveBeenCalled();
  });
});

describe('processWalletItems with unreadable balances', () => {
  it('does not mistake an unreadable balance for an empty wallet', async () => {
    /*
     * A mempool.space 429 used to read as a zero balance: every buyer looked
     * broke, so the seller's listings were taken down and the run could stop.
     */
    const api = fakeApi();
    requireTradingApi.mockReturnValue(api);
    fetchWalletBalance.mockResolvedValue(null);
    const log = jest.fn();

    const result = await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: log,
      exchange: 'test',
      useFees: false,
    });

    expect(api.delistOrdinalWithProxyWallet).not.toHaveBeenCalled();
    expect(api.prepareSecurePurchase).not.toHaveBeenCalled();
    expect(result.itemsDelisted).toBe(0);
    expect(result.shouldStopTrading).toBe(false);
    expect(log.mock.calls.flat().join('\n')).toMatch(
      /Could not read buyer wallet balances/
    );
  });

  it('still delists when every buyer is known to be short', async () => {
    const api = fakeApi();
    requireTradingApi.mockReturnValue(api);
    fetchWalletBalance.mockResolvedValue(10);

    await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: jest.fn(),
      exchange: 'test',
      useFees: false,
    });

    expect(api.delistOrdinalWithProxyWallet).toHaveBeenCalledTimes(1);
  });
});

describe('processWalletItems after a failed listing', () => {
  it('keeps the run going to retry, rather than stopping', async () => {
    // One ord.net submit error used to end the run: the item was left
    // unlisted, which read as "all items have been delisted".
    const unlisted = {
      inscriptionId: 'ins-1',
      listed: false,
      listedPrice: null,
      listingId: null,
      mempoolTxId: '',
    };
    const api = fakeApi({
      fetchWalletOrdinals: jest.fn(async (address) =>
        address === wallets[0].address ? [unlisted] : []
      ),
      listOrdinalWithProxyWallet: jest.fn(async () => ({
        success: false,
        error: 'submit refused',
      })),
    });
    requireTradingApi.mockReturnValue(api);
    fetchWalletBalance.mockResolvedValue(10000000);

    const result = await processWalletItems({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      addConsoleLog: jest.fn(),
      exchange: 'test',
      useFees: false,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.shouldStopTrading).toBe(false);
  });
});

describe('sellXFromEachWallet', () => {
  it('lists nothing once Stop has been pressed', async () => {
    const api = fakeApi({
      fetchWalletOrdinals: jest.fn(async () => [
        { inscriptionId: 'ins-a', listed: false, mempoolTxId: '' },
      ]),
    });
    requireTradingApi.mockReturnValue(api);

    let stopped = false;
    api.listOrdinalWithProxyWallet.mockImplementation(async () => {
      stopped = true; // the user presses Stop after the first listing
      return { success: true };
    });

    const result = await sellXFromEachWallet({
      wallets,
      selectedCollection: collection,
      network: 'mainnet',
      sellXAmount: 1,
      addConsoleLog: jest.fn(),
      useCustomPrice: true,
      customPrice: 60000,
      exchange: 'test',
      isStopRequested: () => stopped,
    });

    expect(api.listOrdinalWithProxyWallet).toHaveBeenCalledTimes(1);
    expect(result.itemsListed).toBe(1);
  });
});
