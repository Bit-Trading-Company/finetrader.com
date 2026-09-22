/**
 * Pick a network fee rate: three live tiers, or type your own.
 *
 * Every flow that builds a transaction used to ship a guess — a hardcoded 4
 * in the funding dialog, a 1 in the consolidator and extractor, and the
 * trading fee transaction quietly taking mempool's `fastestFee`, which on a
 * busy day is 40 sat/vB. The rate is what a transaction costs, so it should
 * be a choice made against what the network is actually charging.
 *
 * The tiers come from the explorer; the middle one is preselected. A typed
 * number wins and is never overwritten by a later refresh. When no explorer
 * answers, the tiers are hidden rather than shown with invented numbers, and
 * the field falls back to 1 sat/vB — slow, but never an accidental overpay.
 *
 *   const fees = useFeeRates({ network });
 *   <FeeRateField fees={fees} disabled={isBusy} />
 */
import React, { useId } from 'react';
import { Button, Field, NumberInput } from '../../ui';
import { FEE_TIERS } from '../../lib/feeRates';
import styles from './FeeRateField.module.css';

/**
 * @param {object} props
 * @param {object} props.fees from `useFeeRates`
 * @param {boolean} [props.disabled]
 * @param {string} [props.label]
 * @param {React.ReactNode} [props.hint] what this particular fee buys — the
 *   funding dialog puts the running total here, for instance. The
 *   explorer-unavailable warning is shown separately so it can never displace
 *   it.
 * @param {string} [props.className]
 */
const FeeRateField = ({
  fees,
  disabled = false,
  label = 'Network fee',
  hint,
  className = '',
}) => {
  const inputId = useId();
  const {
    feeRate,
    tier,
    rates,
    isLoading,
    unavailable,
    selectTier,
    setFeeRate,
  } = fees;

  return (
    <Field
      label={label}
      hint={hint ?? 'sat/vB. Pick a speed, or type a rate.'}
      htmlFor={inputId}
      className={[styles.field, className].filter(Boolean).join(' ')}
    >
      <div className={styles.row}>
        {/*
          Hidden rather than disabled when rates are unknown: a greyed-out
          "High" still implies the app knows what high costs.
        */}
        {rates && (
          <div className={styles.tiers} role="group" aria-label="Fee speed">
            {FEE_TIERS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={tier === option.id ? 'primary' : 'secondary'}
                aria-pressed={tier === option.id}
                title={option.hint}
                disabled={disabled}
                onClick={() => selectTier(option.id)}
              >
                <span className={styles.tierLabel}>{option.label}</span>
                <span className={styles.tierRate}>{rates[option.id]}</span>
              </Button>
            ))}
          </div>
        )}

        <NumberInput
          id={inputId}
          min="1"
          value={feeRate}
          disabled={disabled}
          aria-label="Fee rate in sat/vB"
          className={styles.input}
          onChange={(event) => setFeeRate(Number(event.target.value))}
        />
      </div>

      {unavailable ? (
        <p className={styles.warning}>
          Could not reach a block explorer, so this is the 1 sat/vB fallback.
          Raise it if the transaction needs to confirm soon.
        </p>
      ) : (
        isLoading &&
        !rates && (
          <p className={styles.status}>Checking what the network costs…</p>
        )
      )}
    </Field>
  );
};

export default FeeRateField;
