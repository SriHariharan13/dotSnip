export const HOST = "dotSnip";

export function shortUrl(code) {
  return new URL(`/${encodeURIComponent(code)}`, window.location.origin).href;
}

export function shortLabel(code) {
  return `${window.location.host}/${code}`;
}

export function normalizeUrl(value) {
  let v = value.trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function randomCode(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
