import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  ssr:
    command === "build"
      ? { external: ["wordtosite"] }
      : { noExternal: ["wordtosite"] },
  plugins: [
    nitro({ rollupConfig: { external: ["wordtosite"] } }),
    tanstackStart({
      srcDirectory: "app",
      prerender: { crawlLinks: false, autoStaticPathsDiscovery: false },
      pages: [
        { path: "/", prerender: { enabled: true, crawlLinks: false } },
        { path: "/pricing", prerender: { enabled: true, crawlLinks: false } },
        { path: "/docs", prerender: { enabled: true, crawlLinks: false } },
        { path: "/changelog", prerender: { enabled: true, crawlLinks: false } },
        { path: "/mission", prerender: { enabled: true, crawlLinks: false } },
        { path: "/privacy", prerender: { enabled: true, crawlLinks: false } },
        { path: "/terms", prerender: { enabled: true, crawlLinks: false } },
      ],
    }),
    viteReact(),
  ],
}));
