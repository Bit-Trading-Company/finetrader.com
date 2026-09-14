/**
 * Sidebar navigation model.
 *
 * One place that describes every destination in the app, so the sidebar, the
 * mobile drawer and any future command palette stay in sync. `legacy: true`
 * marks a screen that still renders the pre-redesign UI outside the app shell.
 */
import {
  BoltIcon,
  ChartIcon,
  ConsolidateIcon,
  GridIcon,
  StoreIcon,
} from '../ui/icons';

/**
 * @typedef {object} NavItem
 * @property {string} to route path
 * @property {string} label
 * @property {React.ComponentType<{size?: number}>} icon
 * @property {string} [description] shown in the mobile drawer
 * @property {boolean} [legacy] renders outside the redesigned shell
 */

/** @type {{ id: string, title: string, items: NavItem[] }[]} */
export const NAV_GROUPS = [
  {
    id: 'trade',
    title: 'Trade',
    items: [
      {
        to: '/auto-trade',
        label: 'Auto-Trade',
        icon: BoltIcon,
        description: 'Run a collection on Satflow or ord.net',
      },
      {
        to: '/dashboard',
        label: 'Market',
        icon: StoreIcon,
        description: 'Browse collections, buy and sell by hand',
      },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      {
        to: '/consolidator',
        label: 'Consolidator',
        icon: ConsolidateIcon,
        description: 'Sweep proxy wallet funds into one address',
      },
      {
        to: '/extractor',
        label: 'Extractor',
        icon: GridIcon,
        description: 'Find and move inscription UTXOs',
      },
    ],
  },
  {
    id: 'insights',
    title: 'Insights',
    items: [
      {
        to: '/analytics',
        label: 'Analytics',
        icon: ChartIcon,
        description: 'Wallet holdings and purchase history',
      },
      {
        to: '/satflow-stats',
        label: 'Collection stats',
        icon: ChartIcon,
        description: 'Satflow collection statistics',
        legacy: true,
      },
    ],
  },
];

/** Flat list of every destination. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** The nav item whose route matches `pathname`, if any. */
export const findNavItem = (pathname) =>
  NAV_ITEMS.find((item) => item.to === pathname) || null;
