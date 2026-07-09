# utils

個人用の業務自動化スクリプト（Google Apps Script）とテンプレートをまとめたリポジトリです。

## 構成

```
.
├── add-guest-automation/               # カレンダー作成イベントに応じてゲストを自動追加するGAS
├── manager-line-notifications/         # マネージャー向けLINE通知（週次予定など）をまとめたGAS
└── templates/
    ├── gas-template/                    # GAS（TypeScript + pnpm + clasp）のスターターテンプレート
    └── genai-templates/                 # React フロントエンドのスターターテンプレート
```

各プロジェクトのセットアップ・コマンドは、それぞれのディレクトリの `README.md` を参照してください。

## 新しいオートメーションを追加する

新規に GAS ベースの自動化を作る場合は、`templates/gas-template` を参考に実装してください。詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

## 共通ツール

- pnpm: パッケージ管理
- clasp: Google Apps Script へのデプロイ
- Biome: lint / format
- Vitest: テスト
