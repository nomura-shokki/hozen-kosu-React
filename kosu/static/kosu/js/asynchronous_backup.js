// 汎用的なバックアップ処理を開始する関数
function startBackup(endpoint, monitorFunc) {
  // バックアップ期間の日付データをHTMLの入力フィールドから取得
  const dataDay = document.querySelector('input[name="data_day"]').value;
  const dataDay2 = document.querySelector('input[name="data_day2"]').value;

  // 日付が入力されていない場合はユーザーにエラーメッセージを表示（必須チェック）
  if (!dataDay || !dataDay2) {
    alert("日付を指定してください。");
    return; // 処理終了
  }

  // 非同期タスクを開始するためのPOSTリクエストを送信
  fetch(endpoint, {
    method: 'POST', // HTTPメソッドはPOST
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded', // リクエストの形式（URLエンコード）
      'X-CSRFToken': getCsrfToken() // CSRFトークンをヘッダーに追加してセキュリティを確保
    },
    // リクエストのボディに日付範囲データを送信（開始日と終了日）
    body: `data_day=${encodeURIComponent(dataDay)}&data_day2=${encodeURIComponent(dataDay2)}`
  })
  .then(response => response.json()) // サーバーからの応答をJSON形式に変換
  .then(data => {
    if (data.status === 'success') {
      // 非同期タスクIDを取得して進行状況監視関数を呼び出し
      const taskId = data.task_id;
      monitorFunc(taskId); // 非同期タスクの状態を監視
    } else {
      // サーバーからエラーメッセージが返却された場合は表示
      alert(data.message);
    }
  })
  .catch(err => console.error('Error:', err)); // ネットワークエラーやその他のエラーをログに記録
}

function uploadFile(endpoint, fileInputSelector, monitorFunc) {
  const fileInput = document.querySelector(fileInputSelector); // ファイル入力要素の選択
  if (!fileInput.files.length) {
    alert("ファイルを選択してください。"); // ファイルが未選択の場合は警告
    return;
  }

  const formData = new FormData();
  formData.append('kosu_file', fileInput.files[0]); // ファイルをフォームデータに追加

  // CSRFトークンを取得して設定
  const csrfToken = getCsrfToken();

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken // CSRFトークンを設定
    },
    body: formData // フォームデータを送信
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      const taskId = data.task_id;
      monitorFunc(taskId); // 成功時にタスク状態監視処理を開始
    } else {
      alert(data.message); // エラー発生時はメッセージを表示
    }
  })
  .catch(err => console.error('Error:', err)); // ネットワークエラーなどをログに記録
}

// 汎用的なタスク進行状況監視関数
function monitorTaskStatus(endpoint, onSuccess, onError = null) {
  const interval = setInterval(() => {
    fetch(endpoint)
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') { 
          // 成功時にタイマーを停止し、成功後の処理を実行
          clearInterval(interval);
          if (onSuccess) {
            onSuccess(data); // 完了時の成功コールバックを呼び出し
          }
        } else if (data.status === 'error') { 
          // エラー時にタイマーを停止し、エラーハンドリングを実行
          clearInterval(interval);
          if (onError) {
            onError(data); // 必要に応じてエラー処理を呼び出す
          } else {
            alert(data.message); // `onError`未指定ならエラー通知
          }
        }
        // タスクが "pending" の場合は処理を継続（何もしない）
      })
      .catch(err => {
        // ネットワークエラー時にはタイマーを停止し、エラー内容を記録
        clearInterval(interval);
        console.error('Error:', err);
      });
  }, 1000); // タスク状態を1秒間隔で確認
}

// 汎用的なファイルダウンロード関数
function downloadFile(endpoint, filePath) {
  // 仮想リンク（<a> 要素）を作成しそのリンクをクリックすることでファイルをダウンロード
  const link = document.createElement('a');
  link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロード用のURL
  link.download = ''; // ファイル名はサーバー側で設定されるため空にする
  link.click(); // 仮想的なクリックイベントを発生させてダウンロードを開始
}

// CSRFトークン取得関数
function getCsrfToken() {
  const token = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
  if (!token) {
    // CSRFトークンが見つからない場合はエラーメッセージをログに記録
    console.error("CSRFトークンが見つかりません。");
  }
  return token;
}

// ボタンのクリックイベントリスナーを設定（バックアップ処理に対応）
document.getElementById('start-asynchronous1').addEventListener('click', () => {
  startBackup('/start_kosu_backup', (taskId) => { // `/start_kosu_backup` APIでタスク開始
    monitorTaskStatus(`/check_kosu_backup_status?task_id=${taskId}`, (data) => {
      downloadFile('/download_kosu_backup', data.file_path); // 完了したタスクのファイルをダウンロード
    });
  });
});

// ボタンのクリックイベントリスナーを設定（予測処理に対応）
document.getElementById('start-asynchronous2').addEventListener('click', () => {
  startBackup('/start_kosu_prediction', (taskId) => { // `/start_kosu_prediction` APIでタスク開始
    monitorTaskStatus(`/check_kosu_prediction_status?task_id=${taskId}`, (data) => {
      downloadFile('/download_kosu_prediction', data.file_path); // 完了したタスクのファイルをダウンロード
    });
  });
});


document.getElementById('start-asynchronous3').addEventListener('click', () => {
  startBackup('/start_kosu_delete', (taskId) => { // `/start_kosu_delete` APIでタスク開始
    monitorTaskStatus(`/check_kosu_delete_status?task_id=${taskId}`, () => {
      alert('削除が完了しました。'); // 削除完了後にポップアップを表示
    });
  });
});

document.getElementById('start-asynchronous4').addEventListener('click', () => {
  uploadFile('/start_kosu_load', 'input[name="kosu_file"]', (taskId) => {
    monitorTaskStatus(`/check_kosu_load_status?task_id=${taskId}`, () => {
      alert('ロードが完了しました！'); // 完了時にポップアップを表示
    });
  });
});






