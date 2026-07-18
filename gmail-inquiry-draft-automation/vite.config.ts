import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "gas-entrypoint",
      generateBundle(_, bundle) {
        const chunk = bundle["index.js"];
        if (chunk?.type === "chunk") {
          chunk.code +=
            "\nfunction main() { GmailInquiryDraftAutomationBundle.main(); }" +
            "\nfunction setupTrigger() { GmailInquiryDraftAutomationBundle.setupTrigger(); }\n";
        }
      },
    },
  ],
  build: {
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "GmailInquiryDraftAutomationBundle",
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});
