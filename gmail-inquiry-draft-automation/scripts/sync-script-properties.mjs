// Infisical等の環境変数からスクリプトプロパティに同期するキーの一覧。
// process.env をそのまま流し込むと無関係な値が Script Properties に混入するため、
// 同期対象は README.md の「スクリプトプロパティ」表に載っているキーのみに限定する。
const REQUIRED_KEYS = ["ORGANIZATION_NAME", "MANAGER_NAME", "GEMINI_API_KEY"];
const OPTIONAL_KEYS = [
  "GEMINI_MODEL",
  "REPLY_SIGNATURE",
  "LINE_FRIEND_URL",
  "INQUIRY_SUBJECT_KEYWORD",
  "PROCESSED_LABEL_NAME",
];

function buildProperties() {
  const props = {};

  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`${key} が環境変数に設定されていません。Infisicalに登録されているか確認してください。`);
    }
    props[key] = value;
  }

  for (const key of OPTIONAL_KEYS) {
    const value = process.env[key];
    if (value) {
      props[key] = value;
    }
  }

  return props;
}

async function main() {
  const webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl) {
    throw new Error(
      "WEBAPP_URL が環境変数に設定されていません。`pnpm run deploy` で発行したWebアプリのURLをInfisicalに登録してください。",
    );
  }

  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) {
    throw new Error(
      "SYNC_SECRET が環境変数に設定されていません。Apps Scriptエディタのスクリプトプロパティに設定した値と同じものをInfisicalに登録してください。",
    );
  }

  const properties = buildProperties();
  console.log(`スクリプトプロパティを同期します。キー: ${Object.keys(properties).join(", ")}`);

  const response = await fetch(webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: syncSecret, properties }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Webアプリへの同期リクエストが失敗しました。詳細: ${result?.error ?? response.statusText}`);
  }

  console.log("スクリプトプロパティを同期しました。");
}

main();
