# Claude Session Viewer

Mac 上で常駐し、ローカルで起動している **Claude Code** セッションの状態・サブエージェント・コンテキスト使用量・rate limit をリアルタイムに確認できるダッシュボードです。

外部通信は一切行いません（Analytics・Telemetry なし）。すべての処理はローカル環境内で完結します。

## 目的

- ターミナルで起動している複数の Claude Code セッションを一箇所で把握する
- 各セッションが `thinking` / `using_tool` / `waiting_permission` などどの状態にあるかを一目で確認する
- サブエージェント（Task ツール）の実行状況を確認する
- コンテキスト使用量・rate limit を確認する（**取得できない値は取得できないと明示し、推測値で埋めない**）

## 最重要方針（推測との向き合い方）

Claude Code の内部仕様のうち公式に文書化・保証されているものは限られています。このアプリは値ごとに取得元 (`DataSource`) を持たせ、UI 上で 4 段階に区別します。

| UI 表示         | 意味                                                          | 対応する `DataSource`                 |
| --------------- | ------------------------------------------------------------- | -------------------------------------- |
| **Official**    | Claude Code 自身が hooks / statusLine 経由で能動的に教えてくれた値 | `official_hook`, `status_line`         |
| **Observed**    | ローカルファイル（transcript）や OS プロセスから読み取れた値   | `transcript`, `filesystem`, `process`  |
| **Estimated**   | 上記から算出・推測した値（計算根拠をコード内コメントに明記）  | `estimated`                            |
| **Unavailable** | ローカル・オフラインで取得できる手段が確認できていない値       | UI 上に "Unavailable" と表示し、数値は出さない |

優先順位は `official_hook > status_line > transcript > filesystem > process > estimated` です。複数ソースが競合した場合、`src-tauri/src/domain/merge.rs` の `FieldMeta::accepts` が「より信頼できるソースには基本的に負けない／同じソースなら新しい方が勝つ」というルールで解決します。

## 対応 OS

- **macOS**（メニューバー常駐・通知・プロセス検出は macOS を主対象に実装）
- Linux 上でも `cargo build` / `cargo tauri dev` は動作しますが、`sysinfo` によるプロセス検出以外は macOS 固有の検証（メニューバー表示・通知の見た目など）を行っていません。
- 本アプリの開発・テストは **Linux コンテナ上で** 行いました（後述の「既知の制約」を参照）。macOS 実機での最終確認はできていません。

> **Note:** ルートの pnpm workspace catalog (`../pnpm-workspace.yaml`) に合わせ `vite` / `vitest` は `catalog:` を参照しています。`typescript` のみ catalog (`^7.0.2`) を参照せず `~6.0.2` を明示指定しています。catalog の TypeScript 7 系は `typescript-eslint`（現時点の最新版でも TS 7 系は未サポート、`typescript-eslint` 起動時にエラーになることを確認済み）と組み合わせられないため、type-aware な ESLint を維持する目的でこのパッケージだけ明示バージョンにしています。

## 必要環境

- Node.js 20+ / npm
- Rust（`rustup` 経由、stable）
- macOS の場合: Xcode Command Line Tools
- Linux の場合: `libwebkit2gtk-4.1-dev` `libgtk-3-dev` `libayatana-appindicator3-dev` `librsvg2-dev` など（Tauri v2 の Linux 依存関係）

## セットアップ方法

```bash
cd claude-session-viewer
npm install
```

## 開発方法

```bash
npm run dev          # フロントエンドのみ (ブラウザ, モックデータ)
npm run tauri dev    # アプリ本体 (実際の Claude Code セッションを監視)
```

### 実データなしで UI 開発する

- ブラウザで `npm run dev` を開くと、Tauri ランタイムが存在しないことを検出し `src/lib/mockData.ts` のモックセッションを自動的に表示します（UI 確認用。本物のバックエンドは経由しません）。
- 実際の Rust 収集ロジック（hooks / transcript パーサ）まで通しで検証したい場合は、下記シミュレーターを使ってください。

## 開発用シミュレーター

```bash
npm run simulate            # 1回だけシナリオを実行
npm run simulate -- --loop  # 45秒ごとに繰り返す
```

`simulator/.sandbox/` 以下に、本物と同じ形式の hooks NDJSON・statusLine NDJSON・transcript JSONL を書き出します。これを Tauri アプリの実データ収集ロジックに読ませるには:

```bash
CLAUDE_SESSION_VIEWER_DATA_DIR=$(pwd)/simulator/.sandbox/app-data \
CLAUDE_CONFIG_DIR=$(pwd)/simulator/.sandbox/claude-home \
npm run tauri dev
```

再現できるシナリオ: セッション開始 / thinking / tool 実行 / permission 待ち / サブエージェント開始・終了 / コンテキスト増加 / セッション終了。

> **rate limit 増加は再現していません。** アプリには rate limit のローカル・オフライン取得手段が現時点で存在しない（後述）ため、シミュレーターにも偽の rate limit を流すコードパスを作っていません。

## ビルド方法

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e       # Playwright (要 `npm run build` 後、内部で preview サーバーを自動起動)
npm run build          # フロントエンドのみ
npm run tauri build    # ネイティブアプリ (macOS 上で実行した場合 .app / .dmg)
```

Linux コンテナでの検証では `npm run tauri build` は `.deb` / `.rpm` の生成まで成功しました（Rust 側のビルド・バンドル処理そのものは動作確認済み）。`.app` / `.dmg` は macOS の Xcode ツールチェーンが必要なため、この環境では生成できていません。

## Claude Code 連携方法

初回セットアップはアプリ内の **⚙ Settings → Claude Code 連携** から行います。

1. 「差分を確認」で `~/.claude/settings.json` に何が追加されるかをプレビュー（この時点では書き込みは行われません）
2. 内容を確認したうえで「セットアップを適用」を押すと反映されます

適用時に必ず行うこと（`src-tauri/src/claude_config/mod.rs`）:

- 変更前の `settings.json` の内容をまるごと `<app data dir>/backups/settings.json.<timestamp>.bak` にバックアップ
- `hooks` / `statusLine` **以外のキーには一切触れない**
- 既存の `hooks` 配列に対しては **追記のみ**（同じコマンド文字列が既にあれば何もしない = 冪等）
- 既に `statusLine` が設定されている場合は **上書きしない**（スキップした旨をサマリーに表示）
- 2回適用しても差分が出ない（テスト: `claude_config::tests::applying_twice_is_idempotent`）

元に戻すには Settings の「元に戻す」ボタン、または:

```bash
npm run setup:claude:revert
```

直前に作成したバックアップから settings.json を復元します（アプリ導入前にファイルが存在しなかった場合は削除します）。

### hooks 設定

以下のイベントに対して、`<app data dir>/hook-relay.sh <イベント名>` を hooks コマンドとして追加します（[`scripts/hook-relay.sh`](./scripts/hook-relay.sh)）。

`SessionStart` `UserPromptSubmit` `PreToolUse` `PostToolUse` `Notification` `PreCompact` `Stop` `SubagentStop` `SessionEnd`

このスクリプトは Claude Code から stdin で渡される hook ペイロード（JSON）に `hook_event_name` と `received_at` を付加して `<app data dir>/hooks.ndjson` に1行追記するだけです。プロンプト本文やツールの引数・出力を読み取って保存することはありません。

### status line 設定

未設定の場合のみ、[`scripts/status-line.sh`](./scripts/status-line.sh) を `statusLine.command` として追加します。このスクリプトは Claude Code の状態行に短いテキストを出力しつつ、受け取った JSON を `<app data dir>/statusline.ndjson` に追記します。

## データ取得元（正確 / 推定 / 取得不可）

### 正確に取得できる情報（Official / Observed）

- **セッションのライフサイクルイベント**（開始・ツール使用開始・permission 待ち・compacting・応答終了）: hooks 経由、`Official`
- **transcript 上のトークン使用量**（`input_tokens` / `output_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`）: `~/.claude/projects/**/*.jsonl` の各 assistant メッセージに Claude Code 自身が記録している、Anthropic API のレスポンスそのままの値。`Observed`
- **モデル名・作業ディレクトリ**: hooks / statusLine / transcript のいずれかから、`Official` または `Observed`
- **OS プロセスの存在・PID・起動時刻**: `sysinfo` クレートによる直接のプロセステーブル読み取り（`ps`/`lsof` の文字列パースは行わない）。`Observed`

### 推定している情報（Estimated・算出根拠あり）

- **コンテキストウィンドウの最大値 (`max_tokens`)**: transcript には含まれないため、モデル名から「公式ドキュメント記載のデフォルト値（200,000 トークン）」を仮定しています（`src-tauri/src/collectors/transcripts.rs::estimate_context_window`）。1M トークンβ等の拡張コンテキストが有効なアカウント・モデルでは実際の上限と異なる可能性があります。
- **現在のコンテキスト使用量 (`used_tokens`)**: 直近の assistant ターンの `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` の合計を「そのターンの実際のプロンプトサイズ」として採用しています（`context_usage_from_api_usage`）。厳密には次ターンの起点となる正確な残量とは異なる場合があります。
- **process ↔ transcript の紐付け**: プロセスの cwd から `~/.claude/projects/<cwd の '/' を '-' に置換したディレクトリ名>/` を推測し、その中に `.jsonl` が **ちょうど1つ** だけあればそのセッション ID を採用します（複数・0個の場合は synthetic ID にフォールバックし、誤って紐付けません）。
- **長時間活動が確認できないセッションの `stopped` 遷移**: 6時間 (`DEAD_AFTER`) 活動シグナルが無いセッションを `Estimated` ソースで `stopped` とみなします。ただし公式ソース (`official_hook`) が既に設定したステータスを上書きすることはありません。

### 現時点では取得できない情報（Unavailable）

- **rate limit（5時間枠 / 7日枠の使用率・リセット時刻）**

  Claude Code CLI・Claude.ai のいずれの利用形態でも、**ローカルファイルまたはオフラインで確実に取得できる公式な手段を確認できませんでした**。この値は Anthropic のサーバーへの API 呼び出しレスポンスヘッダー等でしか得られないと考えられますが、本アプリは「外部通信なし」という方針のためその手段は使えません。

  そのため MVP では rate limit を **常に "Unavailable"** として表示し、ダミーの数値やそれらしい推測値は一切出しません（`RateLimitState::unavailable`）。将来的に Claude Code 自身がこの情報を hooks やローカルファイルとして公開するようになれば実装を追加できるよう、型定義 (`RateLimitState`) は用意してあります。

  > API 契約（Anthropic API 直接利用）とサブスクリプション契約（Claude.ai / Claude Code CLI ログイン）では rate limit の取得方法自体が異なりますが、いずれも上記の理由から本アプリでは未実装です。実装が分かれる場合に備えて、コード上は `DataSource` の区別を保ったまま拡張できる設計にしています。

- **サブエージェントの transcript パス**: Claude Code がサブエージェントの応答を親セッションと別ファイルに書き出しているかどうかを確認できていません。本アプリは親セッションと同じ transcript ファイルに `isSidechain` 付きで記録される前提で実装しており、これが誤っている場合 `transcriptPath` は親セッションのものになります。
- **サブエージェントの正確な `agent_type` の一覧**: `Task` ツールの `input.subagent_type` をそのまま表示しているだけで、Claude Code が実際にどのサブエージェント種別を持つかの公式な一覧は取得していません。

## SQLite 保存場所

```
macOS: ~/Library/Application Support/dev.komechan.claude-session-viewer/sessions.sqlite3
```

（Tauri の `app_data_dir()` が返すパス。設定画面にも実際のパスを表示します。）

保存されるのはメタデータのみです: セッション ID・PID・cwd・プロジェクト名・正規化ステータスとその取得元・モデル名・トークン数・サブエージェントの ID/種別/時刻、および冪等性のための処理済みイベント ID。

**保存しないもの**: プロンプト本文、ツールの引数・実行結果、ファイル内容、transcript のテキストそのもの。

## セキュリティとプライバシー

- 外部通信・Analytics・Telemetry なし（`tauri.conf.json` の CSP も `connect-src 'self' ipc:` のみ許可）
- transcript 本文・プロンプト・ツール引数・ファイル内容は **一切保存しない**。収集層 (`collectors/`) はこれらのフィールドを読み取っても、必要なメタデータを抽出したらその場で破棄する
- ログにプロンプトやコードを出力しない（`tracing` は構造化イベント名とメタデータのみ）
- 設定画面の「履歴の保存」をオフにすると、再起動後にセッション一覧を復元しなくなり、既存の保存データも削除される
- 「ローカルデータを削除」ボタンで SQLite の全テーブルを即座に空にできる

## アンインストール方法

1. アプリを終了する（メニューバーアイコン → Quit）
2. `.app` を Applications フォルダから削除
3. ローカルデータを削除する場合:
   ```bash
   rm -rf ~/Library/Application\ Support/dev.komechan.claude-session-viewer
   ```

## Claude Code 設定の戻し方

アプリ内 Settings → 「元に戻す」、または:

```bash
npm run setup:claude:revert
```

アプリのバックアップ機構が失われている場合は、`~/.claude/settings.json` を手動で編集し、`hooks` 配列の中から `command` が `<app data dir>/hook-relay.sh ...` になっているエントリと、`statusLine.command` が `<app data dir>/status-line.sh` になっている行を削除してください。

## 既知の制約

- **開発・検証は Linux コンテナ上で行いました。** macOS 実機でのメニューバー表示・通知の見た目・Dock 挙動・`.app`/`.dmg` バンドル生成は検証できていません。Rust ロジック（プロセス検出・hooks/transcript パース・SQLite・設定マージ）は OS 非依存な範囲でテスト済みです。
- 待機時 CPU 1%未満 / メモリ 100MB未満という目標値は、macOS 実機での実測ができていないため未検証です。設計上の工夫（filesystem watcher 優先・プロセスポーリング5秒間隔・JSONL 差分読み込み・SQLite バッチ書き込み）は行っていますが、数値としての裏付けはありません。
- rate limit は前述の通り常に Unavailable です。
- サブエージェントの transcript 分離・`agent_type` の公式な列挙は未確認の前提に基づいています。
- E2E テスト (`npm run test:e2e`) はブラウザ上のモックデータ経由で UI を検証しており、Tauri ネイティブウィンドウ・トレイ・通知そのものは自動テストしていません。

## トラブルシューティング

- **セッションが表示されない**: Settings で hooks 連携を適用したか確認してください。適用前でも `~/.claude/projects/**/*.jsonl` の transcript とプロセス検出だけである程度は表示されますが、状態 (`status`) の精度は hooks 連携後の方が高くなります。
- **`npm run tauri dev` が起動しない (Linux)**: `libwebkit2gtk-4.1-dev` 等の依存パッケージが入っているか確認してください（`apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev`）。
- **hooks を適用したのに反映されない**: `<app data dir>/hooks.ndjson` が増えているか確認してください。増えていなければ Claude Code が settings.json の hooks を読み込めていない可能性があります（Claude Code の再起動が必要な場合があります）。
- **設定を元に戻せない**: `<app data dir>/backups/` にバックアップファイルが残っているか確認してください。残っていれば手動で `~/.claude/settings.json` に上書きコピーすれば復元できます。

## ディレクトリ構成

```
src/
  app/            画面のトップレベル (App.tsx)
  components/     状態バッジ・コンテキストバー等の共通 UI 部品
  features/
    sessions/     セッション一覧・カード
    rate-limits/  rate limit ヘッダー
    settings/     設定パネル (hooks 連携・通知・プライバシー)
  hooks/          useSessions / useRateLimits / useNow
  lib/            Tauri ブリッジ・フォーマッタ・モックデータ
  types/          フロントエンド側のドメイン型
src-tauri/
  src/
    collectors/   hooks.rs / status_line.rs / transcripts.rs / processes.rs / filesystem.rs / tail.rs
    domain/       types.rs / events.rs / merge.rs (状態統合エンジン) / status.rs
    storage/      SQLite (メタデータのみ)
    commands/     フロントエンドに公開する Tauri コマンド
    notifications/ 通知の重複排除
    claude_config/ settings.json の安全なマージ・バックアップ・復元
    state.rs      収集層とドメイン層を束ねるバックグラウンドループ
  tests/          Rust 統合テスト
simulator/        開発用イベントシミュレーター
e2e/              Playwright E2E テスト
scripts/          hook-relay.sh / status-line.sh (Claude Code から呼ばれる中継スクリプト)
```
