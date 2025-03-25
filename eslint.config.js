module.exports = [
  {
    "files": ["**/*.js"],
    "languageOptions": {
      "globals": {
        "browser": true,
        "node": true,
        "es6": true
      },
      "ecmaVersion": 2020,
      "sourceType": "module"
    },
    "rules": {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  },
  ...require("eslint-config-eslint").configs.recommended
];
