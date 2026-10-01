import { resolveLocale } from '@workbox/i18n';
import { getLogger } from '@workbox/observability';
import { defineCommand } from 'citty';

import { formatDoctorReport } from '../doctor/report.ts';
import { runDoctor } from '../doctor/run-doctor.ts';
import { resolveWorkboxHome } from '../home.ts';
import { configureCliLogging } from '../logging.ts';
import { writeLine } from '../output/stdout.ts';
import { bunCommandRunner } from '../process/command-runner.ts';
import { resolveVersion } from '../version.ts';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check that git, Claude Code and the Workbox home directory are ready',
  },
  args: {
    json: { type: 'boolean', description: 'Print the report as JSON', default: false },
    debug: {
      type: 'boolean',
      description: 'Verbose logging on stderr (same as WORKBOX_DEBUG=1)',
      default: false,
    },
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- citty types the command context (args, rawArgs, cmd) as mutable and dictates this signature
  async run({ args }) {
    const { env } = process;
    await configureCliLogging({ debug: args.debug, env, home: resolveWorkboxHome(env) });
    const logger = getLogger(['cli', 'doctor']);
    logger.debug('running doctor checks');
    const report = await runDoctor({ runner: bunCommandRunner, env, version: resolveVersion() });
    writeLine(args.json ? JSON.stringify(report) : formatDoctorReport(report, resolveLocale(env)));
    logger.debug('doctor finished {ok}', { ok: report.ok });
    process.exitCode = report.ok ? EXIT_CODE_SUCCESS : EXIT_CODE_FAILURE;
  },
});
