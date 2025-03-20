// 工数データバックアップ時の処理
document.getElementById('start-backup1').addEventListener('click', function() {
  // バックアップ期間の日付データ取得
  const dataDay = document.querySelector('input[name="data_day"]').value;
  const dataDay2 = document.querySelector('input[name="data_day2"]').value;

  // 日付が指定されていない場合のエラー
  if (!dataDay || !dataDay2) {
    alert("バックアップする日付を指定してください。");
    return;
  }

  // 非同期タスクを開始（バックエンドにPOSTリクエストを送信する）
  fetch('/start_kosu_backup', {
    method: 'POST',
    headers: {
      // リクエストの形式を設定
      'Content-Type': 'application/x-www-form-urlencoded',
      // CSRFトークンを送信
      'X-CSRFToken': getCsrfToken()
    },
    // リクエストのボディに日付データを送信
    body: `data_day=${dataDay}&data_day2=${dataDay2}`
  })
  .then(response => response.json()) // サーバーからの応答をJSON形式でパース
  .then(data => {
    // サーバーからの応答が成功の場合
    if (data.status === 'success') {
      // 非同期タスクIDを取得
      const taskId = data.task_id;
      // 非同期タスクの進行状況を監視
      monitorTaskStatus(taskId);
    } else {
      // サーバーからの応答がエラーの場合、エラーメッセージを表示
      alert(data.message);
    }
  })
  // 通信エラーが発生した場合はエラーメッセージをログに出力
  .catch(err => console.error('Error:', err));
});

// 非同期タスク進行状況監視関数
function monitorTaskStatus(taskId) {
  // タスクを確認するAPI呼び出し
  const interval = setInterval(() => {
    fetch(`/check_kosu_backup_status?task_id=${taskId}`)
    // サーバーからの応答をJSON形式に
    .then(response => response.json())
    .then(data => {
        // タスクが完了した場合、タスク監視を停止しダウンロード処理
      if (data.status === 'success') {
        clearInterval(interval);
        downloadFile(data.file_path);
      } else if (data.status === 'error') {
        // タスクが失敗した場合
        clearInterval(interval); // ポーリング（状態確認）を停止
        alert(data.message); // エラーメッセージを表示
      }
      // statusが 'pending' の場合は何もしない（タスクがまだ進行中）
    })
    .catch(err => console.error('Error:', err)); // 通信エラーが発生した場合はエラーメッセージをログに出力
  }, 1000); // 1秒ごとに状態を確認
}

// バックアップ完了ファイルダウンロード関数
function downloadFile(filePath) {
  // <a> 要素を生成
  const link = document.createElement('a');
  // ダウンロードリンクのURLを設定
  link.href = `/download_kosu_backup?file_path=${encodeURIComponent(filePath)}`;
  // ファイル名の設定（サーバーで自動的に決定）
  link.download = '';
  // 仮想的にクリックしてダウンロード開始
  link.click();
}

// CSRFトークン取得関数
function getCsrfToken() {
  // HTML内の <input> 要素からCSRFトークン取得
  return document.querySelector('input[name="csrfmiddlewaretoken"]').value;
}