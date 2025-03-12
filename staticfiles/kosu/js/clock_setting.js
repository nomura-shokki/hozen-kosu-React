$(document).ready(function() {
    $('.your-time-field').clockTimePicker({
        alwaysSelectHoursFirst: true,
        precision: 5,
        i18n: {
            cancelButton: 'キャンセル'
        },
        onAdjust: function(newVal, oldVal) {}
    });
});