const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

function getChannelAccessToken_(): string {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN がスクリプトプロパティに設定されていません。");
  }
  return token;
}

function pushTextMessage(to: string, text: string): void {
  const token = getChannelAccessToken_();

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(LINE_PUSH_ENDPOINT, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(
      `LINE API エラー: ステータスコード ${statusCode} - ${response.getContentText()}`,
    );
  }

  console.log(`LINE送信完了。送信先: ${to}`);
}

function replyTextMessage(replyToken: string, text: string): void {
  const token = getChannelAccessToken_();

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(LINE_REPLY_ENDPOINT, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(
      `LINE API エラー: ステータスコード ${statusCode} - ${response.getContentText()}`,
    );
  }

  console.log("LINE返信完了。");
}

export { pushTextMessage, replyTextMessage };
