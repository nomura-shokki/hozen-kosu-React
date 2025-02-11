document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const orderElement = document.querySelector('[name="kosu_order"]');
    const summarizeElement = document.querySelector('[name="kosu_summarize"]');
    const kosudayElement = document.querySelector('[name="kosu_day"]');
    const submitButton = document.querySelector('input[name="kosu_find"]');

    // グラフ更新イベント
    if (orderElement && summarizeElement && kosudayElement && submitButton) {
        orderElement.addEventListener('change', function () {
            submitButton.click();
        });

        summarizeElement.addEventListener('change', function () {
            submitButton.click();
        });

        kosudayElement.addEventListener('change', function () {
            submitButton.click();
        });
    }
});