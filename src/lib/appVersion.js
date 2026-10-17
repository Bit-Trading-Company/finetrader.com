/*
 * The build this app was made from: package version, commit, branch and build
 * time, stamped in at build time by craco.config.js. Logged once at startup so
 * a console paste from a user names the exact commit it came from.
 */
export const APP_VERSION = {
  version: process.env.REACT_APP_VERSION || '0.0.0',
  commit: process.env.REACT_APP_COMMIT_SHA || 'unknown',
  branch: process.env.REACT_APP_COMMIT_REF || '',
  builtAt: process.env.REACT_APP_BUILD_TIME || '',
};

/** e.g. "Fine Trader v0.1.0 (abc1234, main, built 2026-10-17T20:00:00.000Z)" */
export const formatAppVersion = ({
  version,
  commit,
  branch,
  builtAt,
} = APP_VERSION) =>
  `Fine Trader v${version} (${[commit, branch, builtAt && `built ${builtAt}`]
    .filter(Boolean)
    .join(', ')})`;

export const logAppVersion = () => {
  console.info(formatAppVersion());
};
