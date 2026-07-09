import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "gas-entrypoint",
      generateBundle(_, bundle) {
        const chunk = bundle["index.js"];
        if (chunk?.type === "chunk") {
          chunk.code +=
            "\nfunction weeklyScheduleToLine() { SummurizeGoogleCalendarToManagerBundle.weeklyScheduleToLine(); }" +
            "\nfunction setupTrigger() { SummurizeGoogleCalendarToManagerBundle.setupTrigger(); }" +
            "\nfunction doPost(e) { return SummurizeGoogleCalendarToManagerBundle.doPost(e); }\n";
        }
      },
    },
  ],
  build: {
    emptyOutDir: true,
    minify: false,
    target: "es2017",
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "SummurizeGoogleCalendarToManagerBundle",
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});
