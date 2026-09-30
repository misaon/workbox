/** Semantic version of the wire protocol between the daemon and its clients. Bump major on breaking changes. */
export const PROTOCOL_VERSION = '0.1.0';

/** Returns the major number of a plain `major.minor.patch` version and throws on anything else. */
export function protocolMajor(version: string): number {
  const match = /^(\d+)\.\d+\.\d+$/.exec(version);
  const major = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(major)) {
    throw new Error(`Invalid protocol version "${version}"`);
  }
  return major;
}
