import { type RandomBytes, uuidv7, uuidv7Timestamp } from './ids';

const fixedRandom: RandomBytes = (length) => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = (i + 1) * 7;
  return bytes;
};

describe('uuidv7', () => {
  it('produces the canonical 8-4-4-4-12 layout', () => {
    const id = uuidv7(1_700_000_000_000, fixedRandom);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('sets version 7 and the RFC 4122 variant', () => {
    const id = uuidv7(1_700_000_000_000, fixedRandom);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the timestamp so ids sort by creation time', () => {
    const early = uuidv7(1_000, fixedRandom);
    const late = uuidv7(2_000, fixedRandom);
    expect(uuidv7Timestamp(early)).toBe(1_000);
    expect(uuidv7Timestamp(late)).toBe(2_000);
    expect(early < late).toBe(true);
  });

  it('is unique for distinct random input at the same millisecond', () => {
    const a = uuidv7(1_700_000_000_000, (n) => new Uint8Array(n).fill(1));
    const b = uuidv7(1_700_000_000_000, (n) => new Uint8Array(n).fill(2));
    expect(a).not.toBe(b);
  });

  it('returns null for a value that is not a uuid', () => {
    expect(uuidv7Timestamp('not-a-uuid')).toBeNull();
  });
});
