/**
 * Trading console output. The page owns the log list and the scroll ref.
 */
import React from 'react';

const TradingConsole = ({ consoleRef, consoleLogs }) => (
  <div className="auto-trade-console">
    <h3>Console Output</h3>
    <div className="auto-trade-console-logs" ref={consoleRef}>
      {consoleLogs.length === 0 ? (
        <p className="auto-trade-console-empty">No logs yet...</p>
      ) : (
        consoleLogs.map((log, index) => (
          <div key={index} className="auto-trade-console-log">
            <span className="auto-trade-console-time">{log.timestamp}</span>
            <span className="auto-trade-console-message">{log.message}</span>
            {log.link && (
              <a
                href={log.link}
                target="_blank"
                rel="noopener noreferrer"
                className="auto-trade-console-link"
              >
                {log.link.includes('/inscription/')
                  ? 'View Item'
                  : 'View Transaction'}
              </a>
            )}
          </div>
        ))
      )}
    </div>
  </div>
);

export default TradingConsole;
