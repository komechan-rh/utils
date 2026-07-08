# AI Working Agreement

- 実装前に `.claude/rules` と `.claude/context` を参照する
- `tasks` 配下の `spec.md` を起点に作業する
- 共通 UI は `src/components/ui` を優先する
- 機能固有ロジックは `src/features` に閉じ込める
- API 通信は `src/services` を経由する
- 変更後は `tasks/<task-id>/result.md` に要約を残す
- 既存規約がある場合は新規提案より既存規約を優先する
- 影響範囲を確認し、不要な抽象化を追加しない
