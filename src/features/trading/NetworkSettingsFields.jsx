/**
 * Settings → Network: where the app reads the chain and broadcasts to.
 *
 * Separate from the run settings because it is not about a strategy — it is
 * the same choice whatever the auto-trader is doing, and it is remembered
 * across sessions by `lib/mempoolProvider`.
 */
import React from 'react';
import { Field, Select } from '../../ui';
import {
  MEMPOOL_PROVIDERS,
  getMempoolProviderLabel,
} from '../../lib/mempoolProvider';
import styles from './RunSettingsFields.module.css';

const NetworkSettingsFields = ({ settings }) => {
  const { mempoolProvider, handleMempoolProviderChange } = settings;

  return (
    <div className={styles.fields}>
      <Field
        label="Block explorer"
        hint="Used for balances, fee rates and broadcasting. Falls back automatically if the chosen one stops answering."
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
    </div>
  );
};

export default NetworkSettingsFields;
