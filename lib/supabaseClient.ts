"use client";

import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "./supabasePublicConfig";

export function hasSupabaseConfig() {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

export function createSupabaseBrowserClient() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseAnonKey();
  return createBrowserClient(url, key);
}

