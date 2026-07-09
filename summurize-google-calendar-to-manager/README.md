# summurize-google-calendar-to-manager

TypeScript、pnpm、clasp を使った Google Apps Script プロジェクトです。
GAS 実行アカウント本人の Google カレンダー（デフォルトカレンダー）から今週の予定を取得し、毎週月曜 8:00 に LINE グループへ送信します。
また、LINE グループ内で「今週の予定」と発言すると、その場で今週の予定を返信します。

## セットアップ

```bash
pnpm install
```

1. 新規 GAS プロジェクトを作成する場合は `clasp create --type standalone --title "summurize-google-calendar-to-manager"` を実行します（複数アカウントを使う場合は `--user <name>` を付与）。
2. 既存の GAS プロジェクトへ紐付ける場合は `.clasp.json` を作成し、`scriptId` と `rootDir: "dist"` を設定します。
3. `pnpm run build` で TypeScript をコンパイルします。
4. `pnpm run push` で Apps Script に反映します。
5. Apps Script のブラウザ画面（`pnpm run open`）でスクリプトプロパティを設定します（下記「スクリプトプロパティ」参照）。
6. `setupTrigger` を一度だけ手動実行し、毎週月曜 8:00 の実行トリガーを登録します。

`.clasp.json` の例:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "dist"
}
```

## LINE Developers 設定

このプロジェクトは LINE Messaging API を使います。

- 毎週月曜 8:00 に push メッセージ（`https://api.line.me/v2/bot/message/push`）で今週の予定を送信
- LINE グループ内で「今週の予定」と発言すると、reply メッセージ（`https://api.line.me/v2/bot/message/reply`）でその場で返信（`src/webhook.ts` の `doPost`）
- LINE グループ内で「ID」と発言すると、そのグループの `group_id` を返信（`LINE_GROUP_ID` の設定に使う）

reply 機能を使うため、Webhook は一時的にではなく常時オンにしておく必要があります。

1. [LINE Developers コンソール](https://developers.line.biz/console/) にログインし、Provider を作成します（既にあれば流用）。
2. Provider 内に新規チャネルを作成し、チャネルタイプは **Messaging API** を選択します。
3. 作成したチャネルの「Messaging API設定」タブで、以下を行います。
   - **チャネルアクセストークン（長期）** を発行する → `LINE_CHANNEL_ACCESS_TOKEN` に使用
   - 「応答メッセージ」（LINE公式アカウントのデフォルト応答機能）をオフにする（`doPost` 側の応答と重複させないため）
   - 「Webhookの利用」をオンにする
4. `pnpm run push` で反映後、Apps Script エディタで「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」、実行ユーザー「自分」、アクセス「全員」でデプロイし、発行された URL を Messaging API 設定の Webhook URL に登録します（コードを更新した場合は「デプロイを管理」から同じデプロイを更新し、URLが変わらないようにします）。
5. 作成した Bot を、通知を送りたい LINE グループに招待します（QRコードまたは Bot の LINE ID で友だち追加してからグループに招待）。
6. グループ内で「ID」と発言し、返信された `group_id` を `LINE_GROUP_ID` に使います。
7. 取得したチャネルアクセストークンとグループIDを、GAS のスクリプトプロパティに設定します。

## スクリプトプロパティ

Apps Script エディタの「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定します。

| キー | 値 |
|------|----|
| `LINE_GROUP_ID` | 送信先 LINE グループのID |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers で発行したチャネルアクセストークン（長期） |

## コマンド

- `pnpm run build` - TypeScript をコンパイルし、`appsscript.json` を `dist/` にコピー
- `pnpm run watch` - TypeScript の変更を監視してコンパイル
- `pnpm run push` - ビルド後に Apps Script へプッシュ
- `pnpm run deploy` - clasp でデプロイ
- `pnpm run open` - Apps Script エディタを開く
- `pnpm run typecheck` - 型チェック
- `pnpm run lint` - Biome lint
- `pnpm run test` - Vitest
