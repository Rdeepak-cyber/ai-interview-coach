import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("your-project") || anonKey.includes("your-")) {
    throw new Error("Supabase is not configured. Add your project URL and anon key to .env.local, then restart the dev server.");
  }

  return createBrowserClient(
    url,
    anonKey
  );
}
