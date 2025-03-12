document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const dayElement = document.querySelector('[name="work_day"]');
    const submitButton = document.querySelector('button[name="display_day"]');

    // 表示更新イベント
    dayElement.addEventListener('change', function () {
        submitButton.click();
    });
});