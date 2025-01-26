$(document).ready(function(){
    var message = $("#success-message");
    
    // メッセージを表示
    message.css('display', 'block');
    
    // メッセージが表示される時に画面中央に位置させる
    function centerMessage() {
        message.css({
            top: ($(window).height() - message.outerHeight()) / 2 + $(window).scrollTop() + 'px',
            left: ($(window).width() - message.outerWidth()) / 2 + $(window).scrollLeft() + 'px',
        });
    }

    // 画面サイズが変更される度にセンタリング
    $(window).on('resize scroll', centerMessage);
    
    // 最初の表示もセンタリング
    centerMessage();

    // 1秒後にメッセージを非表示
    setTimeout(function() {
        message.css('display', 'none');
    }, 1000);
});
