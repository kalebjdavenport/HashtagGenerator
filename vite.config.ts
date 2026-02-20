import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["@mlc-ai/web-llm"],
  },
});
