import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  getTaprootInternalPubkeyBytes,
  normalizePrivateKeyHex,
} from '../../lib/bitcoinUtils';

const ECPair = ECPairFactory(ecc);

/*
 * ord.net's listing escrow, and how a proxy wallet proves it can sign one.
 *
 * Step 0 of a listing moves the inscription into an escrow output, and step 1
 * and the recovery PSBT spend that escrow. The escrow is script-path only in
 * practice:
 *
 *   P2TR(internal key = seller's output key,
 *        leaf = <seller> CHECKSIG <ord.net> CHECKSIGADD 2 NUMEQUAL)
 *
 * The signer needs the leaf (`tapLeafScript`) on the input to sign it, and
 * ord.net does not reliably send one. Without it the escrow is just a P2TR
 * output whose key is not the wallet's, so signing fails with "input 0
 * belongs to bc1p…": the escrow's own address, which looks like a stranger's
 * wallet.
 *
 * Every escrow that ord.net has settled on mainnet uses the same co-signing
 * key (29 of 29 read off the settlements paying its fee address, e.g.
 * c2067d51…e51b input 2). So the leaf can be rebuilt from the wallet's key,
 * and it is only ever used when it hashes to the exact output being spent.
 * A rebuilt leaf that does not match changes nothing. If ord.net rotates the
 * key, signing fails as before instead of signing something else.
 */
export const ORDNET_ESCROW_COSIGNER_KEY =
  'd2dc3222298e2a5f4e1c7d702fae2bcf7821cc0a095a478b95c62195b0df7398';

const LEAF_VERSION_TAPSCRIPT = 0xc0;

const bitcoinNetworkFor = (network) =>
  ['testnet', 'signet'].includes(String(network).toLowerCase())
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin;

/** The escrow leaf for a given seller key. */
export const escrowLeafScript = (sellerXOnly) =>
  Buffer.from(
    bitcoin.script.compile([
      Buffer.from(sellerXOnly),
      bitcoin.opcodes.OP_CHECKSIG,
      Buffer.from(ORDNET_ESCROW_COSIGNER_KEY, 'hex'),
      bitcoin.opcodes.OP_CHECKSIGADD,
      bitcoin.opcodes.OP_2,
      bitcoin.opcodes.OP_NUMEQUAL,
    ])
  );

/** The escrow output, and the control block that spends its one leaf. */
export const buildEscrow = (
  internalXOnly,
  sellerXOnly,
  network = 'mainnet'
) => {
  const leaf = escrowLeafScript(sellerXOnly);
  const payment = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(internalXOnly),
    scriptTree: { output: leaf },
    redeem: { output: leaf, redeemVersion: LEAF_VERSION_TAPSCRIPT },
    network: bitcoinNetworkFor(network),
  });
  return {
    output: Buffer.from(payment.output),
    leafScript: leaf,
    controlBlock: Buffer.from(payment.witness[payment.witness.length - 1]),
  };
};

/** The wallet's two Taproot keys: the address's output key, then the raw one. */
const walletTaprootKeys = (privateKeyHex, network) => {
  const internal = Buffer.from(getTaprootInternalPubkeyBytes(privateKeyHex));
  const output = Buffer.from(
    bitcoin.payments.p2tr({
      internalPubkey: internal,
      network: bitcoinNetworkFor(network),
    }).pubkey
  );
  return [output, internal];
};

/**
 * Which of this wallet's escrows a PSBT input spends, if any: the seller key
 * in the leaf and the internal key that rebuild its exact prevout. ord.net
 * uses the output key for both, but the match is what decides.
 */
const matchEscrow = (input, keys, network) => {
  const prevout = input?.witnessUtxo?.script;
  if (!prevout) return null;
  const declaredInternal = input.tapInternalKey
    ? Buffer.from(input.tapInternalKey)
    : null;
  for (const seller of keys) {
    for (const internal of keys) {
      if (declaredInternal && !declaredInternal.equals(internal)) continue;
      const escrow = buildEscrow(internal, seller, network);
      if (escrow.output.equals(Buffer.from(prevout))) {
        return { seller, internal, escrow };
      }
    }
  }
  return null;
};

/**
 * Fill in the escrow leaf on any of `indexes` that spends an ord.net escrow
 * of this wallet's and arrived without one. Returns the PSBT unchanged when
 * there is nothing to add, so it never rewrites what it cannot prove.
 */
export const withEscrowLeafScripts = (
  psbtBase64,
  privateKeyHex,
  network = 'mainnet',
  indexes = []
) => {
  let psbt;
  try {
    psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
      network: bitcoinNetworkFor(network),
    });
  } catch {
    return psbtBase64;
  }

  const keys = walletTaprootKeys(privateKeyHex, network);
  let changed = false;

  for (const index of new Set(indexes)) {
    const input = psbt.data.inputs[index];
    const prevout = input?.witnessUtxo?.script;
    if (!prevout || input.tapLeafScript?.length) continue;

    const match = matchEscrow(input, keys, network);
    if (!match) continue;

    psbt.updateInput(index, {
      ...(input.tapInternalKey ? {} : { tapInternalKey: match.internal }),
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: match.escrow.leafScript,
          controlBlock: match.escrow.controlBlock,
        },
      ],
    });
    changed = true;
  }

  return changed ? psbt.toBase64() : psbtBase64;
};

/**
 * Who each of `indexes` spends from, by address, for error messages and the
 * stale-index check. Inputs whose prevout cannot be read are left out.
 */
export const inputOwners = (psbtBase64, indexes = [], network = 'mainnet') => {
  const owners = new Map();
  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
      network: bitcoinNetworkFor(network),
    });
    for (const index of new Set(indexes)) {
      const script = psbt.data.inputs[index]?.witnessUtxo?.script;
      if (!script) continue;
      try {
        owners.set(
          index,
          bitcoin.address.fromOutputScript(script, bitcoinNetworkFor(network))
        );
      } catch {
        // A script with no address form; nothing to report.
      }
    }
  } catch {
    // Unparseable PSBT; the signer reports that itself.
  }
  return owners;
};

/**
 * ord.net's PSBT as it sent it, plus the signatures from `signedBase64`.
 *
 * ord.net checks each signed input field by field against its preflight and
 * refuses anything else that changed ("Signed PSBT input 0 field
 * tapLeafScript does not match preflight"). Signing writes more than the
 * signature: the leaf filled in above, a tapInternalKey, an instructed
 * sighashType. None of it is needed once signed (a Schnorr signature carries
 * its sighash byte, and ord.net holds the leaf), so only signatures are
 * carried back.
 */
export const withOnlySignatures = (
  originalBase64,
  signedBase64,
  network = 'mainnet'
) => {
  const options = { network: bitcoinNetworkFor(network) };
  const original = bitcoin.Psbt.fromBase64(originalBase64, options);
  const signed = bitcoin.Psbt.fromBase64(signedBase64, options);
  if (original.inputCount !== signed.inputCount) {
    throw new Error('Signing changed the number of PSBT inputs');
  }
  signed.data.inputs.forEach((input, index) => {
    const before = original.data.inputs[index];
    const update = {};
    if (input.tapKeySig && !before.tapKeySig)
      update.tapKeySig = input.tapKeySig;
    const sameScriptSig = (a, b) =>
      Buffer.from(a.pubkey).equals(Buffer.from(b.pubkey)) &&
      Buffer.from(a.leafHash).equals(Buffer.from(b.leafHash));
    const newScriptSigs = (input.tapScriptSig || []).filter(
      (sig) => !(before.tapScriptSig || []).some((b) => sameScriptSig(sig, b))
    );
    if (newScriptSigs.length) update.tapScriptSig = newScriptSigs;
    const newPartialSigs = (input.partialSig || []).filter(
      (sig) =>
        !(before.partialSig || []).some((b) =>
          Buffer.from(b.pubkey).equals(Buffer.from(sig.pubkey))
        )
    );
    if (newPartialSigs.length) update.partialSig = newPartialSigs;
    if (Object.keys(update).length) original.updateInput(index, update);
  });
  return original.toBase64();
};

/**
 * Sign this wallet's escrow inputs by key path, as ord.net requires of the
 * recovery PSBT ("Listing recovery input must contain only a key-path
 * signature").
 *
 * Recovery is how the seller takes the inscription back alone, so it spends
 * the escrow without ord.net's co-signature. The escrow's internal key is
 * one of the wallet's own keys, so the wallet can: its key tweaked once more
 * by the escrow's script tree is the escrow's output key. Each input is only
 * signed when that key is exactly the prevout's.
 *
 * @returns {{ psbtBase64: string, signed: number[] }} the PSBT and the
 *   indexes signed here; other indexes are left for the ordinary signer.
 */
export const signEscrowKeyPath = (
  psbtBase64,
  privateKeyHex,
  network = 'mainnet',
  instructions = []
) => {
  const net = bitcoinNetworkFor(network);
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: net });
  const keys = walletTaprootKeys(privateKeyHex, network);
  const [outputKey, internalKey] = keys;

  const keyPair = ECPair.fromPrivateKey(
    Buffer.from(normalizePrivateKeyHex(privateKeyHex), 'hex'),
    { network: net }
  );
  const tweaked = keyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', internalKey)
  );
  const signerFor = (xOnly) =>
    xOnly.equals(outputKey)
      ? tweaked
      : xOnly.equals(internalKey)
        ? keyPair
        : null;

  const signed = [];
  for (const instruction of instructions || []) {
    for (const index of instruction?.signingIndexes || []) {
      const input = psbt.data.inputs[index];
      const match = matchEscrow(input, keys, network);
      const base = match && signerFor(match.internal);
      if (!base) continue;

      const merkleRoot = Buffer.from(
        bitcoin.payments.p2tr({
          internalPubkey: match.internal,
          scriptTree: { output: match.escrow.leafScript },
          network: net,
        }).hash
      );
      const escrowSigner = base.tweak(
        bitcoin.crypto.taggedHash(
          'TapTweak',
          Buffer.concat([match.internal, merkleRoot])
        )
      );
      if (
        !Buffer.from(escrowSigner.publicKey)
          .subarray(1, 33)
          .equals(Buffer.from(input.witnessUtxo.script).subarray(2, 34))
      ) {
        throw new Error(
          `Input ${index}: the escrow key-path key does not match its output`
        );
      }

      psbt.updateInput(index, {
        ...(input.tapInternalKey ? {} : { tapInternalKey: match.internal }),
        ...(input.tapMerkleRoot ? {} : { tapMerkleRoot: merkleRoot }),
      });
      const sigHash = instruction.sigHash;
      if (sigHash && input.sighashType !== sigHash) {
        psbt.updateInput(index, { sighashType: sigHash });
      }
      psbt.signTaprootInput(
        index,
        escrowSigner,
        undefined,
        sigHash ? [sigHash] : undefined
      );
      if (!psbt.data.inputs[index].tapKeySig) {
        throw new Error(`Input ${index}: no key-path signature was produced`);
      }
      signed.push(index);
    }
  }
  return { psbtBase64: psbt.toBase64(), signed };
};
