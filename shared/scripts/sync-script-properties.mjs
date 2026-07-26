/**
 * Infisicalから注入された環境変数のうち、呼び出し側が指定したキーだけを抽出し、
 * 各automationが個別にデプロイしたWebアプリ(doPost)へ {secret, properties} としてPOSTする。
 * WebアプリのURLを保持する環境変数名は automation ごとに異なる値を持つため、
 * 呼び出し側が `webAppUrlKey` で自身のキー名を指定する（全automationで共通の `WEBAPP_URL` は使わない）。
 * @param {{ webAppUrlKey: string; requiredKeys: string[]; optionalKeys?: string[] }} options
 */
export async function syncScriptProperties({ webAppUrlKey, requiredKeys, optionalKeys = [] }) {
  const webAppUrl = process.env[webAppUrlKey];
  if (!webAppUrl) {
    throw new Error(
      `${webAppUrlKey} が環境変数に設定されていません。\`pnpm run deploy\` で発行したWebアプリのURLをInfisicalに登録してください。`,
    );
  }

  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) {
    throw new Error(
      "SYNC_SECRET が環境変数に設定されていません。Apps Scriptエディタのスクリプトプロパティに設定した値と同じものをInfisicalに登録してください。",
    );
  }

  const properties = {};

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`${key} が環境変数に設定されていません。Infisicalに登録されているか確認してください。`);
    }
    properties[key] = value;
  }

  for (const key of optionalKeys) {
    const value = process.env[key];
    if (value) {
      properties[key] = value;
    }
  }

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
