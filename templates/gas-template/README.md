# GAS テンプレート

TypeScript、pnpm、clasp を使った Google Apps Script のスタータープロジェクトです。

## セットアップ

```bash
cd gas-template
pnpm install
```

1. `clasp.json` の `scriptId` を有効な値に設定します（[clasp](https://github.com/google/clasp) で GAS プロジェクトを作成）。
2. `src/` 内のファイルを編集し、`pnpm run build` を実行します。
3. `pnpm run push` または `pnpm run deploy` でデプロイします。

## 便利なスクリプト

- `pnpm run build` - TypeScript をコンパイル
- `pnpm run watch` - 変更時に自動ビルド
- `pnpm run push` - コードを Apps Script にプッシュ
- `pnpm run open` - Apps Script エディタでプロジェクトを開く

## claspの基本的な利用方法

### コンソール上で Google にログイン（これがないと、cloneやdeploy等ができない）

```bash
clasp login
```

### clasp で新しくGASを作成する

```bash
clasp create --type standalone "hello"
```

### 既存のGASプロジェクトと紐付ける

```bash
clasp clone [GAS ID]
```
