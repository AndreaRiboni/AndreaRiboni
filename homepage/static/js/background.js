import * as THREE from 'three';

let camera, scene, renderer, blob, clock, mouse, targetRotation;
let colorPhase = 0;

init();
animate();
setupScrollEffects();
createFloatingParticles();

function init() {
    clock = new THREE.Clock();
    mouse = new THREE.Vector2();
    targetRotation = new THREE.Vector2();

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a23, 8, 20);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 6);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0x4169e1, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x66ccff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0xff6b9d, 0.6, 20);
    pointLight1.position.set(-5, 5, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xc471ed, 0.4, 15);
    pointLight2.position.set(5, -3, 2);
    scene.add(pointLight2);

    // Create Enhanced Blob
    const geometry = new THREE.IcosahedronGeometry(2, 2);
    const material = new THREE.MeshPhysicalMaterial({
    color: 0x66ccff,
    roughness: 0.1,
    metalness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    transmission: 0.1,
    transparent: true,
    opacity: 0.9
    });

    blob = new THREE.Mesh(geometry, material);
    blob.castShadow = true;
    blob.receiveShadow = true;
    scene.add(blob);

    // Store original positions
    blob.geometry.userData.originalPositions = geometry.attributes.position.array.slice();

    // Event listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('scroll', onScroll, { passive: true });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onScroll() {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollTop / docHeight;
    
    document.getElementById('progressFill').style.width = (scrollPercent * 100) + '%';
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
    const noise1 = Math.sin(time * 0.5 + ox * 2 + oy * 1.5) * 0.15;
    const noise2 = Math.cos(time * 0.3 + oz * 1.8 + ox * 0.8) * 0.1;
    const noise3 = Math.sin(time * 0.8 + oy * 2.2 + oz * 1.2) * 0.08;
    
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
    // Smooth rotation based on scroll and mouse
    const scrollY = window.pageYOffset;
    targetRotation.x = -scrollY * 0.0008 + mouse.y * 0.3;
    targetRotation.y = scrollY * 0.0005 + mouse.x * 0.2;
    
    blob.rotation.x += (targetRotation.x - blob.rotation.x) * 0.05;
    // blob.rotation.y += (targetRotation.y - blob.rotation.y) * 0.05;
    
    // Floating animation
    blob.position.y = Math.sin(time * 0.3) * 0.2;
    blob.position.x = Math.cos(time * 0.2) * 0.1;
    }

    // Camera sway
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

function setupScrollEffects() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    if (scrollY > 100) {
        scrollIndicator.style.opacity = '0';
    } else {
        scrollIndicator.style.opacity = '1';
    }
    });
}

function createFloatingParticles() {
    const container = document.querySelector('.floating-elements');
    
    for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 20 + 's';
    particle.style.animationDuration = (15 + Math.random() * 10) + 's';
    container.appendChild(particle);
    }
}
