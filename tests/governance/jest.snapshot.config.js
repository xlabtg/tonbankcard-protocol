module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  testRegex: '/tests/governance/Snapshot(?:Rpc|Testnet\\.integration)\\.spec\\.ts$',
  transform: {
    '^.+\\.tsx?$': [
      '<rootDir>/tests/tooling/node_modules/ts-jest',
      { tsconfig: '<rootDir>/tests/governance/tsconfig.snapshot.json' },
    ],
  },
};
