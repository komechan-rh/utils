import { getCurrentWeekMonday, getWeeklyEvents } from "./calendar";
import { formatWeeklyMessage } from "./formatter";
import { replyTextMessage } from "./line";

const WEEKLY_SCHEDULE_KEYWORD = "今週の予定";
const GROUP_ID_KEYWORD = "ID";

type LineWebhookMessage = {
  type: string;
  text?: string;
};

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    groupId?: string;
    userId?: string;
    roomId?: string;
  };
  message?: LineWebhookMessage;
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function replyWeeklySchedule(replyToken: string): void {
  const monday = getCurrentWeekMonday();
  const events = getWeeklyEvents(monday);
  const message = formatWeeklyMessage(events, monday);

  replyTextMessage(replyToken, message);
}

function replyGroupId(replyToken: string, groupId: string | undefined): void {
  const text = groupId
    ? groupId
    : "このトークはグループではないため、グループIDを取得できません。";

  replyTextMessage(replyToken, text);
}

function handleLineWebhook(
  e: GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput {
  console.log(`Webhook受信: ${e.postData.contents}`);

  const body: LineWebhookBody = JSON.parse(e.postData.contents);

  for (const event of body.events ?? []) {
    if (event.source?.groupId) {
      console.log(`LINE_GROUP_ID: ${event.source.groupId}`);
    }

    if (
      event.type === "message" &&
      event.message?.type === "text" &&
      event.replyToken
    ) {
      if (event.message.text === WEEKLY_SCHEDULE_KEYWORD) {
        replyWeeklySchedule(event.replyToken);
      } else if (event.message.text === GROUP_ID_KEYWORD) {
        replyGroupId(event.replyToken, event.source?.groupId);
      }
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

export { handleLineWebhook };
