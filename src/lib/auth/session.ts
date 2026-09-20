const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string;
  exp: number;
};

export async function signSession(payload: SessionPayload, secret: string) {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(encoded)));
  return `${encoded}.${bytesToBase64Url(signature)}`;
}

export async function verifySession(token: string | undefined, secret: string | undefined): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await key(secret), base64UrlToBytes(signature), encoder.encode(encoded));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as SessionPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
