# React Practical Template

実務向けの React フロントエンド初期構成です。保守性、再現性、AI エージェントとの相性を重視し、責務ごとに入口を分けています。

## 推奨環境

- Node.js: 22 LTS 系
- pnpm: 10 系

## セットアップ

```bash
pnpm install
pnpm dev
```

## 開発コマンド

```bash
pnpm dev
pnpm build
pnpm preview
```

## テスト実行方法

```bash
pnpm test
pnpm test:watch
```

## Lint / Format 実行方法

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

`lint` / `format` は `Biome` を使用します。

## CSS 方針

- 基本実装は `Tailwind CSS` を使います
- グローバルなベーススタイルは `src/index.css` に集約します

## フォルダー責務

- `src/app`: アプリ全体の組み立て
- `src/components/ui`: 汎用 UI 部品
- `src/components/feature`: 複数機能で使う準共通 UI
- `src/features`: 機能単位で閉じる実装
- `src/hooks`: 共通カスタムフック
- `src/lib`: 外部ライブラリや設定値の初期化
- `src/pages`: 画面コンポーネント
- `src/routes`: ルーティング定義
- `src/services`: API 通信
- `src/stores`: グローバル状態の入口
- `src/types`: 共通型
- `src/utils`: 純粋関数
- `src/test`: テスト補助
- `tests/integration`: 結合テスト
- `tests/e2e`: E2E テスト
- `.claude`: AI エージェント向けルール、プロンプト、文脈
- `tasks`: タスク駆動で進めるための作業単位

## AI運用前提の使い方

1. `CLAUDE.md` を読み、AI エージェントの作業原則を確認する
2. `.claude/rules` と `.claude/context` を参照して制約と設計意図を把握する
3. `tasks/<task-id>/spec.md` を起点に要件を整理する
4. 実装後は `tasks/<task-id>/result.md` に変更概要と判断を残す

## タスク駆動の進め方

1. `tasks/` に作業ディレクトリを追加する
2. `spec.md` に要件と完了条件を書く
3. `plan.md` に実装手順を書く
4. 作業中の判断や問題を `logs.md` に残す
5. 完了時に `result.md` に要約、影響範囲、次の課題を書く
