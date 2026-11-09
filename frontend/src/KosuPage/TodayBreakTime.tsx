/**
 * ============================================================
 * ファイル名 : TodayBreakTime.tsx
 * 種別       : 画面コンポーネント（当日休憩時間変更画面）
 * 概要       : 工数入力画面で選択中の就業日（セッションに保存された日付）1日分だけ、
 *              休憩時間（昼休憩・残業休憩1〜3）を変更する画面。工数入力画面の休憩変更ボタンから開く。
 *              指定した休憩時間帯に入力済みの工数は、サーバー側で休憩に置き換えられる。
 *
 * 主な機能   :
 *   - 対象就業日の工数データに登録済みの休憩時間を取得し、時刻選択欄に表示
 *   - 休憩の長さチェック（昼休憩・残業休憩2は60分以内、残業休憩1・3は15分以内）
 *   - 休憩時間を登録し、工数入力画面へ戻る
 *
 * 使用API    : GET  /api/today_break_time/  対象就業日の工数データ（休憩時間）取得（kosu/views/kosu_views.py の TodayBreakTime）
 *              POST /api/today_break_time/  対象就業日の休憩時間を更新（同上）
 * 画面URL    : /today-break-time            （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/TodayBreakTime.module.css, Components/Loading.tsx,
 *              KosuPage/KosuNew.tsx（遷移元の工数入力画面）, KosuPage/BreakTime.tsx（毎日の休憩時間変更画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, FormEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { useNavigate, Link } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"; // 日付ライブラリ date-fns を MUI の時刻選択欄で使うためのアダプター
import { MobileTimePicker } from "@mui/x-date-pickers"; // ダイアログ形式の時刻選択欄（MUI部品）
import { LocalizationProvider } from "@mui/x-date-pickers"; // 時刻選択欄に日付ライブラリを渡す外枠（MUI部品）
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/KosuPage/TodayBreakTime.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * 対象就業日の工数データのうち、この画面で使う項目（GET /api/today_break_time/ のレスポンス kosu_data）。
 *
 * 休憩時間は "#HHMMHHMM" 形式（例: "#12001245" = 12:00〜12:45）の文字列。
 */
interface Kosu {
  employee_no3: number; // 従業員番号
  work_day2: string; // 就業日（"YYYY-MM-DD"）
  breaktime: string | null; // 昼休憩
  breaktime_over1: string | null; // 残業休憩1
  breaktime_over2: string | null; // 残業休憩2
  breaktime_over3: string | null; // 残業休憩3
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 当日休憩時間変更画面。
 *
 * 表示時に対象就業日の工数データから休憩時間を取得し、4種類の休憩の開始/終了時刻を表示する。
 * 「登録」ボタンで休憩の長さをチェックしたうえでサーバーへ送信し、成功したら工数入力画面へ戻る。
 *
 * @returns 当日休憩時間変更画面のJSX
 */
const TodayBreakTime: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  // 休憩時間の開始/終了時刻（奇数番号が開始、偶数番号が終了）
  const [breakTime1, setBreakTime1] = useState<Date | null>(null); // 昼休憩の開始時刻
  const [breakTime2, setBreakTime2] = useState<Date | null>(null); // 昼休憩の終了時刻
  const [breakTime3, setBreakTime3] = useState<Date | null>(null); // 残業休憩1の開始時刻
  const [breakTime4, setBreakTime4] = useState<Date | null>(null); // 残業休憩1の終了時刻
  const [breakTime5, setBreakTime5] = useState<Date | null>(null); // 残業休憩2の開始時刻
  const [breakTime6, setBreakTime6] = useState<Date | null>(null); // 残業休憩2の終了時刻
  const [breakTime7, setBreakTime7] = useState<Date | null>(null); // 残業休憩3の開始時刻
  const [breakTime8, setBreakTime8] = useState<Date | null>(null); // 残業休憩3の終了時刻
  const [sessionDay, setSessionDay] = useState<string | null>(null); // 対象の就業日（"YYYY-MM-DD"。サーバーのセッションに保存された日付）
  const navigate = useNavigate(); // 画面遷移用の関数

  // ---------- ヘルパー関数 ----------

  /**
   * "#HHMMHHMM" 形式の休憩時間を、開始時刻と終了時刻の Date に変換する。
   *
   * 日付部分は今日の日付のまま、時・分だけを設定する（時刻選択欄では時刻しか使わないため）。
   * 値が空（null・空文字）の場合は "#00000000"（00:00〜00:00）として扱う。
   *
   * @param breaktime - 休憩時間文字列（例: "#12001245" = 12:00〜12:45）。null 可
   * @returns [開始時刻, 終了時刻]。形式が不正な場合は [null, null]
   */
  const parseBreakTime = (breaktime: string | null): [Date | null, Date | null] => {
    // 未登録の休憩時間は 00:00〜00:00 とみなす
    const validBreaktime = breaktime || "#00000000";

    // 「#」で始まる9文字（# + 開始HHMM + 終了HHMM）のときだけ変換する
    if (validBreaktime.length === 9 && validBreaktime.startsWith("#")) {
      const time1 = new Date();
      const time2 = new Date();

      // 開始時刻: 1〜2文字目が時、3〜4文字目が分（例: "#12001245" → 12時00分）
      time1.setHours(parseInt(validBreaktime.slice(1, 3), 10));
      time1.setMinutes(parseInt(validBreaktime.slice(3, 5), 10));
      // 秒・ミリ秒は0にそろえる（差分計算で端数が出ないようにする）
      time1.setSeconds(0);
      time1.setMilliseconds(0);

      // 終了時刻: 5〜6文字目が時、7〜8文字目が分（例: "#12001245" → 12時45分）
      time2.setHours(parseInt(validBreaktime.slice(5, 7), 10));
      time2.setMinutes(parseInt(validBreaktime.slice(7, 9), 10));
      time2.setSeconds(0);
      time2.setMilliseconds(0);

      return [time1, time2];
    }
    // 形式が不正な値は未設定（null）として扱う
    return [null, null];
  };

  // ---------- 副作用（useEffect） ----------

  // 初回表示時（navigate は通常変わらないため実質1回）: 対象就業日の休憩時間を取得して表示する
  useEffect(() => {
    /**
     * 対象就業日の工数データを取得し、休憩時間を breakTime1〜8 の state に展開する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ、
     * 400 なら工数入力画面へ遷移する。
     *
     * @returns なし（結果は breakTime1〜8 / sessionDay / errorMessage の state に反映）
     */
    const fetchData = async () => {
      try {
        // GET /api/today_break_time/ : セッションの就業日（未設定なら今日）の工数データを取得
        //   その日の工数データがない場合、サーバーは404「レコードが見つかりません。」を返す
        const response = await api.get("/api/today_break_time/");
        // 工数データが返らなかった場合に備え、全休憩 00:00〜00:00 の仮データを用意する
        const kosu_data: Kosu = response.data.kosu_data || {
          employee_no3: 0,
          breaktime: "#00000000",
          breaktime_over1: "#00000000",
          breaktime_over2: "#00000000",
          breaktime_over3: "#00000000",
        };

        // 昼休憩 → breakTime1（開始）/ breakTime2（終了）
        const [initialTime1, initialTime2] = parseBreakTime(kosu_data.breaktime);
        setBreakTime1(initialTime1);
        setBreakTime2(initialTime2);

        // 残業休憩1 → breakTime3（開始）/ breakTime4（終了）
        const [initialTime3, initialTime4] = parseBreakTime(kosu_data.breaktime_over1);
        setBreakTime3(initialTime3);
        setBreakTime4(initialTime4);

        // 残業休憩2 → breakTime5（開始）/ breakTime6（終了）
        const [initialTime5, initialTime6] = parseBreakTime(kosu_data.breaktime_over2);
        setBreakTime5(initialTime5);
        setBreakTime6(initialTime6);

        // 残業休憩3 → breakTime7（開始）/ breakTime8（終了）
        const [initialTime7, initialTime8] = parseBreakTime(kosu_data.breaktime_over3);
        setBreakTime7(initialTime7);
        setBreakTime8(initialTime8);

        // 対象の就業日（見出しと完了メッセージに表示する）
        setSessionDay(response.data.session_day || null);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // 400: 工数入力画面へ戻す（現在のサーバーのGET処理は400を返さない）
          else if (err.response?.status === 400) navigate("/kosu-new");
          // その他（404: 対象日の工数データなし など）: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 「登録」ボタン押下時の処理。休憩の長さをチェックし、問題なければ休憩時間を送信する。
   *
   * チェック内容（開始・終了の両方が入っている休憩だけが対象）:
   *   - 昼休憩・残業休憩2: 60分を超えたらエラー
   *   - 残業休憩1・残業休憩3: 15分を超えたらエラー
   * 登録に成功したら完了メッセージを出して工数入力画面へ戻る。
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止める
    event.preventDefault();
    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    // 休憩ごとのチェック設定（start/end: 開始・終了時刻、label: エラー表示名、limit: 上限の分数）
    const breakConfigs = [
      { start: breakTime1, end: breakTime2, label: "昼休憩", limit: 60 },
      { start: breakTime3, end: breakTime4, label: "残業休憩1", limit: 15 },
      { start: breakTime5, end: breakTime6, label: "残業休憩2", limit: 60 },
      { start: breakTime7, end: breakTime8, label: "残業休憩3", limit: 15 },
    ];

    // 4種類の休憩それぞれについて長さをチェックする
    for (const config of breakConfigs) {
      // 開始・終了の両方が入っている場合だけチェックする
      if (config.start && config.end) {
        // 終了 − 開始 をミリ秒で求め、分に換算する（1分 = 1000ミリ秒 × 60）
        let diffMin = (config.end.getTime() - config.start.getTime()) / (1000 * 60);

        // マイナスになるのは日をまたぐ休憩（例: 23:45〜00:15）なので、24時間分（1440分）を足す
        if (diffMin < 0) {
          diffMin += 24 * 60;
        }

        // 上限を超えていたらエラーを表示して送信を中止する
        if (diffMin > config.limit) {
          setErrorMessage(`${config.label}が${config.limit}分を超えています。`);
          return;
        }
      }
    }

    try {
      // POST /api/today_break_time/ : 対象就業日の工数データの休憩時間を更新
      //   breakTime1〜8 は toISOString() による UTC の日時文字列（例: "2026-11-09T03:00:00.000Z" = 日本時間12:00）
      //   サーバー側で日本時間に戻して "#HHMMHHMM" 形式で保存し、休憩時間帯の工数を休憩に置き換える
      //   未入力（null）が1つでもあるとサーバーは400エラー「未入力箇所があります」を返す
      //   sessionDay も送っているが、サーバーは対象日をセッションの就業日から決める
      await api.post("/api/today_break_time/",
        {
          breakTime1: breakTime1 ? breakTime1.toISOString() : null,
          breakTime2: breakTime2 ? breakTime2.toISOString() : null,
          breakTime3: breakTime3 ? breakTime3.toISOString() : null,
          breakTime4: breakTime4 ? breakTime4.toISOString() : null,
          breakTime5: breakTime5 ? breakTime5.toISOString() : null,
          breakTime6: breakTime6 ? breakTime6.toISOString() : null,
          breakTime7: breakTime7 ? breakTime7.toISOString() : null,
          breakTime8: breakTime8 ? breakTime8.toISOString() : null,
          sessionDay: sessionDay,
        }
      );

      // 完了メッセージ用の日付文字列を作る
      //   toLocaleDateString で "2026/11/09" の形にしてから「/」をすべて「年」に置き換え、末尾に「日」を付ける
      //   （例: "2026/11/09" → "2026年11年09日"。.replace(/月/, "月") は置換前後が同じで変化しない）
      //   就業日が取得できていない場合は "日付未設定"
      const formattedDate = sessionDay
        ? new Date(sessionDay)
            .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
            .replace(/\//g, "年")
            .replace(/月/, "月") + "日"
        : "日付未設定";

      alert(`${formattedDate} 休憩時間変更完了！`);
      // 登録後は工数入力画面へ戻る
      navigate("/kosu-new");
    } catch (err) {
      // サーバーからの応答があるエラー: ステータスコードで処理を分ける
      if (axios.isAxiosError(err)) {
        // 401: 未ログイン → ログイン画面へ
        if (err.response?.status === 401) navigate("/login");
        // 403: 権限なし → メインメニューへ
        else if (err.response?.status === 403) navigate("/");
        // その他（400: 未入力・形式不正 など）: サーバーが返したメッセージを表示
        else setErrorMessage(err.response?.data.message);
      // 通信以外の予期しないエラー
      } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
    } finally {
      // 読み込み中表示を終了する（この処理内では true にしていないため、実質変化なし）
      setLoading(false);
    }
  };

  // ---------- 描画用データ ----------

  // 時刻選択欄を描画するための設定（休憩1種類につき1要素）
  //   label: 表示名、start/end: 開始・終了時刻の値、setStart/setEnd: それぞれを更新する関数
  const breakLabels = [
    { label: "昼休憩", start: breakTime1, setStart: setBreakTime1, end: breakTime2, setEnd: setBreakTime2 },
    { label: "残業休憩1", start: breakTime3, setStart: setBreakTime3, end: breakTime4, setEnd: setBreakTime4 },
    { label: "残業休憩2", start: breakTime5, setStart: setBreakTime5, end: breakTime6, setEnd: setBreakTime6 },
    { label: "残業休憩3", start: breakTime7, setStart: setBreakTime7, end: breakTime8, setEnd: setBreakTime8 },
  ];

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["today-brea-time-wrapper"]}>
        {/* 画面タイトル: 1行目に対象就業日、2行目に「休憩時間変更」を表示 */}
        {/* 日付は "2026/11/9" の「/」をすべて「年」に置き換えて末尾に「日」を付けた形（例: "2026年11年9日"）。就業日がなければ空 */}
        <h1 className={styles["h1-collar"]}>
          {sessionDay ? new Date(sessionDay).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).replace(/\//g, "年").replace(/月/, "月") + "日" : ""}<br />
          休憩時間変更
        </h1>
        {/* 工数入力画面へ戻るリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-new">工数入力</Link>
        </nav>
        {/* 注意書き: 休憩時間帯に入力済みの工数は休憩に置き換わる旨を表示 */}
        <p>
          指定した休憩時間に入っている工数は<br />
          休憩時間に置き換わり消えます
        </p>

        {/* エラーメッセージがあるときだけ赤字で表示（role="alert" で読み上げソフトにも通知） */}
        {errorMessage && <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>}

        {/* 休憩時間の入力フォーム（送信で handleSubmit を実行） */}
        {/* onKeyDown: 入力欄で Enter を押してもフォーム送信せず、入力欄からフォーカスを外すだけにする */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // 入力欄（input要素）で Enter キーが押された場合、誤操作による登録を防ぐため送信を止め、
            // フォーカスを外して入力を確定させる
            if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "textarea") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 時刻選択欄に日付ライブラリ（date-fns）を渡す外枠 */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              {/* 休憩ごとの入力行: breakLabels の4種類を1行ずつ表示（key には休憩の名称を使う） */}
              {breakLabels.map((item) => (
                <React.Fragment key={item.label}>
                  {/* 休憩の名称（例: 昼休憩:） */}
                  <label>{item.label}:</label>
                  {/* 開始時刻 〜 終了時刻 の時刻選択欄 */}
                  <div className={styles["time-picker-wrapper"]}>
                    {/* 開始時刻の選択欄: 24時間表記・5分刻み */}
                    {/* onAccept: 時刻を確定してダイアログが閉じたとき、MUIのダイアログ表示中に root 要素へ付く */}
                    {/*           aria-hidden 属性（読み上げ対象外にする印）を取り除き、画面が操作対象に戻るようにする */}
                    <MobileTimePicker
                      className={styles["time-picker"]}
                      value={item.start}
                      onChange={(newValue) => item.setStart(newValue)}
                      ampm={false}
                      minutesStep={5}
                      onAccept={() => {
                        // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                        const rootElement = document.getElementById("root");
                        if (rootElement) rootElement.removeAttribute("aria-hidden");
                      }}
                    />
                    {/* 開始と終了の区切り文字 */}
                    <span>〜</span>
                    {/* 終了時刻の選択欄: 開始時刻と同じ設定 */}
                    <MobileTimePicker
                      className={styles["time-picker"]}
                      value={item.end}
                      onChange={(newValue) => item.setEnd(newValue)}
                      ampm={false}
                      minutesStep={5}
                      onAccept={() => {
                        // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                        const rootElement = document.getElementById("root");
                        if (rootElement) rootElement.removeAttribute("aria-hidden");
                      }}
                    />
                  </div>
                </React.Fragment>
              ))}
            </LocalizationProvider>

            {/* エラーメッセージ（登録ボタンの直前にも同じ内容を表示する） */}
            {errorMessage && <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>}

            {/* 登録ボタン（フォームを送信し handleSubmit を実行） */}
            <button type="submit" className="light_blue_button">登録</button>
          </div>
        </form>
      </div>
    </>
  );
};

// ============================================================
// エクスポート
// ============================================================
export default TodayBreakTime;