const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  watchFolders: [path.resolve(monorepoRoot, 'mobile')],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'mobile', 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
