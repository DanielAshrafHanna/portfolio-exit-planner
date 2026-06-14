/** Public Supabase client settings (safe for browser). Used as Preview fallback when Vercel env is unset. */
export const DEFAULT_SUPABASE_URL = "https://igfyiupvogkgzddyvnab.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZnlpdXB2b2drZ3pkZHl2bmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTcxMTQsImV4cCI6MjA5NjA3MzExNH0.gfX1mb-Y15-Qvc5X88hCxJSoeTkmX0OyzprlyKJH60s";

export function resolveSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
}

export function resolveSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;
}
