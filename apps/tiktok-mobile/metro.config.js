// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve local workspaces
config.resolver.extraNodeModules = {
  '@dataclaus/sdk-react-native': path.resolve(monorepoRoot, 'packages/sdk-react-native'),
};

// Disable symlink resolution to use our explicit paths
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
