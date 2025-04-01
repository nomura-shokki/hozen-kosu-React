// バックアップ開始関数
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
      alert(data.message); // エラーメッセージ出力
    }
  })
  .catch(err => console.error('Error:', err)); // エラーを記録
}



// ファイルアップロード関数
function uploadFile(endpoint, fileInputSelector, monitorFunc, fileKey) {
  // ファイル入力要素取得
  const fileInput = document.querySelector(fileInputSelector);
  // ファイルが選択されていない場合、警告
  if (!fileInput.files.length) {
    alert("ファイルを選択してください。");
    return;
  }

  const formData = new FormData(); // FormData作成
  formData.append(fileKey, fileInput.files[0]); // ファイルをFormDataに追加

  const csrfToken = getCsrfToken(); // CSRFトークン取得

  // サーバーにファイルを送信
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken // CSRFトークンをヘッダーに設定
    },
    body: formData // FormData送信
  })
  .then(response => response.json()) // レスポンスJSONに変換
  .then(data => {
    if (data.status === 'success') {
      const taskId = data.task_id; // タスクID取得
      monitorFunc(taskId); // タスク監視関数呼び出し
    } else {
      alert(data.message); // エラー出力
    }
  })
  .catch(err => console.error('Error:', err)); // エラーを記録
}



// タスク進行状態監視関数
function monitorTaskStatus(endpoint, onSuccess, onError = null) {
  const interval = setInterval(() => {
    fetch(endpoint) // 定期的に状態を確認するためにリクエストを送信
      .then(response => response.json()) // レスポンスJSONに変換
      .then(data => {
        if (data.status === 'success') { // タスク成功時
          clearInterval(interval); // 監視停止
          if (onSuccess) {
            onSuccess(data); // コールバックを呼び出す
          }
        } else if (data.status === 'error') { // タスクエラー時
          clearInterval(interval); // 監視停止
          if (onError) {
            onError(data); // エラー処理が定義されていれば実行
          } else {
            alert(data.message); // エラー出力
          }
        }
        // "pending" の場合は監視続行
      })
      .catch(err => { // ネットワークエラー時
        clearInterval(interval); // 監視停止
        console.error('Error:', err); // エラーをログに記録
      });
  }, 1000); // 1秒間隔でタスク状態確認
}



// ファイルダウンロード関数
function downloadFile(endpoint, filePath) {
  const link = document.createElement('a'); // 仮想リンク作成
  link.href = `${endpoint}?file_path=${encodeURIComponent(filePath)}`; // ダウンロードURLを設定
  link.download = ''; // ファイル名はサーバー設定に委ねる
  link.click(); // 仮想リンククリックでダウンロード開始
}



// CSRFトークンを取得する関数
function getCsrfToken() {
  // CSRFトークンをフォームから取得
  const token = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
  // トークン見つからない場合はエラーログ記録
  if (!token) {
    console.error("CSRFトークンが見つかりません。");
  }
  return token;
}



// 工数データバックアップボタン操作
document.getElementById('start-asynchronous1').addEventListener('click', () => { // バックアップボタンを押すと処理開始
  startBackup('/start_kosu_backup', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_kosu_backup_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_kosu_backup', data.file_path); // 処理成功後、ダウンロード
    });
  }, { requireDates: true }); // 日付指定オプション追加
});



// 工数区分定義予測データ出力ボタン操作
document.getElementById('start-asynchronous2').addEventListener('click', () => { // 出力ボタンを押すと処理開始
  startBackup('/start_kosu_prediction', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_kosu_prediction_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_kosu_prediction', data.file_path); // 処理完了後、ダウンロード
    });
  }, { requireDates: true }); // 日付指定オプション追加
});



// 工数データ削除関数
document.getElementById('start-asynchronous3').addEventListener('click', () => { // 削除ボタンを押すと処理開始
  startBackup('/start_kosu_delete', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_kosu_delete_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('削除が完了しました。'); // 成功後、ポップアップ表示
    });
  }, { requireDates: true }); // 日付指定オプション追加
});



// 工数データロード関数
document.getElementById('start-asynchronous4').addEventListener('click', () => { // ロードボタンを押すと処理開始
  uploadFile('/start_kosu_load', 'input[name="kosu_file"]', (taskId) => { // ファイルアップロード開始関数を呼ぶ
    monitorTaskStatus(`/check_kosu_load_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('ロードが完了しました！'); // 成功後、ポップアップ表示
    });
  }, 'kosu_file'); // ファイルアップロードフォーム指定
});



// 人員データバックアップ関数
document.getElementById('start-asynchronous5').addEventListener('click', () => { // バックアップボタンを押すと処理開始
  startBackup('/start_member_backup', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_member_backup_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_member_backup', data.file_path); // 処理完了後、ダウンロード
    });
  });
});



// 人員データロード関数
document.getElementById('start-asynchronous6').addEventListener('click', () => { // ロードボタンを押すと処理開始
  uploadFile('/start_member_load', 'input[name="member_file"]', (taskId) => { // ファイルアップロード開始関数を呼ぶ
    monitorTaskStatus(`/check_member_load_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('ロードが完了しました！'); // 成功後、ポップアップ表示
    });
  }, 'member_file'); // ファイルアップロードフォーム指定
});



// 班員データバックアップ関数
document.getElementById('start-asynchronous7').addEventListener('click', () => { // バックアップボタンを押すと処理開始
  startBackup('/start_team_backup', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_team_backup_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_team_backup', data.file_path); // 処理完了後、ダウンロード
    });
  });
});



// 班員データロード関数
document.getElementById('start-asynchronous8').addEventListener('click', () => { // ロードボタンを押すと処理開始
  uploadFile('/start_team_load', 'input[name="team_file"]', (taskId) => { // ファイルアップロード開始関数を呼ぶ
    monitorTaskStatus(`/check_team_load_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('ロードが完了しました！'); // 成功後、ポップアップ表示
    });
  }, 'team_file'); // ファイルアップロードフォーム指定
});



// 工数区分定義データバックアップ関数
document.getElementById('start-asynchronous9').addEventListener('click', () => { // バックアップボタンを押すと処理開始
  startBackup('/start_def_backup', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_def_backup_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_def_backup', data.file_path); // 処理完了後、ダウンロード
    });
  });
});



// 工数区分定義データロード関数
document.getElementById('start-asynchronous10').addEventListener('click', () => { // ロードボタンを押すと処理開始
  uploadFile('/start_def_load', 'input[name="def_file"]', (taskId) => { // ファイルアップロード開始関数を呼ぶ
    monitorTaskStatus(`/check_def_load_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('ロードが完了しました！'); // 成功後、ポップアップ表示
    });
  }, 'def_file'); // ファイルアップロードフォーム指定
});



// 問い合わせデータバックアップ関数
document.getElementById('start-asynchronous11').addEventListener('click', () => { // バックアップボタンを押すと処理開始
  startBackup('/start_inquiry_backup', (taskId) => { // バックアップ開始関数を呼ぶ
    monitorTaskStatus(`/check_inquiry_backup_status?task_id=${taskId}`, (data) => { // タスク監視関数を呼ぶ
      downloadFile('/download_inquiry_backup', data.file_path); // 処理完了後、ダウンロード
    });
  });
});



// 問い合わせデータロード関数
document.getElementById('start-asynchronous12').addEventListener('click', () => { // ロードボタンを押すと処理開始
  uploadFile('/start_inquiry_load', 'input[name="inquiry_file"]', (taskId) => { // ファイルアップロード開始関数を呼ぶ
    monitorTaskStatus(`/check_inquiry_load_status?task_id=${taskId}`, () => { // タスク監視関数を呼ぶ
      alert('ロードが完了しました！'); // 成功後、ポップアップ表示
    });
  }, 'inquiry_file'); // ファイルアップロードフォーム指定
});

