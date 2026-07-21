import { execFileSync } from "node:child_process";

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

function main() {
  const claspUser = process.env.CLASP_USER;
  if (!claspUser) {
    throw new Error("CLASP_USER が設定されていません。例: CLASP_USER=<name> pnpm run sync-props");
  }

  const props = buildProperties();
  console.log(`スクリプトプロパティを同期します。キー: ${Object.keys(props).join(", ")}`);

  try {
    execFileSync(
      "clasp",
      ["run", "setScriptProperties", "-p", JSON.stringify([props]), "-u", claspUser],
      { stdio: "inherit" },
    );
  } catch {
    // 実行時の例外オブジェクトには渡した引数（＝プロパティの値）が含まれうるため、
    // 詳細を出力せずサニタイズしたメッセージのみを投げる。
    throw new Error(
      "clasp run に失敗しました。事前に `pnpm run push` 済みか、Apps Script API が有効化されているか確認してください。",
    );
  }

  console.log("スクリプトプロパティを同期しました。");
}

main();
