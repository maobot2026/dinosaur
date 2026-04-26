import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: {
    GITHUB_ACTIONS?: string;
    GITHUB_REPOSITORY?: string;
  };
};

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
});
