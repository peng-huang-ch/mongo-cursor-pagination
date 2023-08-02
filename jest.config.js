// const { pathsToModuleNameMapper, preset } = require('ts-jest');
const { defaults: tsjPreset } = require('ts-jest/presets');

// const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  preset: '@shelf/jest-mongodb',
  moduleFileExtensions: ['js', 'json', 'ts'],
  clearMocks: true,
  rootDir: '.',
  testRegex: '.*\\.test\\.ts$',
  transform: tsjPreset.transform,
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: [
    'node_modules',
    'coverage',
    '.eslintrc.js',
    'jest.config.js',
  ],
  coverageDirectory: './coverage',
  // testEnvironment: 'node',
};
