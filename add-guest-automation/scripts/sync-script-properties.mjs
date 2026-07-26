import { syncScriptProperties } from "shared/sync-script-properties-cli";

await syncScriptProperties({
  webAppUrlKey: "ADD_GUEST_WEBAPP_URL",
  requiredKeys: ["GUEST_EMAILS"],
});
