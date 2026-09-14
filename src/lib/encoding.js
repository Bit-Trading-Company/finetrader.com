/**
 * Hex string to base64 (wallets sometimes return signed PSBTs as hex).
 * @param {string} hex
 * @returns {string}
 */
export const hexToBase64 = (hex) => {
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
  return btoa(
    Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join('')
  );
};
