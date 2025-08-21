document.addEventListener("DOMContentLoaded", function () {
  const nowTimeButton = document.getElementById("now_time_button");
  nowTimeButton.addEventListener("click", function (event) {
    event.preventDefault();

    // 現在時刻を取得
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();

    // 5分単位で丸める
    minutes = Math.floor(minutes / 5) * 5;

    // 時刻をフォーマット
    const roundedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // `end_time` フィールドに設定
    const endTimeField = document.getElementById("end_time");
    if (endTimeField) {
      endTimeField.value = roundedTime;
    } else {
      console.error("現在時刻を入力するフィールドが見つかりません");
    }
  });
});