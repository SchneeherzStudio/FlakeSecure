/**
 * FlakeSecure - 3D Hero Animation with Three.js
 * Prepared for custom .glb model (/models/phone_scan.glb)
 * Features high-performance procedural fallback with glowing fiber optic data transmission,
 * phone scan visualizer, and zero-knowledge cryptographic particles.
 */
(function () {
  'use strict';

  var container = document.getElementById('hero-canvas-container');
  if (!container) return;

  // Verify Three.js availability
  if (typeof THREE === 'undefined') {
    console.warn('[FlakeSecure 3D] Three.js not loaded. Skipping 3D initialization.');
    return;
  }

  var scene, camera, renderer;
  var phoneGroup, fiberLines = [], packetParticles, laserMesh;
  var glbModel = null;
  var animationFrameId = null;
  var isVisible = true;
  var mouseX = 0, mouseY = 0, targetRotationX = 0, targetRotationY = 0;
  var clock = new THREE.Clock();

  function init() {
    var width = container.clientWidth || 600;
    var height = container.clientHeight || 450;

    // 1. Scene
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. Lighting
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    var goldLight = new THREE.PointLight(0xE8B020, 3.5, 40);
    goldLight.position.set(6, 6, 8);
    scene.add(goldLight);

    var greenLight = new THREE.PointLight(0x4ADE80, 2.0, 30);
    greenLight.position.set(-6, -4, 6);
    scene.add(greenLight);

    var blueLight = new THREE.PointLight(0x38bdf8, 1.5, 30);
    blueLight.position.set(0, 8, -4);
    scene.add(blueLight);

    // 5. Try loading external GLB model if available
    tryLoadGLB();

    // 6. Build procedural 3D visual fallback / ambient scene
    buildProceduralScene();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);

    // IntersectionObserver to pause rendering when scrolled out of view
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          isVisible = entry.isIntersecting;
          if (isVisible && !animationFrameId) {
            animate();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(container);
    }

    animate();
  }

  function tryLoadGLB() {
    if (typeof THREE.GLTFLoader === 'undefined') return;

    var loader = new THREE.GLTFLoader();
    loader.load(
      '/models/phone_scan.glb',
      function (gltf) {
        glbModel = gltf.scene;
        glbModel.scale.set(3.5, 3.5, 3.5);
        glbModel.position.set(0, 0, 0);

        // Hide procedural phone if custom GLB loads
        if (phoneGroup) {
          phoneGroup.visible = false;
        }

        scene.add(glbModel);
        console.log('[FlakeSecure 3D] Custom phone_scan.glb model loaded successfully.');
      },
      undefined,
      function () {
        // Fallback silently to procedural scene
        console.log('[FlakeSecure 3D] /models/phone_scan.glb not found. Using procedural 3D animation.');
      }
    );
  }

  function buildProceduralScene() {
    phoneGroup = new THREE.Group();

    // --- A. Procedural Phone Body ---
    var phoneGeo = new THREE.BoxGeometry(4.8, 9.6, 0.45);
    var phoneMat = new THREE.MeshStandardMaterial({
      color: 0x0c101b,
      metalness: 0.85,
      roughness: 0.25
    });
    var phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
    phoneGroup.add(phoneMesh);

    // Phone Edge Bezel Accent (Gold rim)
    var rimGeo = new THREE.BoxGeometry(4.9, 9.7, 0.38);
    var rimMat = new THREE.MeshStandardMaterial({
      color: 0xE8B020,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x473200,
      emissiveIntensity: 0.4
    });
    var rimMesh = new THREE.Mesh(rimGeo, rimMat);
    phoneGroup.add(rimMesh);

    // --- B. Glowing Phone Screen ---
    var screenGeo = new THREE.PlaneGeometry(4.4, 8.8);
    var screenMat = new THREE.MeshBasicMaterial({
      color: 0x07090e
    });
    var screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = 0.235;
    phoneGroup.add(screenMesh);

    // QR Code Canvas texture simulation on screen
    var qrCanvas = document.createElement('canvas');
    qrCanvas.width = 256;
    qrCanvas.height = 256;
    var ctx = qrCanvas.getContext('2d');
    ctx.fillStyle = '#090b14';
    ctx.fillRect(0, 0, 256, 256);

    // Draw stylized QR Matrix in FlakeSecure Gold
    ctx.fillStyle = '#E8B020';
    // Corner finders
    drawFinder(ctx, 20, 20, 60);
    drawFinder(ctx, 176, 20, 60);
    drawFinder(ctx, 20, 176, 60);
    // Random secure dots
    for (var r = 0; r < 14; r++) {
      for (var c = 0; c < 14; c++) {
        if (Math.random() > 0.45) {
          ctx.fillRect(36 + c * 13, 36 + r * 13, 9, 9);
        }
      }
    }

    var qrTexture = new THREE.CanvasTexture(qrCanvas);
    var qrGeo = new THREE.PlaneGeometry(3.2, 3.2);
    var qrMat = new THREE.MeshBasicMaterial({ map: qrTexture, transparent: true, opacity: 0.92 });
    var qrMesh = new THREE.Mesh(qrGeo, qrMat);
    qrMesh.position.set(0, 0.4, 0.24);
    phoneGroup.add(qrMesh);

    // --- C. Laser Scanning Line ---
    var laserGeo = new THREE.PlaneGeometry(3.6, 0.08);
    var laserMat = new THREE.MeshBasicMaterial({
      color: 0x4ADE80,
      transparent: true,
      opacity: 0.95
    });
    laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.set(0, 0.4, 0.25);
    phoneGroup.add(laserMesh);

    // Laser glow strip
    var glowGeo = new THREE.PlaneGeometry(3.6, 0.4);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x4ADE80,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    var laserGlow = new THREE.Mesh(glowGeo, glowMat);
    laserMesh.add(laserGlow);

    // Brand Badge text on phone screen
    var badgeGeo = new THREE.PlaneGeometry(2.6, 0.45);
    var badgeMat = new THREE.MeshBasicMaterial({ color: 0xE8B020, transparent: true, opacity: 0.85 });
    var badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.position.set(0, 2.6, 0.24);
    phoneGroup.add(badgeMesh);

    scene.add(phoneGroup);

    // --- D. Fiber Optic Light Data Streams (Curved Paths) ---
    var fiberCurves = [
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(-2.2, 1.2, 0.2),
        new THREE.Vector3(-6, 4, 3),
        new THREE.Vector3(-9, 1, 2),
        new THREE.Vector3(-12, -2, -1)
      ),
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(2.2, 0.5, 0.2),
        new THREE.Vector3(7, 3, 2),
        new THREE.Vector3(9, -2, 4),
        new THREE.Vector3(12, 1, -2)
      ),
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, -4.5, 0.2),
        new THREE.Vector3(-3, -7, 2),
        new THREE.Vector3(4, -8, 1),
        new THREE.Vector3(8, -10, -2)
      )
    ];

    fiberCurves.forEach(function (curve, idx) {
      var tubeGeo = new THREE.TubeGeometry(curve, 40, 0.04, 8, false);
      var tubeMat = new THREE.MeshBasicMaterial({
        color: idx === 1 ? 0x4ADE80 : 0xE8B020,
        transparent: true,
        opacity: 0.45
      });
      var tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);
      fiberLines.push({ curve: curve, color: idx === 1 ? 0x4ADE80 : 0xE8B020 });
    });

    // --- E. Encrypted Data Packets Flowing Along Fibers ---
    var packetCount = 45;
    var packetGeo = new THREE.BufferGeometry();
    var packetPos = new Float32Array(packetCount * 3);
    var packetColors = new Float32Array(packetCount * 3);

    for (var i = 0; i < packetCount; i++) {
      packetPos[i * 3] = (Math.random() - 0.5) * 20;
      packetPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      packetPos[i * 3 + 2] = (Math.random() - 0.5) * 8;

      var isGreen = Math.random() > 0.6;
      packetColors[i * 3] = isGreen ? 0.29 : 0.91;
      packetColors[i * 3 + 1] = isGreen ? 0.87 : 0.69;
      packetColors[i * 3 + 2] = isGreen ? 0.5 : 0.12;
    }

    packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
    packetGeo.setAttribute('color', new THREE.BufferAttribute(packetColors, 3));

    var packetMat = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    packetParticles = new THREE.Points(packetGeo, packetMat);
    scene.add(packetParticles);
  }

  function drawFinder(ctx, x, y, size) {
    ctx.strokeStyle = '#E8B020';
    ctx.lineWidth = 8;
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = '#E8B020';
    ctx.fillRect(x + 14, y + 14, size - 28, size - 28);
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;
    var width = container.clientWidth || 600;
    var height = container.clientHeight || 450;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function onMouseMove(event) {
    var rect = container.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom) return;
    var x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    var y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    mouseX = Math.max(-1, Math.min(1, x));
    mouseY = Math.max(-1, Math.min(1, y));
  }

  function animate() {
    if (!isVisible) {
      animationFrameId = null;
      return;
    }

    animationFrameId = requestAnimationFrame(animate);

    var elapsedTime = clock.getElapsedTime();

    // 1. Mouse Parallax Rotation
    targetRotationY = mouseX * 0.4;
    targetRotationX = -mouseY * 0.25;

    if (glbModel) {
      glbModel.rotation.y += (targetRotationY - glbModel.rotation.y) * 0.05 + 0.003;
      glbModel.rotation.x += (targetRotationX - glbModel.rotation.x) * 0.05;
      glbModel.position.y = Math.sin(elapsedTime * 1.5) * 0.2;
    } else if (phoneGroup) {
      phoneGroup.rotation.y += (targetRotationY - phoneGroup.rotation.y) * 0.05 + Math.sin(elapsedTime * 0.8) * 0.002;
      phoneGroup.rotation.x += (targetRotationX - phoneGroup.rotation.x) * 0.05;
      phoneGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.25;

      // Oscillate laser scanning line
      if (laserMesh) {
        laserMesh.position.y = 0.4 + Math.sin(elapsedTime * 3.5) * 1.35;
      }
    }

    // 2. Animate Data Packets / Particles
    if (packetParticles) {
      var positions = packetParticles.geometry.attributes.position.array;
      for (var i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(elapsedTime * 2 + i) * 0.015;
        positions[i] += Math.cos(elapsedTime + i) * 0.01;
      }
      packetParticles.geometry.attributes.position.needsUpdate = true;
      packetParticles.rotation.y = elapsedTime * 0.04;
    }

    renderer.render(scene, camera);
  }

  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
