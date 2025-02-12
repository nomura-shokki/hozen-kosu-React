document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const DefElement = document.querySelector('[name="kosu_def_list"]');
    const submitButton = document.querySelector('button[name="def_find"]');

    // 表示更新イベント
    DefElement.addEventListener('change', function () {
        submitButton.click();
    });
});