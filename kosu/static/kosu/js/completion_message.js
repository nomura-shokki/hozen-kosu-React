$(document).ready(function(){
    // メッセージ要素を取得
    let message = $('#success-message');

    // メッセージ表示
    message.css("display", "block");

    // 中央位置設定
    function centerMessage() {
        message.css({
            'top': '50%',
            'left': '50%',
            'transform': 'translate(-50%, -50%)'
        });
    }

    // 最初の表示もセンタリング
    centerMessage();

    // 画面サイズが変更される度にセンタリング
    $(window).on('resize scroll', centerMessage);

    // 1秒後にメッセージを非表示
    setTimeout(function() {
        message.css("display", "none");
    }, 1000);
});
