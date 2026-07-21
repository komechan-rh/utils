# gmail-inquiry-draft-automation

TypeScript、pnpm、clasp を使った Google Apps Script プロジェクトです。
Gmail に届いた問い合わせメールに対して、返信の下書きを自動作成します。

GAS には「メール受信をトリガーに直接実行する」仕組みがないため、時間主導型トリガーで受信箱を定期的にポーリングする方式にしています。件名に指定キーワードを含むスレッドのうち、まだ下書きを作成していない最新の1件を見つけて処理します。

## 仕組み

1. `main` が `subject:"<問い合わせキーワード>" -label:"<処理済みラベル>"` で該当スレッドを検索し、最新の1件のみを対象にします。件名（タイトル）に `INQUIRY_SUBJECT_KEYWORD`（既定値: `問い合わせ`）を含むメールが対象です（部分一致）。未処理が複数ある場合は、次回以降のトリガー実行で順次処理されます。
2. 各スレッドについて、既に下書きが存在する場合はスキップします。なければ、最新メッセージの本文を Gemini API に渡し、内見希望日の有無に応じた文面（希望日があればその日時で確定する旨、なければ候補日時を3つ程度提案する旨）を生成させます。
3. 下書き本文は「固定の冒頭挨拶」＋「Gemini APIが生成した本文」＋「固定のLINE案内・署名」で組み立てます。
4. 処理したスレッドには処理済みラベル（`PROCESSED_LABEL_NAME`、既定値: `下書き作成済み`。存在しない場合は自動作成）を付与し、次回以降の重複処理を防ぎます。

下書きを作成するだけで送信は行いません。内容を確認のうえ、手動で送信してください。

## セットアップ

```bash
pnpm install
```

1. 新規 GAS プロジェクトを作成する場合は `clasp create --type standalone --title "gmail-inquiry-draft-automation"` を実行します（複数アカウントを使う場合は `--user <name>` を付与）。
2. 既存の GAS プロジェクトへ紐付ける場合は `.clasp.json` を作成し、`scriptId` と `rootDir: "dist"` を設定します。
3. `pnpm run build` で TypeScript をコンパイルします。
4. `pnpm run push` で Apps Script に反映します。
5. Apps Script のブラウザ画面（`pnpm run open`）でスクリプトプロパティを設定します（下記「スクリプトプロパティ」参照）。
6. `setupTrigger` を一度だけ手動実行し、`TRIGGER_INTERVAL_MINUTES`（既定値: 5分）ごとに `main` が実行される時間主導型トリガーを登録します。

`.clasp.json` の例:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "dist"
}
```

`pnpm run push` / `pnpm run deploy` / `pnpm run open` は `CLASP_USER` 環境変数で指定した clasp ユーザーを使います（未設定の場合はエラーになり、`default` アカウントが誤って使われることはありません）。

```bash
CLASP_USER=<clasp-user-alias> pnpm run push
```

## スクリプトプロパティ

Apps Script エディタの「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定します。

| キー | 必須 | 値 |
|------|------|----|
| `ORGANIZATION_NAME` | 必須 | 下書き本文で名乗る組織・施設名（例: `〇〇ハウス`） |
| `MANAGER_NAME` | 必須 | 下書き本文の冒頭挨拶で名乗る管理人氏名（例: `〇〇`） |
| `GEMINI_API_KEY` | 必須 | Gemini API のAPIキー（[Google AI Studio](https://aistudio.google.com/apikey)で発行） |
| `GEMINI_MODEL` | 任意 | 本文生成に使うGeminiのモデル名（既定値: `gemini-2.5-flash`） |
| `REPLY_SIGNATURE` | 任意 | 下書き本文の末尾に付ける署名（未設定の場合は署名なし） |
| `LINE_FRIEND_URL` | 任意 | 公式LINEアカウントの友達追加URL。設定すると本文と署名の間に友達追加を案内する文言を挿入する（未設定の場合は案内なし） |
| `INQUIRY_SUBJECT_KEYWORD` | 任意 | 問い合わせメールと判定する件名（タイトル）キーワード。部分一致（既定値: `問い合わせ`） |
| `PROCESSED_LABEL_NAME` | 任意 | 下書き作成済みスレッドに付与するラベル名（既定値: `下書き作成済み`） |

各プロパティ値の前後の空白は自動で除去されるため、コピー&ペースト時に空白が混入しても判定への影響はありません。

### Infisical によるスクリプトプロパティの自動同期（任意）

上記の値を毎回 Apps Script エディタで手入力する代わりに、[Infisical](https://infisical.com/) に登録した値を `clasp run` 経由でスクリプトプロパティへ同期できます。

前提:

- [Infisical CLI](https://infisical.com/docs/cli/overview) をインストール済みで、`infisical login` / `infisical init` をこのディレクトリで実行済みであること
- Infisical 側に、上記表と同じキー名（`ORGANIZATION_NAME` / `MANAGER_NAME` / `GEMINI_API_KEY` など）でシークレットを登録済みであること
- `pnpm run push` を実行済みで、`setScriptProperties` 関数が Apps Script 側に反映されていること
- [script.google.com/home/usersettings](https://script.google.com/home/usersettings) で Google Apps Script API が有効になっていること（`clasp run` の実行に必要）

実行方法:

```bash
CLASP_USER=<clasp-user-alias> pnpm run sync-props
```

内部では `infisical run -- node scripts/sync-script-properties.mjs` を実行し、Infisicalから注入された環境変数のうち上記表のキーだけを抽出して `clasp run setScriptProperties` に渡します。`process.env` を丸ごと転送するわけではないため、無関係な環境変数やシークレットが Script Properties に混入することはありません。

セキュリティ上の注意:

- `clasp run` はプロパティの値をコマンドライン引数として渡すため、実行中は同一マシン上の他プロセスから一瞬見える可能性があります。**個人の開発端末でのみ実行し、共有CIランナー等では使用しないでください。**
- 同期対象のキー・値はログに出力されません（出力されるのはキー名のみ）。

## コマンド

- `pnpm run build` - TypeScript をコンパイルし、`appsscript.json` を `dist/` にコピー
- `pnpm run watch` - TypeScript の変更を監視してコンパイル
- `pnpm run push` - ビルド後に Apps Script へプッシュ
- `pnpm run sync-props` - Infisical のシークレットをスクリプトプロパティへ同期（`CLASP_USER` 必須。前掲の「Infisical によるスクリプトプロパティの自動同期」参照）
- `pnpm run deploy` - clasp でデプロイ
- `pnpm run open` - Apps Script エディタを開く
- `pnpm run typecheck` - 型チェック
- `pnpm run lint` - Biome lint
- `pnpm run test` - Vitest
