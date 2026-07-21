import { respondJson, syncScriptProperties } from "shared/script-properties-sync";
import { getCurrentWeekMonday, getWeeklyEvents } from "./calendar/schedule";
import { formatWeeklyMessage } from "./calendar/formatter";
import { pushTextMessage } from "./line-client";
import { handleLineWebhook } from "./line-webhook";
import { formatMonthlyPayrollMessage } from "./payroll/formatter";
import { getMonthlyPayroll } from "./payroll/sheet";

function weeklyScheduleToLine(): void {
  const props = PropertiesService.getScriptProperties();
  const groupId = props.getProperty("LINE_GROUP_ID");

  if (!groupId) throw new Error("LINE_GROUP_ID がスクリプトプロパティに設定されていません。");

  const monday = getCurrentWeekMonday();
  const events = getWeeklyEvents(monday);
  const message = formatWeeklyMessage(events, monday);

  pushTextMessage(groupId, message);
}

function monthlyPayrollToLine(): void {
  const props = PropertiesService.getScriptProperties();
  const groupId = props.getProperty("LINE_GROUP_ID");

  if (!groupId) throw new Error("LINE_GROUP_ID がスクリプトプロパティに設定されていません。");

  const result = getMonthlyPayroll();
  const message = formatMonthlyPayrollMessage(result);

  pushTextMessage(groupId, message);
}

function setupTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    const handlerFunction = trigger.getHandlerFunction();
    if (handlerFunction === "weeklyScheduleToLine" || handlerFunction === "monthlyPayrollToLine") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger("weeklyScheduleToLine")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  ScriptApp.newTrigger("monthlyPayrollToLine").timeBased().onMonthDay(25).atHour(8).create();

  console.log(
    "トリガーを登録しました。毎週月曜 8:00 に weeklyScheduleToLine、毎月25日 8:00 に monthlyPayrollToLine が実行されます。",
  );
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  let body: unknown;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (error) {
    return respondJson({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }

  // LINEのWebhookペイロードは常にトップレベルの events 配列を持つ。
  // スクリプトプロパティ同期リクエストは secret/properties を持ち、events は持たない。
  if (Array.isArray((body as { events?: unknown })?.events)) {
    return handleLineWebhook(e);
  }

  return respondJson(syncScriptProperties(body as { secret?: string; properties?: Record<string, string> }));
}

export { weeklyScheduleToLine, monthlyPayrollToLine, setupTrigger, doPost };
