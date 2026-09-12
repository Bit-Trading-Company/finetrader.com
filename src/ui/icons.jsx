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
