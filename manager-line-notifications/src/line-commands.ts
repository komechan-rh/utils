import { getCurrentWeekMonday, getWeeklyEvents } from "./calendar/schedule";
import { formatWeeklyMessage } from "./calendar/formatter";
import { replyTextMessage } from "./line-client";
import { formatMonthlyPayrollMessage } from "./payroll/formatter";
import { getMonthlyPayroll } from "./payroll/sheet";

type LineCommandContext = {
  replyToken: string;
  groupId?: string;
};

type LineCommandHandler = (context: LineCommandContext) => void;

function replyWeeklySchedule({ replyToken }: LineCommandContext): void {
  const monday = getCurrentWeekMonday();
  const events = getWeeklyEvents(monday);
  const message = formatWeeklyMessage(events, monday);

  replyTextMessage(replyToken, message);
}

function replyGroupId({ replyToken, groupId }: LineCommandContext): void {
  const text = groupId
    ? groupId
    : "このトークはグループではないため、グループIDを取得できません。";

  replyTextMessage(replyToken, text);
}

function replyMonthlyPayroll({ replyToken }: LineCommandContext): void {
  const result = getMonthlyPayroll();
  const message = formatMonthlyPayrollMessage(result);

  replyTextMessage(replyToken, message);
}

// LINEグループ内での発言キーワードとハンドラの対応表。
// 発言キーワードが増えても、この対応表に追加するだけでよい。
const LINE_COMMANDS: Record<string, LineCommandHandler> = {
  今週の予定: replyWeeklySchedule,
  今月の給与: replyMonthlyPayroll,
  ID: replyGroupId,
};

function findLineCommand(text: string): LineCommandHandler | undefined {
  return LINE_COMMANDS[text];
}

export { findLineCommand };
export type { LineCommandContext, LineCommandHandler };
