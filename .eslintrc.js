module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  plugins: ['react-hooks'],
  rules: {
    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // General rules
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    // Allow console for Logger utility (it wraps console internally)
    'no-console': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
