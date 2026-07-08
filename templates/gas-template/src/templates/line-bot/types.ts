/**
 * LINE Messaging API の型定義
 *
 * GAS はファイル間のモジュール読み込みをサポートしないため、
 * このファイルの型は TypeScript コンパイル時のみ使用されます（実行時には消去）。
 */

type LineMessageType = "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LineWebhookSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

interface LineWebhookEvent {
  type: string;
  message?: { type: LineMessageType; text?: string; [key: string]: unknown };
  timestamp: number;
  source: LineWebhookSource;
  replyToken?: string;
  mode: "active" | "standby";
}

interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

// このファイルを TypeScript モジュールとして認識させるためのダミーエクスポート
export {};
