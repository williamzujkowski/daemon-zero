/**
 * Expo's default Metro config plus the content channel (#205). DAEMON_CONTENT_CHANNEL=preview
 * makes a web bundle resolve src/content/index.ts to src/content/preview/index.ts for every
 * importer outside src/content, so production bundles never reference the preview overlay.
 * Decided by Nexus vote metro-content-alias (vote-1794924364010-e91diez).
 */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** Unset or empty means production, so every existing build command stays production. */
function contentChannel(value) {
  if (value === undefined || value === '' || value === 'production') return 'production';
  if (value === 'preview') return 'preview';
  throw new Error('DAEMON_CONTENT_CHANNEL must be "production" or "preview", got ' + JSON.stringify(value));
}

function isInside(directory, file) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Preview is web-only: native release profiles must never ship unfinished content, so a native
 * bundle with the channel set fails at its first resolution instead of building.
 */
function withContentChannel(config, channel, projectRoot) {
  if (channel === 'production') return config;
  const contentDir = path.join(projectRoot, 'src', 'content');
  const productionEntry = path.join(contentDir, 'index.ts');
  const previewEntry = path.join(contentDir, 'preview', 'index.ts');
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform !== 'web') {
      throw new Error('DAEMON_CONTENT_CHANNEL=preview is web-only; refusing to bundle for ' + String(platform));
    }
    const resolution = upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
    // Inside src/content the composition modules import each other directly and must stay as written.
    if (resolution.type === 'sourceFile' && resolution.filePath === productionEntry && !isInside(contentDir, context.originModulePath)) {
      return { type: 'sourceFile', filePath: previewEntry };
    }
    return resolution;
  };
  return config;
}

module.exports = withContentChannel(getDefaultConfig(__dirname), contentChannel(process.env.DAEMON_CONTENT_CHANNEL), __dirname);
