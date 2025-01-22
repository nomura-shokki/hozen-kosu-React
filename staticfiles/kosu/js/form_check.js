// 全てのチェックボックスを取得
const checkboxes = document.querySelectorAll('.controlled-checkbox');

// 状態を更新する関数
function updateFormInputs() {
    checkboxes.forEach(checkbox => {
        const formGroup = checkbox.closest('.form-group');
        if (formGroup) {
            const inputs = formGroup.querySelectorAll('.controlled-input');
            inputs.forEach(input => {
                input.disabled = !checkbox.checked;
            });
        }
    });
}

// 各チェックボックスにイベントリスナーを追加
checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateFormInputs);
});

// 初期状態の更新
updateFormInputs();