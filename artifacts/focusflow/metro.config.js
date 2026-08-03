const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

process.env.EXPO_ROUTER_APP_ROOT = "app";

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo root so Metro can find shared packages
config.watchFolders = [workspaceRoot];

// Exclude .local/ (Replit agent temp dirs) and any .old-deployment-* directories
// from Metro's file-watching scope to prevent ENOENT crashes when those dirs
// are created/removed mid-scan during Replit task operations.
// Preserve any existing defaults (e.g. .expo/types, __tests__) set by getDefaultConfig.
const existingBlockList = config.resolver.blockList
  ? Array.from(config.resolver.blockList)
  : [];
config.resolver.blockList = [
  ...existingBlockList,
  /[/\\]\.local[/\\].*/,
  /[/\\]\.old-deployment-[^/\\]+[/\\].*/,
];

// Tell Metro where to find packages — app-level first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Intercept expo-router's _ctx module and redirect to local overrides that use
// hardcoded string literals. Metro validates require.context() args via its own
// AST parser BEFORE Babel runs, so env vars are never substituted in time.
// The actual import is `require("expo-router/_ctx")` (absolute, not relative).
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-router/_ctx") {
    const plat = platform || "android";
    const overrideFile = path.resolve(
      projectRoot,
      `_ctx-override.${plat}.js`
    );
    return { filePath: overrideFile, type: "sourceFile" };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
