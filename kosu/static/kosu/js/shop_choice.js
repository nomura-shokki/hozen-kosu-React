document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const shopElement = document.querySelector('[name="shop"]');
    const shop2Element = document.querySelector('[name="shop2"]');
    const submitButton = document.querySelector('button[name="shop_choice"]');

    // 選択肢更新イベント
    if (shopElement && shop2Element && submitButton) {
        shopElement.addEventListener('change', function () {
            submitButton.click();
        });

        shop2Element.addEventListener('change', function () {
            submitButton.click();
        });
    }
});