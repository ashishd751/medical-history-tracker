/**
 * UUIDv7 (RFC 9562) primary keys: time-ordered, so records sort naturally by id
 * and B-tree inserts stay cheap.
 *
 * These ids are identifiers, not secrets. `defaultRandom` prefers a cryptographic
 * RNG when the runtime provides one and falls back to Math.random otherwise.
 */
export type RandomBytes = (length: number) => Uint8Array;

export function defaultRandom(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

const HEX: readonly string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0'),
);

/**
 * Builds a UUIDv7 string from a timestamp (UTC epoch ms) and 10 random bytes.
 * @param nowMs timestamp in milliseconds; injectable for deterministic tests.
 */
export function uuidv7(nowMs: number = Date.now(), random: RandomBytes = defaultRandom): string {
  const bytes = new Uint8Array(16);
  bytes.set(random(10), 0);

  // 48-bit big-endian unix timestamp in milliseconds (bytes 0..5).
  const ts = Math.max(0, Math.floor(nowMs));
  const high = Math.floor(ts / 2 ** 32);
  const low = ts % 2 ** 32;
  bytes[0] = (high >>> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >>> 24) & 0xff;
  bytes[3] = (low >>> 16) & 0xff;
  bytes[4] = (low >>> 8) & 0xff;
  bytes[5] = low & 0xff;

  // Version 7 (high nibble of byte 6) and RFC 4122 variant (high bits of byte 8).
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => HEX[b] ?? '00').join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Extracts the millisecond timestamp encoded in a UUIDv7. */
export function uuidv7Timestamp(id: string): number | null {
  const hex = id.replace(/-/g, '').slice(0, 12);
  if (!/^[0-9a-f]{12}$/i.test(hex)) return null;
  return Number.parseInt(hex, 16);
}
