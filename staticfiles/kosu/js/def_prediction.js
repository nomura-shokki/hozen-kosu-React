document.addEventListener('DOMContentLoaded', function() {
    const work_detail_input = $('#id_work_detail');
    const kosu_def_list_select = $('#id_kosu_def_list');

    work_detail_input.on('input', function() {
        const detail = $(this).val();
        $.ajax({
            url: dynamicChoicesUrl, // 動的に取得したURLを使用
            method: "POST",
            headers: {'X-CSRFToken': csrfToken}, // 動的に取得したCSRFトークンを使用
            data: JSON.stringify({ detail: detail }),
            contentType: "application/json",
            success: function(data) {
                kosu_def_list_select.empty();
                $.each(data.choices, function(index, value) {
                    kosu_def_list_select.append($('<option></option>').val(value[0]).text(value[1]));
                });
            },
            error: function(xhr, status, error) {
                console.error('Error:', error);
            }
        });
    });

    kosu_def_list_select.on('focus', function() {
        $.ajax({
            url: allChoicesUrl, // 動的に取得したURLを使用
            method: "GET",
            success: function(data) {
                kosu_def_list_select.empty();
                $.each(data.choices, function(index, value) {
                    kosu_def_list_select.append($('<option></option>').val(value[0]).text(value[1]));
                });
            },
            error: function(xhr, status, error) {
                console.error('Error:', error);
            }
        });
    });
});