/// <reference types="vite/client" />

/** Compiled-in allow-list of host origins (vite.config.ts, from HOST_ORIGINS; RULE-16, ADR-0010). */
declare const __HOST_ORIGINS__: readonly string[];

/** True in a production build only: the offline service worker is registered (ADR-0011, MOD-Build). */
declare const __TK_OFFLINE__: boolean;
