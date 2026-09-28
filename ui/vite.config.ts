import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The Straapp API (api/, `dotnet run`), proxied so the app can call /api on its own origin
    // without any CORS setup.
    proxy: {
      "/api": "http://localhost:5080",
    },
  },
});
