/**
 * Icon set for the redesigned UI.
 *
 * Stroked, 20px on a 24px grid, drawn with slightly loose geometry so they sit
 * next to the hand-drawn headings without looking like clip art. They inherit
 * `currentColor` and take a `size` prop.
 */
import React from 'react';

const Svg = ({ size = 20, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

/** Auto-trading: a bolt, for the engine that runs on its own. */
export const BoltIcon = (props) => (
  <Svg {...props}>
    <path d="M13 2.5 4.5 13.5h6L10 21.5 19.5 10h-6.2z" />
  </Svg>
);

/** Marketplace. */
export const StoreIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 9.5 5 4.5h14l1.5 5" />
    <path d="M4.5 9.5v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9" />
    <path d="M3.5 9.5c0 1.4 1.1 2.5 2.5 2.5S8.5 10.9 8.5 9.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5" />
    <path d="M9.5 19.5v-5h5v5" />
  </Svg>
);

/** Wallets. */
export const WalletIcon = (props) => (
  <Svg {...props}>
    <path d="M4 7.5c0-1.1.9-2 2-2h11a2 2 0 0 1 2 2" />
    <path d="M4 7.5v9.8c0 1.2 1 2.2 2.2 2.2H18a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H6.2" />
    <circle cx="16.2" cy="13.4" r="1.2" />
  </Svg>
);

/** Analytics. */
export const ChartIcon = (props) => (
  <Svg {...props}>
    <path d="M4 4.5v14a1 1 0 0 0 1 1h15" />
    <path d="M7.5 15.5 11 10.5l3.5 3 4-6.5" />
  </Svg>
);

/** Tools drawer. */
export const ToolsIcon = (props) => (
  <Svg {...props}>
    <path d="M14.7 6.3a3.6 3.6 0 0 0 4.8 4.6l-7 7a2.1 2.1 0 0 1-3-3z" />
    <path d="m6.5 6.5 3 3" />
  </Svg>
);

/** Collections / items. */
export const GridIcon = (props) => (
  <Svg {...props}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
  </Svg>
);

/** Palette: the design system page. */
export const PaletteIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.5c-4.7 0-8.5 3.6-8.5 8 0 4.1 3 6.5 6.2 6.5 1.6 0 2.1-.9 2.1-1.8 0-1.2-.9-1.5-.9-2.5 0-.8.7-1.5 1.7-1.5h1.9c3 0 5-2 5-4.8 0-2.4-2.6-3.9-7.5-3.9z" />
    <circle cx="8" cy="10" r="1" />
    <circle cx="12" cy="8" r="1" />
    <circle cx="16" cy="10.5" r="1" />
  </Svg>
);

export const MenuIcon = (props) => (
  <Svg {...props}>
    <path d="M4 7h16M4 12h16M4 17h11" />
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const ChevronLeftIcon = (props) => (
  <Svg {...props}>
    <path d="m14.5 5.5-6 6.5 6 6.5" />
  </Svg>
);

export const ChevronRightIcon = (props) => (
  <Svg {...props}>
    <path d="m9.5 5.5 6 6.5-6 6.5" />
  </Svg>
);

export const ExternalIcon = (props) => (
  <Svg {...props}>
    <path d="M13.5 4.5H19.5V10.5" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14.5v4a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
  </Svg>
);

/** Settings: sliders, because what is behind it is things you tune. */
export const SettingsIcon = (props) => (
  <Svg {...props}>
    <path d="M5 7.5h6" />
    <path d="M15 7.5h4" />
    <circle cx="13" cy="7.5" r="2" />
    <path d="M5 16.5h4" />
    <path d="M13 16.5h6" />
    <circle cx="11" cy="16.5" r="2" />
  </Svg>
);

/** How the app looks. */
export const EyeIcon = (props) => (
  <Svg {...props}>
    <path d="M2.8 12s3.4-5.5 9.2-5.5S21.2 12 21.2 12s-3.4 5.5-9.2 5.5S2.8 12 2.8 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

/** Anything that talks to the chain or an API. */
export const GlobeIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.6 12h16.8" />
    <path d="M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z" />
  </Svg>
);

/** Moving coin into the proxy wallets. */
export const FundIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.5v11" />
    <path d="m7.5 10 4.5 4.5 4.5-4.5" />
    <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </Svg>
);

/** Connecting a browser wallet. */
export const PlugIcon = (props) => (
  <Svg {...props}>
    <path d="M9 3.5v5" />
    <path d="M15 3.5v5" />
    <path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0z" />
    <path d="M12 17v3.5" />
  </Svg>
);

/**
 * Consolidating wallets: several streams converging into one.
 *
 * Deliberately not the wallet glyph — the sidebar already uses that for the
 * Fine Trader wallets, and two entries sharing an icon read as one feature.
 */
export const ConsolidateIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 5.5h4.2c1 0 1.9.5 2.4 1.3L12 9.5" />
    <path d="M3.5 18.5h4.2c1 0 1.9-.5 2.4-1.3L12 14.5" />
    <path d="M12 12h7" />
    <path d="m16.5 8.5 4 3.5-4 3.5" />
  </Svg>
);

/** Leaving: disconnecting the browser wallet. */
export const LogOutIcon = (props) => (
  <Svg {...props}>
    <path d="M14.5 5.5V4.2a1.7 1.7 0 0 0-1.7-1.7H5.7A1.7 1.7 0 0 0 4 4.2v15.6a1.7 1.7 0 0 0 1.7 1.7h7.1a1.7 1.7 0 0 0 1.7-1.7v-1.3" />
    <path d="M9.5 12h11" />
    <path d="m17 8.5 3.5 3.5L17 15.5" />
  </Svg>
);

/** About: what this thing is, and what it does not promise. */
export const InfoIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.9" />
  </Svg>
);
