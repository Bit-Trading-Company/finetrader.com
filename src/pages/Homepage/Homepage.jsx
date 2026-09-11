import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import GoldenLayout from 'golden-layout';
import { OrdConnectProvider } from '@ordzaar/ord-connect';
// Golden Layout's own styles (previously loaded from an unpinned CDN in index.html).
// Must stay above global.css so app styles keep overriding them.
import 'golden-layout/src/css/goldenlayout-base.css';
import 'golden-layout/src/css/goldenlayout-dark-theme.css';
import '../../styles/global.css'; // Global app styles (bundled for every route)

import { BitprintProvider } from '../../features/wallet/bitprint.tsx';
import WalletManagement from '../../features/wallet/WalletManagement';
import WalletDetails from '../../features/wallet/WalletDetails';
import Inscriptions from '../../features/explorer/Inscriptions';
import UTXOs from '../../features/explorer/UTXOs';
import SignPSBT from '../../features/psbt/SignPSBT';
import WalletConnect from '../../features/wallet/WalletConnect';
import OrdinalsCollections from '../../features/marketplace/OrdinalsCollections';
import CollectionDetails from '../../features/marketplace/CollectionDetails';
import BuyOrdinal from '../../features/marketplace/BuyOrdinal';
import Dispatcher from '../../features/psbt/Dispatcher';
import CreatePSBT from '../../features/psbt/CreatePSBT';
import MenuBar from './MenuBar';

/**
 * Legacy multi-panel workspace (/home) built on Golden Layout 1.x.
 *
 * Golden Layout mounts each panel into its own DOM node, so every panel is a
 * separate React root outside the app's provider tree. Each panel therefore
 * gets its own wallet providers, and panels talk to each other through
 * Golden Layout's event hub (passed as `glEventHub`).
 */

// Golden Layout component name -> React component rendered in that panel.
const PANEL_COMPONENTS = {
  walletDetails: WalletDetails,
  inscriptions: Inscriptions,
  utxos: UTXOs,
  signPSBT: SignPSBT,
  walletManagement: WalletManagement,
  walletConnect: WalletConnect,
  buyOrdinal: BuyOrdinal,
  ordinalsCollections: OrdinalsCollections,
  dispatcher: Dispatcher,
  createPSBT: CreatePSBT,
  collectionDetails: CollectionDetails,
};

const panel = (componentName, title, extra = {}) => ({
  type: 'component',
  componentName,
  title,
  id: componentName,
  ...extra,
});

// Built per mount: Golden Layout may mutate the config it is given.
const createLayoutConfig = () => ({
  content: [
    {
      type: 'row',
      content: [
        {
          type: 'column',
          content: [
            {
              type: 'stack',
              content: [
                panel('ordinalsCollections', 'Ordinals Collections'),
                panel('dispatcher', 'Dispatcher'),
              ],
            },
          ],
        },
        {
          type: 'column',
          content: [
            {
              type: 'row',
              content: [
                {
                  type: 'stack',
                  content: [
                    panel('walletManagement', 'Wallet Management'),
                    panel('buyOrdinal', 'Buy Ordinal'),
                    panel('walletDetails', 'Wallet Details'),
                  ],
                },
                {
                  type: 'stack',
                  content: [panel('walletConnect', 'Wallet Connect')],
                },
              ],
            },
            {
              type: 'stack',
              content: [
                panel('createPSBT', 'Create PSBT'),
                panel('collectionDetails', 'Collection'),
                panel('signPSBT', 'Sign PSBT'),
                panel('utxos', 'Explore UTXOs', { isClosable: false }),
                panel('inscriptions', 'Inscriptions', { isClosable: false }),
              ],
            },
          ],
        },
      ],
    },
  ],
});

const Homepage = () => {
  const layoutRef = useRef(null);
  const goldenLayoutRef = useRef(null);

  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      // Trigger Golden Layout resize after a short delay to ensure DOM is updated
      setTimeout(() => {
        if (goldenLayoutRef.current) {
          goldenLayoutRef.current.updateSize();
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    const layout = new GoldenLayout(createLayoutConfig(), layoutRef.current);

    Object.entries(PANEL_COMPONENTS).forEach(([name, Component]) => {
      layout.registerComponent(name, function (container) {
        const root = createRoot(container.getElement()[0]);
        root.render(
          <BitprintProvider>
            <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
              <Component glContainer={container} glEventHub={layout.eventHub} />
            </OrdConnectProvider>
          </BitprintProvider>
        );
        // Unmount after the current render/commit when the panel is destroyed.
        container.on('destroy', () => setTimeout(() => root.unmount(), 0));
      });
    });

    // Initialize the layout
    layout.init();

    // Store reference for cleanup
    goldenLayoutRef.current = layout;

    // Add menu event listeners
    const handleMenuConnectWallet = () => {
      // Focus on wallet connect component
      const walletConnectStack = layout.root
        .getItemsByType('stack')
        .find(
          (stack) =>
            stack.contentItems[0]?.config?.componentName === 'walletConnect'
        );
      if (walletConnectStack) {
        walletConnectStack.setActiveContentItem(
          walletConnectStack.contentItems[0]
        );
      }
    };

    const handleMenuFocusComponent = (componentName) => {
      const targetStack = layout.root
        .getItemsByType('stack')
        .find(
          (stack) =>
            stack.contentItems[0]?.config?.componentName === componentName
        );
      if (targetStack) {
        targetStack.setActiveContentItem(targetStack.contentItems[0]);
      }
    };

    // Listen for menu events
    layout.eventHub.on('menu-connect-wallet', handleMenuConnectWallet);
    layout.eventHub.on('menu-focus-component', handleMenuFocusComponent);

    // Ensure layout takes up full space after initialization
    setTimeout(() => {
      if (goldenLayoutRef.current) {
        goldenLayoutRef.current.updateSize();
      }
    }, 100);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (goldenLayoutRef.current) {
        goldenLayoutRef.current.eventHub.off(
          'menu-connect-wallet',
          handleMenuConnectWallet
        );
        goldenLayoutRef.current.eventHub.off(
          'menu-focus-component',
          handleMenuFocusComponent
        );
        goldenLayoutRef.current.destroy();
      }
    };
  }, []);

  return (
    <>
      <MenuBar
        glEventHub={goldenLayoutRef.current?.eventHub}
        layout={goldenLayoutRef.current}
      />
      <div
        ref={layoutRef}
        id="golden-layout-container"
        style={{
          width: '100vw',
          height: 'calc(100vh - 24px)', // Subtract menu bar height
          position: 'fixed',
          top: '24px', // Position below menu bar
          left: 0,
          margin: 0,
          padding: '8px', // Add padding around the layout
          backgroundColor: '#1a202c', // Dark background to match theme
          overflow: 'hidden', // Prevent scrollbars
          boxSizing: 'border-box', // Include padding in width/height calculations
        }}
      />
    </>
  );
};

export default Homepage;
