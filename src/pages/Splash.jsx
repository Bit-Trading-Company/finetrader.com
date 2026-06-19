import React from 'react';
import './Splash.css';
import { useNavigate } from 'react-router-dom';
import fineTraderImg from '../assets/images/png/fine-trader.png';

const Splash = () => {
  const navigate = useNavigate();

  return (
    <div className="splash-container">
      <div className="splash-content">
        <div className="splash-content-header">
          <div className="header">
            <h1>EVERYTHING IS GONNA BE FINE..</h1>
          </div>
          <div className="button" onClick={() => navigate('/auto-trade')}>
            ENTER FINE TRADER
          </div>
        </div>

        <img className="gang" src={fineTraderImg} alt="logo" />
      </div>
    </div>
  );
};

export default Splash;
