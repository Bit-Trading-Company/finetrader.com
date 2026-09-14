/**
 * A guided sequence: one step open at a time, the rest collapsed to a line.
 *
 * Used by every wizard-shaped screen — the auto-trader's simple view, the
 * consolidator, the extractor. The open step follows the first thing still
 * outstanding, but any step can be reopened, because going back to add funds
 * or change an address is normal rather than exceptional.
 *
 * Steps declare whether they are `done`; the component works out where to
 * start from that, so no page has to reimplement "first unfinished step".
 *
 * <Steps
 *   steps={[
 *     { id: 'connect', title: 'Connect your wallet', done, render: () => <Panel /> },
 *   ]}
 * />
 */
import React, { useState } from 'react';
import styles from './Steps.module.css';

/**
 * @typedef {object} StepDef
 * @property {string} id
 * @property {React.ReactNode} title
 * @property {React.ReactNode} [summary] shown collapsed, e.g. the value chosen
 * @property {boolean} [done]
 * @property {() => React.ReactNode} render
 */

/**
 * @param {object} props
 * @param {StepDef[]} props.steps
 */
const Steps = ({ steps, className = '' }) => {
  // null means "follow the flow"; an id means the reader has chosen one.
  const [openId, setOpenId] = useState(null);

  const firstUnfinished = steps.find((step) => !step.done) || steps[0];
  const currentId = openId ?? firstUnfinished?.id;

  return (
    <ol className={[styles.steps, className].filter(Boolean).join(' ')}>
      {steps.map((step, index) => {
        const open = step.id === currentId;
        return (
          <li
            key={step.id}
            className={['ds-panel', styles.step, open ? styles.open : '']
              .filter(Boolean)
              .join(' ')}
          >
            <button
              type="button"
              className={styles.head}
              aria-expanded={open}
              onClick={() => setOpenId(open ? '' : step.id)}
            >
              <span
                className={[styles.marker, step.done ? styles.markerDone : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {step.done ? '✓' : index + 1}
              </span>
              <span className={styles.heading}>
                <span className={styles.title}>{step.title}</span>
                {step.summary && (
                  <span className={styles.summary}>{step.summary}</span>
                )}
              </span>
            </button>

            {open && <div className={styles.body}>{step.render()}</div>}
          </li>
        );
      })}
    </ol>
  );
};

export default Steps;
