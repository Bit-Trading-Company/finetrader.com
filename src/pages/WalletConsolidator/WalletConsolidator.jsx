/**
 * Consolidator: sweep every Fine Trader wallet into one address.
 *
 * A guided sequence, the same shape as the auto-trader's simple view —
 * connect, pick the wallets, choose where the coin lands, sweep.
 *
 * The wallets come from the shared `WalletSession`, not from a copy of their
 * own, so the set derived on the auto-trader is the set swept here. The
 * consolidation itself lives in `consolidatorUtils`; this file is the screen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityLog,
  Alert,
  Badge,
  Button,
  Field,
  NumberInput,
  Page,
  PageHeader,
  Steps,
  TextInput,
} from '../../ui';
import { useActivityLog } from '../../lib/useActivityLog';
import { formatSatsAsBtc, shortenAddress } from '../../lib/format';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import { useWalletSession } from '../../features/wallet/WalletSession';
import ConnectWalletPanel from '../../features/wallet/ConnectWalletPanel';
import WalletSubsetPanel from '../../features/wallet/WalletSubsetPanel';
import { DIALOG, useDialogs } from '../../app/DialogContext';
import {
  consolidateAllWallets,
  isValidBitcoinAddress,
  estimateConsolidationFee,
  fetchUtxos,
} from './consolidatorUtils';
import styles from './WalletConsolidator.module.css';

const WalletConsolidator = () => {
  const {
    network,
    address: connectedAddress,
    isWalletConnected,
  } = useWalletConnection();
  const session = useWalletSession();
  const { openDialog } = useDialogs();
  const { entries, log, clear, scrollRef } = useActivityLog();

  const { wallets, activeWallets } = session;

  // Where the coin lands.
  const [useConnectedWallet, setUseConnectedWallet] = useState(true);
  const [customAddress, setCustomAddress] = useState('');

  const [feeRate, setFeeRate] = useState(1);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const stopRequested = React.useRef(false);

  const destination = useConnectedWallet
    ? connectedAddress?.ordinals || ''
    : customAddress.trim();
  const destinationValid =
    Boolean(destination) && isValidBitcoinAddress(destination, network);
  const addressError =
    !useConnectedWallet && customAddress.trim() && !destinationValid
      ? 'That is not a valid Bitcoin address for this network.'
      : undefined;

  const canConsolidate =
    isWalletConnected &&
    activeWallets.length > 0 &&
    destinationValid &&
    !isConsolidating;

  /** Read every active wallet's UTXOs so the sweep is not a blind click. */
  const handlePreview = useCallback(async () => {
    if (activeWallets.length === 0) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      let totalSats = 0;
      let totalUtxos = 0;
      let funded = 0;

      for (const wallet of activeWallets) {
        try {
          const utxos = await fetchUtxos(wallet.address, network);
          const sats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
          totalSats += sats;
          totalUtxos += utxos.length;
          if (utxos.length > 0) funded += 1;
        } catch {
          // A wallet the explorer cannot answer for is reported as empty
          // rather than failing the whole preview.
        }
      }

      const fee = estimateConsolidationFee(totalUtxos, totalUtxos, feeRate);
      setPreview({
        totalSats,
        totalUtxos,
        funded,
        fee,
        spendable: Math.max(0, totalSats - fee),
      });
    } finally {
      setIsPreviewing(false);
    }
  }, [activeWallets, network, feeRate]);

  const handleConsolidate = useCallback(async () => {
    stopRequested.current = false;
    setIsConsolidating(true);
    clear();
    log(`Sweeping ${activeWallets.length} wallet(s) into ${destination}`);
    log(`Fee rate: ${feeRate} sat/vbyte · network: ${network}`);

    await consolidateAllWallets({
      wallets: activeWallets,
      destinationAddress: destination,
      network,
      feeRate,
      addLog: log,
      onWalletComplete: () => {},
      isStopRequested: () => stopRequested.current,
    });

    setIsConsolidating(false);
  }, [activeWallets, destination, network, feeRate, log, clear]);

  const steps = useMemo(
    () => [
      {
        id: 'connect',
        title: 'Connect your wallet',
        done: isWalletConnected,
        summary: isWalletConnected
          ? shortenAddress(connectedAddress?.ordinals || '')
          : undefined,
        render: () => <ConnectWalletPanel />,
      },
      {
        id: 'wallets',
        title: 'Choose the wallets to sweep',
        done: activeWallets.length > 0,
        summary:
          activeWallets.length > 0
            ? `${activeWallets.length} of ${wallets.length}`
            : undefined,
        render: () => (
          <WalletSubsetPanel
            session={session}
            onManage={() => openDialog(DIALOG.wallets)}
            emptyHint="No Fine Trader wallets yet. Derive them once and every page in the app uses the same set."
          />
        ),
      },
      {
        id: 'destination',
        title: 'Set the destination address',
        done: destinationValid,
        summary: destinationValid ? shortenAddress(destination) : undefined,
        render: () => (
          <div className={styles.stack}>
            <Field label="Where the funds go">
              <div className={styles.choices}>
                <Button
                  variant={useConnectedWallet ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setUseConnectedWallet(true)}
                >
                  My connected wallet
                </Button>
                <Button
                  variant={useConnectedWallet ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setUseConnectedWallet(false)}
                >
                  Another address
                </Button>
              </div>
            </Field>

            {useConnectedWallet ? (
              <p className={styles.copy}>
                Everything sweeps to{' '}
                <code className={styles.mono}>
                  {connectedAddress?.ordinals || 'your connected wallet'}
                </code>
                .
              </p>
            ) : (
              <Field
                label="Destination address"
                hint="Checked against the network you are connected to."
                error={addressError}
              >
                <TextInput
                  value={customAddress}
                  mono
                  placeholder="bc1…"
                  invalid={Boolean(addressError)}
                  onChange={(event) => setCustomAddress(event.target.value)}
                />
              </Field>
            )}
          </div>
        ),
      },
      {
        id: 'sweep',
        title: 'Consolidate funds',
        done: false,
        render: () => (
          <div className={styles.stack}>
            <div className={styles.controls}>
              <Field label="Fee rate" hint="sat/vbyte" className={styles.fee}>
                <NumberInput
                  min="1"
                  value={feeRate}
                  disabled={isConsolidating}
                  onChange={(event) =>
                    setFeeRate(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </Field>
              <Button
                variant="secondary"
                onClick={handlePreview}
                loading={isPreviewing}
                disabled={activeWallets.length === 0}
              >
                Check balances
              </Button>
            </div>

            {preview && (
              <dl className={styles.preview}>
                <div>
                  <dt>Across</dt>
                  <dd>
                    {preview.funded} of {activeWallets.length} wallets
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatSatsAsBtc(preview.totalSats)}</dd>
                </div>
                <div>
                  <dt>Estimated fee</dt>
                  <dd>{formatSatsAsBtc(preview.fee)}</dd>
                </div>
                <div>
                  <dt>Arrives</dt>
                  <dd>{formatSatsAsBtc(preview.spendable)}</dd>
                </div>
              </dl>
            )}

            <div className={styles.controls}>
              <Button
                size="lg"
                variant={isConsolidating ? 'danger' : 'primary'}
                disabled={!canConsolidate && !isConsolidating}
                onClick={
                  isConsolidating
                    ? () => {
                        stopRequested.current = true;
                        log('Stop requested — finishing the current wallet.');
                      }
                    : handleConsolidate
                }
              >
                {isConsolidating ? 'Stop' : 'Consolidate funds'}
              </Button>
              {!canConsolidate && !isConsolidating && (
                <span className={styles.blocker}>
                  {!isWalletConnected
                    ? 'Connect a wallet first.'
                    : activeWallets.length === 0
                      ? 'Choose at least one wallet.'
                      : 'Set a valid destination address.'}
                </span>
              )}
            </div>
          </div>
        ),
      },
    ],
    [
      isWalletConnected,
      connectedAddress,
      activeWallets,
      wallets.length,
      session,
      openDialog,
      destinationValid,
      destination,
      useConnectedWallet,
      customAddress,
      addressError,
      feeRate,
      isConsolidating,
      isPreviewing,
      preview,
      canConsolidate,
      handlePreview,
      handleConsolidate,
      log,
    ]
  );

  return (
    <Page variant="consolidator">
      <PageHeader
        title="Consolidator"
        description="Sweep every Fine Trader wallet into a single address."
        actions={
          wallets.length > 0 && (
            <Badge tone="neutral">{wallets.length} wallets</Badge>
          )
        }
      />

      {isConsolidating && (
        <Alert tone="info">
          A sweep is in progress. Leaving this page stops it.
        </Alert>
      )}

      <Steps steps={steps} />

      <ActivityLog
        entries={entries}
        scrollRef={scrollRef}
        busy={isConsolidating}
        busyLabel="Sweeping"
        emptyHint="Nothing yet. Start a sweep and every wallet is reported here."
        onClear={clear}
      />
    </Page>
  );
};

export default WalletConsolidator;
