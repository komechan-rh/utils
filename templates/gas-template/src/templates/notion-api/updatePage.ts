/**
 * Notion API - ページの更新
 *
 * 指定したページのプロパティを更新します。
 * ページのアーカイブ（削除）にも対応しています。
 *
 * ## セットアップ
 * スクリプトプロパティ（Project Settings > Script Properties）に登録:
 *   NOTION_API_KEY     : Notion インテグレーションのシークレットキー
 *   NOTION_PAGE_ID     : 更新するページの ID（任意・省略時は引数で指定）
 *
 * ## 使い方
 * 1. Notion でインテグレーションを作成し、API キーを取得
 * 2. 対象ページが属するデータベースにインテグレーションをコネクト
 * 3. スクリプトプロパティに NOTION_API_KEY を設定
 * 4. updatePage() または各ヘルパー関数を呼び出してページを更新
 *
 * ## ページ ID の確認方法
 * Notion でページを開き、URL の末尾にある 32 文字の英数字がページ ID です。
 * 例: https://www.notion.so/My-Page-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *     → ページ ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx（ハイフン区切り）
 */

// createPage.ts で定義した定数・関数を再利用（GAS は同一スクリプト内で共有）
// NOTION_API_BASE_URL, NOTION_API_VERSION, buildNotionRequestOptions_,
// assertNotionResponse_, buildRichText_ は createPage.ts で定義済み

/**
 * 指定したページのプロパティを更新する
 *
 * @param pageId     - 更新するページの ID
 * @param properties - 更新するプロパティ（変更したいプロパティのみ指定可）
 * @returns 更新されたページのレスポンスオブジェクト
 *
 * @example
 * // ステータスと期日を更新する例
 * const updated = updatePage("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", {
 *   "ステータス": { status: { name: "進行中" } },
 *   "期日": { date: { start: "2025-12-31" } },
 * });
 * console.log("更新日時:", updated.last_edited_time);
 */
function updatePage(
  pageId: string,
  properties: NotionPageProperties,
): NotionPageResponse {
  const url = `${NOTION_API_BASE_URL}/pages/${pageId}`;
  const body: UpdatePageRequest = { properties };

  const options = buildNotionRequestOptions_("patch", body);
  const response = UrlFetchApp.fetch(url, options);
  assertNotionResponse_(response, "ページ更新");

  return JSON.parse(response.getContentText()) as NotionPageResponse;
}

/**
 * ページのタイトルを更新する
 *
 * @param pageId        - 更新するページの ID
 * @param newTitle      - 新しいタイトル
 * @param titlePropName - タイトルプロパティのカラム名（デフォルト: "名前"）
 * @returns 更新されたページのレスポンスオブジェクト
 *
 * @example
 * updatePageTitle("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "更新後のタイトル");
 */
function updatePageTitle(
  pageId: string,
  newTitle: string,
  titlePropName = "名前",
): NotionPageResponse {
  const properties: NotionPageProperties = {
    [titlePropName]: { title: buildRichText_(newTitle) },
  };
  const page = updatePage(pageId, properties);
  console.log(`タイトルを更新しました: ${page.id}`);
  return page;
}

/**
 * ページのステータスを更新する
 *
 * @param pageId         - 更新するページの ID
 * @param newStatus      - 新しいステータス名（データベースに存在するステータス名を指定）
 * @param statusPropName - ステータスプロパティのカラム名（デフォルト: "ステータス"）
 * @returns 更新されたページのレスポンスオブジェクト
 *
 * @example
 * updatePageStatus("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "完了");
 */
function updatePageStatus(
  pageId: string,
  newStatus: string,
  statusPropName = "ステータス",
): NotionPageResponse {
  const properties: NotionPageProperties = {
    [statusPropName]: { status: { name: newStatus } },
  };
  const page = updatePage(pageId, properties);
  console.log(`ステータスを「${newStatus}」に更新しました: ${page.id}`);
  return page;
}

/**
 * ページをアーカイブ（削除）する
 *
 * アーカイブしたページは Notion のゴミ箱に移動します。
 * 復元するには Notion UI 上で操作してください。
 *
 * @param pageId - アーカイブするページの ID
 * @returns 更新されたページのレスポンスオブジェクト
 */
function archivePage(pageId: string): NotionPageResponse {
  const url = `${NOTION_API_BASE_URL}/pages/${pageId}`;
  const body: UpdatePageRequest = { properties: {}, archived: true };

  const options = buildNotionRequestOptions_("patch", body);
  const response = UrlFetchApp.fetch(url, options);
  assertNotionResponse_(response, "ページアーカイブ");

  const page = JSON.parse(response.getContentText()) as NotionPageResponse;
  console.log(`ページをアーカイブしました: ${page.id}`);
  return page;
}

/**
 * タスクページを完了状態に更新するサンプル関数
 *
 * スクリプトプロパティの NOTION_PAGE_ID に設定されたページの
 * タイトルとステータスを更新します。
 *
 * 対象ページのデータベースには以下のプロパティが必要です:
 *   - 名前（タイトル型）
 *   - ステータス（ステータス型）
 */
function completeTaskPage(): void {
  const pageId = PropertiesService.getScriptProperties().getProperty("NOTION_PAGE_ID");
  if (!pageId) {
    throw new Error("NOTION_PAGE_ID がスクリプトプロパティに設定されていません。");
  }

  const properties: NotionPageProperties = {
    名前: { title: buildRichText_("GAS から更新したタスク（完了）") },
    ステータス: { status: { name: "完了" } },
  };

  const page = updatePage(pageId, properties);
  console.log(`タスクを完了状態に更新しました: ${page.id}`);
  console.log(`URL: ${page.url}`);
}

