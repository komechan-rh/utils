import { syncScriptProperties } from "shared/sync-script-properties-cli";

await syncScriptProperties({
  requiredKeys: ["LINE_GROUP_ID", "LINE_CHANNEL_ACCESS_TOKEN", "PAYROLL_SPREADSHEET_ID"],
});
