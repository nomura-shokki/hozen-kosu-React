/**
 * ============================================================
 * ファイル名 : setupTests.ts
 * 種別       : 設定ファイル（テスト共通の事前準備）
 * 概要       : テスト（Vitest）で、各テストファイルの実行前に読み込まれる共通準備のファイル。
 *              vite.config.mts の test.setupFiles でこのファイルが指定されている。
 *
 * 主な機能   :
 *   - @testing-library/jest-dom を読み込み、画面の要素（DOM）を検証するための追加の判定メソッド
 *     （toBeInTheDocument / toHaveTextContent など）を expect で使えるようにする
 *
 * 関連ファイル: frontend/vite.config.mts, tests/（各テストコード）
 * ============================================================
 */

// jest-dom は、DOM の要素を検証するための独自の判定メソッド（マッチャー）を追加する。
// 例えば次のような書き方ができるようになる:
//   expect(element).toHaveTextContent(/react/i)  … 要素の文字に "react"（大文字小文字は区別しない）が含まれるか
// 詳しくは: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
