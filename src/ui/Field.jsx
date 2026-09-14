/**
 * Form primitives: a labelled Field wrapper plus the controls that go in it.
 *
 * <Field label="Trade price (BTC)" hint="Defaults to floor">
 *   <NumberInput value={price} onChange={...} mono />
 * </Field>
 *
 * <ChoiceGroup name="exchange" value={id} onChange={setId} options={[…]} />
 */
import React, { useId } from 'react';
import styles from './Field.module.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Label, hint and error around one control.
 *
 * The label is tied to its control automatically: when Field wraps a single
 * element that has no id of its own, it generates one and passes it down. So
 * the common case needs nothing from the caller, and `htmlFor` is only for
 * pointing at a control Field does not render itself.
 */
export const Field = ({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  className = '',
  children,
}) => {
  const generatedId = useId();

  // Only a lone element can be targeted unambiguously; anything else (a
  // fragment, several controls) is left alone and can pass `htmlFor`.
  const onlyChild = React.Children.count(children) === 1 ? children : null;
  const canAdopt =
    !htmlFor && React.isValidElement(onlyChild) && !onlyChild.props.id;

  const controlId = htmlFor || (canAdopt ? generatedId : undefined);
  const control = canAdopt
    ? React.cloneElement(onlyChild, { id: controlId })
    : children;

  return (
    <div className={joinClasses(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={controlId}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
};

/** Single-line text input. `mono` for addresses, txids and figures. */
export const TextInput = ({
  mono = false,
  invalid = false,
  className = '',
  ...rest
}) => (
  <input
    type="text"
    className={joinClasses(
      styles.control,
      mono && styles.mono,
      invalid && styles.invalid,
      className
    )}
    {...rest}
  />
);

/** Numeric input; always monospaced so digits line up. */
export const NumberInput = ({ invalid = false, className = '', ...rest }) => (
  <input
    type="number"
    className={joinClasses(
      styles.control,
      styles.mono,
      invalid && styles.invalid,
      className
    )}
    {...rest}
  />
);

/** Native select with a custom chevron. */
export const Select = ({
  invalid = false,
  className = '',
  children,
  ...rest
}) => (
  <select
    className={joinClasses(
      styles.control,
      styles.select,
      invalid && styles.invalid,
      className
    )}
    {...rest}
  >
    {children}
  </select>
);

/**
 * Checkbox rendered as a row, so the whole row is clickable.
 *
 * Unlike `ChoiceGroup`, a standalone checkbox gets no surface of its own —
 * there is nothing to pick between, so a box around it is just a box.
 */
export const Checkbox = ({
  label,
  hint,
  checked,
  disabled,
  className = '',
  ...rest
}) => (
  <label
    className={joinClasses(
      styles.check,
      disabled && styles.choiceDisabled,
      className
    )}
  >
    <input
      type="checkbox"
      className={styles.choiceInput}
      checked={checked}
      disabled={disabled}
      {...rest}
    />
    <span>
      <span className={styles.choiceLabel}>{label}</span>
      {hint && <span className={styles.choiceHint}>{hint}</span>}
    </span>
  </label>
);

/**
 * Radio group as selectable rows.
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {{ value: string, label: React.ReactNode, hint?: React.ReactNode, disabled?: boolean }[]} props.options
 * @param {'column'|'row'} [props.direction]
 */
export const ChoiceGroup = ({
  name,
  value,
  onChange,
  options,
  direction = 'column',
  disabled = false,
  className = '',
}) => {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      className={joinClasses(
        styles.choiceGroup,
        direction === 'row' && styles.choiceGroupRow,
        className
      )}
    >
      {options.map((option) => {
        const isDisabled = disabled || option.disabled;
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            htmlFor={`${groupId}-${option.value}`}
            className={joinClasses(
              styles.choice,
              selected && styles.choiceSelected,
              isDisabled && styles.choiceDisabled
            )}
          >
            <input
              id={`${groupId}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={isDisabled}
              onChange={(event) => onChange(event.target.value)}
              className={styles.choiceInput}
            />
            <span>
              <span className={styles.choiceLabel}>{option.label}</span>
              {option.hint && (
                <span className={styles.choiceHint}>{option.hint}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
};
