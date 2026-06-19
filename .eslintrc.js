module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import'],
  rules: {
    // React specific rules (relaxed)
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react/no-unescaped-entities': 'off',
    'react/no-unknown-property': 'warn',
    'react/jsx-no-comment-textnodes': 'off',
    'react/jsx-key': 'warn',
    'react/jsx-no-duplicate-props': 'warn',
    'react/jsx-no-undef': 'error',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'warn',
    'react/no-children-prop': 'off',
    'react/no-danger-with-children': 'off',
    'react/no-deprecated': 'warn',
    'react/no-direct-mutation-state': 'off',
    'react/no-find-dom-node': 'off',
    'react/no-is-mounted': 'off',
    'react/no-render-return-value': 'off',
    'react/no-string-refs': 'off',
    'react/require-render-return': 'error',

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Unused variable warnings (relaxed)
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',

    // General JavaScript/TypeScript rules (most on warn)
    'no-console': 'off',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'no-const-assign': 'error',
    'no-prototype-builtins': 'off',
    'no-undef': 'error',
    'no-unreachable': 'warn',
    'no-dupe-keys': 'warn',
    'no-duplicate-case': 'warn',
    'no-empty': 'off',
    'no-extra-semi': 'warn',
    'no-func-assign': 'warn',
    'no-irregular-whitespace': 'warn',
    'no-obj-calls': 'warn',
    'no-sparse-arrays': 'warn',
    'no-unexpected-multiline': 'warn',
    'use-isnan': 'warn',
    'valid-typeof': 'warn',

    // Typescript specific rules (relaxed)
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/prefer-as-const': 'warn',

    // Accessibility rules (relaxed for development)
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    'jsx-a11y/img-redundant-alt': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/mouse-events-have-key-events': 'off',
    'jsx-a11y/alt-text': 'off',
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',

    // Import rules (mostly off)
    'import/no-dynamic-require': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.test.js',
        '**/*.test.jsx',
        '**/__tests__/**/*',
      ],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};
