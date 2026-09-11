import { defineConfig } from "vite";
// @ts-ignore
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
// @ts-ignore
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
      prerender: { routes: "*" },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
