/**
 * @jest-environment node
 */
// Characterization tests for proxy-wallet key derivation and PSBT signing.
// These pin behavior that real funds depend on: if derivation changes, users
// lose access to their generated proxy wallets.
import { createHash, webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  derivePublicKeyFromPrivateKey,
  deriveAddressFromPrivateKey,
  generateAddressFromPublicKey,
  generateDeterministicWallets,
  getTaprootInternalPubkeyBytes,
  normalizePrivateKeyHex,
  signPsbtWithProxyWallet,
} from './bitcoinUtils';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;

bitcoin.initEccLib(ecc);

const KEY_ONE = `${'0'.repeat(63)}1`;
const GENERATOR_COMPRESSED =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

const sha256 = (data) => createHash('sha256').update(data).digest();
const keyFrom = (label) => sha256(label).toString('hex');

/**
 * A P2TR input whose output key is the raw, untweaked pubkey. This is the
 * shape `disableTweakSigner` exists for: signing it with the tweaked key
 * produces a signature against the wrong key.
 */
const buildUntweakedP2trPsbt = (ownerPrivateKeyHex) => {
  const xOnly = Buffer.from(getTaprootInternalPubkeyBytes(ownerPrivateKeyHex));
  const script = Buffer.concat([Buffer.from([0x51, 0x20]), xOnly]);
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
  psbt.addInput({
    hash: '22'.repeat(32),
    index: 0,
    witnessUtxo: { script, value: 10000n },
    tapInternalKey: xOnly,
  });
  psbt.addOutput({ script, value: 9000n });
  return psbt.toBase64();
};

const buildP2trPsbt = (ownerPrivateKeyHex) => {
  const internalPubkey = Buffer.from(
    getTaprootInternalPubkeyBytes(ownerPrivateKeyHex)
  );
  const payment = bitcoin.payments.p2tr({ internalPubkey });
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
  psbt.addInput({
    hash: '11'.repeat(32),
    index: 0,
    witnessUtxo: { script: payment.output, value: 10000n },
    tapInternalKey: internalPubkey,
  });
  psbt.addOutput({ address: payment.address, value: 9000n });
  return psbt.toBase64();
};

describe('key derivation', () => {
  it('derives the compressed public key', () => {
    expect(derivePublicKeyFromPrivateKey(KEY_ONE)).toBe(GENERATOR_COMPRESSED);
  });

  it('normalizes private key hex to 32 bytes', () => {
    expect(normalizePrivateKeyHex('1')).toBe(KEY_ONE);
    expect(normalizePrivateKeyHex(` ${KEY_ONE}ff `)).toBe(KEY_ONE);
  });

  it('uses the x-only public key as the taproot internal key', () => {
    const internal = Buffer.from(getTaprootInternalPubkeyBytes(KEY_ONE));
    expect(internal.toString('hex')).toBe(GENERATOR_COMPRESSED.slice(2));
  });

  it('produces the same P2TR address via bitcoinjs and @scure paths', () => {
    const privateKey = keyFrom('address-agreement');
    const address = deriveAddressFromPrivateKey(privateKey);
    expect(address).toMatch(/^bc1p/);
    expect(
      generateAddressFromPublicKey(derivePublicKeyFromPrivateKey(privateKey))
    ).toBe(address);
  });

  it('derives proxy wallets as sha256(sha256(signature) || index)', async () => {
    const signature = 'test-signature';
    const wallets = await generateDeterministicWallets(signature, 3);
    const seed = sha256(Buffer.from(signature, 'utf8'));

    expect(wallets).toHaveLength(3);
    wallets.forEach((wallet, i) => {
      const expectedKey = sha256(
        Buffer.concat([seed, Buffer.from(String(i), 'utf8')])
      ).toString('hex');
      expect(wallet.index).toBe(i);
      expect(wallet.privateKey).toBe(expectedKey);
      expect(wallet.publicKey).toBe(derivePublicKeyFromPrivateKey(expectedKey));
      expect(wallet.address).toBe(deriveAddressFromPrivateKey(expectedKey));
      expect(wallet.addresses.p2tr).toBe(wallet.address);
    });
  });
});

describe('signPsbtWithProxyWallet', () => {
  it('signs, finalizes and extracts a taproot key-path spend', async () => {
    const privateKey = keyFrom('signer');
    const result = await signPsbtWithProxyWallet(
      buildP2trPsbt(privateKey),
      privateKey,
      'mainnet',
      { finalize: true, extractTx: true }
    );

    const tx = bitcoin.Transaction.fromHex(result.hex);
    expect(tx.ins).toHaveLength(1);
    expect(tx.ins[0].witness).toHaveLength(1);
    expect(tx.ins[0].witness[0]).toHaveLength(64);
  });

  it('signs without finalizing for listing flows', async () => {
    const privateKey = keyFrom('lister');
    const result = await signPsbtWithProxyWallet(
      buildP2trPsbt(privateKey),
      privateKey,
      'mainnet',
      { finalize: false }
    );

    const signed = bitcoin.Psbt.fromBase64(result.base64);
    expect(signed.data.inputs[0].tapKeySig).toHaveLength(64);
    expect(
      signed.validateSignaturesOfInput(0, (pubkey, msghash, signature) =>
        ecc.verifySchnorr(msghash, pubkey, signature)
      )
    ).toBe(true);
    expect(result.hex).toBeUndefined();
  });

  /*
   * ord.net's listing flow sends per-input signing instructions and expects
   * them honoured exactly: sigHash values of 0, 1 and 131 appear in its own
   * documented examples, and `disableTweakSigner` asks for the untweaked key.
   * Getting either wrong yields a PSBT that looks signed but fails to
   * broadcast, which costs a real listing attempt.
   */
  it('honours a sigHash from the signing instructions', async () => {
    const privateKey = keyFrom('sighash-single-anyonecanpay');
    // 131 = SIGHASH_SINGLE | SIGHASH_ANYONECANPAY, the marketplace pattern.
    const result = await signPsbtWithProxyWallet(
      buildP2trPsbt(privateKey),
      privateKey,
      'mainnet',
      {
        finalize: false,
        inputSigningInstructions: [{ signingIndexes: [0], sigHash: 131 }],
      }
    );

    const signed = bitcoin.Psbt.fromBase64(result.base64);
    // A non-default sighash appends its flag byte, so 64 becomes 65.
    expect(signed.data.inputs[0].tapKeySig).toHaveLength(65);
    expect(signed.data.inputs[0].tapKeySig[64]).toBe(131);
  });

  it('signs with the default sighash as a 64-byte signature', async () => {
    const privateKey = keyFrom('sighash-default');
    const result = await signPsbtWithProxyWallet(
      buildP2trPsbt(privateKey),
      privateKey,
      'mainnet',
      {
        finalize: false,
        inputSigningInstructions: [{ signingIndexes: [0], sigHash: 0 }],
      }
    );

    const signed = bitcoin.Psbt.fromBase64(result.base64);
    expect(signed.data.inputs[0].tapKeySig).toHaveLength(64);
  });

  it('signs an untweaked output key when disableTweakSigner is set', async () => {
    const privateKey = keyFrom('untweaked');
    const psbt = buildUntweakedP2trPsbt(privateKey);

    const result = await signPsbtWithProxyWallet(psbt, privateKey, 'mainnet', {
      finalize: false,
      inputSigningInstructions: [
        { signingIndexes: [0], disableTweakSigner: true },
      ],
    });

    const signed = bitcoin.Psbt.fromBase64(result.base64);
    expect(signed.data.inputs[0].tapKeySig).toHaveLength(64);
    expect(
      signed.validateSignaturesOfInput(0, (pubkey, msghash, signature) =>
        ecc.verifySchnorr(msghash, pubkey, signature)
      )
    ).toBe(true);
  });

  it('cannot sign an untweaked output key with the tweaked signer', async () => {
    // The guard that makes the flag matter: without it, this input is unsignable.
    const privateKey = keyFrom('untweaked');
    await expect(
      signPsbtWithProxyWallet(
        buildUntweakedP2trPsbt(privateKey),
        privateKey,
        'mainnet',
        {
          finalize: false,
          inputSigningInstructions: [{ signingIndexes: [0] }],
        }
      )
    ).rejects.toThrow(/No inputs could be signed/);
  });

  it('refuses to sign inputs owned by a different key', async () => {
    await expect(
      signPsbtWithProxyWallet(
        buildP2trPsbt(keyFrom('owner')),
        keyFrom('someone-else'),
        'mainnet',
        { finalize: true, extractTx: true }
      )
    ).rejects.toThrow(
      /tapInternalKey does not match|No inputs could be signed/
    );
  });
});
