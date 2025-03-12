document.addEventListener('DOMContentLoaded', () => {
    const loadingImg = document.getElementById('loadingImg'); // 画像要素取得
    const loadingContainer = document.getElementById('loading'); // 親要素取得

    // 指定したIDの要素が存在するか確認
    if (!loadingImg || !loadingContainer) {
        console.error("Target elements not found in the DOM!");
        return;
    }

    // 位置を更新する関数
    function updateImagePosition() {
        const displayHeight = document.documentElement.clientHeight; // 表示画面の高さ
        const displayWidth = document.documentElement.clientWidth;  // 表示画面の幅
        const imgHeight = loadingImg.offsetHeight;
        const imgWidth = loadingImg.offsetWidth;

        // 画像のサイズ基準で中心を計算
        const topPosition = (displayHeight / 2) - (imgHeight / 2);
        const leftPosition = (displayWidth / 2) - (imgWidth / 2);

        // 動的にスタイルを更新
        loadingImg.style.top = `${topPosition}px`; // 上下位置
        loadingImg.style.left = `${leftPosition}px`; // 左右位置
    }

    // ウィンドウのスクロールやリサイズに応じて位置を更新
    window.addEventListener('scroll', updateImagePosition);
    window.addEventListener('resize', updateImagePosition);

    // 初期位置を設定
    updateImagePosition();
});
