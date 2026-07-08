# Architecture

- `src/app` はアプリ全体の組み立てに限定する
- `src/features` は機能ごとに閉じる
- `src/services` は外部通信の入口に固定する
- `src/routes` は画面遷移の宣言に集中させる
