/** Pages exports use a subpath; local development and release archives stay at root. */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'DAEMON // 0',
  slug: config.slug ?? 'daemon-zero',
  experiments: { ...config.experiments, baseUrl: process.env.DAEMON_WEB_BASE_PATH ?? '' },
});
