/**
 * ============================================================
 * ファイル名 : axios.ts
 * 種別       : ユーティリティ（API通信の共通設定）
 * 概要       : サーバー（Django）のAPIと通信するための axios インスタンスを、共通の設定付きで作る。
 *              axios とは、ブラウザからサーバーへHTTPリクエストを送るためのライブラリ。
 *              各画面はこのファイルの api を import し、api.get("/api/kosu_list/") のように使う。
 *
 * 主な機能   :
 *   - 接続先の基準URL（baseURL）の設定
 *   - Cookie（セッションID）を毎回送る設定（ログイン状態を保つため）
 *   - Cookie の CSRF トークンを、リクエストヘッダーに自動で付ける設定
 *
 * 関連ファイル: kosu/permissions.py（LoginNoAuthentication: セッション・CSRF トークンの確認）,
 *              hozen_another/settings.py（CORS・セッションCookie・CSRF の設定）, frontend/.env.production
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import axios from "axios";  

// ============================================================
// 共通設定済みの axios インスタンス
// ============================================================

/** API通信用の axios インスタンス（以下の設定がすべてのリクエストに自動で適用される） */
const api = axios.create({  
    // 接続先の基準URL。api.get("/api/〜") は「baseURL ＋ /api/〜」へ送られる
    //   コード上は環境変数 REACT_APP_API_BASE_URL（frontend/.env.production に同名の設定あり）を読む。
    //   ただし Vite のビルド（npm run build）では process.env が空のオブジェクト {} に置き換えられるため
    //   この値は undefined になり、baseURL なし＝画面を表示しているのと同じサーバーへ送信される
    baseURL: process.env.REACT_APP_API_BASE_URL,  
    // Cookie（セッションID・CSRFトークン）をリクエストに付けて送る。これが無いとサーバー側でログイン者を特定できない
    withCredentials: true,  
    // CSRF（なりすまし送信）対策: Django が発行する Cookie「csrftoken」の値を読み取り、
    // リクエストヘッダー「X-CSRFToken」に入れて送る（Django はこの2つが一致するかを確認する）。
    //   ※axios がこのヘッダーを自動で付けるのは、画面と同じオリジン（サーバー）へのリクエストの場合
    xsrfCookieName: "csrftoken", // CSRFトークンを読み取る Cookie の名前（Django の既定値）
    xsrfHeaderName: "X-CSRFToken", // CSRFトークンを入れて送るヘッダーの名前（Django が確認するヘッダー）
});  

// ============================================================
// エクスポート
// ============================================================
export default api;  