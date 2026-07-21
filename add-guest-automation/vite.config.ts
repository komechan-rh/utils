import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "gas-entrypoint",
      generateBundle(_, bundle) {
        const chunk = bundle["index.js"];
        if (chunk?.type === "chunk") {
          chunk.code +=
            "\nfunction main() { AddGuestAutomationBundle.main(); }" +
            "\nfunction doPost(e) { return AddGuestAutomationBundle.doPost(e); }\n";
        }
      },
    },
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "AddGuestAutomationBundle",
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});
