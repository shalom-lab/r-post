import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub project Pages: https://shalom-lab.github.io/r-post/
export default defineConfig({
  base: "/r-post/",
  plugins: [react()],
});
