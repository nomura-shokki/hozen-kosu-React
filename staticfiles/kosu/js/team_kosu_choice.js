document.addEventListener('DOMContentLoaded', function () {
    // フォーム要素を取得
    const employeeNoElement = document.querySelector('[name="employee_no6"]');
    const dayElement = document.querySelector('[name="team_day"]');
    const submitButton = document.querySelector('button[name="find_team"]');

    // 一覧更新イベント
    if (employeeNoElement && dayElement && submitButton) {
        dayElement.addEventListener('change', function () {
            submitButton.click();
        });

        employeeNoElement.addEventListener('change', function () {
            submitButton.click();
        });
    }
});