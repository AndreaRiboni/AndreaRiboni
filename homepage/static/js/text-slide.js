document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('letter-scroll-container');
    const textToAnimate = container.innerText; // Change this text as needed
    container.innerText = "";
    const letterSlots = []; // Will store { slotElement, moverElement }

    const animationDuration = 600; // Must match CSS animation-duration (0.6s)

    // 1. Create HTML structure for each letter
    textToAnimate.split('').forEach(char => {
        const slotElement = document.createElement('div');
        slotElement.classList.add('letter-slot');
        const charToUse = char === ' ' ? '\u00A0' : char;

        if (char === ' ') {
            slotElement.style.width = '0.3em'; // Custom width for space
        }

        const moverElement = document.createElement('div');
        moverElement.classList.add('letter-inner-mover');

        const token1 = document.createElement('span');
        token1.classList.add('letter-token');
        token1.textContent = charToUse;

        const token2 = document.createElement('span');
        token2.classList.add('letter-token');
        token2.textContent = charToUse;

        moverElement.appendChild(token1);
        moverElement.appendChild(token2);
        slotElement.appendChild(moverElement);
        container.appendChild(slotElement);

        letterSlots.push({ slot: slotElement, mover: moverElement, char: charToUse });
    });

    const directions = [
        { name: 'right', setupBase: 'setup-scroll-horizontal', setupSpecific: 'setup-scroll-right', animation: 'do-scroll-right' },
        { name: 'left',  setupBase: 'setup-scroll-horizontal', setupSpecific: 'setup-scroll-left',  animation: 'do-scroll-left'  },
        { name: 'down',  setupBase: 'setup-scroll-vertical',   setupSpecific: 'setup-scroll-down',  animation: 'do-scroll-down'  },
        { name: 'up',    setupBase: 'setup-scroll-vertical',   setupSpecific: 'setup-scroll-up',    animation: 'do-scroll-up'    }
    ];
    const allSetupClasses = directions.flatMap(d => [d.setupBase, d.setupSpecific]);
    const allAnimationClasses = directions.map(d => d.animation).concat('animate-scroll');


    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function scheduleNextAnimation() {
        const randomDelay = getRandomInt(150, 900); // ms between different letter animations
        setTimeout(animateRandomLetter, randomDelay);
    }

    function animateRandomLetter() {
      if (letterSlots.length === 0) return;
      const randomIndex = getRandomInt(0, letterSlots.length - 1);
      const target = letterSlots[randomIndex];
      const mover = target.mover;

      if (mover.dataset.isAnimating === 'true') {
          scheduleNextAnimation();
          return;
      }
      mover.dataset.isAnimating = 'true';

      const randomDirection = directions[getRandomInt(0, directions.length - 1)];

      allSetupClasses.forEach(cls => mover.classList.remove(cls));
      allAnimationClasses.forEach(cls => mover.classList.remove(cls));
      // mover.style.animationName = ''; // Not strictly needed if classes define animation-name

      mover.classList.add(randomDirection.setupBase);
      mover.classList.add(randomDirection.setupSpecific);

      void mover.offsetWidth; // Force reflow

      mover.classList.add('animate-scroll');
      mover.classList.add(randomDirection.animation);

      // Define the cleanup function
      function cleanupAfterAnimation() {
          allSetupClasses.forEach(cls => mover.classList.remove(cls));
          allAnimationClasses.forEach(cls => mover.classList.remove(cls));
          mover.dataset.isAnimating = 'false';
          // mover.style.animationPlayState = ''; // Not strictly needed after removing anim class
          mover.removeEventListener('animationend', cleanupAfterAnimation); // Crucial: remove listener
      }

      // Add event listener for animation end
      mover.addEventListener('animationend', cleanupAfterAnimation, { once: true });
      // The { once: true } option automatically removes the listener after it fires once.
      // If not supported or preferred, remove it manually as in cleanupAfterAnimation.

      scheduleNextAnimation(); // Schedule the next letter's animation
  }

    // Start the animation loop
    if (letterSlots.length > 0) {
        scheduleNextAnimation();
    }
});