/**
 * One step of the AutoTrade wizard: a clickable header (number, title,
 * completion checkbox) and content that is only shown while the step is
 * active.
 */
import React from 'react';

const AutoTradeStep = ({
  number,
  title,
  isActive,
  isComplete,
  onSelect,
  headerStyle,
  headerExtra = null,
  children,
}) => (
  <div className="auto-trade-step">
    <div
      className={`auto-trade-step-header ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      style={{ cursor: 'pointer', ...headerStyle }}
    >
      <div className="auto-trade-step-number">{number}</div>
      <div className="auto-trade-step-title">{title}</div>
      <div className="auto-trade-step-status">
        <input
          type="checkbox"
          checked={isComplete}
          readOnly
          className="auto-trade-step-checkbox"
        />
      </div>
      {headerExtra}
    </div>
    <div
      className={`auto-trade-step-content ${isActive ? 'active' : 'hidden'}`}
    >
      {children}
    </div>
  </div>
);

export default AutoTradeStep;
