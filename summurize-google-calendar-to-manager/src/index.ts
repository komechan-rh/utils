import { getWeeklyEvents } from "./calendar";
import { formatWeeklyMessage } from "./formatter";
import { pushTextMessage } from "./line";

function weeklyScheduleToLine(): void {
  const props = PropertiesService.getScriptProperties();
  const calendarId = props.getProperty("CALENDAR_ID");
  const groupId = props.getProperty("LINE_GROUP_ID");

  if (!calendarId) throw new Error("CALENDAR_ID がスクリプトプロパティに設定されていません。");
  if (!groupId) throw new Error("LINE_GROUP_ID がスクリプトプロパティに設定されていません。");

  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const events = getWeeklyEvents(calendarId, monday);
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

export {};
