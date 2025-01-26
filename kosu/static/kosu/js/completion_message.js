$(document).ready(function(){
    // 送信完了メッセージを表示
    let message = document.getElementById("success-message");
    message.style.display = "block";

    // 1秒後にメッセージを非表示
    setTimeout(function() {
        message.style.display = "none";
    }, 1000);
});