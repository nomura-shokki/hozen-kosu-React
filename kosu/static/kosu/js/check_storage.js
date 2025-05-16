// ページが読み込まれた時にチェックボックスの状態を復元
document.addEventListener("DOMContentLoaded", function () {
  const checkbox = document.getElementById("myCheckbox");
  const isChecked = localStorage.getItem("myCheckboxChecked"); // 保存済みの状態を取得
  const targetElement = document.getElementById("consoleDiv");

  // ページ読み込み時にチェックボックスの状態を反映
  if (isChecked === "true") {
    checkbox.checked = true;
    targetElement.classList.remove("hidden"); // 表示
  } else {
    targetElement.classList.add("hidden"); // 非表示
  }

  // チェックボックスの状態が変更されたらその場で表示を切り替え
  checkbox.addEventListener("change", function () {
    const isCheckedNow = checkbox.checked; // 現在の状態を取得
    localStorage.setItem("myCheckboxChecked", isCheckedNow); // 状態を保存

    // 表示・非表示を即座に切り替え
    if (isCheckedNow) {
      targetElement.classList.remove("hidden"); // 表示
    } else {
      targetElement.classList.add("hidden"); // 非表示
    }
  });
});

