/**
 * Trading console state: the log list (capped at 1000 entries), addConsoleLog,
 * clearConsole and a ref that keeps the log view scrolled to the newest entry.
 *
 * Each entry is `{ message, link, timestamp }` — renderers must read
 * `.message`, not the entry itself.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export const useTradingConsole = () => {
  const [consoleLogs, setConsoleLogs] = useState([]);

  // Add console log (defined early so it can be used in useEffect hooks)
  const addConsoleLog = useCallback((message, link = null) => {
    setConsoleLogs((prev) => {
      const newLogs = [
        ...prev,
        { message, link, timestamp: new Date().toLocaleTimeString() },
      ];
      // Keep only last 1000 logs to prevent memory issues
      return newLogs.slice(-1000);
    });
  }, []);

  /** Empty the log; the run itself is unaffected. */
  const clearConsole = useCallback(() => setConsoleLogs([]), []);

  // Auto-scroll console to bottom when new logs are added
  const consoleRef = useRef(null);
  useEffect(() => {
    if (consoleRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
      });
    }
  }, [consoleLogs]);

  return { consoleLogs, addConsoleLog, clearConsole, consoleRef };
};
