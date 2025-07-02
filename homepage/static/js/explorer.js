window.addEventListener("DOMContentLoaded", () => {
  const map = L.map("map", { zoomControl: false }).setView([45.4642, 9.19], 5);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">Carto</a>',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  const locations = [
    { coords: [45.4781, 9.2273], title: "Politecnico di Milano", desc: "Bachelor's in Computer Engineering. EIT Data Science program.", color: "#5eead4" },
    { coords: [48.2628, 11.6671], title: "TUM (Munich)", desc: "Summer School: Industrial IoT.", color: "#60a5fa" },
    { coords: [60.1864, 24.8213], title: "Aalto University", desc: "Master's year 2 in Espoo (FI).", color: "#f472b6" },
    { coords: [44.5297, 10.8646], title: "Scuderia Ferrari", desc: "F1 aerodynamics & software.", color: "#facc15" },
    { coords: [1.2966, 103.7764], title: "Singapore", desc: "After winning ACM RecSys 2023.", color: "#34d399" },
    { coords: [59.3954, 24.6714], title: "TALTECH", desc: "Double Degree Kick Off Event.", color: "#c084fc" },
    { coords: [47.4979, 19.0402], title: "Budapest", desc: "Double Degree Closing Ceremony.", color: "#f87171" },
    { coords: [44.4949, 11.3426], title: "Bologna", desc: "PyCon Italia.", color: "#fbfb24" }
  ];

  const hudTitle = document.getElementById("hud-title");
  const hudDesc = document.getElementById("hud-desc");
  const hudCoords = document.getElementById("hud-coords");
  const chartCanvas = document.getElementById("hud-chart");
  const ctx = chartCanvas.getContext("2d");
  const indicatorBars = {
    feature: document.querySelector("[data-indicator='signal']"),
    target: document.querySelector("[data-indicator='stability']"),
    noise: document.querySelector("[data-indicator='noise']")
  };
  let animationFrameId = null;

  function showInfo(loc) {
    hudTitle.textContent = loc.title;
    hudDesc.textContent = loc.desc;
    hudCoords.innerHTML = `Lat: ${loc.coords[0].toFixed(4)}<br>Lon: ${loc.coords[1].toFixed(4)}`;
    hudTitle.setAttribute("data-glitch", loc.title);
  }

  locations.forEach(loc => {
    const marker = L.marker(loc.coords, {
      icon: L.divIcon({
        className: "",
        html: `<div class="pulse-icon" style="color: ${loc.color}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map);
    marker.on("click", () => showInfo(loc));
  });

  function updateCanvasSize() {
    chartCanvas.width = chartCanvas.offsetWidth;
    chartCanvas.height = chartCanvas.offsetHeight;
  }

  function generateSeed(lat, lon, zoom) {
    return {
      freq1: 0.015 + (Math.abs(Math.sin(lat)) + 0.1) * 0.01,
      freq2: 0.005 + (Math.abs(Math.cos(lon)) + 0.1) * 0.005,
      amp1: 0.3 + (zoom % 3) * 0.1,
      amp2: 0.2 + ((lat + lon) % 2) * 0.05,
      offset: (lat + lon + zoom) * 10
    };
  }

  function animateIndicators(seed) {
    const start = performance.now();

    function updateBars(timestamp) {
      const t = (timestamp - start) / 1000;
      const feature = 0.5 + 0.5 * Math.sin(t * seed.freq1 + seed.offset);
      const target = 0.5 + 0.5 * Math.cos(t * seed.freq2 + seed.offset * 0.3);
      const noise = 0.5 + 0.5 * Math.sin(t * (seed.freq1 + seed.freq2) * 0.5);

      indicatorBars.feature.style.width = `${Math.round(feature * 100)}%`;
      indicatorBars.target.style.width = `${Math.round(target * 100)}%`;
      indicatorBars.noise.style.width = `${Math.round(noise * 100)}%`;

      requestAnimationFrame(updateBars);
    }

    requestAnimationFrame(updateBars);
  }

  function animateChart(seed) {
    updateCanvasSize();
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    let startTime = null;

    function drawFrame(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let x = 0; x <= w; x += 2) {
        const t = x + seed.offset + elapsed * 10;
        const yFactor =
          Math.sin(t * seed.freq1 + elapsed) * seed.amp1 +
          Math.cos(t * seed.freq2 + elapsed * 0.5) * seed.amp2;
        const y = h - (0.5 + 0.5 * yFactor) * h * 0.7;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(34,211,238,0.4)";
      ctx.fill();
      ctx.strokeStyle = "rgba(6,182,212,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(drawFrame);
    }

    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(drawFrame);
  }

  function updateChartFromMap() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const seed = generateSeed(center.lat, center.lng, zoom);
    animateChart(seed);
    animateIndicators(seed);
  }

  window.addEventListener("resize", updateCanvasSize);
  map.on("move", updateChartFromMap);
  map.on("zoom", updateChartFromMap);
  updateChartFromMap();

  // Blob Animation
  const glassCanvas = document.getElementById("glass-canvas");
  const glassCtx = glassCanvas.getContext("2d");

  function resizeGlassCanvas() {
    glassCanvas.width = glassCanvas.offsetWidth;
    glassCanvas.height = glassCanvas.offsetHeight;
  }

  window.addEventListener("resize", resizeGlassCanvas);
  resizeGlassCanvas();

  const NUM_BLOBS = 15;
  const blobs = Array.from({ length: NUM_BLOBS }, () => {
    const baseR = 40 + Math.random() * 60;
    return {
      x: Math.random(),
      y: Math.random(),
      baseR,
      phase: Math.random() * Math.PI * 2,
      freq: 0.5 + Math.random(),
      speedX: (Math.random() - 0.5) * 0.005,
      speedY: (Math.random() - 0.5) * 0.005,
      opacity: 0.02 + Math.random() * 0.03,
      segs: 16,
      distortionAmp: baseR * 0.3
    };
  });

  function drawBlobs(ts) {
    const t = ts / 1000;
    const W = glassCanvas.width;
    const H = glassCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxD = Math.hypot(cx, cy);

    glassCtx.clearRect(0, 0, W, H);
    glassCtx.globalCompositeOperation = "screen";
    glassCtx.filter = "blur(8px)";

    blobs.forEach(b => {
      b.x = (b.x + b.speedX + 1) % 1;
      b.y = (b.y + b.speedY + 1) % 1;
      const px = b.x * W;
      const py = b.y * H;
      const dist = Math.hypot(px - cx, py - cy);
      const fade = Math.pow(1 - Math.min(dist / maxD, 1), 2);
      const pulse = Math.sin(t * b.freq + b.phase) * 15;
      const R = b.baseR + pulse;

      const grad = glassCtx.createRadialGradient(px, py, 0, px, py, R);
      grad.addColorStop(0, `rgba(255,255,255,${b.opacity * fade * 1.5})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");

      glassCtx.beginPath();
      for (let i = 0; i <= b.segs; i++) {
        const ang = (i / b.segs) * Math.PI * 2;
        const noise = Math.sin(t * b.freq * 2 + ang * 6 + b.phase) * b.distortionAmp;
        const r = R + noise;
        const x = px + Math.cos(ang) * r;
        const y = py + Math.sin(ang) * r;
        glassCtx[i === 0 ? "moveTo" : "lineTo"](x, y);
      }
      glassCtx.closePath();
      glassCtx.fillStyle = grad;
      glassCtx.fill();
    });

    glassCtx.filter = "none";
    glassCtx.globalCompositeOperation = "source-over";
    requestAnimationFrame(drawBlobs);
  }

  requestAnimationFrame(drawBlobs);

  // Sonar animation over Milan
  const sonarCanvas = document.getElementById("sonar-canvas");
  const sonarCtx = sonarCanvas.getContext("2d");
  
  function resizeSonarCanvas() {
    sonarCanvas.width = sonarCanvas.offsetWidth;
    sonarCanvas.height = sonarCanvas.offsetHeight;
  }
  
  window.addEventListener("resize", resizeSonarCanvas);
  resizeSonarCanvas();
  
  let sonarStart = performance.now();
  const SONAR_PERIOD = 4000; // ms
  const MAX_RADIUS = 650;
  
  function drawSonar(timestamp) {
    const t = timestamp - sonarStart;
    const W = sonarCanvas.width;
    const H = sonarCanvas.height;
  
    sonarCtx.clearRect(0, 0, W, H);
  
    const { x, y } = map.latLngToContainerPoint([45.4781, 9.2273]);
  
    const cycles = 3;
    for (let i = 0; i < cycles; i++) {
      const localT = (t + i * (SONAR_PERIOD / cycles)) % SONAR_PERIOD;
      let progress = localT / SONAR_PERIOD;
  
      // Ensure progress stays in [0, 1]
      progress = Math.max(0, Math.min(progress, 1));
      const radius = Math.max(0, progress * MAX_RADIUS);
      const alpha = 1 - progress;
  
      if (radius > 1e-2) {  // skip degenerate arcs
        sonarCtx.beginPath();
        sonarCtx.arc(x, y, radius, 0, Math.PI * 2);
        sonarCtx.strokeStyle = `rgba(94, 234, 212, ${alpha * 0.4})`;
        sonarCtx.lineWidth = 2;
        sonarCtx.stroke();
      }
    }
  
    requestAnimationFrame(drawSonar);
  }
  
  
  requestAnimationFrame(drawSonar);

});
