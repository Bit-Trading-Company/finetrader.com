// const path = require('path');
const webpack = require('webpack');

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
        '[/\\\\]node_modules[/\\\\](?!(@noble|@scure|micro-packed|bitcoinjs-lib|bip174|bs58|bs58check|base-x|uint8array-tools|varuint-bitcoin|valibot)[/\\\\]).+\\.(js|jsx|mjs|cjs|ts|tsx)$',
        '^.+\\.module\\.(css|sass|scss)$',
      ];
      return jestConfig;
    },
  },
};
