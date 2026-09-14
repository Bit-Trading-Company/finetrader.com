/**
 * Verify the signing assumptions ord.net's API rests on.
 *
 *   node scripts/verify-ordnet-signing.mjs
 *
 * Run this before trusting a release with real funds, and after any bump of
 * bip322-js, bitcoinjs-lib, ecpair or the secp256k1 binding.
 *
 * Why a script and not a Jest test: bip322-js pins bitcoinjs-lib 6 in its own
 * node_modules while this app is on 7. CRA's Jest resolver flattens module
 * resolution, so under Jest the library receives the app's version 7 and
 * fails with "No inputs were signed". Webpack and Node both resolve the
 * nested copy correctly, so the shipped code path is fine — the failure is
 * the test environment, not the signing. This script runs on plain Node,
 * which resolves it the way the browser bundle does.
 *
 * The PSBT signing rules (sigHash, disableTweakSigner) are covered by real
 * unit tests in src/lib/bitcoinUtils.test.js; only the BIP-322 auth path
 * needs this escape hatch.
 */
import { createHash } from 'node:crypto';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import ecpair from 'ecpair';
import { Signer, Verifier } from 'bip322-js';

bitcoin.initEccLib(ecc);
const ECPairFactory = ecpair.ECPairFactory || ecpair.default || ecpair;
const ECPair = ECPairFactory(ecc);

/** The conversion src/trading/ordnet/ordnetTrading.js applies before sending. */
const base64ToHex = (value) =>
  Array.from(atob(value))
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

const taprootWallet = (label) => {
  const keyPair = ECPair.fromPrivateKey(
    createHash('sha256').update(label).digest(),
    { network: bitcoin.networks.bitcoin }
  );
  const internalPubkey = Buffer.from(keyPair.publicKey).subarray(1, 33);
  const { address } = bitcoin.payments.p2tr({
    internalPubkey,
    network: bitcoin.networks.bitcoin,
  });
  return { wif: keyPair.toWIF(), address };
};

const CHALLENGE =
  'Sign in to ord.net at 2026-09-14T12:00:00Z (nonce: 0123456789abcdef)';

const checks = [];
const check = (name, passed, detail = '') =>
  checks.push({ name, passed, detail });

const signer = taprootWallet('ordnet-auth');
const other = taprootWallet('ordnet-auth-other');
const signature = String(Signer.sign(signer.wif, signer.address, CHALLENGE));
const hex = base64ToHex(signature);

check(
  'proxy wallet address is taproot',
  signer.address.startsWith('bc1p'),
  signer.address
);
check(
  'signature verifies for the signing address',
  Verifier.verifySignature(signer.address, CHALLENGE, signature)
);
check(
  'signature does not verify for another address',
  Verifier.verifySignature(other.address, CHALLENGE, signature) === false
);
check(
  'signature does not verify for a tampered message',
  Verifier.verifySignature(
    signer.address,
    `${CHALLENGE} tampered`,
    signature
  ) === false
);
check(
  'base64 -> hex is byte-for-byte reversible',
  Buffer.from(hex, 'hex').toString('base64') === signature
);
check('hex is lowercase hex', /^[0-9a-f]+$/.test(hex));
check(
  'hex fits ord.net’s 8192-character cap',
  hex.length < 8192,
  `${hex.length} chars`
);

let failed = 0;
for (const { name, passed, detail } of checks) {
  if (!passed) failed += 1;
  console.log(
    `${passed ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`
  );
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
