/**
 * @input Vite core config APIs, Vue plugin, and unplugin-based Element Plus resolvers
 * @output Vite config providing dev proxy, component auto import, and production chunk splitting strategy
 * @position Frontend tooling entrypoint controlling development server behavior and build-time performance optimization
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ["vue", "vue-router"],
      dts: false,
      resolvers: [
        ElementPlusResolver({
          importStyle: "css"
        })
      ]
    }),
    Components({
      dts: false,
      resolvers: [
        ElementPlusResolver({
          importStyle: "css"
        })
      ]
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:18080",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("vue") || id.includes("pinia") || id.includes("vue-router")) {
              return "framework";
            }
            if (id.includes("element-plus") || id.includes("@element-plus/icons-vue")) {
              return "ui-core";
            }
            if (id.includes("axios") || id.includes("dayjs")) {
              return "utils";
            }
            return "vendor";
          }

          if (id.includes("/src/") && id.endsWith("View.vue")) {
            return "views";
          }

          return undefined;
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});