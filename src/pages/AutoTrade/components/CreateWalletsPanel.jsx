/**
 * Step 2: derive the proxy wallets.
 *
 * One signature produces the whole set, and the same wallet always produces
 * the same addresses — so this is safe to repeat, and asking for more wallets
 * later re-derives the earlier ones unchanged.
 */
import React, { useState } from 'react';
import { Alert, Button, Field, NumberInput } from '../../../ui';
import {
  DEFAULT_WALLET_COUNT,
  MAX_WALLET_COUNT,
} from '../../../features/wallet/WalletSession';
import styles from './CreateWalletsPanel.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 */
const CreateWalletsPanel = ({ session }) => {
  const { wallets, isGenerating, error, isWalletConnected, generateWallets } =
    session;
  const [count, setCount] = useState(DEFAULT_WALLET_COUNT);

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <Field
          label="How many wallets"
          hint={`Up to ${MAX_WALLET_COUNT}. You can derive more later.`}
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
          {wallets.length > 0 ? 'Re-derive wallets' : 'Create wallets'}
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <p className={styles.note}>
        Your wallet will ask you to sign a message. That signature derives the
        keys and never leaves this browser — but it is also the only thing
        needed to recreate them, so sign it only here.
      </p>
    </div>
  );
};

export default CreateWalletsPanel;
