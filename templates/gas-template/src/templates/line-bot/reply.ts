/**
 * LINE Messaging API - 自動応答（Webhook）
 *
 * GAS のウェブアプリとしてデプロイし、LINE Developers コンソールで
 * Webhook URL に登録してください。
 *
 * ## セットアップ
 * スクリプトプロパティ（Project Settings > Script Properties）に登録:
 *   LINE_CHANNEL_ACCESS_TOKEN : チャンネルアクセストークン
 *
 * ## 使い方
 * 1. GAS をウェブアプリとしてデプロイ（アクセス権限: 全員）
 * 2. LINE Developers コンソールの Webhook URL にデプロイ URL を設定
 * 3. Webhook を ON にする
 */

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

/**
 * チャンネルアクセストークンをスクリプトプロパティから取得する
 */
function getReplyChannelAccessToken_(): string {
  const token = PropertiesService.getScriptProperties().getProperty(
    "LINE_CHANNEL_ACCESS_TOKEN",
  );
  if (!token) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN がスクリプトプロパティに設定されていません。",
    );
  }
  return token;
}

/**
 * LINE Reply API を呼び出してメッセージを返信する
 *
 * @param replyToken - Webhook イベントから取得したリプライトークン
 * @param messages   - 送信するメッセージの配列（最大5件）
 */
function replyMessage(
  replyToken: string,
  messages: { type: string; text: string }[],
): void {
  const token = getReplyChannelAccessToken_();

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify({ replyToken, messages }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(LINE_REPLY_ENDPOINT, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(
      `LINE Reply API エラー: ステータスコード ${statusCode} - ${response.getContentText()}`,
    );
  }
}

/**
 * メッセージイベントを処理する
 *
 * @param event - LINE Webhook イベントオブジェクト
 */
function handleMessageEvent_(event: {
  replyToken?: string;
  message?: { type: string; text?: string };
}): void {
  const { replyToken, message } = event;
  if (!replyToken || !message) return;

  // テキストメッセージ以外はガイドメッセージを返す
  if (message.type !== "text" || !message.text) {
    replyMessage(replyToken, [
      { type: "text", text: "テキストメッセージのみ対応しています。" },
    ]);
    return;
  }

  // ========================================
  // ここで応答ロジックをカスタマイズしてください
  // ========================================
  const responseText = `「${message.text}」と受け取りました！`;

  replyMessage(replyToken, [{ type: "text", text: responseText }]);
}

/**
 * LINE Webhook を受け取るエントリーポイント
 *
 * GAS ウェブアプリの doPost 関数として動作します。
 * LINE サーバーからの POST リクエストを受け取り、各イベントを処理します。
 */
function doPost(
  e: GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput {
  try {
    const body = JSON.parse(e.postData.contents) as {
      destination: string;
      events: {
        type: string;
        replyToken?: string;
        message?: { type: string; text?: string };
        source: { type: string; userId?: string };
        timestamp: number;
      }[];
    };

    for (const event of body.events) {
      switch (event.type) {
        case "message":
          handleMessageEvent_(event);
          break;
        // 必要に応じて follow / unfollow / postback などを追加
        // case "follow":
        //   handleFollowEvent_(event);
        //   break;
        default:
          console.log(`未対応のイベントタイプ: ${event.type}`);
      }
    }
  } catch (error) {
    // LINE サーバーへのレスポンスは常に 200 を返す（エラー時もログのみ）
    console.error("Webhook 処理エラー:", error);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// GAS グローバルスコープに公開
export {};
