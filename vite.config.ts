// This project uses the Vite TanStack configuration wrapper that is required by the current app setup.
// Keep the custom startup logic here without altering the app's route or UI behavior.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { getSupabaseConfig } from "./src/integrations/supabase/client";

async function runSupabaseHealthCheck() {
  console.log("🚀 CampusFind starting...");

  const url = process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const anonKey = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!url || !anonKey) {
    console.log("✗ Supabase Database: NOT CONNECTED");
    console.log("⚠ Supabase Backend: UNAVAILABLE");
    console.log("Please check your Supabase URL and anon key configuration.");
    return;
  }

  try {
    const response = await fetch(`${url}/rest/v1/items?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("✓ Supabase Database: CONNECTED");
    console.log("✓ Supabase Backend: READY");
  } catch (error) {
    console.log("✗ Supabase Database: NOT CONNECTED");
    console.log("⚠ Supabase Backend: UNAVAILABLE");
    console.log("Please check your Supabase URL, anon key, internet connection, or database availability.");
    if (error instanceof Error) {
      console.log(`Reason: ${error.message}`);
    }
  }
}

function supabaseDevHealthCheckPlugin() {
  return {
    name: "supabase-dev-health-check",
    async configureServer() {
      await runSupabaseHealthCheck();
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [supabaseDevHealthCheckPlugin()],
});
