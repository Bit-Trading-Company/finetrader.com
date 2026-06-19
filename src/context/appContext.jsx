import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [app, setApp] = useState({
    poolData: [],
    userRuneList: [],
    userBrc20List: [],
    baseTokenList: [],
    targetTokenList: [],
    baseToken: null,
    targetToken: null,
    buy_mode: true,
    btcPrice: 0,
  });

  return (
    <AppContext.Provider value={{ app, setApp }}>
      {children}
    </AppContext.Provider>
  );
};

const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('Occure error in useApp context');
  }

  return context;
};

export { AppProvider, useApp };
