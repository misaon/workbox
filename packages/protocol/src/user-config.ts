import * as z from 'zod';

export const LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof LOCALES)[number];

export const userConfigSchema = z.strictObject({
  locale: z.enum(LOCALES).default('en'),
  notifications: z
    .strictObject({
      desktop: z.boolean().default(true),
      sound: z.boolean().default(true),
    })
    .default({ desktop: true, sound: true }),
  office: z
    .strictObject({
      renderer: z.enum(['webgl', 'webgpu']).default('webgl'),
    })
    .default({ renderer: 'webgl' }),
  harness: z
    .strictObject({
      claude: z
        .strictObject({
          pinSystemBinary: z.boolean().default(false),
        })
        .default({ pinSystemBinary: false }),
    })
    .default({ claude: { pinSystemBinary: false } }),
});

export type UserConfig = z.output<typeof userConfigSchema>;

export const DEFAULT_USER_CONFIG: UserConfig = userConfigSchema.parse({});

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export function parseUserConfig(input: unknown): ParseResult<UserConfig> {
  const result = userConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const message = result.error.issues
    .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
  return { ok: false, message };
}

export function userConfigJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(userConfigSchema, { target: 'draft-7', io: 'input' }) as Record<string, unknown>;
}
