$(document).ready(function() {
    let message = $('#success-message');

    // 中央にメッセージを表示する関数
    function centerMessage() {
        message.css({
            'top': '50%',
            'left': '50%',
            'transform': 'translate(-50%, -50%)'
        });
    }

    // メッセージを表示し位置を中央に設定
    message.css("display", "block");
    centerMessage();

    // 画面サイズ変更やスクロール時に再設定
    $(window).on('resize scroll', centerMessage);

    // 1秒後にメッセージを非表示
    setTimeout(function() {
        message.css("display", "none");
    }, 1000);
});
