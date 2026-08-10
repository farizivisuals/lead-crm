const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');
const sharedLibDir = path.resolve(repoRoot, 'lib');

const config = getDefaultConfig(projectRoot);

// Share lib/types.ts and lib/rbac.ts with the Next.js app so the role
// hierarchy and status labels cannot drift between web and mobile.
config.watchFolders = [sharedLibDir];
config.resolver.extraNodeModules = {
  '@shared': sharedLibDir,
};

// lib/rbac.ts imports "@/lib/types" (a Next.js `@/*` -> repo-root alias). Resolve
// that one literal specifier straight to the file inside sharedLibDir (which is
// already watched above) instead of mapping '@' to the whole repo root — that
// would let Metro resolve arbitrary files under repoRoot (web app source,
// node_modules, .next/) while only lib/ is actually being watched for changes.
const sharedTypesFile = path.resolve(sharedLibDir, 'types.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@/lib/types') {
    return { type: 'sourceFile', filePath: sharedTypesFile };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
