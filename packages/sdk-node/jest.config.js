/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  // Suppress ts-jest "isolatedModules" hint (warning-only).
  globals: {
    'ts-jest': { isolatedModules: true },
  },
};
