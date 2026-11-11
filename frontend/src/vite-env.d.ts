/*
 * ============================================================
 * ファイル名 : vite-env.d.ts
 * 種別       : 型定義ファイル（TypeScript）
 * 概要       : Vite（開発サーバー・ビルドツール）が提供する型定義を読み込むための宣言ファイル。
 *              画像ファイル（.png など）や CSS / CSS Modules（.module.css）の import、
 *              import.meta.env（Vite の環境変数）などに TypeScript の型を付ける。
 *              .d.ts は「型の情報だけ」を書くファイルで、実行されるコードは含まない。
 *
 * 補足       : 下の「/// <reference types="..." />」は三連スラッシュ指示子と呼ばれる特別な書き方で、
 *              指定したパッケージ（vite/client）の型定義を読み込ませる命令（ファイルの先頭に置く必要がある）。
 *              通常のコメントではないため変更しないこと。
 * 関連ファイル: frontend/vite.config.mts, frontend/tsconfig.json
 * ============================================================
 */
/// <reference types="vite/client" />
