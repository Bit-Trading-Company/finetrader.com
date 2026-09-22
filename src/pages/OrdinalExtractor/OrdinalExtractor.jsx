/**
 * Extractor: pull inscriptions out of their UTXOs and send them somewhere safe.
 *
 * Same guided shape as the consolidator — connect, choose the wallets, set a
 * destination, scan, extract. Wallets come from the shared `WalletSession`, so
 * the set derived on the auto-trader is the set scanned here.
 *
 * A UTXO can hold more than one inscription. Extracting one moves the others
 * in that UTXO with it, so those are never selected for you; the row says so
 * and you have to opt in.
 *
 * The PSBT building and broadcasting live in `extractorUtils`; this file is
 * the screen.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSign } from '@ordzaar/ord-connect';
import {
  ActivityLog,
  Alert,
  Badge,
  Button,
  Checkbox,
  Field,
  Page,
  PageHeader,
  Steps,
  TextInput,
} from '../../ui';
import { useActivityLog } from '../../lib/useActivityLog';
import { shortenAddress } from '../../lib/format';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import { useWalletSession } from '../../features/wallet/WalletSession';
import ConnectWalletPanel from '../../features/wallet/ConnectWalletPanel';
import FeeRateField from '../../features/fees/FeeRateField';
import { useFeeRates } from '../../features/fees/useFeeRates';
import WalletSubsetPanel from '../../features/wallet/WalletSubsetPanel';
import { DIALOG, useDialogs } from '../../app/DialogContext';
import {
  fetchAllInscriptionUtxos,
  buildInscriptionExtractionPsbtBase64,
  broadcastTxHex,
  extractInscriptionFromProxyWallet,
  pickLargestNonOrdinalFeeUtxo,
} from './extractorUtils';
import {
  fetchUtxos,
  isValidBitcoinAddress,
} from '../WalletConsolidator/consolidatorUtils';
import styles from './OrdinalExtractor.module.css';

/** Flatten the scan into one row per inscription, the unit you pick. */
const toRows = (byWallet) => {
  const rows = [];
  for (const [walletKey, entry] of Object.entries(byWallet)) {
    const utxos = Array.isArray(entry?.utxos) ? entry.utxos : [];
    for (const utxo of utxos) {
      const inscriptions = Array.isArray(utxo.inscriptions)
        ? utxo.inscriptions
        : [];
      for (const inscription of inscriptions) {
        if (!inscription?.inscriptionId) continue;
        rows.push({
          walletKey,
          address: entry.address,
          txid: utxo.txid,
          vout: utxo.vout,
          satoshi: utxo.satoshi,
          scriptPk: utxo.scriptPk,
          inscriptionsCount: inscriptions.length,
          inscription,
        });
      }
    }
  }
  return rows;
};

const labelFor = (inscription) =>
  inscription?.inscriptionNumber != null
    ? `#${inscription.inscriptionNumber}`
    : inscription.inscriptionId;

const OrdinalExtractor = () => {
  const {
    network,
    address: connectedAddress,
    publicKey: connectedPublicKey,
    isWalletConnected,
  } = useWalletConnection();
  const { sign } = useSign();
  const session = useWalletSession();
  const { openDialog } = useDialogs();
  const { entries: logEntries, log, clear, scrollRef } = useActivityLog();

  const { wallets, activeWallets } = session;

  const [useConnectedDestination, setUseConnectedDestination] = useState(true);
  const [customDestination, setCustomDestination] = useState('');
  const [includeConnectedWallet, setIncludeConnectedWallet] = useState(true);
  // Network fee, read from the chain rather than guessed.
  const fees = useFeeRates({ network });
  const { feeRate } = fees;

  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const stopRequested = useRef(false);

  const destination = useConnectedDestination
    ? connectedAddress?.ordinals || ''
    : customDestination.trim();
  const destinationValid =
    Boolean(destination) && isValidBitcoinAddress(destination, network);
  const destinationError =
    !useConnectedDestination && customDestination.trim() && !destinationValid
      ? 'That is not a valid Bitcoin address for this network.'
      : undefined;

  const rows = useMemo(() => toRows(scanned), [scanned]);
  const selectedRows = rows.filter((row) =>
    selectedIds.has(row.inscription.inscriptionId)
  );

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanned({});
    setSelectedIds(new Set());

    try {
      const found = {};
      const targets = [];

      if (includeConnectedWallet && connectedAddress?.ordinals) {
        targets.push({
          key: `connected:${connectedAddress.ordinals}`,
          address: connectedAddress.ordinals,
          what: 'connected wallet',
        });
      }
      for (const wallet of activeWallets) {
        targets.push({
          key: `proxy:${wallet.address}`,
          address: wallet.address,
          what: shortenAddress(wallet.address),
        });
      }

      // Sequential on purpose: the inscription API rate-limits a burst.
      for (const target of targets) {
        log(`Scanning ${target.what}…`);
        const utxos = await fetchAllInscriptionUtxos(target.address, {
          pageSize: 16,
        });
        found[target.key] = { address: target.address, utxos };
        log(`Found ${utxos.length} inscription UTXO(s) in ${target.what}.`);
      }

      setScanned(found);

      // Pre-select only the unambiguous ones. A UTXO holding several
      // inscriptions moves all of them together, so that is the reader's call.
      const preselected = new Set();
      for (const entry of Object.values(found)) {
        for (const utxo of entry.utxos || []) {
          const inscriptions = Array.isArray(utxo.inscriptions)
            ? utxo.inscriptions
            : [];
          if (inscriptions.length === 1 && inscriptions[0]?.inscriptionId) {
            preselected.add(inscriptions[0].inscriptionId);
          }
        }
      }
      setSelectedIds(preselected);
    } catch (error) {
      log(`✗ Scan failed: ${error?.message || String(error)}`);
    } finally {
      setIsScanning(false);
    }
  }, [includeConnectedWallet, connectedAddress, activeWallets, log]);

  /** Extract from the browser wallet, which signs its own PSBT. */
  const extractFromConnected = useCallback(
    async (row) => {
      const allUtxos = await fetchUtxos(row.address, network);
      const feeUtxo = await pickLargestNonOrdinalFeeUtxo(allUtxos, {
        exclude: [{ txid: row.txid, vout: row.vout }],
      });

      const { psbtBase64 } = await buildInscriptionExtractionPsbtBase64({
        inscriptionUtxo: {
          txid: row.txid,
          vout: row.vout,
          value: row.satoshi,
          scriptPk: row.scriptPk,
          inscriptions: [row.inscription],
        },
        inscription: row.inscription,
        feeUtxo: feeUtxo || null,
        destinationAddress: destination,
        changeAddress: row.address,
        feeRate,
        network,
        walletPublicKeyHex: connectedPublicKey?.ordinals || null,
      });

      const result = await sign(row.address, psbtBase64, {
        finalize: true,
        extractTx: true,
      });
      if (!result?.hex) {
        throw new Error('Connected wallet signing returned no tx hex');
      }
      return broadcastTxHex({ txHex: result.hex, network });
    },
    [network, destination, feeRate, connectedPublicKey, sign]
  );

  const handleExtract = useCallback(async () => {
    stopRequested.current = false;
    setIsExtracting(true);
    clear();
    log(`Extracting ${selectedRows.length} inscription(s) to ${destination}`);
    log(`Fee rate: ${feeRate} sat/vbyte · network: ${network}`);

    try {
      for (const row of selectedRows) {
        if (stopRequested.current) break;
        const label = labelFor(row.inscription);

        if (row.inscriptionsCount > 1) {
          log(
            `  ⚠ ${label} shares a UTXO with ${row.inscriptionsCount - 1} other inscription(s); they move with it.`
          );
        }
        log(`  Extracting ${label} from ${row.txid.slice(0, 8)}…:${row.vout}`);

        try {
          const { txid, txUrl } = row.walletKey.startsWith('connected:')
            ? await extractFromConnected(row)
            : await extractInscriptionFromProxyWallet({
                wallet: wallets.find((w) => w.address === row.address),
                inscriptionUtxo: {
                  txid: row.txid,
                  vout: row.vout,
                  value: row.satoshi,
                  satoshi: row.satoshi,
                  scriptPk: row.scriptPk,
                  scriptpubkey: row.scriptPk,
                  inscriptions: [row.inscription],
                },
                inscription: row.inscription,
                destinationAddress: destination,
                feeRate,
                network,
              });
          log(`  ✓ Extracted ${label}. ${txid.slice(0, 16)}…`, txUrl);
        } catch (error) {
          log(`  ✗ ${label}: ${error?.message || String(error)}`);
        }

        if (!stopRequested.current) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      log('✓ Extraction run complete.');
    } finally {
      setIsExtracting(false);
    }
  }, [
    selectedRows,
    destination,
    feeRate,
    network,
    wallets,
    extractFromConnected,
    log,
    clear,
  ]);

  const toggleRow = (id, checked) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const canExtract =
    isWalletConnected &&
    destinationValid &&
    selectedRows.length > 0 &&
    !isExtracting;

  const steps = [
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
      title: 'Choose the wallets to scan',
      done: activeWallets.length > 0 || includeConnectedWallet,
      summary:
        activeWallets.length > 0
          ? `${activeWallets.length} of ${wallets.length}`
          : undefined,
      render: () => (
        <div className={styles.stack}>
          <Checkbox
            label="Also scan my connected wallet"
            hint="Inscriptions held by the browser wallet itself, not just the Fine Trader wallets."
            checked={includeConnectedWallet}
            onChange={(event) =>
              setIncludeConnectedWallet(event.target.checked)
            }
          />
          <WalletSubsetPanel
            session={session}
            onManage={() => openDialog(DIALOG.wallets)}
            emptyHint="No Fine Trader wallets yet. Derive them once and every page in the app uses the same set."
          />
        </div>
      ),
    },
    {
      id: 'destination',
      title: 'Set the destination address',
      done: destinationValid,
      summary: destinationValid ? shortenAddress(destination) : undefined,
      render: () => (
        <div className={styles.stack}>
          <Field label="Where the inscriptions go">
            <div className={styles.choices}>
              <Button
                variant={useConnectedDestination ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setUseConnectedDestination(true)}
              >
                My connected wallet
              </Button>
              <Button
                variant={useConnectedDestination ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setUseConnectedDestination(false)}
              >
                Another address
              </Button>
            </div>
          </Field>

          {!useConnectedDestination && (
            <Field
              label="Destination address"
              hint="Each inscription arrives in its own 546-sat output."
              error={destinationError}
            >
              <TextInput
                value={customDestination}
                mono
                placeholder="bc1…"
                invalid={Boolean(destinationError)}
                onChange={(event) => setCustomDestination(event.target.value)}
              />
            </Field>
          )}
        </div>
      ),
    },
    {
      id: 'scan',
      title: 'Find inscriptions',
      done: rows.length > 0,
      summary: rows.length > 0 ? `${rows.length} found` : undefined,
      render: () => (
        <div className={styles.stack}>
          <div className={styles.controls}>
            <Button
              onClick={handleScan}
              loading={isScanning}
              disabled={!isWalletConnected}
            >
              Scan wallets
            </Button>
            {rows.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedIds(
                      new Set(
                        rows
                          .filter((row) => row.inscriptionsCount === 1)
                          .map((row) => row.inscription.inscriptionId)
                      )
                    )
                  }
                >
                  Select the safe ones
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </>
            )}
          </div>

          {rows.length > 0 && (
            <ul className={styles.rows}>
              {rows.map((row) => {
                const id = row.inscription.inscriptionId;
                const shared = row.inscriptionsCount > 1;
                return (
                  <li key={`${row.txid}:${row.vout}:${id}`}>
                    <label className={styles.row}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={selectedIds.has(id)}
                        onChange={(event) =>
                          toggleRow(id, event.target.checked)
                        }
                      />
                      <span className={styles.rowLabel}>
                        {labelFor(row.inscription)}
                      </span>
                      <code className={styles.rowMeta}>
                        {shortenAddress(row.address)} · {row.satoshi} sats
                      </code>
                      {shared && (
                        <Badge tone="warning">
                          shares a UTXO with {row.inscriptionsCount - 1}
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ),
    },
    {
      id: 'extract',
      title: 'Extract',
      done: false,
      render: () => (
        <div className={styles.stack}>
          <div className={styles.controls}>
            <FeeRateField
              fees={fees}
              disabled={isExtracting}
              hint="What each extraction pays to confirm."
            />
            <Button
              size="lg"
              variant={isExtracting ? 'danger' : 'primary'}
              disabled={!canExtract && !isExtracting}
              onClick={
                isExtracting
                  ? () => {
                      stopRequested.current = true;
                      log('Stop requested — finishing the current one.');
                    }
                  : handleExtract
              }
            >
              {isExtracting
                ? 'Stop'
                : `Extract ${selectedRows.length || ''}`.trim()}
            </Button>
          </div>
          {!canExtract && !isExtracting && (
            <p className={styles.blocker}>
              {!isWalletConnected
                ? 'Connect a wallet first.'
                : !destinationValid
                  ? 'Set a valid destination address.'
                  : 'Scan, then select at least one inscription.'}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page variant="extractor">
      <PageHeader
        title="Extractor"
        description="Move inscriptions into their own 546-sat outputs and send them somewhere safe."
        actions={
          rows.length > 0 && (
            <Badge tone="neutral">{selectedRows.length} selected</Badge>
          )
        }
      />

      {isExtracting && (
        <Alert tone="info">
          An extraction is in progress. Leaving this page stops it.
        </Alert>
      )}

      <Steps steps={steps} />

      <ActivityLog
        entries={logEntries}
        scrollRef={scrollRef}
        busy={isExtracting || isScanning}
        busyLabel={isScanning ? 'Scanning' : 'Extracting'}
        emptyHint="Nothing yet. Scan your wallets and every inscription found is reported here."
        onClear={clear}
      />
    </Page>
  );
};

export default OrdinalExtractor;
