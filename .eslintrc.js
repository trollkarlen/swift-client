module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true
  },
  'plugins': [
    'mocha'
  ],
  'extends': [
    'eslint:recommended',
    'plugin:mocha/recommended'
  ],
  'overrides': [
  ],
  'parserOptions': {
    'ecmaVersion': 'latest'
  },
  'rules': {
    'indent': [
      'error',
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    'quotes': [
      'error',
      'single'
    ],
    'semi': [
      'error',
      'always'
    ],
    'mocha/no-skipped-tests': 'error',
    'mocha/no-exclusive-tests': 'error'
  }
};
