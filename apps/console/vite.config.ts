import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 相对路径，兼容 GitHub project Pages 与本地 preview
export default defineConfig({
  base: "./",
  plugins: [react()],
});
