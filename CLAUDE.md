# AI Working Agreement

- このリポジトリは個人用の Google Apps Script 自動化プロジェクト群と、そのテンプレート集です。
- 新しく automation（GASプロジェクト）を作成する場合は、`templates/gas-template` を参考に実装する
  - ディレクトリ構成、`package.json` のスクリプト（build / push / deploy / lint / test など）、`biome.json`、`tsconfig.json`、`.clasp.json` の扱いを踏襲する
  - React 実装が必要な場合のみ `templates/genai-templates` を参考にする
- 1 automation = 1 ディレクトリ（ルート直下）とし、既存の `add-guest-automation` や `summurize-google-calendar-to-manager` と同様の構成にする
- `.clasp.json` は各プロジェクト固有の `scriptId` を含むため、テンプレートをコピーした後に作成し直す（コミットしない）
- 既存の automation の実装（`add-guest-automation`, `summurize-google-calendar-to-manager`）は具体例として参照してよい
- 変更は対象ディレクトリ内に閉じ、他の automation やテンプレートに影響を与えない
- 不要な抽象化や、テンプレートにない独自ルールの追加は避ける
