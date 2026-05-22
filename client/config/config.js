const isLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1" || globalThis.location.hostname === "0.0.0.0";

export const API_URL = isLocal
  ? "http://localhost:3020"
  : `${globalThis.location.protocol}//${globalThis.location.hostname}:3020`;

export const WSS_URL = isLocal
  ? "ws://localhost:3020"
  : `${globalThis.location.protocol === "https:" ? "wss:" : "ws:"}//${globalThis.location.hostname}:3020`;

export const CLIENT_URL = `${globalThis.location.protocol}//${globalThis.location.host}`;
