/**
 * Notion API - データベースへのページ作成
 *
 * 指定したデータベースに新しいページ（レコード）を作成します。
 *
 * ## セットアップ
 * スクリプトプロパティ（Project Settings > Script Properties）に登録:
 *   NOTION_API_KEY        : Notion インテグレーションのシークレットキー
 *   NOTION_DATABASE_ID    : ページを作成するデータベースの ID（任意・省略時は引数で指定）
 *
 * ## 使い方
 * 1. Notion でインテグレーションを作成し、API キーを取得
 * 2. 対象データベースにインテグレーションをコネクト（データベース右上の「...」から）
 * 3. スクリプトプロパティに NOTION_API_KEY を設定
 * 4. createPageInDatabase() を呼び出してページを作成
 */

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";

/**
 * Notion API キーをスクリプトプロパティから取得する
 */
function getNotionApiKey_(): string {
  const apiKey = PropertiesService.getScriptProperties().getProperty("NOTION_API_KEY");
  if (!apiKey) {
    throw new Error("NOTION_API_KEY がスクリプトプロパティに設定されていません。");
  }
  return apiKey;
}

/**
 * Notion API 共通リクエストオプションを生成する
 *
 * @param method  - HTTP メソッド
 * @param payload - リクエストボディ（オブジェクト）
 */
function buildNotionRequestOptions_(
  method: "get" | "post" | "patch" | "delete",
  payload?: object,
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
  const apiKey = getNotionApiKey_();
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    muteHttpExceptions: true,
  };
  if (payload !== undefined) {
    options.payload = JSON.stringify(payload);
  }
  return options;
}

/**
 * Notion API レスポンスを検証し、エラー時は例外を投げる
 *
 * @param response - UrlFetchApp のレスポンス
 * @param context  - エラーメッセージに付加するコンテキスト文字列
 */
function assertNotionResponse_(
  response: GoogleAppsScript.URL_Fetch.HTTPResponse,
  context: string,
): void {
  const statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      `Notion API エラー（${context}）: ステータスコード ${statusCode} - ${response.getContentText()}`,
    );
  }
}

/**
 * テキスト文字列から RichText オブジェクトを生成するヘルパー
 *
 * @param content - テキスト内容
 */
function buildRichText_(content: string): NotionRichText[] {
  return [{ type: "text", text: { content } }];
}

/**
 * 段落ブロックを生成するヘルパー
 *
 * @param content - 段落のテキスト内容
 */
function buildParagraphBlock_(content: string): NotionParagraphBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: buildRichText_(content) },
  };
}

/**
 * 指定したデータベースに新しいページを作成する
 *
 * @param databaseId - ページを作成するデータベースの ID
 * @param properties - ページのプロパティ（データベースのスキーマに合わせて設定）
 * @param children   - ページのコンテンツブロック（省略可）
 * @returns 作成されたページのレスポンスオブジェクト
 *
 * @example
 * // タイトルとステータスを持つページを作成する例
 * const page = createPageInDatabase("your-database-id", {
 *   "名前": { title: [{ type: "text", text: { content: "新しいタスク" } }] },
 *   "ステータス": { status: { name: "未着手" } },
 *   "期日": { date: { start: "2025-12-31" } },
 * });
 * console.log("作成されたページ ID:", page.id);
 */
function createPageInDatabase(
  databaseId: string,
  properties: NotionPageProperties,
  children?: NotionBlock[],
): NotionPageResponse {
  const url = `${NOTION_API_BASE_URL}/pages`;
  const body: CreatePageRequest = {
    parent: { database_id: databaseId },
    properties,
  };
  if (children && children.length > 0) {
    body.children = children;
  }

  const options = buildNotionRequestOptions_("post", body);
  const response = UrlFetchApp.fetch(url, options);
  assertNotionResponse_(response, "ページ作成");

  return JSON.parse(response.getContentText()) as NotionPageResponse;
}

/**
 * スクリプトプロパティの NOTION_DATABASE_ID に設定されたデータベースに
 * タイトルのみのシンプルなページを作成する
 *
 * @param title          - ページのタイトル
 * @param titlePropName  - タイトルプロパティのカラム名（デフォルト: "名前"）
 * @returns 作成されたページのレスポンスオブジェクト
 *
 * @example
 * createSimplePage("新しいページ");
 * createSimplePage("My Task", "Name"); // 英語カラム名のデータベース向け
 */
function createSimplePage(title: string, titlePropName = "名前"): NotionPageResponse {
  const databaseId = PropertiesService.getScriptProperties().getProperty("NOTION_DATABASE_ID");
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID がスクリプトプロパティに設定されていません。");
  }

  const properties: NotionPageProperties = {
    [titlePropName]: { title: buildRichText_(title) },
  };

  const page = createPageInDatabase(databaseId, properties);
  console.log(`ページを作成しました: ${page.id} (${page.url})`);
  return page;
}

/**
 * データベースにタスクページを作成するサンプル関数
 *
 * スクリプトプロパティの NOTION_DATABASE_ID に設定されたデータベースに
 * タイトル・ステータス・期日・メモを持つタスクページを作成します。
 *
 * データベースには以下のプロパティが必要です:
 *   - 名前（タイトル型）
 *   - ステータス（ステータス型）
 *   - 期日（日付型）
 *   - メモ（テキスト型）
 */
function createTaskPage(): void {
  const databaseId = PropertiesService.getScriptProperties().getProperty("NOTION_DATABASE_ID");
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID がスクリプトプロパティに設定されていません。");
  }

  const today = new Date().toISOString().split("T")[0];

  const properties: NotionPageProperties = {
    名前: { title: buildRichText_("GAS から作成したタスク") },
    ステータス: { status: { name: "未着手" } },
    期日: { date: { start: today } },
    メモ: { rich_text: buildRichText_("GAS の createTaskPage() で作成しました。") },
  };

  const children: NotionBlock[] = [
    buildParagraphBlock_("このページは Google Apps Script から Notion API を使って作成されました。"),
    buildParagraphBlock_("必要に応じてコンテンツを編集してください。"),
  ];

  const page = createPageInDatabase(databaseId, properties, children);
  console.log(`タスクページを作成しました: ${page.id}`);
  console.log(`URL: ${page.url}`);
}

