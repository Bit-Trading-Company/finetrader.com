/**
 * Settings that apply to every run, rather than to one strategy.
 *
 * Shared by the wizard (inside a modal, where fewer choices on screen is the
 * point) and the dashboard (inline, where an advanced user wants them in
 * front of them).
 *
 * Wallet selection deliberately is not here — it belongs in the dashboard
 * table next to the balances, not in a list of bare addresses.
 */
import React from 'react';
import { Checkbox, Field, NumberInput, Select } from '../../../ui';
import {
  MEMPOOL_PROVIDERS,
  getMempoolProviderLabel,
} from '../../../lib/mempoolProvider';
import styles from './RunSettingsFields.module.css';

const RunSettingsFields = ({ settings, isTrading }) => {
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
    <div className={styles.fields}>
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
  );
};

export default RunSettingsFields;
