import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import GoldenLayout from 'golden-layout';
// Golden Layout's own styles (previously loaded from an unpinned CDN in index.html).
// Must stay above index.css so app styles keep overriding them.
import 'golden-layout/src/css/goldenlayout-base.css';
import 'golden-layout/src/css/goldenlayout-dark-theme.css';
import '../../styles/global.css'; // Import Homepage styles

// Import our layout components
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
    // Golden Layout configuration
    const config = {
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
                    {
                      type: 'component',
                      componentName: 'ordinalsCollections',
                      title: 'Ordinals Collections',
                      id: 'ordinalsCollections',
                    },
                    {
                      type: 'component',
                      componentName: 'dispatcher',
                      title: 'Dispatcher',
                      id: 'dispatcher',
                    },
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
                        {
                          type: 'component',
                          componentName: 'walletManagement',
                          title: 'Wallet Management',
                          id: 'walletManagement',
                        },
                        {
                          type: 'component',
                          componentName: 'buyOrdinal',
                          title: 'Buy Ordinal',
                          id: 'buyOrdinal',
                        },
                        {
                          type: 'component',
                          componentName: 'walletDetails',
                          title: 'Wallet Details',
                          id: 'walletDetails',
                        },
                      ],
                    },
                    {
                      type: 'stack',
                      content: [
                        {
                          type: 'component',
                          componentName: 'walletConnect',
                          title: 'Wallet Connect',
                          id: 'walletConnect',
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'stack',
                  content: [
                    {
                      type: 'component',
                      componentName: 'createPSBT',
                      title: 'Create PSBT',
                      id: 'createPSBT',
                    },
                    {
                      type: 'component',
                      componentName: 'collectionDetails',
                      title: 'Collection',
                      id: 'collectionDetails',
                    },
                    {
                      type: 'component',
                      componentName: 'signPSBT',
                      title: 'Sign PSBT',
                      id: 'signPSBT',
                    },
                    {
                      type: 'component',
                      componentName: 'utxos',
                      title: 'Explore UTXOs',
                      id: 'utxos',
                      isClosable: false,
                    },
                    {
                      type: 'component',
                      componentName: 'inscriptions',
                      title: 'Inscriptions',
                      id: 'inscriptions',
                      isClosable: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    // Create Golden Layout instance
    const layout = new GoldenLayout(config, layoutRef.current);

    layout.registerComponent('walletDetails', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(WalletDetails, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('inscriptions', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(Inscriptions, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('utxos', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(UTXOs, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('signPSBT', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(SignPSBT, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('walletManagement', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(WalletManagement, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('walletConnect', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(WalletConnect, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('buyOrdinal', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(BuyOrdinal, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('ordinalsCollections', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(OrdinalsCollections, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('dispatcher', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(Dispatcher, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('createPSBT', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(CreatePSBT, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
    });

    layout.registerComponent('collectionDetails', function (container) {
      const element = container.getElement();
      const root = createRoot(element[0]);
      root.render(
        React.createElement(CollectionDetails, {
          glContainer: container,
          glEventHub: layout.eventHub,
        })
      );
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
