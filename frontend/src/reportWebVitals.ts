/**
 * ============================================================
 * ファイル名 : reportWebVitals.ts
 * 種別       : ユーティリティ（表示性能の計測）
 * 概要       : Web Vitals（ページの表示速度や操作への反応速度などの性能指標）を計測し、
 *              引数で渡された関数に計測結果を渡す。
 *              Create React App のひな形で作られるファイルと同じ内容。
 *
 * 補足       : 現在このファイルはどこからも import されておらず、計測は行われていない。
 *              使う場合は index.tsx などで reportWebVitals(console.log) のように呼び出す。
 * 関連ファイル: package.json（web-vitals ライブラリ）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
// ReportHandler: 計測結果を受け取る関数の型（web-vitals ライブラリが提供）
import { ReportHandler } from 'web-vitals';

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * Web Vitals の各指標を計測し、結果を onPerfEntry に渡す。
 *
 * web-vitals ライブラリは計測するときだけ読み込む（動的 import）ため、
 * 関数が渡されない場合はライブラリの読み込み自体が発生しない。
 *
 * @param onPerfEntry - 計測結果（指標名・値など）を受け取る関数。省略した場合は何もしない
 * @returns なし
 */
const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  // 結果を受け取る関数が渡された場合だけ計測する
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // web-vitals を動的に読み込み、読み込みが終わったら各指標の計測を開始する
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry); // CLS: 表示中にレイアウトがずれた量
      getFID(onPerfEntry); // FID: 最初の操作（クリック等）から、ブラウザが反応し始めるまでの時間
      getFCP(onPerfEntry); // FCP: 最初に何かが表示されるまでの時間
      getLCP(onPerfEntry); // LCP: 画面内で一番大きな要素が表示されるまでの時間
      getTTFB(onPerfEntry); // TTFB: リクエストしてからサーバーの最初の応答が届くまでの時間
    });
  }
};

// ============================================================
// エクスポート
// ============================================================
export default reportWebVitals;
