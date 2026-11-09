/**
 * ============================================================
 * ファイル名 : BreakTime.tsx
 * 種別       : 画面コンポーネント（休憩時間変更画面）
 * 概要       : ログイン者本人の「毎日の」休憩時間（直ごとの標準休憩時間）を変更する画面。
 *              6種類の直 × 4種類の休憩（昼休憩・残業休憩1〜3）の開始/終了時刻を設定する。
 *              ここで登録した値は人員データに保存され、工数入力時の休憩時間の初期値になる。
 *              （1日だけ休憩を変える場合は当日休憩時間変更画面を使う）
 *
 * 主な機能   :
 *   - 人員データに登録済みの休憩時間を取得し、時刻選択欄に表示
 *   - 休憩の長さチェック（昼休憩・残業休憩2は60分以内、残業休憩1・3は15分以内）
 *   - 全48項目（6直 × 4休憩 × 開始/終了）の休憩時間を一括登録
 *
 * 使用API    : GET  /api/break_time/  ログイン者の人員データ（休憩時間）取得（kosu/views/kosu_views.py の BreakTime）
 *              POST /api/break_time/  休憩時間の一括更新（同上）
 * 画面URL    : /break-time            （index.tsx のルーティング定義）
 * 関連ファイル: styles/KosuPage/BreakTime.module.css, Components/Loading.tsx,
 *              KosuPage/TodayBreakTime.tsx（1日だけの休憩変更画面）
 * ============================================================
 */

// ============================================================
// インポート
// ============================================================
import React, { useState, useEffect, FormEvent } from "react";
import api from "../api/axios"; // 共通設定済みのaxiosインスタンス（API通信用）
import axios from "axios"; // エラー判定（axios.isAxiosError）にだけ使用
import { Link, useNavigate } from "react-router-dom";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"; // 日付ライブラリ date-fns を MUI の時刻選択欄で使うためのアダプター
import { MobileTimePicker } from "@mui/x-date-pickers"; // ダイアログ形式の時刻選択欄（MUI部品）
import { LocalizationProvider } from "@mui/x-date-pickers"; // 時刻選択欄に日付ライブラリを渡す外枠（MUI部品）
import Loading from "../Components/Loading"; // 読み込み中の表示
import styles from "../styles/KosuPage/BreakTime.module.css";

// ============================================================
// 型定義
// ============================================================

/**
 * ログイン者の人員データ（GET /api/break_time/ のレスポンス member_data）。
 *
 * 休憩時間は "#HHMMHHMM" 形式（例: "#12001245" = 12:00〜12:45）の文字列。
 * break_timeN の N は直の種類（1: 1直 / 2: 2直 / 3: 3直 / 4: 常昼 / 5: 連1直 / 6: 連2直）。
 */
interface Member {
  employee_no: number; // 従業員番号
  name: string; // 氏名
  shop: string; // ショップ（所属部署）
  authority: boolean; // 権限（一般より上の操作権限）の有無
  administrator: boolean; // 管理者かどうか
  break_time1: string | null; // 1直の昼休憩
  break_time1_over1: string | null; // 1直の残業休憩1
  break_time1_over2: string | null; // 1直の残業休憩2
  break_time1_over3: string | null; // 1直の残業休憩3
  break_time2: string | null; // 2直の昼休憩
  break_time2_over1: string | null; // 2直の残業休憩1
  break_time2_over2: string | null; // 2直の残業休憩2
  break_time2_over3: string | null; // 2直の残業休憩3
  break_time3: string | null; // 3直の昼休憩
  break_time3_over1: string | null; // 3直の残業休憩1
  break_time3_over2: string | null; // 3直の残業休憩2
  break_time3_over3: string | null; // 3直の残業休憩3
  break_time4: string | null; // 常昼の昼休憩
  break_time4_over1: string | null; // 常昼の残業休憩1
  break_time4_over2: string | null; // 常昼の残業休憩2
  break_time4_over3: string | null; // 常昼の残業休憩3
  break_time5: string | null; // 連1直の昼休憩
  break_time5_over1: string | null; // 連1直の残業休憩1
  break_time5_over2: string | null; // 連1直の残業休憩2
  break_time5_over3: string | null; // 連1直の残業休憩3
  break_time6: string | null; // 連2直の昼休憩
  break_time6_over1: string | null; // 連2直の残業休憩1
  break_time6_over2: string | null; // 連2直の残業休憩2
  break_time6_over3: string | null; // 連2直の残業休憩3
}

// ============================================================
// コンポーネント本体
// ============================================================

/**
 * 休憩時間変更画面。
 *
 * 表示時に人員データから現在の休憩時間を取得し、直ごとに時刻選択欄へ並べる。
 * 「登録」ボタンで休憩の長さをチェックしたうえで、全項目をサーバーへ送信する。
 *
 * 休憩時間は48要素の配列 breakTimes で管理する。並び順は
 *   インデックス = 直の番号(0〜5) × 8 + 休憩の番号(0〜3) × 2 （+1 なら終了時刻）
 * 例: 2直(1)の残業休憩1(1)の開始時刻 → 1×8 + 1×2 = 10、終了時刻 → 11
 *
 * @returns 休憩時間変更画面のJSX
 */
const BreakTime: React.FC = () => {
  // ---------- state（画面の状態） ----------
  const navigate = useNavigate(); // 画面遷移用の関数
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ（null ならエラーなし）
  const [loading, setLoading] = useState(true); // 読み込み中かどうか（true の間はローディング表示）
  // 休憩時間の開始/終了時刻を並べた48要素の配列（並び順はコンポーネント説明を参照）。未取得の間は全て null
  const [breakTimes, setBreakTimes] = useState<(Date | null)[]>(Array(48).fill(null));

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

  // 初回表示時（navigate は通常変わらないため実質1回）: 登録済みの休憩時間を取得して表示する
  useEffect(() => {
    /**
     * ログイン者の人員データを取得し、休憩時間を breakTimes の state に展開する。
     *
     * 401（未ログイン・定義Ver未選択）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
     *
     * @returns なし（結果は breakTimes / errorMessage の state に反映）
     */
    const fetchBreakTimes = async () => {
      try {
        // GET /api/break_time/ : ログイン者の人員データ（休憩時間を含む）を取得
        const response = await api.get("/api/break_time/");
        const member_data: Member = response.data.member_data || {};

        // 人員データの休憩時間項目名。breakTimes の並び順（直ごと・休憩ごと）と同じ順に並べる
        const breakTimeKeys = [
          "break_time1", "break_time1_over1", "break_time1_over2", "break_time1_over3",
          "break_time2", "break_time2_over1", "break_time2_over2", "break_time2_over3",
          "break_time3", "break_time3_over1", "break_time3_over2", "break_time3_over3",
          "break_time4", "break_time4_over1", "break_time4_over2", "break_time4_over3",
          "break_time5", "break_time5_over1", "break_time5_over2", "break_time5_over3",
          "break_time6", "break_time6_over1", "break_time6_over2", "break_time6_over3",
        ];

        // 24項目それぞれを [開始, 終了] に変換し、flatMap で1列に並べて48要素の配列にする
        const newBreakTimes = breakTimeKeys.flatMap((key) => {
          const breakTimeValue = member_data[key as keyof Member] as string | null;
          return parseBreakTime(breakTimeValue);
        });

        setBreakTimes(newBreakTimes);
      } catch (err) {
        // サーバーからの応答があるエラー: ステータスコードで処理を分ける
        if (axios.isAxiosError(err)) {
          // 401: 未ログイン、または工数区分定義Verが未選択 → ログイン画面へ
          if (err.response?.status === 401) navigate("/login");
          // 403: 権限なし → メインメニューへ
          else if (err.response?.status === 403) navigate("/");
          // その他: サーバーが返したメッセージを表示
          else setErrorMessage(err.response?.data.message);
        // 通信以外の予期しないエラー
        } else setErrorMessage("不明なエラーが発生しました。IT担当者に連絡してください。");
      } finally {
        // 成功・失敗どちらでも読み込み中表示を終了する
        setLoading(false);
      }
    };

    fetchBreakTimes();
  }, [navigate]);

  // ---------- イベントハンドラ ----------

  /**
   * 「登録」ボタン押下時の処理。休憩の長さをチェックし、問題なければ全休憩時間を送信する。
   *
   * チェック内容（開始・終了の両方が入っている休憩だけが対象）:
   *   - 昼休憩・残業休憩2: 60分を超えたらエラー
   *   - 残業休憩1・残業休憩3: 15分を超えたらエラー
   * 401（未ログイン）ならログイン画面へ、403（権限なし）ならメニューへ遷移する。
   *
   * @param event - フォーム送信イベント（ページの再読み込みを止めるために使う）
   * @returns なし（結果は alert 表示または errorMessage の state に反映）
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // ブラウザ標準のフォーム送信（ページ再読み込み）を止める
    event.preventDefault();
    // 前回のエラーメッセージを消す
    setErrorMessage(null);

    // エラーメッセージに使う直と休憩の名称（breakTimes の並び順と同じ）
    const groups = ["1直", "2直", "3直", "常昼", "連1直", "連2直"];
    const breaks = ["昼休憩", "残業休憩1", "残業休憩2", "残業休憩3"];

    // 全直 × 全休憩について休憩の長さをチェックする
    for (let g = 0; g < groups.length; g++) {
      for (let b = 0; b < breaks.length; b++) {
        // g番目の直・b番目の休憩の開始/終了時刻を取り出す（並び順はコンポーネント説明を参照）
        const startTime = breakTimes[g * 8 + b * 2];
        const endTime = breakTimes[g * 8 + b * 2 + 1];

        // 開始・終了の両方が入っている場合だけチェックする
        if (startTime && endTime) {
          // 終了 − 開始 をミリ秒で求め、分に換算する（1分 = 1000ミリ秒 × 60）
          const diffMs = endTime.getTime() - startTime.getTime();
          let diffMin = diffMs / (1000 * 60);

          // マイナスになるのは日をまたぐ休憩（例: 23:45〜00:15）なので、24時間分（1440分）を足す
          if (diffMin < 0) {
            diffMin += 24 * 60;
          }

          // 昼休憩（b=0）・残業休憩2（b=2）は60分まで
          if (b === 0 || b === 2) {
            if (diffMin > 60) {
              setErrorMessage(`${groups[g]}${breaks[b]}が60分を超えています。`);
              return;
            }
          } 
          // 残業休憩1（b=1）・残業休憩3（b=3）は15分まで
          else {
            if (diffMin > 15) {
              setErrorMessage(`${groups[g]}${breaks[b]}が15分を超えています。`);
              return;
            }
          }
        }
      }
    }

    // 送信データを作成: { breakTime1: 開始, breakTime2: 終了, ..., breakTime48 } の形にする
    //   値は toISOString() による UTC の日時文字列（例: "2026-11-09T03:00:00.000Z" = 日本時間12:00）
    //   サーバー側で日本時間に戻して "#HHMMHHMM" 形式に変換される。未入力は null
    const breakTimeData = breakTimes.reduce((result, time, index) => {
      result[`breakTime${index + 1}`] = time ? time.toISOString() : null;
      return result;
    }, {} as { [key: string]: string | null });

    try {
      // POST /api/break_time/ : ログイン者の人員データの休憩時間（48項目）を一括更新
      //   未入力（null）が1つでもあるとサーバーは400エラー「未入力箇所があります」を返す
      await api.post("/api/break_time/", breakTimeData);
      alert("変更完了！");
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

  // ---------- 描画（JSX） ----------

  // 読み込み中はローディング表示だけを出す
  if (loading) return <div><Loading isLoading={loading} /></div>;

  return (
    <>
      <div className={styles["brea-time-wrapper"]}>
        {/* 画面タイトル */}
        <h1 className={styles["h1-collar"]}>
          休憩時間変更
        </h1>
        {/* 工数メニュー画面へ戻るリンク */}
        <nav className={styles["kosu-nav"]}>
          <Link to="/kosu-menu">工数MENU</Link>
        </nav>
        {/* 説明文: この画面は毎日の休憩時間を変える画面で、1日だけの変更は工数入力画面から行う旨を表示 */}
        <p>
          毎日の休憩時間が変更されます<br />
          1日のみの休憩変更は工数入力画面の休憩変更釦から実施
        </p>

        {/* エラーメッセージがあるときだけ赤字で表示（role="alert" で読み上げソフトにも通知） */}
        {errorMessage && <div role="alert" style={{ color: "red", fontWeight: "bold" }}>{errorMessage}</div>}

        {/* 休憩時間の入力フォーム（送信で handleSubmit を実行） */}
        {/* onKeyDown: 入力欄で Enter を押してもフォーム送信せず、入力欄からフォーカスを外すだけにする */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // 入力欄（input要素）で Enter キーが押された場合
            if (
              e.key === "Enter" &&
              e.target instanceof HTMLInputElement &&
              e.target.type !== "textarea"
            ) {
              // 誤操作による登録を防ぐため送信を止め、フォーカスを外して入力を確定させる
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        >
          <div className={styles["search-bar"]}>
            {/* 直ごとの入力ブロック: 6種類の直を1ブロックずつ表示（key には直の名称を使う） */}
            {["1直", "2直", "3直", "常昼", "連1直", "連2直"].map((groupLabel, groupIndex) => (
              <div key={groupLabel} className={styles["breakinition-block"]}>
                {/* 直の名称（見出し） */}
                <h3>{groupLabel}</h3>
                {/* 休憩ごとの入力行: 4種類の休憩を1行ずつ表示（key には休憩の名称を使う） */}
                {["昼休憩", "残業休憩1", "残業休憩2", "残業休憩3"].map((breakLabel, breakIndex) => (
                  <div key={breakLabel}>
                    {/* 休憩の名称（例: 昼休憩:） */}
                    <label>{`${breakLabel}`}:</label>
                    {/* 開始時刻 〜 終了時刻 の時刻選択欄 */}
                    <div className={styles["time-picker-wrapper"]}>
                      {/* 開始時刻の選択欄: 24時間表記・5分刻み。変更すると breakTimes の該当要素（直×8 + 休憩×2）を書き換える */}
                      {/* onAccept: 時刻を確定してダイアログが閉じたとき、MUIのダイアログ表示中に root 要素へ付く */}
                      {/*           aria-hidden 属性（読み上げ対象外にする印）を取り除き、画面が操作対象に戻るようにする */}
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <MobileTimePicker
                          className={styles["time-picker"]}
                          value={breakTimes[groupIndex * 8 + breakIndex * 2]}
                          onChange={(newValue) => {
                            // 配列をコピーしてから該当要素だけ書き換える（state を直接変更しないため）
                            const updatedBreakTimes = [...breakTimes];
                            updatedBreakTimes[groupIndex * 8 + breakIndex * 2] = newValue;
                            setBreakTimes(updatedBreakTimes);
                          }}
                          ampm={false}
                          minutesStep={5}
                          onAccept={() => {
                            // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                            const rootElement = document.getElementById("root");
                            if (rootElement) rootElement.removeAttribute("aria-hidden");
                          }}
                        />
                      </LocalizationProvider>
                      {/* 開始と終了の区切り文字 */}
                      <span>〜</span>
                      {/* 終了時刻の選択欄: 開始時刻と同じ設定。書き換えるのは breakTimes の (直×8 + 休憩×2 + 1) 番目 */}
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <MobileTimePicker
                          className={styles["time-picker"]}
                          value={breakTimes[groupIndex * 8 + breakIndex * 2 + 1]}
                          onChange={(newValue) => {
                            // 配列をコピーしてから該当要素だけ書き換える（state を直接変更しないため）
                            const updatedBreakTimes = [...breakTimes];
                            updatedBreakTimes[groupIndex * 8 + breakIndex * 2 + 1] = newValue;
                            setBreakTimes(updatedBreakTimes);
                          }}
                          ampm={false}
                          minutesStep={5}
                          onAccept={() => {
                            // ダイアログ表示中に付けられた aria-hidden を root 要素から外す
                            const rootElement = document.getElementById("root");
                            if (rootElement) rootElement.removeAttribute("aria-hidden");
                          }}
                        />
                      </LocalizationProvider>
                    </div>
                  </div>
                ))}
              </div>
            ))}
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
export default BreakTime;