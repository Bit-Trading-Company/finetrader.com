import { Route, Routes, useLocation } from 'react-router-dom';
import ThemeProvider from './context/ThemeContext';
import Homepage from './pages/Homepage';
import SatflowStats from './pages/SatflowStats';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Splash from './pages/Splash';
import AutoTrade from './pages/AutoTrade';
import WalletConsolidator from './pages/WalletConsolidator';
import OrdinalExtractor from './pages/OrdinalExtractor';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';

import { BitprintProvider } from './modules/bitprint.tsx';

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
            <Route path="/auto-trade" element={<AutoTrade />} />
            <Route path="/consolidator" element={<WalletConsolidator />} />
            <Route path="/extractor" element={<OrdinalExtractor />} />
            <Route path="/satflow-stats" element={<SatflowStats />} />
          </Routes>
        </div>
      </ThemeProvider>
    </BitprintProvider>
  );
}

export default App;
