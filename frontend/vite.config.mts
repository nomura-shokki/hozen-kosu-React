/**
 * ============================================================
 * ファイル名 : vite.config.mts
 * 種別       : 設定ファイル（Vite / Vitest）
 * 概要       : フロントエンドの開発サーバー・ビルドツール「Vite」と、テストツール「Vitest」の設定。
 *              package.json の scripts（npm start / npm run build / npm test など）で
 *              vite・vitest を実行すると、このファイルが自動で読み込まれる。
 *              拡張子 .mts は「ES モジュール形式（import / export を使う形式）の TypeScript」を表す。
 *
 * 主な設定   :
 *   - plugins : React（JSX/TSX の変換・開発時の自動更新）を扱うプラグインを使う
 *   - build   : ビルド結果を Django が配信するフォルダ（frontend/build/）に、Django の静的ファイルの
 *               URL（/static/〜）で読み込める形で出力する
 *   - test    : Vitest の設定（グローバル関数の有効化・ブラウザ環境の再現・共通準備ファイル）
 *
 * 補足       : 開発サーバーのポート番号は指定していないため、Vite の既定値（5173）が使われる。
 * 関連ファイル: frontend/package.json（scripts）, src/setupTests.ts, frontend/tsconfig.json,
 *              hozen_another/settings.py（TEMPLATES の DIRS・STATICFILES_DIRS・STATIC_URL）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
// defineConfig: 設定オブジェクトに型を付けるための関数。vitest/config 版は test 項目の型も含む
import { defineConfig } from 'vitest/config';
// React 用の Vite プラグイン（JSX/TSX の変換や、開発時に画面の状態を保ったまま更新する機能などを提供）
import react from '@vitejs/plugin-react';

// ============================================================
// 設定本体
// ============================================================
export default defineConfig({
  plugins: [react()], // 使用するプラグインの一覧（React 対応）
  // ビルド（npm run build）の設定
  //   Django は frontend/build/index.html を画面のテンプレートとして返し（settings.py の TEMPLATES）、
  //   frontend/build/static/ の中身を /static/〜 のURLで配信する（STATICFILES_DIRS・STATIC_URL）。
  //   その配置に合わせて出力しないと、本番で新しいビルド結果が使われない・JSやCSSが読み込めない。
  build: {
    outDir: 'build', // 出力先フォルダ（frontend/build/）。既定値の dist/ では Django から配信されない
    assetsDir: 'static', // JS・CSS・画像の出力先（build/static/）。index.html からは /static/〜 で参照される
    emptyOutDir: true, // ビルドのたびに build/ の中身を空にしてから出力する（古いファイルを残さない）
  },
  // Vitest（テスト）の設定
  test: {
    globals: true, // describe / it / expect などを import せずにどのテストファイルでも使えるようにする
    environment: 'jsdom', // jsdom（ブラウザの document などを再現するライブラリ）上でテストを動かす
    setupFiles: './src/setupTests.ts', // 各テストファイルの実行前に読み込む共通準備ファイル
  },
});