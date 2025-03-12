document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const employeeNoElement = document.querySelector('[name="employee_no6"]');
    const shopElement = document.querySelector('[name="shop2"]');
    const submitButton = document.querySelector('button[name="member_find"]');

    // 一覧更新イベント
    if (employeeNoElement && shopElement && submitButton) {
        shopElement.addEventListener('change', function () {
            submitButton.click();
        });

        employeeNoElement.addEventListener('change', function () {
            submitButton.click();
        });
    }
});