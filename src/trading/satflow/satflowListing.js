/**
 * Listing (and delisting) ordinals on Satflow with a proxy wallet.
 */

import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
  signPsbtWithProxyWallet,
} from '../../lib/bitcoinUtils';
import { getTokenId } from '../ordinals';

/**
 * List an ordinal for sale using proxy wallet (Satflow: intent/sell → sign → /list).
 * @param {Object} ordinal - The ordinal to list
 * @param {number} priceInSats - Price in satoshis
 * @param {Object} wallet - Proxy wallet object
 * @param {string} network - Network type
 * @returns {Promise<Object>} Result with success, txid, error
 */
export const listOrdinalWithProxyWallet = async (
  ordinal,
  priceInSats,
  wallet,
  network = 'mainnet'
) => {
  try {
    const tokenId = getTokenId(ordinal);
    if (!tokenId) {
      throw new Error('Could not determine token ID from ordinal');
    }

    let address, publicKey;
    try {
      address = deriveAddressFromPrivateKey(wallet.privateKey, network);
      publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
    } catch (err) {
      console.error('Error deriving address from private key:', err);
      address = wallet.address;
      publicKey = wallet.publicKey;
    }

    if (!address || !publicKey) {
      throw new Error('Could not get wallet address or public key');
    }

    const priceInSatsInt = Math.round(parseFloat(priceInSats) || 0);

    // Satflow create listing intent: POST /intent/sell (proxied as /api/satflow-intent-sell)
    const intentPayload = {
      price: priceInSatsInt,
      inscriptionId: tokenId,
      sellerOrdAddress: address,
      sellerReceiveAddress: address,
      tapInternalKey:
        publicKey && publicKey.length >= 64 ? publicKey : undefined,
    };

    const fetchResponse = await fetch('/api/satflow-intent-sell', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(intentPayload),
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      let errorMessage = `Satflow intent/sell error: ${fetchResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const fetchData = await fetchResponse.json();
    const seller = fetchData?.data?.seller;
    if (!seller) {
      throw new Error('Satflow intent/sell did not return data.seller');
    }

    // Response shape: data.seller.unsignedListingPSBTBase64, data.seller.secureListingPSBTs[]
    const unsignedListingBase64 =
      seller.unsignedListingPSBTBase64 || seller.unsignedListingPSBTHex;
    if (!unsignedListingBase64) {
      throw new Error('Satflow intent/sell missing unsignedListingPSBTBase64');
    }

    // If API returns hex, convert to base64 for signing (signPsbtWithProxyWallet expects base64)
    let unsignedListingPsbtB64 = unsignedListingBase64;
    if (
      unsignedListingBase64.length > 0 &&
      !unsignedListingBase64.includes(' ')
    ) {
      const isHex = /^[0-9a-fA-F]+$/.test(unsignedListingBase64);
      if (isHex) {
        const bytes = new Uint8Array(
          unsignedListingBase64.match(/.{1,2}/g).map((b) => parseInt(b, 16))
        );
        unsignedListingPsbtB64 = btoa(
          Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join('')
        );
      }
    }

    // Step 2: Sign main listing PSBT (insecure/snipable listing)
    const signedListing = await signPsbtWithProxyWallet(
      unsignedListingPsbtB64.trim(),
      wallet.privateKey,
      network,
      {
        finalize: false,
        extractTx: false,
        expectedPublicKey: publicKey,
        walletAddress: address,
      }
    );

    if (!signedListing || !signedListing.base64) {
      throw new Error('Failed to sign listing PSBT');
    }

    // Sign each secure listing PSBT (non-snipable)
    const secureListingPsbtList = seller.secureListingPSBTs || [];
    const signedSecureListingPSBTs = [];
    for (let i = 0; i < secureListingPsbtList.length; i++) {
      const secureItem = secureListingPsbtList[i];
      const secureB64 = secureItem.base64 || secureItem.hex;
      if (!secureB64) continue;
      let secureB64ForSign = secureB64;
      if (/^[0-9a-fA-F]+$/.test(secureB64)) {
        const bytes = new Uint8Array(
          secureB64.match(/.{1,2}/g).map((b) => parseInt(b, 16))
        );
        secureB64ForSign = btoa(
          Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join('')
        );
      }
      const signedSecure = await signPsbtWithProxyWallet(
        secureB64ForSign.trim(),
        wallet.privateKey,
        network,
        {
          finalize: false,
          extractTx: false,
          expectedPublicKey: publicKey,
          walletAddress: address,
        }
      );
      if (signedSecure && signedSecure.base64) {
        signedSecureListingPSBTs.push(signedSecure.base64);
      }
    }

    // Step 3: Submit to Satflow POST /list (proxied as /api/satflow-list)
    const listingEntry = {
      price: priceInSatsInt,
      inscriptionId: tokenId,
      sellerOrdAddress: address,
      sellerReceiveAddress: address,
      tapInternalKey:
        publicKey && publicKey.length >= 64 ? publicKey : undefined,
    };

    const listPayload = {
      listings: [listingEntry],
      signedListingPSBT: signedListing.base64,
      signedSecureListingPSBTs:
        signedSecureListingPSBTs.length > 0 ? signedSecureListingPSBTs : [],
      unsignedListingPSBT: unsignedListingPsbtB64,
    };

    const listResponse = await fetch('/api/satflow-list', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(listPayload),
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      let errorMessage = `Satflow /list error: ${listResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const listData = await listResponse.json();
    const success = listData?.success === true;
    const txid = listData?.data?.txid;

    return {
      success,
      listed: success ? 1 : 0,
      txid,
      failed: success ? [] : [tokenId],
      data: listData,
    };
  } catch (err) {
    console.error('Error listing ordinal:', err);
    return {
      success: false,
      error: err.message || 'Failed to list ordinal',
    };
  }
};

/**
 * Delist a Satflow listing held by a proxy wallet.
 *
 * Not implemented. The previous version called Magic Eden's delist API, which
 * the app's proxy never allowed (and Magic Eden has since shut down its
 * ordinals marketplace), so it always failed. It now reports that failure
 * directly; auto-trade only acts on successful delists, so behavior is
 * unchanged. ord.net listings are delisted by delistOrdinalWithProxyWallet
 * in ../ordnet/ordnetTrading.js.
 *
 * To implement: Satflow's v1 API exposes POST /cancel
 * (docs/reference/satflow-openapi.json).
 *
 * @returns {Promise<{ success: false, error: string }>}
 */
export const delistOrdinalWithProxyWallet = async () => ({
  success: false,
  error: 'Delisting Satflow listings is not supported yet',
});
