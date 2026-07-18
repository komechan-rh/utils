# AI Working Agreement

- このリポジトリは個人用の Google Apps Script 自動化プロジェクト群と、そのテンプレート集です。
- 新しく automation（GASプロジェクト）を作成する場合は、`templates/gas-template` を参考に実装する
  - ディレクトリ構成、`package.json` のスクリプト（build / push / deploy / lint / test など）、`biome.json`、`tsconfig.json`、`.clasp.json` の扱いを踏襲する
  - React 実装が必要な場合のみ `templates/genai-templates` を参考にする
- 1 automation = 1 ディレクトリ（ルート直下）とし、既存の `add-guest-automation` や `manager-line-notifications` と同様の構成にする
- `.clasp.json` は各プロジェクト固有の `scriptId` を含むため、テンプレートをコピーした後に作成し直す（コミットしない）
- `package.json` の `devDependencies`（typescript / vite / vitest / @biomejs/biome など）のバージョンはルートの pnpm workspace（[`pnpm-workspace.yaml`](./pnpm-workspace.yaml)）の `catalog` で一元管理している。テンプレートをコピーした直後は具体的なバージョン文字列のままなので、`catalog:` 参照に置き換えたうえでルートで `pnpm install` を実行する
- 既存の automation の実装（`add-guest-automation`, `manager-line-notifications`）は具体例として参照してよい
- 変更は対象ディレクトリ内に閉じ、他の automation やテンプレートに影響を与えない
- 不要な抽象化や、テンプレートにない独自ルールの追加は避ける

## 秘匿情報の扱い

- このリポジトリはポートフォリオとして公開されるため、メールアドレス・氏名・組織名・URL・scriptId・APIキー・トークンなどの秘匿情報・個人情報をコードやコミットにハードコードしない
- 設定値は Script Properties（`PropertiesService`）や環境変数など、リポジトリ外で管理する仕組みを使う
- サンプル・ドキュメント内で値の例を示す場合は、実在の情報ではなくダミー値（例: `user@example.com`）を使う
- `.clasp.json` に加え、秘匿情報を含みうるファイル（認証情報、`.env` など）は `.gitignore` に含め、コミットしない
- 既存コードに秘匿情報のハードコードを見つけた場合は、対応するタスクの範囲であれば Script Properties 等への切り出しを提案・実施する
