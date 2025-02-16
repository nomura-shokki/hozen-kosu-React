document.addEventListener('DOMContentLoaded', () => {
    const heading = document.querySelector('body');
  
    if (heading) {
      const keyframes = [
        {
          opacity: 0,
          transform: 'translateY(30px)'
        },
        {
          opacity: 1,
          transform: 'translateY(0)'
        }
      ];
      const options = {
        duration: 1000,
        easing: 'ease'
      };
  
      heading.animate(keyframes, options);
    }
  });
  