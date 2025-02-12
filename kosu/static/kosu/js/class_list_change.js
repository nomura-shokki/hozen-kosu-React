document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const shopElement = document.querySelector('[name="shop2"]');
    const yearElement = document.querySelector('[name="year"]');
    const monthElement = document.querySelector('[name="month"]');
    const submitButton = document.querySelector('button[name="update"]');

    // 表示更新イベント
    if (shopElement && yearElement && monthElement && submitButton) {
        shopElement.addEventListener('change', function () {
            submitButton.click();
        });

        yearElement.addEventListener('change', function () {
            submitButton.click();
        });

        monthElement.addEventListener('change', function () {
            submitButton.click();
        });
    }
});