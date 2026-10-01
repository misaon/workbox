import { compile } from '@inlang/paraglide-js';

import baseMessages from '../messages/en.json' with { type: 'json' };

await compile({
  project: './project.inlang',
  outdir: './src/paraglide',
  strategy: ['globalVariable', 'baseLocale'],
  emitTsDeclarations: true,
});

// Paraglide only logs a warning when the inlang plugin cannot be loaded (for example when the
// message-format plugin that project.inlang/settings.json points at is missing from node_modules)
// and still exits 0 after writing an empty message module. Fail the build instead, so that neither
// a developer nor turbo's cache keeps an incomplete module.
const generated: Record<string, unknown> = await import('../src/paraglide/messages.js');
const missing = Object.keys(baseMessages).filter(
  (key) => key !== '$schema' && typeof generated[key] !== 'function',
);
const [firstMissing] = missing;
if (firstMissing !== undefined) {
  throw new Error(
    `Paraglide generated no message function for: ${missing.join(', ')}. Did the inlang plugin load?`,
  );
}
