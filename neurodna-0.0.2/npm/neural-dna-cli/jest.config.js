module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '**/test/**/*.test.js'
  ],
  transform: {},
  moduleNameMapper: {
    '^chalk$': '<rootDir>/node_modules/chalk/index.js'
  },
  testTimeout: 30000,
  verbose: true
};