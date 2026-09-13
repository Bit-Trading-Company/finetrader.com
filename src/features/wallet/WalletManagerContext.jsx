/**
 * Opens the Fine Trader wallets manager from anywhere.
 *
 * The dialog is mounted once by the app shell; this is how the sidebar, the
 * header menu and any page ask for it. Keeping the dialog in one place is
 * what lets the wallets be managed the same way from every page.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const WalletManagerContext = createContext(null);

export const WalletManagerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openWalletManager = useCallback(() => setIsOpen(true), []);
  const closeWalletManager = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, openWalletManager, closeWalletManager }),
    [isOpen, openWalletManager, closeWalletManager]
  );

  return (
    <WalletManagerContext.Provider value={value}>
      {children}
    </WalletManagerContext.Provider>
  );
};

/**
 * @returns {{isOpen: boolean, openWalletManager: () => void, closeWalletManager: () => void}}
 */
export const useWalletManager = () => {
  const context = useContext(WalletManagerContext);
  if (!context) {
    throw new Error(
      'useWalletManager must be used inside a WalletManagerProvider'
    );
  }
  return context;
};
