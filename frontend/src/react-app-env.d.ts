/*
 * ============================================================
 * ファイル名 : react-app-env.d.ts
 * 種別       : 型定義ファイル（TypeScript）
 * 概要       : Create React App（react-scripts）が提供する型定義を読み込むための宣言ファイル。
 *              画像ファイル（.png / .svg など）や CSS Modules（.module.css）の import、
 *              process.env.NODE_ENV などに TypeScript の型を付ける。
 *              .d.ts は「型の情報だけ」を書くファイルで、実行されるコードは含まない。
 *
 * 補足       : 下の「/// <reference types="..." />」は三連スラッシュ指示子と呼ばれる特別な書き方で、
 *              指定したパッケージの型定義を読み込ませる命令（ファイルの先頭に置く必要がある）。
 *              通常のコメントではないため変更しないこと。
 *              現在の package.json には react-scripts は記載されておらず、開発・ビルドには Vite を使っている
 *              （Vite 用の型定義は vite-env.d.ts で読み込んでいる）。
 * 関連ファイル: vite-env.d.ts, frontend/tsconfig.json
 * ============================================================
 */
/// <reference types="react-scripts" />
