import { getCurrentWeekMonday, getWeeklyEvents } from "./calendar-schedule";
import { formatWeeklyMessage } from "./calendar-formatter";
import { pushTextMessage } from "./line-client";
import { handleLineWebhook } from "./line-webhook";

function weeklyScheduleToLine(): void {
  const props = PropertiesService.getScriptProperties();
  const groupId = props.getProperty("LINE_GROUP_ID");

  if (!groupId) throw new Error("LINE_GROUP_ID がスクリプトプロパティに設定されていません。");

  const monday = getCurrentWeekMonday();
  const events = getWeeklyEvents(monday);
  const message = formatWeeklyMessage(events, monday);

  pushTextMessage(groupId, message);
}

function setupTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "weeklyScheduleToLine") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger("weeklyScheduleToLine")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  console.log("トリガーを登録しました。毎週月曜 8:00 に weeklyScheduleToLine が実行されます。");
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return handleLineWebhook(e);
}

export { weeklyScheduleToLine, setupTrigger, doPost };
