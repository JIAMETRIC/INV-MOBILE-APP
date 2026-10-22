const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web driver imports wa-sqlite.wasm as a static asset.
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
