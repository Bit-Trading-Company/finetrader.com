/**
 * @jest-environment node
 */
/*
 * ord.net's listing escrow arriving without its leaf script. The signer can
 * only sign a script-path input whose leaf it is given; without one, step 1
 * and the recovery PSBT fail with "input 0 belongs to bc1p…", the escrow's
 * own address. These pin the rebuild against a real mainnet escrow, and that
 * it never adds a leaf it cannot prove.
 */
import { createHash, webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  deriveAddressFromPrivateKey,
  getTaprootInternalPubkeyBytes,
  signPsbtWithProxyWallet,
} from '../../lib/bitcoinUtils';
import {
  buildEscrow,
  inputOwners,
  withEscrowLeafScripts,
  withOnlySignatures,
} from './ordnetEscrow';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;

bitcoin.initEccLib(ecc);

const keyFrom = (label) =>
  createHash('sha256').update(label).digest().toString('hex');

const outputKeyOf = (privateKeyHex) =>
  Buffer.from(
    bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(getTaprootInternalPubkeyBytes(privateKeyHex)),
    }).pubkey
  );

/** An escrow spend as ord.net may send it: prevout only, no leaf. */
const bareEscrowPsbt = (escrowOutput, { tapInternalKey } = {}) => {
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
  psbt.addInput({
    hash: '44'.repeat(32),
    index: 0,
    witnessUtxo: { script: escrowOutput, value: 10000n },
    ...(tapInternalKey ? { tapInternalKey } : {}),
  });
  psbt.addOutput({ script: escrowOutput, value: 9000n });
  return psbt.toBase64();
};

describe('ord.net escrow rebuild', () => {
  it('reproduces a real mainnet escrow from the seller key alone', () => {
    // Output 0 of b6d8eee1…15c5, spent by settlement c2067d51…e51b input 2.
    // The seller key is the output key of bc1p5y63c28…fn07.
    const seller = Buffer.from(
      'a1351c28eb1cc291a2d4abe865bd7f1183c88d4828ec32606ebbe827e704c21c',
      'hex'
    );
    const escrow = buildEscrow(seller, seller);
    expect(bitcoin.address.fromOutputScript(escrow.output)).toBe(
      'bc1puedeal0gns34ucrncw7ukyauknj0yu5f8tuy4rpcfxese3zlhh7sqqh35q'
    );
    // The control block that settlement put on chain.
    expect(escrow.controlBlock.toString('hex')).toBe(
      'c1a1351c28eb1cc291a2d4abe865bd7f1183c88d4828ec32606ebbe827e704c21c'
    );
  });

  it("reproduces the escrow from a client's failed listing", () => {
    // "wallet bc1pgfan…36ht; input 0 belongs to bc1p6lxv…mxxpe" (2026-10-17):
    // the foreign input was this wallet's own escrow.
    const seller = Buffer.from(
      bitcoin.address.toOutputScript(
        'bc1pgfanjyf0xzfuxp20cr5uyjf6uwwz75hxfnrccakjjufq724ze7csul36ht'
      )
    ).subarray(2);
    expect(
      bitcoin.address.fromOutputScript(buildEscrow(seller, seller).output)
    ).toBe('bc1p6lxvqh6jhl57kmdevrxyh96ummaud7al4xmgkg79sj9xcg079kys7mxxpe');
  });

  it('fills in the leaf, so the settlement leg can be signed', async () => {
    const privateKey = keyFrom('escrow-rebuild-seller');
    const seller = outputKeyOf(privateKey);
    const unsigned = bareEscrowPsbt(buildEscrow(seller, seller).output);

    const instructions = [
      {
        address: deriveAddressFromPrivateKey(privateKey),
        signingIndexes: [0],
        sigHash: 131,
      },
    ];

    // Unrepaired, this is the reported failure.
    await expect(
      signPsbtWithProxyWallet(unsigned, privateKey, 'mainnet', {
        finalize: false,
        inputSigningInstructions: instructions,
      })
    ).rejects.toThrow(/No inputs could be signed.*input 0 belongs to bc1p/);

    const repaired = withEscrowLeafScripts(unsigned, privateKey, 'mainnet', [
      0,
    ]);
    const result = await signPsbtWithProxyWallet(
      repaired,
      privateKey,
      'mainnet',
      { finalize: false, inputSigningInstructions: instructions }
    );

    const signed = bitcoin.Psbt.fromBase64(result.base64);
    const input = signed.data.inputs[0];
    expect(input.tapScriptSig).toHaveLength(1);
    expect(Buffer.from(input.tapScriptSig[0].pubkey)).toEqual(seller);
    expect(input.tapScriptSig[0].signature[64]).toBe(131);
    expect(
      signed.validateSignaturesOfInput(0, (pubkey, msghash, signature) =>
        ecc.verifySchnorr(msghash, pubkey, signature)
      )
    ).toBe(true);
  });

  it("hands back ord.net's PSBT with nothing changed but the signature", async () => {
    // ord.net refused the first signed escrows at submit: "Signed PSBT input
    // 0 field tapLeafScript does not match preflight".
    const privateKey = keyFrom('escrow-submit-seller');
    const seller = outputKeyOf(privateKey);
    const preflight = bareEscrowPsbt(buildEscrow(seller, seller).output);

    const result = await signPsbtWithProxyWallet(
      withEscrowLeafScripts(preflight, privateKey, 'mainnet', [0]),
      privateKey,
      'mainnet',
      {
        finalize: false,
        inputSigningInstructions: [{ signingIndexes: [0], sigHash: 131 }],
      }
    );
    const submitted = bitcoin.Psbt.fromBase64(
      withOnlySignatures(preflight, result.base64)
    );

    const input = submitted.data.inputs[0];
    expect(input.tapLeafScript).toBeUndefined();
    expect(input.tapInternalKey).toBeUndefined();
    expect(input.sighashType).toBeUndefined();
    expect(input.tapScriptSig).toHaveLength(1);
    expect(input.tapScriptSig[0].signature[64]).toBe(131);

    // Every other field is byte for byte what ord.net sent.
    delete input.tapScriptSig;
    expect(submitted.toBase64()).toBe(preflight);

    // And the signature still verifies against the escrow leaf.
    const leafHash = Buffer.from(
      bitcoin.payments.p2tr({
        internalPubkey: seller,
        scriptTree: { output: buildEscrow(seller, seller).leafScript },
      }).hash
    );
    const signed = bitcoin.Psbt.fromBase64(result.base64);
    const sig = signed.data.inputs[0].tapScriptSig[0];
    expect(Buffer.from(sig.leafHash)).toEqual(leafHash);
  });

  it('keeps a tapInternalKey ord.net already declared', () => {
    const privateKey = keyFrom('escrow-rebuild-declared');
    const seller = outputKeyOf(privateKey);
    const unsigned = bareEscrowPsbt(buildEscrow(seller, seller).output, {
      tapInternalKey: seller,
    });
    const repaired = bitcoin.Psbt.fromBase64(
      withEscrowLeafScripts(unsigned, privateKey, 'mainnet', [0])
    );
    expect(repaired.data.inputs[0].tapLeafScript).toHaveLength(1);
    expect(Buffer.from(repaired.data.inputs[0].tapInternalKey)).toEqual(seller);
  });

  it("leaves another wallet's escrow exactly as it was", () => {
    const theirs = outputKeyOf(keyFrom('escrow-rebuild-someone-else'));
    const unsigned = bareEscrowPsbt(buildEscrow(theirs, theirs).output);
    expect(
      withEscrowLeafScripts(
        unsigned,
        keyFrom('escrow-rebuild-seller'),
        'mainnet',
        [0]
      )
    ).toBe(unsigned);
  });

  it('names who an input spends from', () => {
    const privateKey = keyFrom('escrow-rebuild-owner');
    const address = deriveAddressFromPrivateKey(privateKey);
    const owners = inputOwners(
      bareEscrowPsbt(bitcoin.address.toOutputScript(address)),
      [0]
    );
    expect(owners.get(0)).toBe(address);
  });
});
