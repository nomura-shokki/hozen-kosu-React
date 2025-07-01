import React, { useEffect, useState } from 'react';
import axios from 'axios';

// CSRFトークンを取得するヘルパー関数
const getCSRFToken = () => {
  const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken'))?.split('=')[1];
  return csrfToken || '';
};

interface KosuDivision {
  id: number;
  kosu_name: string;
}

function KosuVersion() {
  const [choices, setChoices] = useState<KosuDivision[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    axios.get('/api/def_ver/')
      .then(response => {
        setChoices(response.data.choices || []);
        setCurrentVersion(response.data.current_version || '');
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setChoices([]);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const csrfToken = getCSRFToken();
    axios.post('/api/def_ver/', { versionchoice: selectedVersion }, {
      headers: {
        'X-CSRFToken': csrfToken, // CSRFトークンを付与
      },
    })
      .then(response => {
        setMessage(response.data.message);
        setCurrentVersion(selectedVersion);
      })
      .catch(error => console.error('Error updating version:', error));
  };

  return (
    <div className="container content">
      <h1 className="display-4 text-success">工数区分定義切り替え</h1>
      <p className="h6">
        <a href="/def_main" className="text-success">工数区分定義MENUへ</a>
      </p>
      <p>現在の工数区分のVerは "{currentVersion}" です</p>
      <p>{message}</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="versionchoice" className="form-label">工数区分の選択</label>
          <select
            id="versionchoice"
            name="versionchoice"
            className="form-select"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {choices && choices.length > 0 ? (
              choices.map((choice) => (
                <option key={choice.id} value={choice.kosu_name}>
                  {choice.kosu_name}
                </option>
              ))
            ) : (
              <option disabled>データがありません</option>
            )}
          </select>
        </div>
        <button type="submit" className="btn btn-green4 mt-2">
          工数区分定義切り替え
        </button>
      </form>
    </div>
  );
}

export default KosuVersion;