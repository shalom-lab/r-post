import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
      for (const route of ["articles", "topics", "settings"]) {
        mkdirSync(`${dist}/${route}`, { recursive: true });
        writeFileSync(`${dist}/${route}/index.html`, appShell);
      }
      const manifestPath = fileURLToPath(new URL("public/content/index.json", import.meta.url));
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          articles?: Array<{ id: string }>;
        };
        for (const article of manifest.articles || []) {
          mkdirSync(`${dist}/article/${article.id}`, { recursive: true });
          writeFileSync(`${dist}/article/${article.id}/index.html`, appShell);
        }
      }
      // Unknown routes still load the app instead of the Pages 404 document.
      writeFileSync(`${dist}/404.html`, appShell);
    },
  }],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
