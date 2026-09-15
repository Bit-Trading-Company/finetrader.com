/**
 * The "turn it off and on again" section of Settings.
 *
 * A browser that has been through several builds of this app can be holding
 * state in a shape the current build no longer understands. Clearing the site
 * from browser settings works, but people do not find it; this is the same
 * thing, in the place they are already looking.
 */
import React, { useState } from 'react';
import { Alert, Button, Field } from '../ui';
import { listAppStorageKeys, resetAppStorage } from './appStorage';
import styles from './TroubleshootingFields.module.css';

const TroubleshootingFields = () => {
  const [confirming, setConfirming] = useState(false);
  const count = listAppStorageKeys().length;

  return (
    <div className={styles.stack}>
      <Field
        label="Reset local app data"
        hint={`Clears the ${count} setting(s) and wallet records this browser is holding, then reloads.`}
      >
        {confirming ? (
          <div className={styles.confirm}>
            <Button
              variant="danger"
              onClick={() => {
                resetAppStorage();
                window.location.replace(window.location.pathname);
              }}
            >
              Clear it and reload
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Reset local app data
          </Button>
        )}
      </Field>

      <Alert tone="info">
        Your coin is on the chain, not in this browser. Fine Trader wallets
        derive from a signature by your own wallet, so after a reset you
        reconnect, sign once, and the same wallets — and their balances — come
        back.
      </Alert>
    </div>
  );
};

export default TroubleshootingFields;
