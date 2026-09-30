import { z } from 'zod';

export const LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof LOCALES)[number];

// Each section defaults to `schema.parse({})`, not to a literal. Zod 4 returns a `.default()` value
// without parsing it, so a literal would repeat the leaf defaults and share its nested objects with
// every parse. Parsing `{}` builds fresh objects from the leaf defaults each time.
const notificationsSchema = z.strictObject({
  desktop: z.boolean().default(true),
  sound: z.boolean().default(true),
});

const officeSchema = z.strictObject({
  renderer: z.enum(['webgl', 'webgpu']).default('webgl'),
});

const claudeHarnessSchema = z.strictObject({
  pinSystemBinary: z.boolean().default(false),
});

const harnessSchema = z.strictObject({
  claude: claudeHarnessSchema.default(() => claudeHarnessSchema.parse({})),
});

export const userConfigSchema = z.strictObject({
  // Editors add a "$schema" key to JSON config files, so the strict root has to allow it.
  $schema: z.string().optional(),
  locale: z.enum(LOCALES).default('en'),
  notifications: notificationsSchema.default(() => notificationsSchema.parse({})),
  office: officeSchema.default(() => officeSchema.parse({})),
  harness: harnessSchema.default(() => harnessSchema.parse({})),
});

export type UserConfig = z.output<typeof userConfigSchema>;

/** Freezes `value` and everything reachable from it, so shared defaults cannot be mutated. */
function deepFreeze<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value) as unknown[]) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

export const DEFAULT_USER_CONFIG: UserConfig = deepFreeze(userConfigSchema.parse({}));

export type ParseResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly message: string };

/** The parts of a Zod issue that the error message needs, typed read-only. */
interface IssueSummary {
  readonly message: string;
  readonly path: readonly PropertyKey[];
}

function describeIssue(issue: IssueSummary): string {
  return `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`;
}

export function parseUserConfig(input: unknown): ParseResult<UserConfig> {
  const result = userConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const message = result.error.issues.map(describeIssue).join('; ');
  return { ok: false, message };
}

export function userConfigJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(userConfigSchema, { target: 'draft-7', io: 'input' });
}
