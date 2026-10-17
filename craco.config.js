// const path = require('path');
const { execSync } = require('child_process');
const webpack = require('webpack');

/*
 * The version and commit this build was made from, for the version line the
 * app logs (src/lib/appVersion.js). CRA only passes REACT_APP_* variables to
 * the bundle, and reads them after this file loads, so they are set here.
 * Vercel provides the commit; locally it comes from git, marked "-dirty"
 * when the working tree has uncommitted changes.
 */
const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};
if (!process.env.REACT_APP_COMMIT_SHA) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || git('rev-parse HEAD');
  const dirty =
    !process.env.VERCEL_GIT_COMMIT_SHA && git('status --porcelain') !== '';
  process.env.REACT_APP_COMMIT_SHA = sha
    ? `${sha.slice(0, 7)}${dirty ? '-dirty' : ''}`
    : 'unknown';
}
process.env.REACT_APP_COMMIT_REF =
  process.env.REACT_APP_COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  git('rev-parse --abbrev-ref HEAD');
process.env.REACT_APP_VERSION = require('./package.json').version;
process.env.REACT_APP_BUILD_TIME =
  process.env.REACT_APP_BUILD_TIME || new Date().toISOString();

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        // Add any other polyfills you need
      };

      // Webpack will naturally prefer top-level node_modules over nested ones
      // No alias needed - just ensure source-map-loader doesn't process nested packages

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      // Ignore source map warnings for jsontokens and ecpair libraries
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /jsontokens/,
        /ecpair/,
      ];

      // Exclude nested packages from source-map-loader to prevent build errors
      if (webpackConfig.module && webpackConfig.module.rules) {
        webpackConfig.module.rules = webpackConfig.module.rules.map((rule) => {
          if (
            rule.enforce === 'pre' &&
            rule.loader &&
            rule.loader.includes('source-map-loader')
          ) {
            const existingExclude = Array.isArray(rule.exclude)
              ? rule.exclude
              : rule.exclude
                ? [rule.exclude]
                : [];
            return {
              ...rule,
              exclude: [
                ...existingExclude,
                /node_modules\/@ordzaar\/ordit-sdk\/node_modules/,
              ],
            };
          }
          return rule;
        });
      }

      // Ensure webpack resolves to package main entry, not source files
      if (!webpackConfig.resolve.mainFields) {
        webpackConfig.resolve.mainFields = ['browser', 'module', 'main'];
      }

      return webpackConfig;
    },
  },
  jest: {
    configure: (jestConfig) => {
      // The Bitcoin libraries (@noble/*, @scure/*, bitcoinjs-lib and its deps)
      // ship ESM-only builds, which CRA's Jest setup refuses to transform.
      jestConfig.transformIgnorePatterns = [
        '[/\\\\]node_modules[/\\\\](?!(@ordzaar|@noble|@scure|micro-packed|bitcoinjs-lib|bip174|bs58|bs58check|base-x|uint8array-tools|varuint-bitcoin|valibot)[/\\\\]).+\\.(js|jsx|mjs|cjs|ts|tsx)$',
        '^.+\\.module\\.(css|sass|scss)$',
      ];
      // API handler tests live next to the handlers in server/.
      jestConfig.roots = [...(jestConfig.roots || []), '<rootDir>/server'];
      jestConfig.testMatch = [
        ...(jestConfig.testMatch || []),
        '<rootDir>/server/**/*.test.js',
      ];
      return jestConfig;
    },
  },
};
