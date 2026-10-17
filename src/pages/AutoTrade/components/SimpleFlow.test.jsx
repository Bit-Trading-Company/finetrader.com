/*
 * The wizard opens the first unfinished step. Funding used to count, so a
 * run that started (balances pause and read as nothing funded) or a wallet
 * spent down snapped the open step back to "Fund them".
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import SimpleFlow from './SimpleFlow';

jest.mock('../../../features/wallet/ConnectWalletPanel', () => () => (
  <div>connect panel</div>
));
jest.mock('./CollectionPicker', () => () => <div>collection picker</div>);
jest.mock('./RunControls', () => () => <div>run controls</div>);

const workspace = (readiness) => ({
  session: { isWalletConnected: true, activeWallets: [] },
  wallets: [{ address: 'bc1p-a', index: 0 }],
  balances: {
    totals: { confirmed: 0, pending: 0, funded: 0 },
    isLoading: false,
    refresh: () => {},
  },
  selectedCollection: { name: 'Wizards' },
  selectCollection: () => {},
  settings: { tradingExchange: 'ordnet', setTradingExchange: () => {} },
  isTrading: false,
  consoleLogs: [],
  clearConsole: () => {},
  consoleRef: { current: null },
  floorPriceSats: null,
  applyFloorPrice: () => {},
  readiness: {
    connected: true,
    hasWallets: true,
    funded: false,
    hasCollection: true,
    ...readiness,
  },
});

const renderFlow = (readiness) =>
  render(
    <SimpleFlow
      workspace={workspace(readiness)}
      onOpenDispatch={() => {}}
      onOpenBids={() => {}}
      onOpenWallets={() => {}}
      onOpenRunSettings={() => {}}
      startButton={<button type="button">Start</button>}
    />
  );

describe('SimpleFlow open step', () => {
  it('stays on Trade when wallets are not funded', () => {
    renderFlow({ funded: false });
    expect(screen.getByText('run controls')).toBeInTheDocument();
    expect(screen.queryByText(/Fund wallets/)).not.toBeInTheDocument();
  });

  it('still opens on the collection step when none is chosen', () => {
    renderFlow({ funded: false, hasCollection: false });
    expect(screen.getByText('collection picker')).toBeInTheDocument();
  });
});
