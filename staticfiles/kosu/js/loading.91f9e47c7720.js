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
