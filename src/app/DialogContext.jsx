/**
 * One dialog at a time, for the whole app.
 *
 * Every modal in the app goes through here rather than owning its own open
 * flag. Opening one closes whatever was up, so dialogs replace each other
 * instead of stacking — funding opened from the wallets manager takes its
 * place rather than landing on top of it.
 *
 * The shell mounts the app-level dialogs; a page mounts its own and asks
 * whether its id is the active one.
 *
 *   const { openDialog } = useDialogs();
 *   openDialog(DIALOG.funding);
 *
 *   const { isDialogOpen } = useDialogs();
 *   <Modal open={isDialogOpen(DIALOG.settings)} … />
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/** Every dialog in the app. One is open at most. */
export const DIALOG = {
  wallets: 'wallets',
  funding: 'funding',
  settings: 'settings',
  bids: 'bids',
};

const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  const [active, setActive] = useState(null);
  /** Free-form argument for the open dialog — e.g. which settings section. */
  const [payload, setPayload] = useState(null);

  const openDialog = useCallback((id, nextPayload = null) => {
    setPayload(nextPayload);
    setActive(id);
  }, []);

  const closeDialog = useCallback(() => {
    setActive(null);
    setPayload(null);
  }, []);

  const isDialogOpen = useCallback((id) => active === id, [active]);

  const value = useMemo(
    () => ({ active, payload, openDialog, closeDialog, isDialogOpen }),
    [active, payload, openDialog, closeDialog, isDialogOpen]
  );

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
};

/**
 * @returns {{
 *   active: string|null,
 *   payload: unknown,
 *   openDialog: (id: string, payload?: unknown) => void,
 *   closeDialog: () => void,
 *   isDialogOpen: (id: string) => boolean,
 * }}
 */
export const useDialogs = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogs must be used inside a DialogProvider');
  }
  return context;
};
