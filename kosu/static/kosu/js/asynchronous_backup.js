// バックアップ処理開始関数
function startBackup(endpoint, monitorFunc, options = {}) {
  const headers = {
    'X-CSRFToken': getCsrfToken() // CSRFトークンを含むヘッダーを設定
  };

  let body = null;

  // 日付の入力が必要な場合、日付を取得
  if (options.requireDates) {
    const dataDay = document.querySelector('input[name="data_day"]').value;
    const dataDay2 = document.querySelector('input[name="data_day2"]').value;

    // 必須の日付が未入力の場合、警告
    if (!dataDay || !dataDay2) {
      alert("日付を指定してください。");
      return;
    }

    // POSTする際のContent-TypeをフォームデータをURLエンコードした形式に設定
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    // 日付データをURLエンコードして送信
    body = `data_day=${encodeURIComponent(dataDay)}&data_day2=${encodeURIComponent(dataDay2)}`;
  }

  // サーバーにPOST送信
  fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: body
  })
  .then(response => response.json()) // レスポンスJSONに変換
  .then(data => {
    // タスク開始成功時の処理
    if (data.status === 'success') {
      const taskId = data.task_id; // タスクID取得
      monitorFunc(taskId); // タスク監視関数を呼び出し
    } else {
      alert(data.message); // エラーメッセージを通知
    }
  })
  .catch(err => console.error('Error:', err)); // ネットワークエラーなどをログに記録
}



// ファイルアップロード処理関数
function uploadFile(endpoint, fileInputSelector, monitorFunc, fileKey) {
  // ファイル入力要素取得
  const fileInput = document.querySelector(fileInputSelector);
  // ファイルが選択されていない場合、警告
  if (!fileInput.files.length) {
    alert("ファイルを選択してください。");
    return;
  }

  const formData = new FormData(); // FormDataオブジェクトを作成
  formData.append(fileKey, fileInput.files[0]); // ファイルを指定されたキーでFormDataに追加

  const csrfToken = getCsrfToken(); // CSRFトークンを取得

  // サーバーにファイルを送信
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken // CSRFトークンをヘッダーに設定
    },
    body: formData // ファイルを含むFormDataを送信
  })
  .then(response => response.json()) // レスポンスをJSONとしてパース
  .then(data => {
    if (data.status === 'success') {
      const taskId = data.task_id; // タスクIDを取得
      monitorFunc(taskId); // タスクの監視関数を呼び出し
    } else {
      alert(data.message); // エラーメッセージをアラートで通知
    }
  })
  .catch(err => console.error('Error:', err)); // ネットワークエラーをログに記録
}

// タスクの進行状態を監視する汎用的な関数
function monitorTaskStatus(endpoint, onSuccess, onError = null) {
  const interval = setInterval(() => {
    fetch(endpoint) // 定期的に状態を確認するためにリクエストを送信
      .then(response => response.json()) // レスポンスをJSONとしてパース
      .then(data => {
        if (data.status === 'success') { 
          clearInterval(interval); // 成功時には監視を停止
          if (onSuccess) {
            onSuccess(data); // 成功時のコールバックを呼び出す
          }
        } else if (data.status === 'error') { 
          clearInterval(interval); // エラー発生時にも監視を停止
          if (onError) {
            onError(data); // エラー処理が定義されていれば実行
          } else {
            alert(data.message); // エラーメッセージを表示
          }
        }
        // タスクが "pending" の場合は何もせず監視を続ける
      })
      .catch(err => {
        clearInterval(interval); // ネットワークエラー時には監視を停止
        console.error('Error:', err); // エラーをログに記録
      });
  }, 1000); // 1秒間隔でタスク状態を確認
}

// ファイルをダウンロードする汎用的な関数
function downloadFile(endpoint, filePath) {
  const link = document.createElement('a'); // 仮想的な<a>要素を作成
  link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロードURLを設定
  link.download = ''; // ファイル名はサーバー設定に委ねる（空の状態）
  link.click(); // 仮想クリックでダウンロードを開始
}

// CSRFトークンを取得する関数
function getCsrfToken() {
  const token = document.querySelector('input[name="csrfmiddlewaretoken"]').value; // CSRFトークンをフォームから取得
  if (!token) {
    console.error("CSRFトークンが見つかりません。"); // 見つからない場合はエラーログを記録
  }
  return token;
}

// ボタン操作によるバックアップ開始イベント（例：コスバックアップ）
document.getElementById('start-asynchronous1').addEventListener('click', () => {
  startBackup('/start_kosu_backup', (taskId) => {
    monitorTaskStatus(`/check_kosu_backup_status?task_id=${taskId}`, (data) => {
      downloadFile('/download_kosu_backup', data.file_path); // 処理成功後、ダウンロードを開始
    });
  }, { requireDates: true }); // 日付指定が必要であるオプションを追加
});

// コス予測処理を開始
document.getElementById('start-asynchronous2').addEventListener('click', () => {
  startBackup('/start_kosu_prediction', (taskId) => {
    monitorTaskStatus(`/check_kosu_prediction_status?task_id=${taskId}`, (data) => {
      downloadFile('/download_kosu_prediction', data.file_path); // 処理完了後、予測結果をダウンロード
    });
  }, { requireDates: true });
});

// コス削除処理を開始
document.getElementById('start-asynchronous3').addEventListener('click', () => {
  startBackup('/start_kosu_delete', (taskId) => {
    monitorTaskStatus(`/check_kosu_delete_status?task_id=${taskId}`, () => {
      alert('削除が完了しました。'); // 成功後にポップアップを表示
    });
  }, { requireDates: true });
});

// コスロード（ファイルアップロード）を開始
document.getElementById('start-asynchronous4').addEventListener('click', () => {
  uploadFile('/start_kosu_load', 'input[name="kosu_file"]', (taskId) => {
    monitorTaskStatus(`/check_kosu_load_status?task_id=${taskId}`, () => {
      alert('ロードが完了しました！'); // 成功通知
    });
  }, 'kosu_file');
});

// メンバーバックアップ処理を開始
document.getElementById('start-asynchronous5').addEventListener('click', () => {
  startBackup('/start_member_backup', (taskId) => {
    monitorTaskStatus(`/check_member_backup_status?task_id=${taskId}`, (data) => {
      downloadFile('/download_member_backup', data.file_path); // 結果をダウンロード
    });
  });
});

// メンバーファイルのロード（ファイルアップロード）を開始
document.getElementById('start-asynchronous6').addEventListener('click', () => {
  uploadFile('/start_member_load', 'input[name="member_file"]', (taskId) => {
    monitorTaskStatus(`/check_member_load_status?task_id=${taskId}`, () => {
      alert('ロードが完了しました！'); // 成功を通知
    });
  }, 'member_file');
});