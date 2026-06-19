import React, { createContext, useContext, useState } from 'react';

// Extend Window interface to include bitprint
declare global {
  interface Window {
    bitprint?: {
      isDisconnected: boolean;
      disconnect: () => void;
    };
  }
}

const bp = {
  wallet: {},
  assets: {},
  markets: {},
  contracts: {},
  isDisconnected:
    typeof window !== 'undefined'
      ? localStorage.getItem('wallet-disconnected') === 'true'
      : false,
  disconnect() {
    try {
      this.wallet = {};
      this.isDisconnected = true;
      // Store disconnect state in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet-disconnected', 'true');
      }
      // Wallet disconnected
    } catch {
      // Error during disconnect
    }
  },
  async generateDeterministicWallets(
    walletSignature: string,
    count: number = 50
  ): Promise<
    Array<{
      index: number;
      privateKey: string;
      address: string;
      publicKey: string;
    }>
  > {
    if (!walletSignature) {
      throw new Error('Wallet signature is required');
    }

    const wallets: Array<{
      index: number;
      privateKey: string;
      address: string;
      publicKey: string;
    }> = [];

    // Create a deterministic seed from the wallet signature
    const seed = await this.createSeedFromSignature(walletSignature);

    for (let i = 0; i < count; i++) {
      // Generate deterministic private key using the seed and index
      const privateKey = await this.derivePrivateKey(seed, i);

      // Generate Bitcoin address from private key
      const address = await this.privateKeyToBitcoinAddress(privateKey);

      wallets.push({
        index: i,
        privateKey: privateKey,
        address: address,
        publicKey: await this.privateKeyToPublicKey(privateKey),
      });
    }

    return wallets;
  },
  async createSeedFromSignature(signature) {
    // Use Web Crypto API to create a deterministic seed from signature
    const encoder = new TextEncoder();
    const data = encoder.encode(signature);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  },
  async derivePrivateKey(seed, index) {
    // Create a deterministic private key using seed + index
    const encoder = new TextEncoder();
    const indexData = encoder.encode(index.toString());

    // Combine seed with index
    const combined = new Uint8Array(seed.length + indexData.length);
    combined.set(seed);
    combined.set(indexData, seed.length);

    // Hash the combined data
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert to hex string and ensure it's a valid private key
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
  },
  async privateKeyToPublicKey(privateKeyHex) {
    // Convert hex private key to BigInt
    const privateKey = BigInt('0x' + privateKeyHex);

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
    // const n = BigInt(
    //   '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
    // ); // Unused variable removed

    // Point multiplication: publicKey = privateKey * G
    const publicKey = this.pointMultiply(privateKey, Gx, Gy, p, a, b);

    // Compress the public key
    const compressedPublicKey = this.compressPublicKey(
      publicKey.x,
      publicKey.y
    );

    return compressedPublicKey;
  },
  pointMultiply(k, Gx, Gy, p, a, b) {
    // Simplified point multiplication for secp256k1
    // This is a basic implementation - in production, use a proper crypto library
    if (k === BigInt(0)) {
      return { x: BigInt(0), y: BigInt(0) };
    }

    let result = { x: Gx, y: Gy };
    let remaining = k - BigInt(1);

    while (remaining > BigInt(0)) {
      result = this.pointAdd(result.x, result.y, Gx, Gy, p, a, b);
      remaining = remaining - BigInt(1);
    }

    return result;
  },
  pointAdd(x1, y1, x2, y2, p, a, b) {
    // Point addition on elliptic curve
    if (x1 === BigInt(0) && y1 === BigInt(0)) {
      return { x: x2, y: y2 };
    }
    if (x2 === BigInt(0) && y2 === BigInt(0)) {
      return { x: x1, y: y1 };
    }
    if (x1 === x2 && y1 === y2) {
      return this.pointDouble(x1, y1, p, a, b);
    }
    if (x1 === x2) {
      return { x: BigInt(0), y: BigInt(0) }; // Point at infinity
    }

    const slope = ((y2 - y1) * this.modInverse(x2 - x1, p)) % p;
    const x3 = (slope * slope - x1 - x2) % p;
    const y3 = (slope * (x1 - x3) - y1) % p;

    return { x: x3 < BigInt(0) ? x3 + p : x3, y: y3 < BigInt(0) ? y3 + p : y3 };
  },
  pointDouble(x: bigint, y: bigint, p: bigint, a: bigint, b: bigint) {
    // Point doubling on elliptic curve
    const slope =
      ((BigInt(3) * x * x + a) * this.modInverse(BigInt(2) * y, p)) % p;
    const x3 = (slope * slope - BigInt(2) * x) % p;
    const y3 = (slope * (x - x3) - y) % p;

    return { x: x3 < BigInt(0) ? x3 + p : x3, y: y3 < BigInt(0) ? y3 + p : y3 };
  },
  modInverse(a: bigint, m: bigint): bigint {
    // Extended Euclidean Algorithm for modular inverse
    let [oldR, r] = [a, m];
    let [oldS, s] = [BigInt(1), BigInt(0)];

    while (r !== BigInt(0)) {
      const quotient = oldR / r;
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }

    return oldS < BigInt(0) ? oldS + m : oldS;
  },
  compressPublicKey(x, y) {
    // Compress public key: 0x02 or 0x03 + x coordinate
    const prefix = y % BigInt(2) === BigInt(0) ? '02' : '03';
    const xHex = x.toString(16).padStart(64, '0');
    return prefix + xHex;
  },
  async privateKeyToBitcoinAddress(privateKeyHex) {
    // Get the public key
    const publicKey = await this.privateKeyToPublicKey(privateKeyHex);

    // Create a simple Bitcoin address (P2PKH format)
    // This is a simplified implementation - in production, use proper Bitcoin libraries
    const publicKeyBytes = new Uint8Array(publicKey.length / 2);
    for (let i = 0; i < publicKey.length; i += 2) {
      publicKeyBytes[i / 2] = parseInt(publicKey.substr(i, 2), 16);
    }

    // Hash the public key with SHA-256
    const sha256Hash = await crypto.subtle.digest('SHA-256', publicKeyBytes);

    // Hash again with RIPEMD-160 (simplified - using SHA-256 again for demo)
    const ripemd160Hash = await crypto.subtle.digest('SHA-256', sha256Hash);
    const ripemd160Bytes = new Uint8Array(ripemd160Hash).slice(0, 20);

    // Add version byte (0x00 for mainnet)
    const versionedPayload = new Uint8Array(21);
    versionedPayload[0] = 0x00; // Mainnet version
    versionedPayload.set(ripemd160Bytes, 1);

    // Calculate checksum
    const checksumHash = await crypto.subtle.digest(
      'SHA-256',
      versionedPayload
    );
    const checksumHash2 = await crypto.subtle.digest('SHA-256', checksumHash);
    const checksum = new Uint8Array(checksumHash2).slice(0, 4);

    // Combine payload and checksum
    const addressBytes = new Uint8Array(25);
    addressBytes.set(versionedPayload);
    addressBytes.set(checksum, 21);

    // Convert to Base58 (simplified implementation)
    return this.base58Encode(addressBytes);
  },
  base58Encode(bytes) {
    // Base58 alphabet
    const alphabet =
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    let num = BigInt(
      '0x' +
        Array.from(bytes as Uint8Array)
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join('')
    );

    while (num > BigInt(0)) {
      result = alphabet[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }

    // Add leading '1's for leading zero bytes
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
      result = '1' + result;
    }

    return result;
  },
};

// Create a Context
const Bitprint = createContext({});

// Create a Provider Component
export const BitprintProvider = ({ children }) => {
  const [globalState, setGlobalState] = useState(bp);

  // Make bitprint available globally for useConnect hook
  if (typeof window !== 'undefined') {
    window.bitprint = globalState;
  }

  return (
    <Bitprint.Provider value={{ globalState, setGlobalState }}>
      {children}
    </Bitprint.Provider>
  );
};

// Custom Hook for consuming the context
export const useBitprint = () => useContext(Bitprint);
