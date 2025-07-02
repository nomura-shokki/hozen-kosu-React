import React, { useEffect, useState } from "react";
import helmetImage from "../img/helmet.png"; // 静的リソースの画像
import styles from "../styles/components/Loading.module.css";

interface LoadingProps {
  isLoading: boolean; // ローディング状態を受け取るためのプロパティ
}

const Loading: React.FC<LoadingProps> = ({ isLoading }) => {
  const [shouldRender, setShouldRender] = useState(true); // フェードアウト後に完全削除

  useEffect(() => {
    if (!isLoading) {
      // ローディング終了後にフェードアウトを開始
      const timeout = setTimeout(() => {
        setShouldRender(false); // 完全にレンダリングを停止
      }, 1000); // CSSトランジションと同期（1秒）
      return () => clearTimeout(timeout); // コンポーネントアンマウント時にクリーンアップ
    }
  }, [isLoading]);

  if (!shouldRender) return null; // レンダリングを停止

  return (
    <div
      id="loading"
      className={`${styles.loading} ${!isLoading ? styles.fadeOut : ""}`} // フェードアウト時にクラス追加
    >
      <div className={styles.item}>
        <img
          id="loadingImg"
          src={helmetImage}
          alt="Loading..."
          className={styles.sway}
        />
      </div>
      <p className={styles.loadingText}>Loading...</p>
    </div>
  );
};

export default Loading;