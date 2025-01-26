$(document).ready(function(){
    var message = $("#success-message");
    
    // メッセージを表示
    message.show();
    
    // 親要素の横スクロールを無効にする
    $("body").css("overflow-x", "hidden");

    // 1秒後にメッセージを非表示
    setTimeout(function() {
        message.hide();
        $("body").css("overflow-x", "auto"); // 元に戻す
    }, 1000);
});
