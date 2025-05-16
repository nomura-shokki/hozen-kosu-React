function fetchLogs() {
  fetch('/get-logs')
      .then(response => response.json())
      .then(data => {
          const consoleDiv = document.getElementById('consoleDiv');
          const maxLines = 50; // 表示するログの最大行数
          const logs = data.logs.slice(-maxLines);
          consoleDiv.innerHTML = logs.join('<br>');
      })
      .catch(error => console.error("Failed to fetch logs:", error));
}

// 5秒間隔で更新
setInterval(fetchLogs, 5000);