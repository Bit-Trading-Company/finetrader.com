/**
 * @jest-environment node
 */
/*
 * sendFeePayment moves real coin, so it is signed for real here; only the
 * network is faked. What it may spend: confirmed, inscription-free outputs.
 */
import { createHash, webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
} from '../lib/bitcoinUtils';
import { TRADING_FEE_RECEIVER_ADDRESS } from './fees';
import { sendFeePayment } from './feeTransaction';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
bitcoin.initEccLib(ecc);

const privateKey = createHash('sha256').update('fee-wallet').digest('hex');
const wallet = {
  index: 0,
  privateKey,
  address: deriveAddressFromPrivateKey(privateKey),
  publicKey: derivePublicKeyFromPrivateKey(privateKey),
};
const script = Buffer.from(
  bitcoin.address.toOutputScript(wallet.address)
).toString('hex');

const CONFIRMED = {
  txid: 'c'.repeat(64),
  vout: 0,
  value: 50000,
  confirmed: true,
};
const UNCONFIRMED = {
  txid: 'd'.repeat(64),
  vout: 0,
  value: 900000,
  confirmed: false,
};
const INSCRIPTION = {
  txid: 'e'.repeat(64),
  vout: 0,
  value: 800000,
  confirmed: true,
};
const UTXOS = [CONFIRMED, UNCONFIRMED, INSCRIPTION];

const json = (body) => ({ ok: true, status: 200, json: async () => body });

const stubNetwork = ({ broadcastStatus = 200 } = {}) => {
  const order = [];
  const sent = [];
  global.fetch = jest.fn(async (url, init = {}) => {
    const target = String(url);
    if (init.method === 'POST') {
      order.push('broadcast');
      sent.push(init.body);
      return {
        ok: broadcastStatus === 200,
        status: broadcastStatus,
        text: async () =>
          broadcastStatus === 200
            ? bitcoin.Transaction.fromHex(init.body).getId()
            : 'bad-txns',
      };
    }
    if (target.includes('fees/recommended')) {
      return json({ fastestFee: 20, halfHourFee: 10, hourFee: 3 });
    }
    if (target.includes('inscription-utxo-data')) {
      return json({
        data: {
          total: 1,
          utxo: [{ txid: INSCRIPTION.txid, vout: 0, inscriptions: [{}] }],
        },
      });
    }
    if (target.includes('path=utxo%2F')) {
      const isInscription = target.includes(INSCRIPTION.txid);
      return json({ data: { inscriptionsCount: isInscription ? 1 : 0 } });
    }
    if (target.endsWith('/txs/mempool')) return json([]);
    if (target.endsWith('/utxo')) {
      return json(
        UTXOS.map(({ confirmed, ...u }) => ({ ...u, status: { confirmed } }))
      );
    }
    const tx = UTXOS.find((u) => target.endsWith(`/tx/${u.txid}`));
    if (tx) return json({ vout: [{ scriptpubkey: script, value: tx.value }] });
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => '',
    };
  });
  return { order, sent };
};

describe('sendFeePayment', () => {
  it('pays from confirmed, inscription-free coin only', async () => {
    const { sent } = stubNetwork();
    const result = await sendFeePayment({ wallet, amountSats: 20000 });

    expect(result.success).toBe(true);
    const tx = bitcoin.Transaction.fromHex(sent[0]);
    // Not the unconfirmed 900k, not the inscription's 800k: the 50k only.
    expect(
      tx.ins.map((i) => Buffer.from(i.hash).reverse().toString('hex'))
    ).toEqual([CONFIRMED.txid]);
    expect(bitcoin.address.fromOutputScript(tx.outs[0].script)).toBe(
      TRADING_FEE_RECEIVER_ADDRESS
    );
    expect(Number(tx.outs[0].value)).toBe(20000);
    expect(bitcoin.address.fromOutputScript(tx.outs[1].script)).toBe(
      wallet.address
    );
    expect(result.txid).toBe(tx.getId());
  });

  it('reports the txid before it broadcasts', async () => {
    const { order } = stubNetwork();
    await sendFeePayment({
      wallet,
      amountSats: 20000,
      onSigned: () => order.push('signed'),
    });
    expect(order).toEqual(['signed', 'broadcast']);
  });

  it('says when the explorer refused it, so the fees can be owed again', async () => {
    stubNetwork({ broadcastStatus: 400 });
    const result = await sendFeePayment({ wallet, amountSats: 20000 });
    expect(result).toMatchObject({ success: false, broadcastRejected: true });
    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('waits rather than spend more than the confirmed coin holds', async () => {
    stubNetwork();
    const result = await sendFeePayment({ wallet, amountSats: 60000 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Insufficient spendable BTC/);
  });

  it('refuses an amount below the dust limit', async () => {
    global.fetch = jest.fn();
    const result = await sendFeePayment({ wallet, amountSats: 200 });
    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
