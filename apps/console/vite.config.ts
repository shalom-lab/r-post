import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// GitHub project Pages: https://shalom-lab.github.io/r-post/
export default defineConfig({
  base: "/r-post/",
  plugins: [react(), {
    name: "pages-route-entries",
    apply: "build",
    closeBundle() {
      const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
      const appShell = readFileSync(`${dist}/index.html`);
      // Pages has no server-side rewrite: serve the app at each static route.
      for (const route of ["topics", "articles", "prompts", "settings", "categories", "generate", "new"]) {
        mkdirSync(`${dist}/${route}`, { recursive: true });
        writeFileSync(`${dist}/${route}/index.html`, appShell);
      }
      // Dynamic article URLs also load the app when opened directly.
      writeFileSync(`${dist}/404.html`, appShell);
    },
  }],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
