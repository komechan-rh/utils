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

### 複数アカウントを使い分ける

`clasp login` は毎回 `default` という名前でログイン情報を上書きするため、複数の Google アカウントを使い分けたい場合は `-u/--user` で名前を付けてログインする。

```bash
clasp login -u <user-name>
```

`push` / `deploy` など他のコマンドでも同様に `-u <名前>` を付けないと `default` アカウントが使われる。

```bash
clasp push -u <user-name>
clasp create-deployment -u <user-name>
```

現在ログイン中のアカウントの確認方法は、ルートの [README.md](../../README.md) を参照。
