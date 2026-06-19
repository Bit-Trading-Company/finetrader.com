// Utility function to wait for Unisat extension to be ready
export const waitForUnisatExtensionReady = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.unisat) {
      resolve(true);
      return;
    }

    // Wait for the extension to load
    const checkUnisat = () => {
      if (typeof window !== 'undefined' && window.unisat) {
        resolve(true);
      } else {
        setTimeout(checkUnisat, 100);
      }
    };

    checkUnisat();
  });
};
