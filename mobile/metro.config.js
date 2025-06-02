// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package.json exports to avoid require errors with SDK 53
config.resolver.unstable_enablePackageExports = false;

module.exports = config; 