document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('dataForm');
    const responseArea = document.getElementById('responseArea');
    const loading = document.querySelector('#loading');
    const loadingText = document.querySelector('#loading p');
    const loadingImg = document.querySelector('#loading img');

    // ボタンのクリックイベントを設定
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async (event) => {
            showLoading(); // ローディング画面を表示

            try {
                const formData = new FormData(form);
                formData.append(event.target.name, event.target.name);

                const response = await fetch(htmlUrl, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    responseArea.innerHTML = data.html;
                } else {
                    responseArea.innerHTML = '<p class="text-danger">エラーが発生しました。</p>';
                }
            } catch (err) {
                console.error(err);
                responseArea.innerHTML = '<p class="text-danger">通信エラーが発生しました。</p>';
            } finally {
                hideLoading(); // 最後にローディング画面を非表示
            }
        });
    });

    // ローディング画面を表示
    function showLoading() {
        resetAnimations();
        loading.style.visibility = "visible"; // visibilityをvisibleに設定
        loadingText.style.opacity = "1"; // テキストを完全に表示
        loadingImg.style.opacity = "1"; // 画像を完全に表示
    }

    // アニメーションをリセット
    function resetAnimations() {
        loading.getAnimations().forEach(animation => animation.cancel());
        loadingText.getAnimations().forEach(animation => animation.cancel());
        loadingImg.getAnimations().forEach(animation => animation.cancel());

        loading.style.opacity = "1";
        loadingText.style.opacity = "1";
        loadingImg.style.opacity = "1";
        loadingImg.style.display = "block";
    }

    // ローディング画面を非表示
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

        Promise.all([loadingAnimation.finished, loadingTextAnimation.finished, loadingImgAnimation.finished])
            .then(() => {
                loading.style.visibility = "hidden"; // 最後にvisibilityをhiddenにする
            });
    }
});