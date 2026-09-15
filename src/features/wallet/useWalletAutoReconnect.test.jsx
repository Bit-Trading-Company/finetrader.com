/**
 * The bug this guards against: restoring a remembered UniSat session used to
 * re-trigger itself, because the effect that did it depended on the state its
 * own success wrote. It ran hundreds of times a second, which users saw as the
 * page strobing and the wallet panel flipping between their address and
 * "Connect wallet".
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { OrdConnectProvider } from '@ordzaar/ord-connect';
import { getAddresses } from '@ordzaar/ordit-sdk/unisat';
import { useWalletAutoReconnect } from './useWalletAutoReconnect';

// Jest cannot resolve the SDK's subpath exports, so every entry useConnect and
// ord-connect reach for is declared virtually.
jest.mock(
  '@ordzaar/ordit-sdk',
  () => ({
    BrowserWalletNotInstalledError: class extends Error {},
    BrowserWalletRequestCancelledByUserError: class extends Error {},
  }),
  { virtual: true }
);
jest.mock('@ordzaar/ordit-sdk/leather', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/magiceden', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/okx', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/oyl', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/phantom', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/xverse', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});
jest.mock('@ordzaar/ordit-sdk/unisat', () => ({ getAddresses: jest.fn() }), {
  virtual: true,
});

const Probe = () => {
  useWalletAutoReconnect();
  return null;
};

const renderApp = () =>
  render(
    <OrdConnectProvider network="mainnet" chain="bitcoin">
      <Probe />
    </OrdConnectProvider>
  );

/** Let any loop that survived the fix run for a while. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

beforeEach(() => {
  window.localStorage.clear();
  delete window.bitprint;
  window.unisat = { addListener: () => {}, removeListener: () => {} };
});

test('asks the extension once when the reconnect succeeds', async () => {
  // CRA's Jest config sets resetMocks, so implementations are per-test.
  getAddresses.mockImplementation(async () => [
    { address: 'bc1pordinals', publicKey: '02aabb', format: 'taproot' },
  ]);
  window.localStorage.setItem('ord-connect_wallet', JSON.stringify('unisat'));

  renderApp();

  await waitFor(() => expect(getAddresses).toHaveBeenCalled());
  await settle();

  expect(getAddresses).toHaveBeenCalledTimes(1);
  expect(getAddresses).toHaveBeenCalledWith('mainnet', 'bitcoin', {
    readOnly: true,
  });
});

test('does not retry when the extension refuses', async () => {
  getAddresses.mockImplementation(async () => []);
  window.localStorage.setItem('ord-connect_wallet', JSON.stringify('unisat'));

  renderApp();

  await waitFor(() => expect(getAddresses).toHaveBeenCalled());
  await settle();

  expect(getAddresses).toHaveBeenCalledTimes(1);
});

test('stays out of the way when no wallet is remembered', async () => {
  getAddresses.mockImplementation(async () => []);

  renderApp();
  await settle();

  expect(getAddresses).not.toHaveBeenCalled();
});

test('respects an explicit disconnect', async () => {
  getAddresses.mockImplementation(async () => [
    { address: 'bc1pordinals', publicKey: '02aabb', format: 'taproot' },
  ]);
  window.localStorage.setItem('ord-connect_wallet', JSON.stringify('unisat'));
  window.bitprint = { isDisconnected: true, disconnect: () => {} };

  renderApp();
  await settle();

  expect(getAddresses).not.toHaveBeenCalled();
});
