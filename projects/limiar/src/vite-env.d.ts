/// <reference types="vite/client" />

import type { LimiarDebugApi } from './game/debug-api';

declare global {
  interface Window {
    /** API de debug (DEV ou ?debug=1); ver game/debug-api.ts. */
    __limiar?: LimiarDebugApi;
  }
}

export {};
