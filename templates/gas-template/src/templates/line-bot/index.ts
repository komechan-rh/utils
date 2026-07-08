/**
 * LINE Bot テンプレート
 *
 * LINE Developers の Messaging API を使った自動応答・Push 通知のテンプレートです。
 *
 * ## ファイル構成
 *
 * ```
 * src/templates/line-bot/
 * ├── index.ts   このファイル（概要・使い方）
 * ├── reply.ts   自動応答（Webhook 受信 → doPost → replyMessage）
 * ├── push.ts    Push 通知（pushMessage / multicastMessage / broadcastMessage）
 * └── types.ts   型定義
 * ```
 *
 * ## セットアップ手順
 *
 * 1. LINE Developers コンソール（https://developers.line.biz/）でチャンネルを作成
 * 2. Messaging API チャンネルのチャンネルアクセストークンを発行
 * 3. GAS のスクリプトプロパティに以下を設定:
 *    - LINE_CHANNEL_ACCESS_TOKEN : チャンネルアクセストークン（必須）
 *    - LINE_DEFAULT_USER_ID      : デフォルト送信先ユーザー ID（Push 通知用・任意）
 * 4. GAS をウェブアプリとしてデプロイ（アクセス権限: 全員）
 * 5. LINE Developers コンソールの Webhook URL にデプロイ URL を設定
 * 6. Webhook を ON にする
 *
 * ## 提供する関数
 *
 * ### reply.ts（自動応答）
 * - `doPost(e)`              : LINE Webhook を受け取るエントリーポイント
 * - `replyMessage(token, messages)` : リプライトークンを使って返信
 *
 * ### push.ts（Push 通知）
 * - `pushMessage(to, messages)`          : 特定ユーザー/グループに送信
 * - `multicastMessage(userIds, messages)` : 複数ユーザーに一括送信（最大 500 件）
 * - `broadcastMessage(messages)`          : 全友だちに送信
 * - `pushTextToDefaultUser(text)`         : デフォルトユーザーに手軽にテキスト送信
 */

export {};
