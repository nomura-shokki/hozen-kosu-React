document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const shopElement = document.querySelector('[name="year"]');
    const shop2Element = document.querySelector('[name="month"]');
    const submitButton = document.querySelector('button[name="update"]');

    // カレンダー更新イベント
    if (shopElement && shop2Element && submitButton) {
        shopElement.addEventListener('change', function () {
            submitButton.click();
        });

        shop2Element.addEventListener('change', function () {
            submitButton.click();
        });
    }
});