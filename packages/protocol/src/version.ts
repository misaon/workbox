/** Semantic version of the wire protocol between the daemon and its clients. Bump major on breaking changes. */
export const PROTOCOL_VERSION = '0.1.0';

export function protocolMajor(version: string): number {
  const [major] = version.split('.');
  const parsed = Number(major);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid protocol version "${version}"`);
  }
  return parsed;
}
