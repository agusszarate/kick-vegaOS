// Unit tests for the WebView UI (pure logic only, no DOM).
module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/web/test'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: '<rootDir>/web/tsconfig.json'}],
  },
};
