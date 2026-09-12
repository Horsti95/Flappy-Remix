/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPPORT_URL?: string;
  readonly VITE_BANNER_ENABLED?: string;
  readonly VITE_BANNER_LABEL?: string;
  readonly VITE_BANNER_HREF?: string;
  readonly VITE_FEEDBACK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build identity, replaced at build time by vite's `define` (see
 * vite.config.ts). Declared here so the crash screen and feedback form can
 * read them without an import.
 */
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;
