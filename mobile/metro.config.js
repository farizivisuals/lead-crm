const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Share lib/types.ts and lib/rbac.ts with the Next.js app so the role
// hierarchy and status labels cannot drift between web and mobile.
config.watchFolders = [path.resolve(repoRoot, 'lib')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  '@shared': path.resolve(repoRoot, 'lib'),
  // lib/rbac.ts imports "@/lib/types" (a Next.js alias). Map it here so Metro
  // can resolve the same file without touching the web app.
  '@': repoRoot,
};

module.exports = config;
