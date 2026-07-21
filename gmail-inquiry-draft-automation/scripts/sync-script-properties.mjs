import { syncScriptProperties } from "shared/sync-script-properties-cli";

// 同期対象は README.md の「スクリプトプロパティ」表に載っているキーのみに限定する。
// process.env をそのまま流し込むと無関係な値が Script Properties に混入するため。
await syncScriptProperties({
  requiredKeys: ["ORGANIZATION_NAME", "MANAGER_NAME", "GEMINI_API_KEY"],
  optionalKeys: [
    "GEMINI_MODEL",
    "REPLY_SIGNATURE",
    "LINE_FRIEND_URL",
    "INQUIRY_SUBJECT_KEYWORD",
    "PROCESSED_LABEL_NAME",
  ],
});
