/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OAUTH_REDIRECT_ORIGIN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
}
