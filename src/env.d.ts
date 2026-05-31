/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_SUPPORT_URL?: string;
  readonly VITE_BANNER_ENABLED?: string;
  readonly VITE_BANNER_LABEL?: string;
  readonly VITE_BANNER_HREF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
