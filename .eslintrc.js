// .eslintrc.js
module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Disable the exhaustive-deps rule specifically for App.js
    'react-hooks/exhaustive-deps': [
      'warn', // Keep it as a warning locally
      {
        additionalHooks: '(useMemo|useCallback)', // Standard additional hooks
        enableFor: ['src/App.js'], // Apply this rule (or disable it) only for App.js
      },
    ],
  },
  overrides: [
    {
      files: ['src/App.js'], // Target App.js specifically
      rules: {
        'react-hooks/exhaustive-deps': 'off', // Turn off the rule for App.js
      },
    },
  ],
};