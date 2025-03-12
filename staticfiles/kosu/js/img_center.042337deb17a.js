document.addEventListener('DOMContentLoaded', () => {
    const loadingImg = document.getElementById('loadingImg'); // 画像要素取得
    const loadingText = document.querySelector('#loading p');
    const loadingContainer = document.getElementById('loading'); // 親要素取得

    // 指定したIDの要素が存在するか確認
    if (!loadingImg || !loadingContainer || !loadingText) {
        console.error("Target elements not found in the DOM!");
        return;
    }

    // 位置を更新する関数
    function updateImagePosition() {
        const displayHeight = document.documentElement.clientHeight; // 表示画面の高さ
        const displayWidth = document.documentElement.clientWidth;  // 表示画面の幅
        const imgHeight = loadingImg.offsetHeight;
        const imgWidth = loadingImg.offsetWidth;
        const textHeight = loadingText.offsetHeight;
        const textWidth = loadingText.offsetWidth;

        // 画像のサイズ基準で中心を計算
        const topPosition = (displayHeight / 2) - (imgHeight / 2);
        const leftPosition = (displayWidth / 2) - (imgWidth / 2);
        const topPosition2 = (displayHeight / 2) - (textHeight / 2) + (imgHeight / 2) +15;
        const leftPosition2 = (displayWidth / 2) - (textWidth / 2);

        // 動的にスタイルを更新
        loadingImg.style.top = `${topPosition}px`; // 上下位置
        loadingImg.style.left = `${leftPosition}px`; // 左右位置
        loadingText.style.top = `${topPosition2}px`; // 上下位置
        loadingText.style.left = `${leftPosition2}px`; // 左右位置
    }

    // ウィンドウのスクロールやリサイズに応じて位置を更新
    window.addEventListener('scroll', updateImagePosition);
    window.addEventListener('resize', updateImagePosition);

    // 初期位置を設定
    updateImagePosition();
});
