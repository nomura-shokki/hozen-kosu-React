document.addEventListener('DOMContentLoaded', function() {
      
    let inputElements = document.querySelectorAll('input, textarea');
    
    inputElements.forEach(function(inputElement) {
      inputElement.addEventListener('keydown', function(event) {

        // textarea 以外の input で Enter キーが押された場合にのみ実行
        if (event.key === 'Enter' && inputElement.tagName.toLowerCase() !== 'textarea') {
          event.preventDefault();  // エンターキーによるフォーム送信を防止
          inputElement.blur();     // フォーカスを外す
          }
    });
    });
});