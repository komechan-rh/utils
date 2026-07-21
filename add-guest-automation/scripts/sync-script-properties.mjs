import { syncScriptProperties } from "shared/sync-script-properties-cli";

await syncScriptProperties({
  requiredKeys: ["GUEST_EMAILS"],
});
