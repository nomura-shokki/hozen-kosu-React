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

// 都度更新
setInterval(fetchLogs, 4000);


// ページが読み込まれた時にチェックボックスの状態を復元
document.addEventListener("DOMContentLoaded", function () {
  const htmlElement = document.documentElement;
  const bodyElement = document.body;
  const isChecked = localStorage.getItem("myCheckboxChecked"); // 保存済みの状態を取得
  const targetElement = document.getElementById("consoleDiv");
  const content = document.getElementById("content");

  // ページ読み込み時にチェックボックスの状態を反映
  if (isChecked === "true") {
    targetElement.classList.remove("hidden"); // 表示
    targetElement.classList.add("consoleDiv");
    content.classList.add("content");
    htmlElement.classList.add("display");
    bodyElement.classList.add("display");
  } else {
    targetElement.classList.add("hidden"); // 非表示
    targetElement.classList.remove("consoleDiv");
    content.classList.remove("content");
    htmlElement.classList.remove("display");
    bodyElement.classList.remove("display");
  }
});

