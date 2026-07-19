export function createId(prefix = "id"): string {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  const randomValues = globalThis.crypto?.getRandomValues;
  if (typeof randomValues === "function") {
    const bytes = new Uint8Array(16);
    randomValues.call(globalThis.crypto, bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function assertWebCryptoSupport(): void {
  if (typeof window === "undefined") return;

  const hasDigest = typeof globalThis.crypto?.subtle?.digest === "function";
  if (!hasDigest) {
    console.warn(
      "Web Crypto API crypto.subtle.digest is unavailable. Use HTTPS or localhost in production; some preview/runtime dependencies require a secure context.",
    );
  }
}
