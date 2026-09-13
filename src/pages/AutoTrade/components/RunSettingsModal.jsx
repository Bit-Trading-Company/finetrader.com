/**
 * Settings that apply to every run, rather than to one strategy: which
 * explorer to use, whether to pay the app fee, how long to wait between
 * preparation attempts, and wallet rotation.
 *
 * Wallet selection itself lives in the dashboard table, where the balances
 * are — choosing wallets blind from a list of addresses was the hardest part
 * of the old modal.
 */
import React from 'react';
import {
  Button,
  Checkbox,
  Field,
  Modal,
  NumberInput,
  Select,
} from '../../../ui';
import {
  MEMPOOL_PROVIDERS,
  getMempoolProviderLabel,
} from '../../../lib/mempoolProvider';
import styles from './RunSettingsModal.module.css';

const RunSettingsModal = ({ open, onClose, settings, isTrading }) => {
  const {
    mempoolProvider,
    handleMempoolProviderChange,
    useFees,
    setUseFees,
    prepDelay,
    setPrepDelay,
    walletRandomizer,
    setWalletRandomizer,
  } = settings;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run settings"
      description="These apply to every strategy."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className={styles.body}>
        <Field
          label="Block explorer"
          hint="Used for balances, fee rates and broadcasting."
        >
          <Select
            value={mempoolProvider}
            onChange={(e) => handleMempoolProviderChange(e.target.value)}
          >
            {Object.values(MEMPOOL_PROVIDERS).map((provider) => (
              <option key={provider} value={provider}>
                {getMempoolProviderLabel(provider)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Delay between attempts"
          hint="How long to pause before retrying a step that needs the chain to catch up."
        >
          <div className={styles.inline}>
            <NumberInput
              min="0"
              step="0.5"
              value={prepDelay / 1000}
              disabled={isTrading}
              onChange={(e) =>
                setPrepDelay(Math.max(0, Number(e.target.value) || 0) * 1000)
              }
            />
            <span className={styles.unit}>seconds</span>
          </div>
        </Field>

        <Checkbox
          label="Rotate wallet order"
          hint="Shuffles which wallet acts first on each cycle."
          checked={walletRandomizer}
          disabled={isTrading}
          onChange={(e) => setWalletRandomizer(e.target.checked)}
        />

        <Checkbox
          label="Pay the app fee"
          hint="Adds the Fine Trader fee output to trades."
          checked={useFees}
          disabled={isTrading}
          onChange={(e) => setUseFees(e.target.checked)}
        />
      </div>
    </Modal>
  );
};

export default RunSettingsModal;
