import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import axios from 'axios'; // HTTPクライアント
import ShopSelect from '../components/ShopSelect'; // ショップ選択コンポーネント
import { Link, useNavigate } from 'react-router-dom'; // 画面遷移に使用



// CSRFトークンをCookieから取得するヘルパー関数
const getCSRFToken = () => {
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken'))
    ?.split('=')[1];
  return csrfToken || '';
};

// APIから受け取る工数区分の型定義
interface FormData {
  id: number;
  kosu_name: string;
}

function KosuVersion() {
  // 状態変数の定義
  const [choices, setChoices] = useState<FormData[]>([]); // プルダウンメニュー用の選択肢リスト
  const [currentVersion, setCurrentVersion] = useState<string>(''); // 現在の工数定義バージョン
  const [selectedVersion, setSelectedVersion] = useState<string>(''); // ユーザーが選択したバージョン
  const [message, setMessage] = useState<string>(''); // 変更結果メッセージ

  // 🔄 コンポーネントのマウント時にAPIから初期データを取得
  useEffect(() => {
    axios
      .get('/api/def_ver/', {
        withCredentials: true, // ✅ Cookie付きでGET
      })
      .then(response => {
        setChoices(response.data.choices || []);
        setCurrentVersion(response.data.current_version || '');
      })
      .catch(error => {
        console.error('データ取得中にエラーが発生しました:', error);
        setChoices([]);
      });
  }, []);

  // フォーム送信時のハンドラ（選択したバージョンをサーバーに送信）
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // ページリロード防止

    const csrfToken = getCSRFToken(); // CSRFトークンを取得
    axios.post(
      '/api/def_ver/',
      { versionchoice: selectedVersion },
      {
        headers: {
          'X-CSRFToken': csrfToken, // CSRFを明示
        },
        withCredentials: true, // Cookie付きでPOST
      }
    )
      .then(response => {
        setMessage(response.data.message);
        setCurrentVersion(selectedVersion);
      })
      .catch(error => {
        console.error('バージョン更新時にエラーが発生しました:', error);
      });
  };

  return (
    <div>
      <h1>工数区分定義切り替え</h1>
      <p>
        <a href="/def_main">工数区分定義MENUへ</a>
      </p>
      <p>現在の工数区分のVerは "{currentVersion}" です</p>
      <p>{message}</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="versionchoice">工数区分の選択</label>
          <select
            id="versionchoice"
            name="versionchoice"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {choices.length > 0 ? (
              choices.map(choice => (
                <option key={choice.id} value={choice.kosu_name}>
                  {choice.kosu_name}
                </option>
              ))
            ) : (
              <option disabled>データがありません</option>
            )}
          </select>
        </div>
        <button type="submit">
          工数区分定義切り替え
        </button>
      </form>
    </div>
  );
}

export default KosuVersion;
