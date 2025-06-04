function copyDiscord() {
    navigator.clipboard.writeText('datandre').then(() => {
        const notification = document.getElementById('copyNotification');
        notification.classList.remove('opacity-0');
        notification.classList.add('opacity-100');

        setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0');
        }, 2000);
    });
}

// SVG Signature Animation Functions
function startSignatureAnimation() {
    const paths = document.querySelectorAll('.signature-path');
    
    paths.forEach(path => {
    path.classList.remove('animate');
    path.offsetHeight; // Force reflow
    });
    
    setTimeout(() => {
    paths.forEach(path => {
        path.classList.add('animate');
    });
    }, 30); // Small delay to ensure class removal/reflow completes
}

// Auto-start signature animation on page load
window.addEventListener('load', () => {
    startSignatureAnimation(); // Delay of 1s before animation starts

    const island     = document.getElementById('dynamic-island');
    const brand      = island.querySelector('.brand');
    let   expandedW  = null;          // cache full width
    let   collapsedW = null;          // cache brand width

    function measureWidths () {
        // Collapsed width = brand block + horizontal padding
        const style = getComputedStyle(island);
        const pad   = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        collapsedW  = brand.offsetWidth + pad;

        // Expanded width = whole pill when links are visible
        island.classList.add('expanded');         // temporarily reveal links
        expandedW = island.scrollWidth;
        island.classList.remove('expanded');
    }

    measureWidths();                   // once on load
    window.addEventListener('resize', measureWidths);   // recalc on breakpoint switches

    function expand ()   {
        island.style.width = expandedW + 'px';
        island.classList.add('expanded');
    }
    function collapse () {
        island.style.width = collapsedW + 'px';
        island.classList.remove('expanded');
    }

    /* Hover behaviour only on desktop pointers */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        collapse();                      // start collapsed at the right width
        island.addEventListener('mouseenter', expand);
        island.addEventListener('mouseleave', collapse);
    }

});