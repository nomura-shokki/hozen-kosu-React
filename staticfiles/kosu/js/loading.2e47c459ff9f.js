document.addEventListener('DOMContentLoaded', () => {
    // フォームとボタン、レスポンス表示エリアを取得
    const form = document.getElementById('dataForm');
    const updateButton = document.getElementById('update');
    const responseArea = document.getElementById('responseArea');
    const loading = document.querySelector('#loading');
    const loadingText = document.querySelector('#loading p');
    const loadingImg = document.querySelector('#loading img');
    const loadingAreaGreen = document.querySelector('#loading-screen');
  
    // 更新ボタンにクリックイベントを設定
    updateButton.addEventListener('click', async () => {
        // ローディング画面を表示
        showLoading();
  
        try {
            // フォームデータを作成
            const formData = new FormData(form);
  
            // サーバーへのPOSTリクエスト
            const response = await fetch(classListUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            
            if (response.ok) {
                // レスポンスをJSONとして取得
                const data = await response.json();
  
                // レスポンスされたHTMLを表示する
                responseArea.innerHTML = data.html;
            } else {
                // サーバーエラー時の処理
                responseArea.innerHTML = '<p class="text-danger">エラーが発生しました。</p>';
            }
        } catch (err) {
            console.error(err);
            responseArea.innerHTML = '<p class="text-danger">通信エラーが発生しました。</p>';
        } finally {
            // 非同期処理後にローディング画面を非表示にする
            hideLoading();
        }
    });
  
    // ローディング画面を表示する関数
    function showLoading() {
        // 現在のアニメーションをキャンセルする（リセット）
        resetAnimations();
        loading.style.display = "grid";
        loadingText.style.display = "block";
        loadingImg.style.display = "block";
        loadingAreaGreen.style.display = "block";
    }

    // アニメーション状態をリセットする関数
    function resetAnimations() {
        // 各要素の現在動作しているアニメーションをキャンセル
        loading.getAnimations().forEach(animation => animation.cancel());
        loadingText.getAnimations().forEach(animation => animation.cancel());
        loadingImg.getAnimations().forEach(animation => animation.cancel());
        loadingAreaGreen.getAnimations().forEach(animation => animation.cancel());

        // 各要素のスタイルを明示的に初期化
        loading.style.opacity = "1";
        loadingText.style.opacity = "1";
        loadingImg.style.opacity = "1";
        loadingAreaGreen.style.opacity = "1";
    }
  
    function hideLoading() {
        const loadingAnimation = loading.animate(
            [
                { opacity: 1 },
                { opacity: 0 }
            ],
            {
                duration: 1500,
                delay: 1000,
                easing: "ease"
            }
        );

        const loadingTextAnimation = loadingText.animate(
            [
                { opacity: 1 },
                { opacity: 0 }
            ],
            {
                duration: 1000,
                easing: 'ease',
                fill: 'forwards'
            }
        );

        const loadingImgAnimation = loadingImg.animate(
            [
                { opacity: 1 },
                { opacity: 0 }
            ],
            {
                duration: 1000,
                easing: 'ease',
                fill: 'forwards'
            }
        );

        loadingAreaGreen.animate(
            {
                translate: ['0 100vh', '0 0', '0 -100vh']
            },
            {
                duration: 1000,
                delay: 500,
                easing: 'ease',
                fill: 'forwards',
            }
        );

        // 全アニメーション終了後に要素を非表示に設定
        Promise.all([loadingAnimation.finished, loadingTextAnimation.finished, loadingImgAnimation.finished])
            .then(() => {
                loading.style.display = "none"; // ローディング画面全体を非表示
                loading.style.opacity = "1"; // 次回のためにリセット
            });
    }
});

/*
window.addEventListener('load', () => {
    const loadingAreaGrey = document.querySelector('#loading');
    const loadingAreaGreen = document.querySelector('#loading-screen');
    const loadingText = document.querySelector('#loading p');
    const loadingImg = document.querySelector('#loading img');

    if (loadingAreaGrey) {
        loadingAreaGrey.animate(
            {
                opacity: [1, 0],
                visibility: 'hidden',
            },
            {
                duration: 1500,
                delay: 1000,
                easing: 'ease',
                fill: 'forwards'
            }
        );
        loadingAreaGreen.animate(
            {
                translate: ['0 100vh', '0 0', '0 -100vh']
            },
            {
                duration: 1500,
                delay: 700,
                easing: 'ease',
                fill: 'forwards',
            }
        );
        loadingText.animate(
            [
                {
                    opacity: 1,
                    offset: .8  //80%
                },
                {
                    opacity: 0,
                    offset: 1  //100%
                },
            ], 
            {
                duration: 1000,
                easing: 'ease',
                fill: 'forwards',
            }
        );
        loadingImg.animate(
            [
                {
                    opacity: 1,
                    offset: .8  //80%
                },
                {
                    opacity: 0,
                    offset: 1  //100%
                },
            ], 
            {
                duration: 1000,
                easing: 'ease',
                fill: 'forwards',
            }
        );
    }
});
*/