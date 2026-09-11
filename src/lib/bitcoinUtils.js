import * as bitcoin from 'bitcoinjs-lib';
import { networks, initEccLib } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as btc from '@scure/btc-signer';
import * as secp from '@noble/curves/secp256k1.js';
import { base64, hex } from '@scure/base';

// Extract schnorr from the secp256k1 module
const schnorr = secp.schnorr;

// Initialize ECC library for bitcoinjs-lib v7 (required for browser environments)
initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

/**
 * Derive public key from private key using ECPair (consistent with signing method)
 * This ensures the public key matches what will be used for signing
 * @param {string} privateKeyHex - Private key as hex string
 * @param {string} network - Network type: 'mainnet', 'testnet', or 'signet' (default: 'mainnet')
 * @returns {string} Public key as hex string (compressed format)
 */
export const derivePublicKeyFromPrivateKey = (
  privateKeyHex,
  network = 'mainnet'
) => {
  if (!privateKeyHex) {
    throw new Error('Private key is required');
  }

  // Normalize private key to ensure it's exactly 32 bytes (64 hex characters)
  let normalizedPrivateKeyHex = privateKeyHex.trim();
  if (normalizedPrivateKeyHex.length > 64) {
    normalizedPrivateKeyHex = normalizedPrivateKeyHex.substring(0, 64);
  } else if (normalizedPrivateKeyHex.length < 64) {
    normalizedPrivateKeyHex = normalizedPrivateKeyHex.padStart(64, '0');
  }

  // Determine network
  let networkConfig;
  switch (network.toLowerCase()) {
    case 'testnet':
      networkConfig = networks.testnet;
      break;
    case 'signet':
      networkConfig = networks.testnet; // Signet uses testnet network config
      break;
    case 'mainnet':
    default:
      networkConfig = networks.bitcoin;
      break;
  }

  // Convert private key hex to Buffer
  const privateKeyBuffer = Buffer.from(normalizedPrivateKeyHex, 'hex');

  // Validate private key length
  if (privateKeyBuffer.length !== 32) {
    throw new Error(
      'Invalid private key length. Must be 32 bytes (64 hex characters)'
    );
  }

  // Create ECPair from private key
  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, {
    network: networkConfig,
  });

  // Return public key as hex string (compressed format)
  return keyPair.publicKey.toString('hex');
};

/**
 * Generate P2TR address from public key
 * This is exported so it can be used to regenerate addresses when public keys are derived
 * @param {string} publicKeyHex - Public key as hex string (compressed format)
 * @returns {string} P2TR address
 */
export const generateAddressFromPublicKey = (publicKeyHex) => {
  // Use P2TR address generation (same as wallet generation)
  return generateP2TRAddress(publicKeyHex);
};

/**
 * Generate deterministic wallets using a signature as seed
 * @param {string} walletSignature - The signature from the connected wallet
 * @param {number} count - Number of wallets to generate (default: 10)
 * @returns {Promise<Array>} Array of wallet objects with privateKey, publicKey, and address
 */
export const generateDeterministicWallets = async (
  walletSignature,
  count = 10
) => {
  // Starting wallet generation

  if (!walletSignature) {
    throw new Error('Wallet signature is required');
  }

  const wallets = [];

  // Creating seed from signature
  // Create a deterministic seed from the wallet signature
  const seed = await createSeedFromSignature(walletSignature);
  // Seed created successfully

  for (let i = 0; i < count; i++) {
    // Generating wallet

    // Deriving private key
    // Generate deterministic private key using the seed and index
    const privateKeyHex = await derivePrivateKey(seed, i);
    // Private key derived

    // Generating public key
    // Generate public key from private key using ECPair (same method used for signing)
    // This ensures consistency between wallet generation and signing
    const publicKeyHex = derivePublicKeyFromPrivateKey(
      privateKeyHex,
      'mainnet'
    );
    // Public key generated using ECPair (matches signing method)

    // Generating addresses
    // Generate different types of Bitcoin addresses
    const p2pkhAddress = generateP2PKHAddress(publicKeyHex);
    // P2PKH address generated

    const p2wpkhAddress = generateP2WPKHAddress(publicKeyHex);
    // P2WPKH address generated

    const p2trAddress = generateP2TRAddress(publicKeyHex);
    // P2TR address generated

    const wallet = {
      index: i,
      privateKey: privateKeyHex,
      publicKey: publicKeyHex,
      addresses: {
        p2pkh: p2pkhAddress,
        p2wpkh: p2wpkhAddress,
        p2tr: p2trAddress,
      },
      // Use P2TR as the primary address (most modern)
      address: p2trAddress,
    };

    wallets.push(wallet);
    // Wallet completed successfully
  }

  // All wallets generated successfully
  return wallets;
};

/**
 * Create a deterministic seed from wallet signature
 * @param {string} signature - Wallet signature
 * @returns {Promise<Uint8Array>} Seed bytes
 */
const createSeedFromSignature = async (signature) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(signature);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
};

/**
 * Derive a private key from seed and index
 * @param {Uint8Array} seed - Seed bytes
 * @param {number} index - Index for derivation
 * @returns {Promise<string>} Private key as hex string
 */
const derivePrivateKey = async (seed, index) => {
  const encoder = new TextEncoder();
  const indexData = encoder.encode(index.toString());

  // Combine seed with index
  const combined = new Uint8Array(seed.length + indexData.length);
  combined.set(seed);
  combined.set(indexData, seed.length);

  // Hash the combined data
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  let privateKeyHex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Ensure the private key is 64 characters (32 bytes)
  if (privateKeyHex.length > 64) {
    privateKeyHex = privateKeyHex.substring(0, 64);
  } else {
    privateKeyHex = privateKeyHex.padStart(64, '0');
  }

  return privateKeyHex;
};

/**
 * Generate public key from private key using Web Crypto API
 * @param {string} privateKeyHex - Private key as hex string
 * @returns {Promise<string>} Public key as hex string
 */
const privateKeyToPublicKey = async (privateKeyHex) => {
  // Converting private key to BigInt
  // Convert hex private key to BigInt
  const privateKey = BigInt('0x' + privateKeyHex);
  // Private key converted

  // Setting up curve parameters
  // Secp256k1 curve parameters
  const p = BigInt(
    '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'
  );
  const a = BigInt(0);
  const b = BigInt(7);
  const Gx = BigInt(
    '0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'
  );
  const Gy = BigInt(
    '0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'
  );
  // Curve parameters set

  // Starting point multiplication
  // Point multiplication: publicKey = privateKey * G
  const publicKey = pointMultiply(privateKey, Gx, Gy, p, a, b);
  // Point multiplication completed

  // Compressing public key
  // Compress the public key
  const compressedPublicKey = compressPublicKey(publicKey.x, publicKey.y);
  // Public key compressed

  return compressedPublicKey;
};

// Point multiplication for elliptic curve (optimized with binary method)
const pointMultiply = (k, Gx, Gy, p, a, b) => {
  // Point multiplication starting

  if (k === BigInt(0)) {
    // k is zero, returning zero point
    return { x: BigInt(0), y: BigInt(0) };
  }

  // Use binary method for much faster point multiplication
  let result = { x: BigInt(0), y: BigInt(0) }; // Point at infinity
  let addend = { x: Gx, y: Gy };
  let kCopy = k;
  let iterationCount = 0;

  while (kCopy > BigInt(0)) {
    iterationCount++;

    if (iterationCount > 256) {
      // Safety limit for 256-bit keys
      // Safety limit reached
      throw new Error(
        `Point multiplication exceeded safety limit of 256 iterations`
      );
    }

    if (kCopy % BigInt(2) === BigInt(1)) {
      result = pointAdd(result.x, result.y, addend.x, addend.y, p, a, b);
    }

    addend = pointDouble(addend.x, addend.y, p, a, b);
    kCopy = kCopy / BigInt(2);
  }

  // Point multiplication completed
  return result;
};

// Point addition on elliptic curve
const pointAdd = (x1, y1, x2, y2, p, a, b) => {
  if (x1 === BigInt(0) && y1 === BigInt(0)) {
    return { x: x2, y: y2 };
  }
  if (x2 === BigInt(0) && y2 === BigInt(0)) {
    return { x: x1, y: y1 };
  }
  if (x1 === x2 && y1 === y2) {
    return pointDouble(x1, y1, p, a, b);
  }
  if (x1 === x2) {
    return { x: BigInt(0), y: BigInt(0) }; // Point at infinity
  }

  const slope = ((y2 - y1) * modInverse(x2 - x1, p)) % p;
  const x3 = (slope * slope - x1 - x2) % p;
  const y3 = (slope * (x1 - x3) - y1) % p;

  return { x: x3 < BigInt(0) ? x3 + p : x3, y: y3 < BigInt(0) ? y3 + p : y3 };
};

// Point doubling on elliptic curve
const pointDouble = (x, y, p, a) => {
  const slope = ((BigInt(3) * x * x + a) * modInverse(BigInt(2) * y, p)) % p;
  const x3 = (slope * slope - BigInt(2) * x) % p;
  const y3 = (slope * (x - x3) - y) % p;

  return { x: x3 < BigInt(0) ? x3 + p : x3, y: y3 < BigInt(0) ? y3 + p : y3 };
};

// Modular inverse using Extended Euclidean Algorithm
const modInverse = (a, m) => {
  let [oldR, r] = [a, m];
  let [oldS, s] = [BigInt(1), BigInt(0)];

  while (r !== BigInt(0)) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return oldS < BigInt(0) ? oldS + m : oldS;
};

// Compress public key
const compressPublicKey = (x, y) => {
  const prefix = y % BigInt(2) === BigInt(0) ? '02' : '03';
  const xHex = x.toString(16).padStart(64, '0');
  return prefix + xHex;
};

/**
 * Generate P2PKH (Legacy) address
 * @param {string} publicKeyHex - Public key as hex string
 * @returns {string} P2PKH address
 */
const generateP2PKHAddress = (publicKeyHex) => {
  try {
    // Convert hex to Buffer-like object for bitcoinjs-lib
    const publicKeyBuffer = hexToUint8Array(publicKeyHex);
    const { address } = bitcoin.payments.p2pkh({
      pubkey: publicKeyBuffer,
    });
    return address;
  } catch {
    // P2PKH generation failed
    return 'Error generating P2PKH address';
  }
};

/**
 * Generate P2WPKH (Native SegWit) address
 * @param {string} publicKeyHex - Public key as hex string
 * @returns {string} P2WPKH address
 */
const generateP2WPKHAddress = (publicKeyHex) => {
  try {
    const publicKeyBuffer = hexToUint8Array(publicKeyHex);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
    });
    return address;
  } catch {
    // P2WPKH generation failed
    return 'Error generating P2WPKH address';
  }
};

/**
 * Generate P2TR (Taproot) address
 * @param {string} publicKeyHex - Public key as hex string (compressed format: 0x02/0x03 + 32-byte x-coordinate)
 * @returns {string} P2TR address
 */
const generateP2TRAddress = (publicKeyHex) => {
  try {
    // For P2TR (Taproot), we need the x-only public key (32 bytes, without the compression prefix)
    // Compressed public key format: [0x02 or 0x03][32-byte x-coordinate]
    // Taproot uses only the x-coordinate (x-only format)

    // Convert hex string to Buffer (bitcoinjs-lib expects Buffer)
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

    // Validate public key length (should be 33 bytes for compressed format)
    if (publicKeyBuffer.length !== 33) {
      throw new Error(
        `Invalid public key length for P2TR: expected 33 bytes (compressed), got ${publicKeyBuffer.length} bytes`
      );
    }

    // Extract x-only public key (remove the first byte which is the compression flag 0x02 or 0x03)
    // This gives us the 32-byte x-coordinate needed for Taproot
    const xOnlyPubkey = publicKeyBuffer.slice(1, 33);

    // Validate x-only pubkey length (should be exactly 32 bytes)
    if (xOnlyPubkey.length !== 32) {
      throw new Error(
        `Invalid x-only pubkey length: expected 32 bytes, got ${xOnlyPubkey.length} bytes`
      );
    }

    // Generate P2TR address using internalPubkey (correct parameter for Taproot)
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: xOnlyPubkey,
    });

    if (!address) {
      throw new Error('Failed to generate P2TR address');
    }

    return address;
  } catch (err) {
    console.error('Error generating P2TR address:', err);
    // P2TR generation failed, falling back to P2WPKH
    console.warn('Falling back to P2WPKH address generation');
    return generateP2WPKHAddress(publicKeyHex);
  }
};

/**
 * Convert hex string to Uint8Array (Buffer-like object)
 * @param {string} hex - Hex string
 * @returns {Uint8Array} Uint8Array representation
 */
const hexToUint8Array = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

/**
 * Generate a random Bitcoin address for testing
 * @returns {Promise<Object>} Random wallet object
 */
export const generateRandomWallet = async () => {
  // Generate a random private key
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const privateKeyHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate public key
  const publicKeyHex = await privateKeyToPublicKey(privateKeyHex);

  return {
    privateKey: privateKeyHex,
    publicKey: publicKeyHex,
    addresses: {
      p2pkh: generateP2PKHAddress(publicKeyHex),
      p2wpkh: generateP2WPKHAddress(publicKeyHex),
      p2tr: generateP2TRAddress(publicKeyHex),
    },
    address: generateP2TRAddress(publicKeyHex),
  };
};

/**
 * Normalize proxy-wallet private key hex to exactly 32 bytes (64 hex chars).
 * Truncates if longer (same as legacy callers); pads left if shorter.
 */
export const normalizePrivateKeyHex = (privateKeyHex) => {
  let normalized = String(privateKeyHex || '').trim();
  if (normalized.length > 64) normalized = normalized.substring(0, 64);
  else if (normalized.length < 64) normalized = normalized.padStart(64, '0');
  return normalized;
};

/**
 * BIP340 x-only internal pubkey (32 bytes) for Taproot / PSBT tapInternalKey.
 * Must stay in sync with deriveAddressFromPrivateKey and signPsbtWithProxyWallet.
 */
export const getTaprootInternalPubkeyBytes = (privateKeyHex) => {
  const privateKeyBytes = hex.decode(normalizePrivateKeyHex(privateKeyHex));
  return schnorr.getPublicKey(privateKeyBytes);
};

/**
 * Derive Taproot address directly from a private key
 * @param {string} privateKeyHex - The private key in hex format
 * @param {string} network - Network type ('mainnet', 'testnet', or 'signet')
 * @returns {string} The derived Taproot (P2TR) address
 */
export const deriveAddressFromPrivateKey = (
  privateKeyHex,
  network = 'mainnet'
) => {
  // Determine network config for @scure/btc-signer
  let networkConfig;
  switch (network.toLowerCase()) {
    case 'testnet':
    case 'signet':
      networkConfig = btc.TEST_NETWORK;
      break;
    case 'mainnet':
    default:
      networkConfig = btc.NETWORK;
      break;
  }

  const internalPubkey = getTaprootInternalPubkeyBytes(privateKeyHex);
  const p2tr = btc.p2tr(internalPubkey, undefined, networkConfig);
  return p2tr.address;
};

/**
 * Sign a PSBT using a proxy wallet's private key (using @scure/btc-signer for Taproot)
 * @param {string} psbtBase64 - The unsigned PSBT in base64 format
 * @param {string} privateKeyHex - The private key as hex string
 * @param {string} network - Network type: 'mainnet', 'testnet', or 'signet' (default: 'mainnet')
 * @param {Object} options - Signing options
 * @param {boolean} options.finalize - Whether to finalize the PSBT (default: true)
 * @param {boolean} options.extractTx - Whether to extract the transaction (default: false)
 * @param {string} options.expectedPublicKey - Optional: Expected public key hex to validate against (for debugging)
 * @param {string} options.walletAddress - Optional: Wallet address to match against UTXO addresses
 * @returns {Promise<Object>} Signed PSBT result with base64 and/or hex
 */
/** Check if the environment has Web Crypto available (required for PSBT signing in browser). */
const isSecureContextAvailable = () => {
  if (typeof window === 'undefined') return true; // Node / SSR
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  return window.isSecureContext === true;
};

export const signPsbtWithProxyWallet = async (
  psbtBase64,
  privateKeyHex,
  network = 'mainnet',
  options = {}
) => {
  const {
    finalize = true,
    extractTx = false,
    walletAddress,
    inputSigningInstructions = null,
  } = options;

  if (!psbtBase64) {
    throw new Error('PSBT is required');
  }

  if (!privateKeyHex) {
    throw new Error('Private key is required');
  }

  if (!isSecureContextAvailable()) {
    throw new Error(
      'PSBT signing requires a secure context (HTTPS or localhost). ' +
        'Open the app via https:// or http://localhost (not plain HTTP on a remote host).'
    );
  }

  try {
    const normalizedPrivateKeyHex = normalizePrivateKeyHex(privateKeyHex);

    // Determine network config for @scure/btc-signer
    let networkConfig;
    switch (network.toLowerCase()) {
      case 'testnet':
      case 'signet':
        networkConfig = btc.TEST_NETWORK;
        break;
      case 'mainnet':
      default:
        networkConfig = btc.NETWORK;
        break;
    }

    const privateKeyBytes = hex.decode(normalizedPrivateKeyHex);
    const internalPubkey = getTaprootInternalPubkeyBytes(privateKeyHex);

    // Create P2TR payment to get the Taproot address
    const p2tr = btc.p2tr(internalPubkey, undefined, networkConfig);
    const derivedAddress = p2tr.address;

    // Validate address matches if provided
    if (walletAddress && derivedAddress !== walletAddress) {
      console.warn(
        `Address mismatch: Expected ${walletAddress}, got ${derivedAddress}`
      );
    }

    // Parse PSBT
    const psbtBytes = base64.decode(psbtBase64);
    const tx = btc.Transaction.fromPSBT(psbtBytes);

    const bitcoinNetwork =
      network.toLowerCase() === 'testnet' || network.toLowerCase() === 'signet'
        ? networks.testnet
        : networks.bitcoin;

    // P2TR key-path: @scure/btc-signer tx.sign() can return without throwing yet leave
    // invalid or missing BIP341 Schnorr; node then rejects with "Invalid Schnorr signature".
    let psbtHasP2trWitnessInput = false;
    try {
      const probe = bitcoin.Psbt.fromBase64(psbtBase64, {
        network: bitcoinNetwork,
      });
      for (let p = 0; p < probe.inputCount; p++) {
        const scr = probe.data.inputs[p]?.witnessUtxo?.script;
        if (scr && scr.length === 34 && scr[0] === 0x51 && scr[1] === 0x20) {
          psbtHasP2trWitnessInput = true;
          break;
        }
      }
    } catch (_) {
      /* ignore probe errors */
    }

    // Sign all inputs with private key
    let signedCount = 0;
    let signedPsbtBase64Override = null;

    try {
      // Try @scure/btc-signer first when safe; always use bitcoinjs for Taproot witness inputs.
      let useBitcoinjsLib = psbtHasP2trWitnessInput;
      let signMethodWorked = false;

      if (!useBitcoinjsLib) {
        if (!finalize) {
          // For listing PSBTs, @scure/btc-signer often fails, so use bitcoinjs-lib
          try {
            tx.sign(privateKeyBytes);
            signMethodWorked = true;
          } catch (signError) {
            useBitcoinjsLib = true;
          }
        } else {
          // For finalize flows, @scure is skipped when Taproot inputs are present (see above).
          try {
            tx.sign(privateKeyBytes);
            signMethodWorked = true;
          } catch (signError) {
            useBitcoinjsLib = true;
          }
        }
      }

      // Use bitcoinjs-lib for Taproot PSBT signing
      if (useBitcoinjsLib) {
        try {
          const { Psbt, Transaction } = bitcoin;
          const psbtForSigning = Psbt.fromBase64(psbtBase64, {
            network: bitcoinNetwork,
          });

          const sighashDefault =
            typeof Transaction.SIGHASH_DEFAULT === 'number'
              ? Transaction.SIGHASH_DEFAULT
              : 0;
          const instructionByIndex = new Map();
          if (Array.isArray(inputSigningInstructions)) {
            inputSigningInstructions.forEach((instruction) => {
              (instruction?.signingIndexes || []).forEach((index) => {
                instructionByIndex.set(index, instruction);
              });
            });
          }
          const targetIndexes =
            instructionByIndex.size > 0
              ? Array.from(instructionByIndex.keys())
              : Array.from({ length: psbtForSigning.inputCount }, (_, i) => i);

          // Fee / extract flows: every Taproot witness input must get tapKeySig or
          // finalizeAllInputs fails ("No tapleaf script signature"). Listings may be
          // mixed PSBTs — only sign matching Taproot inputs and do not require all-in.
          const strictSignAllTaprootWitness =
            finalize && extractTx && psbtHasP2trWitnessInput;

          const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyBytes), {
            network: bitcoinNetwork,
          });
          if (typeof psbtForSigning.signTaprootInput !== 'function') {
            throw new Error('signTaprootInput not available');
          }
          const tweakedSigner = keyPair.tweak(
            bitcoin.crypto.taggedHash('TapTweak', Buffer.from(internalPubkey))
          );

          if (strictSignAllTaprootWitness) {
            for (const j of targetIndexes) {
              const psbtInput = psbtForSigning.data.inputs[j];
              const wu = psbtInput.witnessUtxo;
              const scr = wu && wu.script;
              const isP2trKeyPath =
                scr &&
                scr.length === 34 &&
                scr[0] === 0x51 &&
                scr[1] === 0x20 &&
                psbtInput.tapInternalKey;

              if (!isP2trKeyPath) {
                throw new Error(
                  `Input ${j} is not a Taproot key-path witness UTXO (need witnessUtxo P2TR + tapInternalKey).`
                );
              }

              const inputTapKey = Buffer.from(psbtInput.tapInternalKey);
              const ourTapKey = Buffer.from(internalPubkey);
              if (inputTapKey.length !== 32 || !inputTapKey.equals(ourTapKey)) {
                throw new Error(
                  `Input ${j} tapInternalKey does not match this wallet; refusing to sign.`
                );
              }

              const sighashType =
                instructionByIndex.get(j)?.sigHash ??
                (psbtInput.sighashType !== undefined &&
                psbtInput.sighashType !== null
                  ? psbtInput.sighashType
                  : sighashDefault);

              const sighashTypes =
                sighashType === sighashDefault ? undefined : [sighashType];

              psbtForSigning.signTaprootInput(
                j,
                tweakedSigner,
                undefined,
                sighashTypes
              );
            }

            for (const j of targetIndexes) {
              const inp = psbtForSigning.data.inputs[j];
              const scr = inp.witnessUtxo && inp.witnessUtxo.script;
              const isP2tr =
                scr && scr.length === 34 && scr[0] === 0x51 && scr[1] === 0x20;
              if (!isP2tr) continue;
              const tks = inp.tapKeySig;
              const len = tks && tks.length;
              if (len !== 64 && len !== 65) {
                throw new Error(
                  `Taproot input ${j} is missing a key-path signature after signing (tapKeySig length ${len}).`
                );
              }
            }

            signMethodWorked = true;
            signedPsbtBase64Override = psbtForSigning.toBase64();
          } else {
            for (const j of targetIndexes) {
              try {
                const psbtInput = psbtForSigning.data.inputs[j];
                const wu = psbtInput.witnessUtxo;
                const scr = wu && wu.script;
                const isP2trKeyPath =
                  scr &&
                  scr.length === 34 &&
                  scr[0] === 0x51 &&
                  scr[1] === 0x20 &&
                  psbtInput.tapInternalKey;

                if (!isP2trKeyPath) {
                  continue;
                }

                const inputTapKey = Buffer.from(psbtInput.tapInternalKey);
                const ourTapKey = Buffer.from(internalPubkey);
                if (
                  inputTapKey.length !== 32 ||
                  !inputTapKey.equals(ourTapKey)
                ) {
                  continue;
                }

                const sighashType =
                  instructionByIndex.get(j)?.sigHash ??
                  (psbtInput.sighashType !== undefined &&
                  psbtInput.sighashType !== null
                    ? psbtInput.sighashType
                    : sighashDefault);

                const sighashTypes =
                  sighashType === sighashDefault ? undefined : [sighashType];

                psbtForSigning.signTaprootInput(
                  j,
                  tweakedSigner,
                  undefined,
                  sighashTypes
                );
                signMethodWorked = true;
              } catch (inputErr) {
                console.error(`Error signing input ${j}:`, inputErr.message);
              }
            }

            if (signMethodWorked) {
              signedPsbtBase64Override = psbtForSigning.toBase64();
            }
          }
        } catch (signErr) {
          console.error('Signing failed:', signErr.message);
          throw signErr;
        }
      }

      // Verify signing results
      if (signedPsbtBase64Override) {
        const { Psbt } = bitcoin;
        const signedPsbt = Psbt.fromBase64(signedPsbtBase64Override, {
          network: bitcoinNetwork,
        });

        for (let i = 0; i < signedPsbt.inputCount; i++) {
          const psbtInput = signedPsbt.data.inputs[i];
          const tks = psbtInput.tapKeySig;
          const tapSigLen = tks && tks.length;
          if (tapSigLen === 64 || tapSigLen === 65 || psbtInput.partialSig) {
            signedCount++;
          }
        }
      } else {
        // Verify @scure/btc-signer signing
        for (let i = 0; i < tx.inputsLength; i++) {
          const input = tx.getInput(i);
          if (input.tapKeySig || input.partialSig) {
            signedCount++;
          }
        }
      }
    } catch (signErr) {
      console.error('Failed to sign transaction:', signErr.message);
    }

    if (signedCount === 0) {
      throw new Error(
        'No inputs could be signed. The PSBT may have been created for a different address.'
      );
    }

    // Finalize and optionally extract: use the same object we signed to avoid "unknown input"
    if (finalize && signedPsbtBase64Override) {
      // We signed with bitcoinjs-lib; finalize and extract with bitcoinjs to avoid
      // calling tx.finalize() on the @scure/btc-signer tx which wasn't updated with our sigs
      try {
        const { Psbt } = bitcoin;
        const signedPsbt = Psbt.fromBase64(signedPsbtBase64Override, {
          network: bitcoinNetwork,
        });
        signedPsbt.finalizeAllInputs();
        if (extractTx) {
          const extractedTx = signedPsbt.extractTransaction();
          const txHex =
            typeof extractedTx.toHex === 'function'
              ? extractedTx.toHex()
              : Buffer.from(extractedTx.toBuffer()).toString('hex');
          return {
            base64: signedPsbt.toBase64(),
            hex: txHex,
          };
        }
        return {
          base64: signedPsbt.toBase64(),
        };
      } catch (finalizeErr) {
        console.error('Finalize (bitcoinjs) failed:', finalizeErr.message);
        throw new Error(`Failed to finalize PSBT: ${finalizeErr.message}`);
      }
    }

    if (finalize && !signedPsbtBase64Override) {
      tx.finalize();
    }

    // Return results
    if (extractTx && finalize && !signedPsbtBase64Override) {
      return {
        base64: base64.encode(tx.toPSBT()),
        hex: tx.hex,
      };
    }

    // Return signed PSBT (use bitcoinjs-lib version if available)
    const psbtBase64Result =
      signedPsbtBase64Override || base64.encode(tx.toPSBT());
    const result = { base64: psbtBase64Result };
    if (extractTx && finalize && tx.hex) {
      result.hex = tx.hex;
    }
    return result;
  } catch (err) {
    console.error('Error signing PSBT:', err.message);
    const msg = err && err.message ? String(err.message) : '';
    if (/secure context|Secure context|crypto\.subtle/i.test(msg)) {
      throw new Error(
        'PSBT signing requires a secure context (HTTPS or localhost). ' +
          'Open the app via https:// or http://localhost (not plain HTTP on a remote host).'
      );
    }
    throw new Error(`Failed to sign PSBT: ${msg}`);
  }
};
