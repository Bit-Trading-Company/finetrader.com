/**
 * The Fine Trader wallets manager.
 *
 * One dialog, reachable from anywhere in the app, holding everything about
 * the proxy wallets: how they work, how many exist, which of them trade, what
 * each one holds, and how to derive more.
 *
 * It lives above the router so the wallets are shared between pages — the
 * user derives once and every page uses the same set.
 */
import React, { useState } from 'react';
import {
  Alert,
  Button,
  Field,
  Modal,
  NumberInput,
  StatGrid,
  StatTile,
} from '../../ui';
import { formatSatsAsBtc } from '../../lib/format';
import { useWalletConnection } from './useWalletConnection';
import {
  useWalletSession,
  DEFAULT_WALLET_COUNT,
  MAX_WALLET_COUNT,
} from './WalletSession';
import { useProxyWalletBalances } from './useProxyWalletBalances';
import WalletDetailPanel from './WalletDetailPanel';
import WalletTable from './WalletTable';
import styles from './FineTraderWalletsModal.module.css';

/** What these wallets are for, in the place the user first meets them. */
export const WALLET_EXPLAINER = [
  'Fine Trader wallets are throwaway wallets this app derives from a single signature by your connected wallet.',
  'The auto-trader buys and sells from them, so it can sign every trade itself — you are not approving each one in your wallet extension while a run is going.',
  'The same signature always produces the same wallets, so nothing is lost: reconnect, sign again, and your wallets and their funds come back.',
];

const FineTraderWalletsModal = ({ open, onClose }) => {
  const session = useWalletSession();
  const { network } = useWalletConnection();
  const { wallets, isGenerating, error, isWalletConnected, generateWallets } =
    session;

  const [count, setCount] = useState(DEFAULT_WALLET_COUNT);
  const [openIndex, setOpenIndex] = useState(null);

  const balances = useProxyWalletBalances(wallets, {
    network,
    enabled: open && wallets.length > 0,
  });

  const openWallet = openIndex === null ? null : wallets[openIndex] || null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Fine Trader wallets"
      description="Derived from your wallet, used by the auto-trader."
    >
      {openWallet ? (
        <WalletDetailPanel
          wallet={openWallet}
          balance={balances.balances[openWallet.address]}
          network={network}
          isActive={session.isWalletActive(openIndex)}
          isSelected={session.selectedWallet?.index === openWallet.index}
          onToggleActive={() => session.toggleWallet(openIndex, wallets.length)}
          onSelect={() => session.selectWallet(openWallet)}
          onBack={() => setOpenIndex(null)}
        />
      ) : (
        <div className={styles.body}>
          {wallets.length === 0 && (
            <div className={styles.explainer}>
              {WALLET_EXPLAINER.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}

          {wallets.length > 0 && (
            <StatGrid>
              <StatTile
                label="Wallets"
                value={wallets.length}
                hint={`${session.activeWallets.length} trading`}
              />
              <StatTile
                label="Funded"
                value={balances.totals.funded}
                hint="With a balance"
              />
              <StatTile
                label="Total balance"
                value={formatSatsAsBtc(balances.totals.confirmed)}
                hint="Confirmed"
              />
              <StatTile
                label="Pending"
                value={
                  balances.totals.pending
                    ? formatSatsAsBtc(balances.totals.pending)
                    : '—'
                }
                hint="Unconfirmed"
                tone={balances.totals.pending ? 'warning' : 'default'}
              />
            </StatGrid>
          )}

          {error && <Alert tone="danger">{error}</Alert>}
          {balances.error && <Alert tone="warning">{balances.error}</Alert>}

          {!isWalletConnected && (
            <Alert tone="info">
              Connect a wallet first — the signature it gives is what derives
              these.
            </Alert>
          )}

          <div className={styles.generate}>
            <Field
              label="How many wallets"
              hint={`Up to ${MAX_WALLET_COUNT}. Deriving again re-creates the earlier ones unchanged.`}
              className={styles.count}
            >
              <NumberInput
                min="1"
                max={MAX_WALLET_COUNT}
                value={count}
                disabled={isGenerating}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
              />
            </Field>
            <Button
              onClick={() => generateWallets(count)}
              loading={isGenerating}
              disabled={!isWalletConnected}
            >
              {wallets.length > 0 ? 'Derive again' : 'Generate wallets'}
            </Button>
            {wallets.length > 0 && (
              <Button
                variant="ghost"
                onClick={balances.refresh}
                loading={balances.isLoading}
              >
                Refresh balances
              </Button>
            )}
          </div>

          {wallets.length > 0 && (
            <WalletTable
              session={session}
              balances={balances.balances}
              isLoadingBalances={balances.isLoading}
              onOpenWallet={(wallet) => setOpenIndex(wallets.indexOf(wallet))}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default FineTraderWalletsModal;
