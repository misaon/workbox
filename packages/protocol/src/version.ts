/** Semantic version of the wire protocol between the daemon and its clients. Bump major on breaking changes. */
export const PROTOCOL_VERSION = '0.1.0';

/** Returns the major number of a plain `major.minor.patch` version and throws on anything else. */
export function protocolMajor(version: string): number {
  const [majorText] = version.split('.');
  const major = Number(majorText);
  // The pattern rejects what Number() would coerce (such as '' or '0x10'), and the safe-integer
  // check rejects digit runs that Number() would round.
  if (!/^\d+\.\d+\.\d+$/u.test(version) || !Number.isSafeInteger(major)) {
    throw new TypeError(`Invalid protocol version "${version}"`);
  }
  return major;
}
