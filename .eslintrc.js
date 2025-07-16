// .eslintrc.js
module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  // No 'rules' section for exhaustive-deps here, as it's handled by overrides
  overrides: [
    {
      files: ['src/App.js'], // Target App.js specifically
      rules: {
        'react-hooks/exhaustive-deps': 'off', // Turn off the rule for App.js
      },
    },
  ],
};