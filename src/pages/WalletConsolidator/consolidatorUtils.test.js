/**
 * @jest-environment node
 */
/*
 * The sweep pays app fees owed as one extra output. Signed for real here —
 * only the network is faked — so the test reads the transaction that would
 * have been broadcast, output by output.
 */
import { createHash, webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
} from '../../lib/bitcoinUtils';
import {
  getOwedSats,
  getSettledSats,
  getSettlingEntries,
  recordFeeOwed,
} from '../../trading/feeLedger';
import { TRADING_FEE_RECEIVER_ADDRESS } from '../../trading/fees';
import { consolidateWallet } from './consolidatorUtils';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
bitcoin.initEccLib(ecc);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const privateKey = createHash('sha256').update('sweep-wallet').digest('hex');
const wallet = {
  index: 0,
  privateKey,
  address: deriveAddressFromPrivateKey(privateKey),
  publicKey: derivePublicKeyFromPrivateKey(privateKey),
};
const DESTINATION = deriveAddressFromPrivateKey(
  createHash('sha256').update('destination').digest('hex')
);

const INSCRIPTION = { txid: 'a'.repeat(64), vout: 0, value: 546 };
const PLAIN = { txid: 'b'.repeat(64), vout: 1, value: 200000 };

/** Fake the explorer and UniSat; capture what gets broadcast. */
const stubNetwork = ({ broadcastStatus = 200 } = {}) => {
  const sent = [];
  global.fetch = jest.fn(async (url, init = {}) => {
    const target = String(url);
    if (init.method === 'POST') {
      sent.push(init.body);
      const txid = bitcoin.Transaction.fromHex(init.body).getId();
      return {
        ok: broadcastStatus === 200,
        status: broadcastStatus,
        text: async () => (broadcastStatus === 200 ? txid : 'rejected'),
      };
    }
    if (/\/address\/[^/]+\/utxo$/.test(target)) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          [INSCRIPTION, PLAIN].map((u) => ({
            ...u,
            status: { confirmed: true },
          })),
      };
    }
    if (target.includes('/api/unisat')) {
      const isInscription = decodeURIComponent(target).includes(
        INSCRIPTION.txid
      );
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { inscriptionsCount: isInscription ? 1 : 0, inscriptions: [] },
        }),
        text: async () => '',
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  return sent;
};

const outputsOf = (hex) =>
  bitcoin.Transaction.fromHex(hex).outs.map((o) => ({
    address: bitcoin.address.fromOutputScript(o.script),
    value: Number(o.value),
  }));

beforeEach(() => store.clear());

describe('consolidateWallet with app fees owed', () => {
  it('pays them as the last output, from plain BTC, inscription untouched', async () => {
    recordFeeOwed(wallet.address, { purchaseTxid: 'p1', priceSats: 1500000 });
    const sent = stubNetwork();

    const result = await consolidateWallet({
      wallet,
      destinationAddress: DESTINATION,
      feeRate: 2,
    });

    expect(result.error).toBeNull();
    const outs = outputsOf(sent[0]);
    // The inscription output comes first with its exact value.
    expect(outs[0]).toEqual({ address: DESTINATION, value: 546 });
    expect(outs[outs.length - 1]).toEqual({
      address: TRADING_FEE_RECEIVER_ADDRESS,
      value: 15000,
    });
    // The fee and the miner fee both came out of the plain output.
    expect(outs[1].address).toBe(DESTINATION);
    expect(outs[1].value).toBeLessThan(200000 - 15000);
    expect(getOwedSats(wallet.address)).toBe(0);
    expect(getSettledSats(wallet.address)).toBe(15000);
  });

  it('adds nothing when nothing is owed', async () => {
    const sent = stubNetwork();
    await consolidateWallet({
      wallet,
      destinationAddress: DESTINATION,
      feeRate: 2,
    });
    const outs = outputsOf(sent[0]);
    expect(outs.map((o) => o.address)).not.toContain(
      TRADING_FEE_RECEIVER_ADDRESS
    );
  });

  it('owes the fees again when the sweep is refused', async () => {
    recordFeeOwed(wallet.address, { purchaseTxid: 'p1', priceSats: 1500000 });
    stubNetwork({ broadcastStatus: 400 });
    const result = await consolidateWallet({
      wallet,
      destinationAddress: DESTINATION,
      feeRate: 2,
    });
    expect(result.error).toMatch(/Broadcast failed/);
    expect(getSettlingEntries(wallet.address)).toHaveLength(0);
    expect(getOwedSats(wallet.address)).toBe(15000);
  });
});
