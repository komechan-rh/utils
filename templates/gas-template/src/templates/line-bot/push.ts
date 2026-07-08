/**
 * LINE Messaging API - Push 通知
 *
 * 任意のタイミングでユーザー・グループに通知を送信する関数群です。
 * スプレッドシートのトリガーや他の GAS 関数から呼び出せます。
 *
 * ## セットアップ
 * スクリプトプロパティ（Project Settings > Script Properties）に登録:
 *   LINE_CHANNEL_ACCESS_TOKEN : チャンネルアクセストークン
 *   LINE_DEFAULT_USER_ID      : デフォルト送信先ユーザー ID（省略可）
 *
 * ## Push 通知の料金について
 * Push 通知は LINE の料金プランにより無料メッセージ数の上限があります。
 * 詳細: https://developers.line.biz/ja/docs/messaging-api/overview/
 */

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_MULTICAST_ENDPOINT = "https://api.line.me/v2/bot/message/multicast";
const LINE_BROADCAST_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";

/**
 * チャンネルアクセストークンをスクリプトプロパティから取得する
 */
function getPushChannelAccessToken_(): string {
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
 * LINE API へ POST リクエストを送信する内部関数
 *
 * @param endpoint - 送信先エンドポイント URL
 * @param payload  - リクエストボディ（JSON シリアライズ対象）
 */
function postToLineApi_(endpoint: string, payload: object): void {
  const token = getPushChannelAccessToken_();

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(
      `LINE API エラー [${endpoint}]: ステータスコード ${statusCode} - ${response.getContentText()}`,
    );
  }
}

/**
 * 特定のユーザー・グループ・トークルームに Push 通知を送信する
 *
 * @param to       - 送信先 ID（userId / groupId / roomId）
 * @param messages - 送信するメッセージの配列（最大5件）
 *
 * @example
 * pushMessage("U1234567890abcdef", [{ type: "text", text: "お知らせです！" }]);
 */
function pushMessage(
  to: string,
  messages: { type: string; text: string }[],
): void {
  postToLineApi_(LINE_PUSH_ENDPOINT, { to, messages });
  console.log(`Push 通知を送信しました。送信先: ${to}`);
}

/**
 * 複数ユーザーに同じメッセージを一括送信する（マルチキャスト）
 *
 * @param userIds  - 送信先ユーザー ID の配列（最大 500 件）
 * @param messages - 送信するメッセージの配列（最大5件）
 *
 * @example
 * multicastMessage(
 *   ["U111...", "U222..."],
 *   [{ type: "text", text: "一斉送信のお知らせです！" }]
 * );
 */
function multicastMessage(
  userIds: string[],
  messages: { type: string; text: string }[],
): void {
  if (userIds.length === 0) {
    console.warn("送信先ユーザー ID が指定されていません。");
    return;
  }
  if (userIds.length > 500) {
    throw new Error("マルチキャストの送信先は最大 500 件までです。");
  }
  postToLineApi_(LINE_MULTICAST_ENDPOINT, { to: userIds, messages });
  console.log(`マルチキャスト送信完了。送信先: ${userIds.length} 件`);
}

/**
 * チャンネルの全友だちにメッセージをブロードキャストする
 *
 * @param messages - 送信するメッセージの配列（最大5件）
 *
 * @example
 * broadcastMessage([{ type: "text", text: "全員へのお知らせです！" }]);
 */
function broadcastMessage(messages: { type: string; text: string }[]): void {
  postToLineApi_(LINE_BROADCAST_ENDPOINT, { messages });
  console.log("ブロードキャスト送信完了。");
}

/**
 * スクリプトプロパティのデフォルトユーザーにテキスト Push 通知を送る便利関数
 *
 * LINE_DEFAULT_USER_ID をプロパティに設定しておくと、
 * 引数なしで手軽に通知を送れます。
 *
 * @param text - 送信するテキストメッセージ
 *
 * @example
 * // スプレッドシートのトリガーなどから呼び出す
 * pushTextToDefaultUser("集計が完了しました！");
 */
function pushTextToDefaultUser(text: string): void {
  const userId = PropertiesService.getScriptProperties().getProperty(
    "LINE_DEFAULT_USER_ID",
  );
  if (!userId) {
    throw new Error(
      "LINE_DEFAULT_USER_ID がスクリプトプロパティに設定されていません。",
    );
  }
  pushMessage(userId, [{ type: "text", text }]);
}

// GAS グローバルスコープに公開
export {};
