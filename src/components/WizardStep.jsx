/**
 * One step of a page wizard (AutoTrade, Wallet Consolidator, Ordinal
 * Extractor): a clickable header with the step number, title and a completion
 * checkbox, followed by content that is shown only while the step is active.
 *
 * Class names are built from `classPrefix` (`${classPrefix}-step`,
 * `${classPrefix}-step-header`, ...), so each page keeps its own styles.
 *
 * @param {object} props
 * @param {string} props.classPrefix e.g. 'auto-trade' or 'consolidator'
 * @param {number} props.number
 * @param {React.ReactNode} props.title
 * @param {boolean} props.isActive
 * @param {boolean} props.isComplete
 * @param {() => void} props.onSelect called when the header is clicked
 * @param {object} [props.headerStyle] inline style for the header
 * @param {React.ReactNode} [props.headerExtra] rendered after the status box
 * @param {React.ReactNode} props.children step content
 */
import React from 'react';

const WizardStep = ({
  classPrefix,
  number,
  title,
  isActive,
  isComplete,
  onSelect,
  headerStyle,
  headerExtra = null,
  children,
}) => (
  <div className={`${classPrefix}-step`}>
    <div
      className={`${classPrefix}-step-header ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      style={headerStyle}
    >
      <div className={`${classPrefix}-step-number`}>{number}</div>
      <div className={`${classPrefix}-step-title`}>{title}</div>
      <div className={`${classPrefix}-step-status`}>
        <input
          type="checkbox"
          checked={isComplete}
          readOnly
          className={`${classPrefix}-step-checkbox`}
        />
      </div>
      {headerExtra}
    </div>
    <div
      className={`${classPrefix}-step-content ${isActive ? 'active' : 'hidden'}`}
    >
      {children}
    </div>
  </div>
);

export default WizardStep;
