/**
 * Dependency-free UTF-8 base64. Hermes, browsers and Node disagree about which
 * of btoa / Buffer / TextDecoder exist, so the save codec carries its own.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(text: string): number[] {
  const encoded = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded.charAt(i) === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

function utf8Text(bytes: readonly number[]): string {
  return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
}

export function toBase64(text: string): string {
  const bytes = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const triple = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET.charAt(triple >> 18) + ALPHABET.charAt((triple >> 12) & 63);
    out += i + 1 < bytes.length ? ALPHABET.charAt((triple >> 6) & 63) : '=';
    out += i + 2 < bytes.length ? ALPHABET.charAt(triple & 63) : '=';
  }
  return out;
}

function sextet(text: string, index: number): number {
  const char = text.charAt(index);
  return char === '=' ? 0 : ALPHABET.indexOf(char);
}

/** Decodes base64 to text. Throws on malformed input or invalid UTF-8. */
export function fromBase64(code: string): string {
  const clean = code.replace(/\s+/g, '');
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('not valid base64');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const triple =
      (sextet(clean, i) << 18) | (sextet(clean, i + 1) << 12) | (sextet(clean, i + 2) << 6) | sextet(clean, i + 3);
    bytes.push((triple >> 16) & 255);
    if (clean.charAt(i + 2) !== '=') bytes.push((triple >> 8) & 255);
    if (clean.charAt(i + 3) !== '=') bytes.push(triple & 255);
  }
  return utf8Text(bytes);
}
