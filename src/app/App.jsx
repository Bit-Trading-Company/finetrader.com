import { Route, Routes, useLocation } from 'react-router-dom';
import ThemeProvider from './ThemeContext';
import Homepage from '../pages/Homepage/Homepage';
import SatflowStats from '../pages/SatflowStats/SatflowStats';
import Dashboard from '../pages/Dashboard/Dashboard';
import Analytics from '../pages/Analytics/Analytics';
import Splash from '../pages/Splash/Splash';
import AutoTrade from '../pages/AutoTrade/AutoTrade';
import WalletConsolidator from '../pages/WalletConsolidator/WalletConsolidator';
import OrdinalExtractor from '../pages/OrdinalExtractor/OrdinalExtractor';
import DesignSystem from '../pages/DesignSystem/DesignSystem';
import AppShell from './AppShell';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';

import { BitprintProvider } from '../features/wallet/bitprint.tsx';
import { WalletSessionProvider } from '../features/wallet/WalletSession';

function App() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAnalytics = location.pathname === '/analytics';

  useEffect(() => {
    AOS.init({
      once: true,
      duration: 1000,
    });
  }, []);

  return (
    <BitprintProvider>
      <WalletSessionProvider>
        <ThemeProvider>
          <div
            className={
              isDashboard || isAnalytics ? '' : 'bg-gray overflow-x-clip'
            }
          >
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/home" element={<Homepage />} />
              <Route path="/consolidator" element={<WalletConsolidator />} />
              <Route path="/extractor" element={<OrdinalExtractor />} />
              <Route path="/satflow-stats" element={<SatflowStats />} />
              {/*
                Redesigned screens render inside the app shell (sidebar + top
                bar). Pages move in here as they are rebuilt; the routes above
                still serve the pre-redesign UI.
              */}
              <Route element={<AppShell />}>
                <Route path="/auto-trade" element={<AutoTrade />} />
                <Route path="/design" element={<DesignSystem />} />
              </Route>
            </Routes>
          </div>
        </ThemeProvider>
      </WalletSessionProvider>
    </BitprintProvider>
  );
}

export default App;
