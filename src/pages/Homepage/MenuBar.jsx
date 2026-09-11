import React, { useState } from 'react';
import FineBtcLogo from '../../assets/Fine_Btc.png';

const MenuBar = ({ glEventHub, layout }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [componentVisibility, setComponentVisibility] = useState({
    walletManagement: true,
    dispatcher: true,
    walletDetails: true,
    walletConnect: true,
    inscriptions: true,
  });

  const handleMenuHover = (menuName) => {
    setActiveDropdown(menuName);
    // Update visibility state when hovering over Window menu
    if (menuName === 'window' && layout) {
      updateComponentVisibility();
    }
  };

  const handleMenuLeave = () => {
    setActiveDropdown(null);
  };

  const updateComponentVisibility = () => {
    if (!layout) return;

    const newVisibility = { ...componentVisibility };
    const componentIds = Object.keys(componentVisibility);

    componentIds.forEach((id) => {
      const items = layout.root.getItemsById(id);
      if (items.length > 0) {
        newVisibility[id] = !items[0].isHidden;
      }
    });

    setComponentVisibility(newVisibility);
  };

  const handleMenuItemClick = (action) => {
    console.log('Menu action:', action);
    // Emit events for specific actions
    if (glEventHub) {
      switch (action) {
        case 'connect-wallet':
          glEventHub.emit('menu-connect-wallet');
          break;
        case 'open-settings':
          glEventHub.emit('menu-open-settings');
          break;
        case 'save':
          glEventHub.emit('menu-save');
          break;
        case 'load':
          glEventHub.emit('menu-load');
          break;
        case 'undo':
          glEventHub.emit('menu-undo');
          break;
        case 'redo':
          glEventHub.emit('menu-redo');
          break;
        default:
          break;
      }
    }
    setActiveDropdown(null);
  };

  const handleWindowItemClick = (componentId) => {
    if (!layout) return;

    const items = layout.root.getItemsById(componentId);
    // Golden Layout 1.5.9 content items have no hide()/show(), so these
    // toggles are not implemented yet (docs/KNOWN_ISSUES.md). Skip instead of
    // throwing.
    if (items.length > 0 && typeof items[0].hide === 'function') {
      const item = items[0];
      if (item.isHidden) {
        item.show();
      } else {
        item.hide();
      }
      // Update visibility state
      updateComponentVisibility();
    }
    setActiveDropdown(null);
  };

  return (
    <div className="menu-bar">
      <div className="menu-bar-content">
        {/* Logo */}
        <div className="menu-logo">
          <img src={FineBtcLogo} alt="Fine BTC" className="menu-logo-img" />
        </div>

        {/* File Menu */}
        <div
          className="menu-item"
          onMouseEnter={() => handleMenuHover('file')}
          onMouseLeave={handleMenuLeave}
        >
          <span>File</span>
          {activeDropdown === 'file' && (
            <div className="menu-dropdown">
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('save')}
              >
                Save
              </div>
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('load')}
              >
                Load
              </div>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div
          className="menu-item"
          onMouseEnter={() => handleMenuHover('edit')}
          onMouseLeave={handleMenuLeave}
        >
          <span>Edit</span>
          {activeDropdown === 'edit' && (
            <div className="menu-dropdown">
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('undo')}
              >
                Undo
              </div>
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('redo')}
              >
                Redo
              </div>
            </div>
          )}
        </div>

        {/* Window Menu */}
        <div
          className="menu-item"
          onMouseEnter={() => handleMenuHover('window')}
          onMouseLeave={handleMenuLeave}
        >
          <span>Window</span>
          {activeDropdown === 'window' && (
            <div className="menu-dropdown">
              <div
                className={`menu-dropdown-item ${componentVisibility.walletManagement ? 'visible' : 'hidden'}`}
                onClick={() => handleWindowItemClick('walletManagement')}
              >
                Wallet Management
                <span className="visibility-indicator">
                  {componentVisibility.walletManagement ? '●' : '○'}
                </span>
              </div>
              <div
                className={`menu-dropdown-item ${componentVisibility.dispatcher ? 'visible' : 'hidden'}`}
                onClick={() => handleWindowItemClick('dispatcher')}
              >
                Dispatcher
                <span className="visibility-indicator">
                  {componentVisibility.dispatcher ? '●' : '○'}
                </span>
              </div>
              <div
                className={`menu-dropdown-item ${componentVisibility.walletDetails ? 'visible' : 'hidden'}`}
                onClick={() => handleWindowItemClick('walletDetails')}
              >
                Wallet Details
                <span className="visibility-indicator">
                  {componentVisibility.walletDetails ? '●' : '○'}
                </span>
              </div>
              <div
                className={`menu-dropdown-item ${componentVisibility.walletConnect ? 'visible' : 'hidden'}`}
                onClick={() => handleWindowItemClick('walletConnect')}
              >
                Wallet Connect
                <span className="visibility-indicator">
                  {componentVisibility.walletConnect ? '●' : '○'}
                </span>
              </div>
              <div
                className={`menu-dropdown-item ${componentVisibility.inscriptions ? 'visible' : 'hidden'}`}
                onClick={() => handleWindowItemClick('inscriptions')}
              >
                Inscriptions
                <span className="visibility-indicator">
                  {componentVisibility.inscriptions ? '●' : '○'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Menu */}
        <div
          className="menu-item"
          onMouseEnter={() => handleMenuHover('wallet')}
          onMouseLeave={handleMenuLeave}
        >
          <span>Wallet</span>
          {activeDropdown === 'wallet' && (
            <div className="menu-dropdown">
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('connect-wallet')}
              >
                Connect Wallet
              </div>
            </div>
          )}
        </div>

        {/* Settings Menu */}
        <div
          className="menu-item"
          onMouseEnter={() => handleMenuHover('settings')}
          onMouseLeave={handleMenuLeave}
        >
          <span>Settings</span>
          {activeDropdown === 'settings' && (
            <div className="menu-dropdown">
              <div
                className="menu-dropdown-item"
                onClick={() => handleMenuItemClick('open-settings')}
              >
                Open Settings
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuBar;
