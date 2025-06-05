import * as THREE from 'three';

let camera, scene, renderer, blob, clock, mouse, targetRotation;
let colorPhase = 0;
let isResizing = false;
let resizeTimeout;

init();
animate();
setupScrollEffects();

function init() {
    clock = new THREE.Clock();
    mouse = new THREE.Vector2();
    targetRotation = new THREE.Vector2();

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a23, 8, 20);

    // Camera with fixed aspect ratio calculation
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    camera.position.set(0, 0, 6);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0x4169e1, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x66ccff, 1.2);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0xff6b9d, 0.8, 25);
    pointLight1.position.set(-5, 5, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xc471ed, 0.4, 15);
    pointLight2.position.set(5, -3, 2);
    scene.add(pointLight2);

    const accentLight = new THREE.PointLight(0x00ffaa, 0.4, 15);
    accentLight.position.set(0, 8, -2);
    scene.add(accentLight);

    // Create Enhanced Blob
    const geometry = new THREE.IcosahedronGeometry(2, 2);
    const material = new THREE.MeshPhysicalMaterial({
       color: 0x66ccff,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transmission: 0.2,
        transparent: true,
        opacity: 0.85,
        ior: 1.4,
        thickness: 0.5,
        envMapIntensity: 1.5,
    });

    blob = new THREE.Mesh(geometry, material);
    blob.castShadow = true;
    blob.receiveShadow = true;
    scene.add(blob);

    // Store original positions
    blob.geometry.userData.originalPositions = geometry.attributes.position.array.slice();

    // Improved event listeners with debouncing
    window.addEventListener('resize', handleResize, false);
    window.addEventListener('orientationchange', handleOrientationChange, false);
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Prevent resize on mobile scroll
    let lastHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        // Only resize if height change is significant (not just address bar)
        const heightDiff = Math.abs(window.innerHeight - lastHeight);
        if (heightDiff > 100 || window.innerWidth !== initialWidth) {
            lastHeight = window.innerHeight;
            onWindowResize();
        }
    }, false);
}

function handleResize() {
    if (isResizing) return;
    
    isResizing = true;
    clearTimeout(resizeTimeout);
    
    resizeTimeout = setTimeout(() => {
        onWindowResize();
        isResizing = false;
    }, 150); // Debounce resize events
}

function handleOrientationChange() {
    // Handle orientation changes specifically
    setTimeout(() => {
        onWindowResize();
    }, 500); // Delay to ensure viewport has stabilized
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Only update if there's a significant change
    if (Math.abs(camera.aspect - (width / height)) > 0.01) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

function onScroll() {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollTop / docHeight;
    
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = (scrollPercent * 100) + '%';
    }
}

function animateBlob() {
    const time = clock.getElapsedTime();
    const positions = blob.geometry.attributes.position;
    const original = blob.geometry.userData.originalPositions;

    for (let i = 0; i < positions.count; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const ox = original[ix];
        const oy = original[iy];
        const oz = original[iz];

        // Multi-layered noise for complex deformation
        const noise1 = Math.sin(time * 0.75 + ox * 2 + oy * 1.5) * 0.3;
        const noise2 = Math.cos(time * 0.5 + oz * 1.8 + ox * 0.8) * 0.2;
        const noise3 = Math.sin(time * 1 + oy * 2.2 + oz * 1.2) * 0.16;
        
        const totalOffset = noise1 + noise2 + noise3;

        positions.setXYZ(
            i,
            ox + ox * totalOffset,
            oy + oy * totalOffset,
            oz + oz * totalOffset
        );
    }

    positions.needsUpdate = true;
    blob.geometry.computeVertexNormals();
}

function updateBlobColor() {
    colorPhase += 0.01;
    const r = (Math.sin(colorPhase) + 1) * 0.5;
    const g = (Math.sin(colorPhase + 2) + 1) * 0.5;
    const b = (Math.sin(colorPhase + 4) + 1) * 0.5;
    
    blob.material.color.setRGB(0.4 + r * 0.6, 0.6 + g * 0.4, 0.8 + b * 0.2);
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    animateBlob();
    updateBlobColor();

    if (blob) {
        // INSTANT rotation based on scroll only (no mouse, no smoothing)
        const scrollY = window.pageYOffset;
        blob.rotation.x = -scrollY * 0.0008;
        blob.rotation.y = scrollY * 0.0005;
        
        // Keep blob centered (no floating animation)
        blob.position.set(0, 0, 0);
    }

    // No camera sway (keep camera static for true center positioning)
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

function setupScrollEffects() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        if (scrollIndicator) {
            if (scrollY > 100) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        }
    });
}