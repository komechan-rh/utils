/**
 * Notion API テンプレート
 *
 * Notion API を使ったデータベースへのページ作成・ページ更新のテンプレートです。
 *
 * ## ファイル構成
 *
 * ```
 * src/templates/notion-api/
 * ├── index.ts       このファイル（概要・使い方）
 * ├── types.ts       型定義（Notion API のリクエスト・レスポンス型）
 * ├── createPage.ts  データベースへのページ作成
 * └── updatePage.ts  ページのプロパティ更新・アーカイブ
 * ```
 *
 * ## セットアップ手順
 *
 * 1. Notion でインテグレーションを作成（https://www.notion.so/my-integrations）
 * 2. インテグレーションのシークレットキー（APIキー）を取得
 * 3. 操作対象のデータベース・ページにインテグレーションをコネクト
 *    （データベース右上「...」→「コネクト先」→ 作成したインテグレーションを選択）
 * 4. GAS のスクリプトプロパティに以下を設定:
 *    - NOTION_API_KEY     : インテグレーションのシークレットキー（必須）
 *    - NOTION_DATABASE_ID : ページを作成するデータベースの ID（createPage 用・任意）
 *    - NOTION_PAGE_ID     : 更新するページの ID（updatePage 用・任意）
 *
 * ## ページ ID / データベース ID の確認方法
 *
 * Notion でページ・データベースを開き、URL の末尾にある 32 文字の英数字が ID です。
 * 例: https://www.notion.so/My-Database-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *     → ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx（ハイフン区切り）
 *
 * ## 提供する関数
 *
 * ### createPage.ts（ページ作成）
 * - `createPageInDatabase(databaseId, properties, children?)` : データベースにページを作成
 * - `createSimplePage(title, titlePropName?)`                 : タイトルのみのシンプルなページを作成
 * - `createTaskPage()`                                        : タスクページを作成するサンプル
 *
 * ### updatePage.ts（ページ更新）
 * - `updatePage(pageId, properties)`                   : ページのプロパティを更新
 * - `updatePageTitle(pageId, newTitle, titlePropName?)` : ページのタイトルを更新
 * - `updatePageStatus(pageId, newStatus, propName?)`    : ページのステータスを更新
 * - `archivePage(pageId)`                              : ページをアーカイブ（削除）
 * - `completeTaskPage()`                               : タスクを完了状態に更新するサンプル
 *
 * ## 使用例
 *
 * ```typescript
 * // データベースにページを作成する
 * const page = createPageInDatabase("database-id", {
 *   "名前": { title: [{ type: "text", text: { content: "新しいタスク" } }] },
 *   "ステータス": { status: { name: "未着手" } },
 *   "期日": { date: { start: "2025-12-31" } },
 * });
 *
 * // ページのステータスを更新する
 * updatePage("page-id", {
 *   "ステータス": { status: { name: "完了" } },
 * });
 * ```
 */

