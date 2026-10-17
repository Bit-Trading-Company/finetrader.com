import {
  SELECTED_PROXY_WALLET_KEY,
  loadSelectedProxyWallet,
  saveSelectedProxyWallet,
  scrubStoredProxyWalletKey,
} from './proxyWalletStorage';

const wallet = {
  index: 3,
  address: 'bc1pwallet',
  publicKey: '02abc',
  privateKey: 'deadbeef'.repeat(8),
};

beforeEach(() => localStorage.clear());

describe('proxy wallet storage', () => {
  it('never writes the private key', () => {
    saveSelectedProxyWallet(wallet);
    const raw = localStorage.getItem(SELECTED_PROXY_WALLET_KEY);
    expect(raw).not.toMatch(/deadbeef|privateKey/);
    expect(loadSelectedProxyWallet()).toEqual({
      index: 3,
      address: 'bc1pwallet',
      publicKey: '02abc',
    });
  });

  it('never hands back a private key stored by an older version', () => {
    localStorage.setItem(SELECTED_PROXY_WALLET_KEY, JSON.stringify(wallet));
    expect(loadSelectedProxyWallet()).not.toHaveProperty('privateKey');
  });

  it('scrubs a stored private key and keeps the selection', () => {
    localStorage.setItem(SELECTED_PROXY_WALLET_KEY, JSON.stringify(wallet));
    scrubStoredProxyWalletKey();
    const raw = localStorage.getItem(SELECTED_PROXY_WALLET_KEY);
    expect(raw).not.toMatch(/deadbeef|privateKey/);
    expect(JSON.parse(raw).index).toBe(3);
  });

  it('drops a record it cannot read', () => {
    localStorage.setItem(SELECTED_PROXY_WALLET_KEY, '{"privateKey": oops');
    scrubStoredProxyWalletKey();
    expect(localStorage.getItem(SELECTED_PROXY_WALLET_KEY)).toBeNull();
  });
});
