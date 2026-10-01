import { homedir } from 'node:os';
import { join } from 'node:path';

import type { EnvLike } from '@workbox/observability';

export function resolveWorkboxHome(env: EnvLike): string {
  const configured = env['WORKBOX_HOME']?.trim();
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.workbox');
}
