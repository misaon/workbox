import { defineCommand } from 'citty';

import { resolveVersion } from '../version.ts';
import { doctorCommand } from './doctor.ts';

export const mainCommand = defineCommand({
  meta: {
    name: 'workbox',
    version: resolveVersion(),
    description: 'Workbox: AI coding agents as a pixel-art office',
  },
  subCommands: {
    doctor: doctorCommand,
  },
});
