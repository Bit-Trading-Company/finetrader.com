import {
  getOwedEntries,
  getOwedSats,
  getSettledSats,
  getSettlingEntries,
  markSettling,
  recordFeeOwed,
} from './feeLedger';
import {
  FEE_SETTLEMENT_THRESHOLD_SATS,
  reconcileSettlements,
  settleOwedFees,
  settleWalletFees,
} from './feeSettlement';
import { sendFeePayment } from './feeTransaction';

jest.mock('./feeTransaction', () => ({ sendFeePayment: jest.fn() }));

const wallet = { address: 'bc1pwallet', index: 0, privateKey: 'k' };

/** Owe `count` purchases of `priceSats` each. */
const owe = (count, priceSats = 1000000) => {
  for (let i = 0; i < count; i++) {
    recordFeeOwed(wallet.address, { purchaseTxid: `p${i}`, priceSats });
  }
};

/** sendFeePayment that signs (calling onSigned) and then does `outcome`. */
const payment = (outcome) =>
  sendFeePayment.mockImplementation(async ({ onSigned }) => {
    onSigned('settle-tx');
    return { txid: 'settle-tx', ...outcome };
  });

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ status: 404 }));
});

describe('settleWalletFees', () => {
  it('carries a small amount over instead of paying more to send it', async () => {
    owe(1); // 10,000 sats owed, under the 20,000 threshold
    const result = await settleWalletFees(wallet);
    expect(result).toMatchObject({ status: 'below-minimum', owedSats: 10000 });
    expect(sendFeePayment).not.toHaveBeenCalled();
  });

  it('pays everything owed in one transaction once it is worth it', async () => {
    owe(3); // 30,000 sats
    payment({ success: true });
    const log = jest.fn();

    const result = await settleWalletFees(wallet, { addConsoleLog: log });

    expect(sendFeePayment).toHaveBeenCalledTimes(1);
    expect(sendFeePayment.mock.calls[0][0].amountSats).toBe(30000);
    expect(result).toMatchObject({ status: 'paid', txid: 'settle-tx' });
    expect(getOwedSats(wallet.address)).toBe(0);
    expect(getSettledSats(wallet.address)).toBe(30000);
    expect(log.mock.calls[0][0]).toMatch(/App fee paid .* 3 purchase/);
  });

  it('owes it all again when the broadcast is refused', async () => {
    owe(3);
    payment({ success: false, broadcastRejected: true, error: 'rejected' });
    const result = await settleWalletFees(wallet);
    expect(result.status).toBe('failed');
    expect(getOwedEntries(wallet.address)).toHaveLength(3);
  });

  it('never pays twice when a broadcast outcome is unknown', async () => {
    // Signed, then the connection dropped: it may or may not be out.
    owe(3);
    payment({ success: false, error: 'network down' });
    await settleWalletFees(wallet);
    expect(getSettlingEntries(wallet.address)).toHaveLength(3);

    // The next attempt must not build a second payment for the same fees.
    sendFeePayment.mockClear();
    await settleWalletFees(wallet, { minimumSats: 0 });
    expect(sendFeePayment).not.toHaveBeenCalled();
  });

  it('honours a lower minimum at the end of a run', async () => {
    owe(1);
    payment({ success: true });
    const result = await settleWalletFees(wallet, { minimumSats: 5000 });
    expect(result.status).toBe('paid');
  });

  it('does not run two settlements for one wallet at once', async () => {
    owe(3);
    let release;
    sendFeePayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ success: true, txid: 't' });
        })
    );
    const first = settleWalletFees(wallet);
    await new Promise((r) => setTimeout(r, 0));
    await expect(settleWalletFees(wallet)).resolves.toMatchObject({
      status: 'busy',
    });
    release();
    await first;
  });
});

describe('reconcileSettlements', () => {
  const settling = (ageMs) => {
    owe(2);
    markSettling(wallet.address, ['p0', 'p1'], 'settle-tx');
    const key = `fine-trading-fee-ledger-v2:${wallet.address}`;
    const data = JSON.parse(localStorage.getItem(key));
    data.entries.forEach((e) => {
      e.settlingAt = Date.now() - ageMs;
    });
    localStorage.setItem(key, JSON.stringify(data));
  };

  it('marks a settlement the explorer has seen as paid', async () => {
    settling(1000);
    global.fetch = jest.fn(async () => ({ status: 200 }));
    await reconcileSettlements(wallet.address);
    expect(getSettledSats(wallet.address)).toBe(20000);
  });

  it('waits before giving up on one it has not seen yet', async () => {
    settling(60 * 1000);
    await reconcileSettlements(wallet.address);
    expect(getSettlingEntries(wallet.address)).toHaveLength(2);
  });

  it('owes it again once it has clearly never gone out', async () => {
    settling(31 * 60 * 1000);
    await reconcileSettlements(wallet.address);
    expect(getOwedEntries(wallet.address)).toHaveLength(2);
  });

  it('changes nothing when the explorer cannot be reached', async () => {
    settling(31 * 60 * 1000);
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    });
    await reconcileSettlements(wallet.address);
    expect(getSettlingEntries(wallet.address)).toHaveLength(2);
  });
});

describe('settleOwedFees', () => {
  it('only touches wallets that owe something', async () => {
    owe(3);
    payment({ success: true });
    const result = await settleOwedFees({
      wallets: [wallet, { address: 'bc1pclean', index: 1 }],
      minimumSats: FEE_SETTLEMENT_THRESHOLD_SATS,
    });
    expect(sendFeePayment).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ paidSats: 30000, stillOwedSats: 0 });
  });
});
