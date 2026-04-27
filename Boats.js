// --- Engine Sound ---

const engineSound = new Audio('engine.mp3');
engineSound.preload = 'auto';
engineSound.loop = true;
const ENGINE_TARGET_VOLUME = 0.7;
let engineSoundIsPlaying = false;
let engineSoundFadeFrame = null;
let engineSoundFading = false;
let engineSoundFadeTarget = ENGINE_TARGET_VOLUME;

function fadeAudioVolume(audio, from, to, durationMs, onComplete) {
    if (audio._fadeFrame) {
        cancelAnimationFrame(audio._fadeFrame);
        audio._fadeFrame = null;
    }
    const start = performance.now();
    function step(now) {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        audio.volume = from + (to - from) * t;
        if (t < 1) {
            audio._fadeFrame = requestAnimationFrame(step);
        } else {
            audio.volume = to;
            audio._fadeFrame = null;
            if (onComplete) onComplete();
        }
    }
    audio._fadeFrame = requestAnimationFrame(step);
}

// --- Disembark Button and Figures ---
let disembarkButton = null;
let figuresGroup = null;

function isShipReadyToDisembark() {
    // Ship's side must be close and parallel to dock
    const dockPos = NEW_YORK_CONFIG.dockBerthCenter;
    const dockYaw = NEW_YORK_CONFIG.dockAlignYaw;
    const dockForward = new THREE.Vector3(Math.sin(dockYaw), 0, Math.cos(dockYaw));
    const dockRight = new THREE.Vector3(Math.cos(dockYaw), 0, -Math.sin(dockYaw));
    // Ship's right vector (sideways direction)
    const shipRight = new THREE.Vector3(Math.cos(shipYaw), 0, -Math.sin(shipYaw));
    // Parallel if ship's right is parallel to dock's forward (side along dock)
    const parallelThreshold = 0.7; // cos(45 deg) - much less strict
    const parallel = Math.abs(dockForward.dot(shipRight)) > parallelThreshold;
    // Project ship position onto dock axis
    const rel = new THREE.Vector3(shipPosition.x - dockPos.x, 0, shipPosition.z - dockPos.z);
    const along = rel.dot(dockForward); // along dock
    const side = rel.dot(dockRight); // perpendicular to dock (sideways)
    const maxAlong = NEW_YORK_CONFIG.dockBerthHalfLength * 2.0; // looser
    const maxSide = 60; // looser
    const close = Math.abs(along) < maxAlong && Math.abs(side) < maxSide;
    if (typeof window !== 'undefined') {
        window._disembarkDebug = {
            shipX: shipPosition.x,
            shipZ: shipPosition.z,
            dockX: dockPos.x,
            dockZ: dockPos.z,
            shipYaw,
            dockYaw,
            parallel,
            dockForward: {x: dockForward.x, z: dockForward.z},
            shipRight: {x: shipRight.x, z: shipRight.z},
            dot: dockForward.dot(shipRight),
            along,
            side,
            maxAlong,
            maxSide,
            close
        };
        if (close || parallel) {
            console.log('[Disembark Debug]', window._disembarkDebug);
        }
    }
    return parallel && close;
}

function showDisembarkButton() {
    if (!disembarkButton) {
        disembarkButton = document.createElement('button');
        disembarkButton.textContent = 'Disembark';
        disembarkButton.style.position = 'absolute';
        disembarkButton.style.bottom = '40px';
        disembarkButton.style.left = '50%';
        disembarkButton.style.transform = 'translateX(-50%)';
        disembarkButton.style.fontSize = '2em';
        disembarkButton.style.padding = '0.5em 2em';
        disembarkButton.style.zIndex = 1000;
        disembarkButton.style.background = '#fff';
        disembarkButton.style.color = '#222';
        disembarkButton.style.border = '2px solid #222';
        disembarkButton.style.borderRadius = '8px';
        disembarkButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        disembarkButton.onclick = spawnDisembarkFigures;
        document.body.appendChild(disembarkButton);
    }
    disembarkButton.style.display = 'block';
}

function hideDisembarkButton() {
    if (disembarkButton) {
        disembarkButton.style.display = 'none';
    }
}

function spawnDisembarkFigures() {
    // Hide the disembark button immediately
    hideDisembarkButton();
    window._disembarkDone = true; // Prevent button from reappearing

    // Delay the cheer sound and jumping by 1 second
    setTimeout(() => {
        playYaySound();
        if (window._cheeringFigures) {
            for (const fig of window._cheeringFigures) {
                fig.jumping = true;
            }
        }
        window._cheeringStartTime = performance.now();
    }, 1000);

    if (figuresGroup) {
        scene.remove(figuresGroup);
    }
    figuresGroup = new THREE.Group();

    // Promenade/cityPlate mesh bounds (from NewYorkMeshes.js)
    const plateCenterX = NEW_YORK_CONFIG.harborCenter.x;
    const plateCenterZ = NEW_YORK_CONFIG.harborCenter.z + 295;
    const plateWidth = 2820;
    const plateDepth = 360;
    const plateY = 5; // cityPlate.position.y
    const plateHeight = 10;
    const minX = plateCenterX - plateWidth / 2 + 10;
    const maxX = plateCenterX + plateWidth / 2 - 10;
    const minZ = plateCenterZ - plateDepth / 2 + 10;
    const maxZ = plateCenterZ + plateDepth / 2 - 10;

    // Boat position
    const boatX = shipPosition.x;
    const boatZ = shipPosition.z;
    const clusterRadius = 48; // How far from the boat figures can appear

    const numFigures = 60 + Math.floor(Math.random() * 40);
    // Store figure jump state for animation
    window._cheeringFigures = [];
    for (let i = 0; i < numFigures; ++i) {
        // Random position within a circle around the boat
        let angle = Math.random() * Math.PI * 2;
        let radius = Math.sqrt(Math.random()) * clusterRadius;
        let x = boatX + Math.cos(angle) * radius;
        let z = boatZ + Math.sin(angle) * radius;
        // Clamp to promenade bounds
        x = Math.max(minX, Math.min(maxX, x));
        z = Math.max(minZ, Math.min(maxZ, z));
        const y = plateY + plateHeight / 2 + 0.1; // just above the surface

        // Simple figure: cylinder (body) + sphere (head)
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 2, 8);
        const headGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const color = new THREE.Color().setHSL(Math.random(), 0.5, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0b0 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        const head = new THREE.Mesh(headGeo, headMat);
        body.position.set(x, y + 1, z);
        head.position.set(x, y + 2, z);
        body.castShadow = true;
        head.castShadow = true;
        figuresGroup.add(body);
        figuresGroup.add(head);
        // Store for cheering animation
        window._cheeringFigures.push({body, head, baseY: y, jumpPhase: Math.random() * Math.PI * 2, jumpSpeed: 2 + Math.random() * 2, jumping: false});
    }
    scene.add(figuresGroup);

    // Start camera zoom and pan to figures
    window._cheeringCameraState = {
        active: true,
        startTime: performance.now(),
        duration: 2000, // ms
        // Focus on the center of the figures
        targetFocus: new THREE.Vector3(plateCenterX, plateY + plateHeight / 2 + 1.5, plateCenterZ),
        targetDistance: 70,
        initialFocus: smoothedFocusPoint.clone(),
        initialDistance: cameraDistance,
        lockAfter: true // lock camera after animation
    };
}

// Spawns figures falling into the water around the boat after an iceberg collision
function spawnFallingFigures(ship) {
    if (figuresGroup) {
        scene.remove(figuresGroup);
    }
    figuresGroup = new THREE.Group();

    // Boat position
    const boatX = ship.position.x;
    const boatZ = ship.position.z;
    const waterY = 0; // Water surface level
    const clusterRadius = 60; // How far from the boat figures can appear
    const numFigures = 60 + Math.floor(Math.random() * 40);
    for (let i = 0; i < numFigures; ++i) {
        // Random position within a circle around the boat
        let angle = Math.random() * Math.PI * 2;
        let radius = Math.sqrt(Math.random()) * clusterRadius;
        let x = boatX + Math.cos(angle) * radius;
        let z = boatZ + Math.sin(angle) * radius;
        const y = waterY + 0.1; // just above the water

        // Simple figure: cylinder (body) + sphere (head)
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 2, 8);
        const headGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const color = new THREE.Color().setHSL(Math.random(), 0.5, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0b0 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        const head = new THREE.Mesh(headGeo, headMat);
        body.position.set(x, y + 1, z);
        head.position.set(x, y + 2, z);
        body.castShadow = true;
        head.castShadow = true;
        figuresGroup.add(body);
        figuresGroup.add(head);
    }
    scene.add(figuresGroup);
}

// Cache invalidation for service workers
if ('caches' in window) {
    caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
        });
    });
}

// Scene setup
const scene = new THREE.Scene();

// Renderer must be initialized before oceanFloor, since createOceanFloor uses it
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

// Ensure all constants used by createOceanFloor are defined before oceanFloor
const oceanFloorY = -260;
const OCEAN_FLOOR_SIZE = 14000;
const OCEAN_FLOOR_HEIGHT_SCALE = 13;
const oceanFloor = createOceanFloor();

const WATER_COLOR_PALETTE = {
    skyEnv: 0x87ceeb,
    underwaterEnv: 0x144f7d,
    seaSurfaceAbove: 0x1a8cbe,
    seaSurfaceUnderwater: 0x6fc0df,
    seaEmissiveAbove: 0x000000,
    seaEmissiveUnderwater: 0x3f7fa1
};
// --- Europe Meshes ---
const EUROPE_X = 0; // Place Europe at the opposite side of New York
const EUROPE_Z = -1700;
const europeGroup = window.createEuropeMeshes();
europeGroup.position.set(EUROPE_X, 0, EUROPE_Z);
scene.add(europeGroup);

// Add iceberg exclusion zone for Europe
const EUROPE_EXCLUSION = {
    type: 'rect',
    centerX: EUROPE_X,
    halfWidth: 120,
    minZ: EUROPE_Z - 120,
    maxZ: EUROPE_Z + 220
};
const SKY_ENV_COLOR = WATER_COLOR_PALETTE.skyEnv;
const UNDERWATER_ENV_COLOR = WATER_COLOR_PALETTE.underwaterEnv;
const FOG_NEAR_DISTANCE = 100;
const FOG_FAR_DISTANCE = 2000;
scene.background = new THREE.Color(SKY_ENV_COLOR); // Sky blue
scene.fog = new THREE.Fog(SKY_ENV_COLOR, FOG_NEAR_DISTANCE, FOG_FAR_DISTANCE);


const shipBaselineDraftY = -7.2;
const TITANIC_BOAT_LENGTH = 224;
const NEW_YORK_CONFIG = Object.freeze({
    harborCenter: new THREE.Vector3(0, 0, 1700),
    harborRadius: 225,
    dockBerthCenter: new THREE.Vector3(0, shipBaselineDraftY, 1660),
    dockBerthHalfWidth: 22,
    dockBerthHalfLength: 52,
    dockAlignYaw: 0,
    dockingReleaseDistance: 90
});
const NEW_YORK_ICE_EXCLUSION_ZONES = [
    {
        type: 'circle',
        centerX: NEW_YORK_CONFIG.harborCenter.x,
        centerZ: NEW_YORK_CONFIG.harborCenter.z,
        radius: NEW_YORK_CONFIG.harborRadius + 70
    },
    {
        type: 'rect',
        centerX: 0,
        halfWidth: 145,
        minZ: 520,
        maxZ: NEW_YORK_CONFIG.harborCenter.z + 40
    }
];
const newYorkDockingState = {
    isDocked: false
};

function sampleTileableFloorHeight(u, v) {
    const x = u * Math.PI * 2;
    const y = v * Math.PI * 2;

    // Integer frequencies keep opposite edges identical, just like the water sampler.
    const warpX = Math.sin(x * 2 + y * 1) * 0.32 + Math.cos(y * 3 - x * 2) * 0.16;
    const warpY = Math.cos(y * 2 - x * 1) * 0.3 + Math.sin(x * 3 + y * 2) * 0.14;
    const xx = x + warpX;
    const yy = y + warpY;

    return (
        Math.sin(xx * 2) * 0.46 +
        Math.cos(yy * 3) * 0.34 +
        Math.sin((xx + yy) * 4) * 0.22 +
        Math.cos((xx - yy) * 5) * 0.14 +
        Math.sin((xx * 7 + yy * 6)) * 0.06
    );
}

function getOceanFloorHeightAtWorld(x, z) {
    if (!oceanFloor) {
        return oceanFloorY;
    }

    const localX = x - oceanFloor.position.x;
    // PlaneGeometry local +Y points toward world -Z after the floor's -PI/2 X-rotation.
    const localY = -(z - oceanFloor.position.z);
    const u = THREE.MathUtils.clamp((localX / OCEAN_FLOOR_SIZE) + 0.5, 0, 1);
    const v = THREE.MathUtils.clamp((localY / OCEAN_FLOOR_SIZE) + 0.5, 0, 1);
    return oceanFloor.position.y + sampleTileableFloorHeight(u, v) * OCEAN_FLOOR_HEIGHT_SCALE;
}

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(0, 50, 100);



const BUILD_VERSION = 'v2026.04.19-full-screen5';

const impactSound = new Audio('ice_breaking.mp3');
impactSound.preload = 'auto';
impactSound.volume = 0.85;
const breakingSound = new Audio('breaking.wav');
breakingSound.preload = 'auto';
breakingSound.volume = 0.9;
const thudSound = new Audio('thud.wav');
thudSound.preload = 'auto';
thudSound.volume = 0.9;
let impactSoundUnlocked = false;

function unlockImpactSound() {
    if (impactSoundUnlocked) {
        return;
    }

    const sounds = [impactSound, breakingSound, thudSound];
    const previousTimes = sounds.map((sound) => sound.currentTime);

    for (const sound of sounds) {
        sound.muted = true;
    }

    const finalizeUnlock = () => {
        for (let i = 0; i < sounds.length; i++) {
            const sound = sounds[i];
            sound.pause();
            sound.currentTime = previousTimes[i];
            sound.muted = false;
        }
        impactSoundUnlocked = true;
    };

    const attempts = sounds.map((sound) => sound.play()).filter((attempt) => attempt && typeof attempt.then === 'function');
    if (attempts.length > 0) {
        Promise.allSettled(attempts).then(finalizeUnlock).catch(finalizeUnlock);
        return;
    }

    finalizeUnlock();
}

function playImpactSound() {
    impactSound.currentTime = 0;
    const playAttempt = impactSound.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch((error) => {
            console.warn('Impact sound failed to play:', error);
        });
    }
}

function playBreakingSound() {
    breakingSound.currentTime = 0;
    const playAttempt = breakingSound.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch((error) => {
            console.warn('Breaking sound failed to play:', error);
        });
    }
}

function playThudSound() {
    thudSound.currentTime = 0;
    const playAttempt = thudSound.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch((error) => {
            console.warn('Thud sound failed to play:', error);
        });
    }
}

// --- Sound for Disembark ---
const yaySound = new Audio('yay.mp3');
yaySound.preload = 'auto';
yaySound.volume = 0.95;

function playYaySound() {
    yaySound.currentTime = 0;
    const playAttempt = yaySound.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch((error) => {
            console.warn('Yay sound failed to play:', error);
        });
    }
}


const ENABLE_TOUCH_DEBUG = true;
let touchDebugElement = null;
let debugToggleButton = null;
let debugVisible = false;
if (ENABLE_TOUCH_DEBUG) {
    // Create debug info element (hidden by default)
    touchDebugElement = document.createElement('div');
    touchDebugElement.style.position = 'fixed';
    touchDebugElement.style.right = '16px';
    touchDebugElement.style.bottom = '16px';
    touchDebugElement.style.zIndex = '130';
    touchDebugElement.style.padding = '8px 10px';
    touchDebugElement.style.background = 'rgba(0, 0, 0, 0.65)';
    touchDebugElement.style.border = '1px solid rgba(125, 220, 255, 0.55)';
    touchDebugElement.style.borderRadius = '6px';
    touchDebugElement.style.color = '#bfefff';
    touchDebugElement.style.fontFamily = 'monospace';
    touchDebugElement.style.fontSize = '11px';
    touchDebugElement.style.whiteSpace = 'pre';
    touchDebugElement.style.pointerEvents = 'auto';
    touchDebugElement.style.display = 'none';
    document.body.appendChild(touchDebugElement);

    // Create debug toggle button (icon)
    debugToggleButton = document.createElement('button');
    debugToggleButton.setAttribute('aria-label', 'Show debug info');
    debugToggleButton.style.position = 'fixed';
    debugToggleButton.style.right = '16px';
    debugToggleButton.style.bottom = '16px';
    debugToggleButton.style.zIndex = '131';
    debugToggleButton.style.width = '32px';
    debugToggleButton.style.height = '32px';
    debugToggleButton.style.border = 'none';
    debugToggleButton.style.background = 'rgba(0,0,0,0.5)';
    debugToggleButton.style.borderRadius = '50%';
    debugToggleButton.style.display = 'flex';
    debugToggleButton.style.alignItems = 'center';
    debugToggleButton.style.justifyContent = 'center';
    debugToggleButton.style.cursor = 'pointer';
    debugToggleButton.style.padding = '0';
    debugToggleButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    // Bug icon SVG
    debugToggleButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#bfefff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="10" cy="13" rx="5" ry="5.5" fill="none"/><path d="M10 7V3"/><path d="M7 3.5l1.5 2"/><path d="M13 3.5l-1.5 2"/><path d="M4 13h12"/><path d="M3 10l2 1"/><path d="M17 10l-2 1"/><path d="M3 16l2-1"/><path d="M17 16l-2-1"/></g></svg>';
    document.body.appendChild(debugToggleButton);

    debugToggleButton.addEventListener('click', () => {
        debugVisible = !debugVisible;
        touchDebugElement.style.display = debugVisible ? 'block' : 'none';
        debugToggleButton.setAttribute('aria-label', debugVisible ? 'Hide debug info' : 'Show debug info');
    });
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(500, 500, 500);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.far = 5000;
directionalLight.shadow.camera.left = -1000;
directionalLight.shadow.camera.right = 1000;
directionalLight.shadow.camera.top = 1000;
directionalLight.shadow.camera.bottom = -1000;
scene.add(directionalLight);

// Create Sea
function createSea() {
    // Keep sea edges far enough away that horizon fog hides the boundary.
    const geometry = new THREE.PlaneGeometry(12000, 12000, 120, 120);

    function sampleTileableHeight(u, v) {
        const x = u * Math.PI * 2;
        const y = v * Math.PI * 2;

        // Keep all frequencies integer-based so opposite tile edges match perfectly.
        const warpX = Math.sin(x * 2 + y * 1) * 0.22 + Math.cos(y * 3 - x * 1) * 0.12;
        const warpY = Math.cos(y * 2 - x * 1) * 0.2 + Math.sin(x * 3 + y * 1) * 0.1;
        const xx = x + warpX;
        const yy = y + warpY;

        return (
            Math.sin(xx * 3) * 0.42 +
            Math.cos(yy * 4) * 0.28 +
            Math.sin((xx + yy) * 2) * 0.2 +
            Math.cos((xx - yy) * 5) * 0.1
        );
    }

    function createSeaTextures(size = 512) {
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const colorCtx = colorCanvas.getContext('2d');
        const colorImage = colorCtx.createImageData(size, size);

        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = size;
        normalCanvas.height = size;
        const normalCtx = normalCanvas.getContext('2d');
        const normalImage = normalCtx.createImageData(size, size);

        const roughnessCanvas = document.createElement('canvas');
        roughnessCanvas.width = size;
        roughnessCanvas.height = size;
        const roughnessCtx = roughnessCanvas.getContext('2d');
        const roughnessImage = roughnessCtx.createImageData(size, size);

        const sampleOffset = 1 / size;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const u = (x + 0.5) / size;
                const v = (y + 0.5) / size;

                const h = sampleTileableHeight(u, v);
                const hxPlus = sampleTileableHeight((u + sampleOffset) % 1, v);
                const hxMinus = sampleTileableHeight((u - sampleOffset + 1) % 1, v);
                const hyPlus = sampleTileableHeight(u, (v + sampleOffset) % 1);
                const hyMinus = sampleTileableHeight(u, (v - sampleOffset + 1) % 1);

                // Build a tangent-space normal from neighboring height samples.
                const dx = (hxPlus - hxMinus) * 0.5;
                const dy = (hyPlus - hyMinus) * 0.5;
                const normal = new THREE.Vector3(-dx * 3.2, -dy * 3.2, 1).normalize();

                normalImage.data[i] = Math.round((normal.x * 0.5 + 0.5) * 255);
                normalImage.data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
                normalImage.data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
                normalImage.data[i + 3] = 255;

                const depthTint = THREE.MathUtils.clamp((h + 1.2) / 2.2, 0, 1);
                const foamTint = Math.max(0, h - 0.6) * 0.6;

                colorImage.data[i] = Math.round(12 + depthTint * 18 + foamTint * 22);
                colorImage.data[i + 1] = Math.round(72 + depthTint * 44 + foamTint * 18);
                colorImage.data[i + 2] = Math.round(120 + depthTint * 60 + foamTint * 20);
                colorImage.data[i + 3] = 255;

                const roughness = THREE.MathUtils.clamp(0.84 - depthTint * 0.24 + Math.abs(h) * 0.08, 0.25, 1);
                const roughnessByte = Math.round(roughness * 255);
                roughnessImage.data[i] = roughnessByte;
                roughnessImage.data[i + 1] = roughnessByte;
                roughnessImage.data[i + 2] = roughnessByte;
                roughnessImage.data[i + 3] = 255;
            }
        }

        colorCtx.putImageData(colorImage, 0, 0);
        normalCtx.putImageData(normalImage, 0, 0);
        roughnessCtx.putImageData(roughnessImage, 0, 0);

        const colorMap = new THREE.CanvasTexture(colorCanvas);
        const normalMap = new THREE.CanvasTexture(normalCanvas);
        const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);

        for (const texture of [colorMap, normalMap, roughnessMap]) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(12, 12);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.needsUpdate = true;
        }

        return { colorMap, normalMap, roughnessMap };
    }

    const seaTextures = createSeaTextures();

    const material = new THREE.MeshStandardMaterial({
        color: 0x1a8cbe,
        map: seaTextures.colorMap,
        normalMap: seaTextures.normalMap,
        normalScale: new THREE.Vector2(1.6, 1.6),
        roughnessMap: seaTextures.roughnessMap,
        metalness: 0.2,
        roughness: 0.58,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        wireframe: false
    });

    const sea = new THREE.Mesh(geometry, material);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = true;

    // Add wave displacement
    const positionAttribute = geometry.getAttribute('position');
    const originalPositions = positionAttribute.array.slice();

    function updateWaves() {
        const time = Date.now() * 0.001;
        for (let i = 0; i < originalPositions.length; i += 3) {
            const x = originalPositions[i];
            const y = originalPositions[i + 1];
            const z = originalPositions[i + 2];

            const wave1 = Math.sin(x * 0.01 + time) * Math.cos(y * 0.01 + time) * 3;
            const wave2 = Math.sin((x + y) * 0.005 + time * 0.7) * 2;

            positionAttribute.array[i + 2] = z + wave1 + wave2;
        }
        positionAttribute.needsUpdate = true;

        // Slow UV drift makes small ripples feel alive instead of static.
        seaTextures.colorMap.offset.x += 0.00018;
        seaTextures.colorMap.offset.y += 0.00011;
        seaTextures.normalMap.offset.x -= 0.00042;
        seaTextures.normalMap.offset.y += 0.00027;
        seaTextures.roughnessMap.offset.x += 0.00023;
        seaTextures.roughnessMap.offset.y -= 0.00019;
    }

    // Store the update function for animation loop
    sea.userData.updateWaves = updateWaves;

    scene.add(sea);
    return sea;
}

const sea = createSea();

const seaSurfaceAppearance = {
    aboveColor: new THREE.Color(WATER_COLOR_PALETTE.seaSurfaceAbove),
    underwaterColor: new THREE.Color(WATER_COLOR_PALETTE.seaSurfaceUnderwater),
    aboveEmissive: new THREE.Color(WATER_COLOR_PALETTE.seaEmissiveAbove),
    underwaterEmissive: new THREE.Color(WATER_COLOR_PALETTE.seaEmissiveUnderwater),
    aboveEmissiveIntensity: 0,
    underwaterEmissiveIntensity: 0.34
};
let isSeaUnderwaterLookActive = null;

function anchorSeaToFocus(seaMesh, focusPoint) {
    // Continuous tracking avoids visible jumps from coarse recenter snapping.
    seaMesh.position.x = focusPoint.x;
    seaMesh.position.z = focusPoint.z;
}

function updateSeaSurfaceAppearance(isUnderwater) {
    if (isSeaUnderwaterLookActive === isUnderwater) {
        return;
    }

    const seaMaterial = sea.material;
    if (!seaMaterial || !seaMaterial.color || !seaMaterial.emissive) {
        return;
    }

    if (isUnderwater) {
        seaMaterial.color.copy(seaSurfaceAppearance.underwaterColor);
        seaMaterial.emissive.copy(seaSurfaceAppearance.underwaterEmissive);
        seaMaterial.emissiveIntensity = seaSurfaceAppearance.underwaterEmissiveIntensity;
    } else {
        seaMaterial.color.copy(seaSurfaceAppearance.aboveColor);
        seaMaterial.emissive.copy(seaSurfaceAppearance.aboveEmissive);
        seaMaterial.emissiveIntensity = seaSurfaceAppearance.aboveEmissiveIntensity;
    }

    isSeaUnderwaterLookActive = isUnderwater;
}

function createOceanFloor() {
    const size = OCEAN_FLOOR_SIZE;
    const geometry = new THREE.PlaneGeometry(size, size, 140, 140);
    const positionAttribute = geometry.getAttribute('position');

    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const u = (x / size) + 0.5;
        const v = (y / size) + 0.5;
        const height = sampleTileableFloorHeight(u, v);
        positionAttribute.setZ(i, height * OCEAN_FLOOR_HEIGHT_SCALE);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();

    function createOceanFloorTextures(textureSize = 512) {
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = textureSize;
        colorCanvas.height = textureSize;
        const colorCtx = colorCanvas.getContext('2d');
        const colorImage = colorCtx.createImageData(textureSize, textureSize);

        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = textureSize;
        normalCanvas.height = textureSize;
        const normalCtx = normalCanvas.getContext('2d');
        const normalImage = normalCtx.createImageData(textureSize, textureSize);

        const roughnessCanvas = document.createElement('canvas');
        roughnessCanvas.width = textureSize;
        roughnessCanvas.height = textureSize;
        const roughnessCtx = roughnessCanvas.getContext('2d');
        const roughnessImage = roughnessCtx.createImageData(textureSize, textureSize);

        const sampleOffset = 1 / textureSize;
        for (let py = 0; py < textureSize; py++) {
            for (let px = 0; px < textureSize; px++) {
                const i = (py * textureSize + px) * 4;
                const u = (px + 0.5) / textureSize;
                const v = (py + 0.5) / textureSize;

                const h = sampleTileableFloorHeight(u, v);
                const hxPlus = sampleTileableFloorHeight((u + sampleOffset) % 1, v);
                const hxMinus = sampleTileableFloorHeight((u - sampleOffset + 1) % 1, v);
                const hyPlus = sampleTileableFloorHeight(u, (v + sampleOffset) % 1);
                const hyMinus = sampleTileableFloorHeight(u, (v - sampleOffset + 1) % 1);

                const dx = (hxPlus - hxMinus) * 0.5;
                const dy = (hyPlus - hyMinus) * 0.5;
                const normal = new THREE.Vector3(-dx * 3.2, -dy * 3.2, 1).normalize();

                normalImage.data[i] = Math.round((normal.x * 0.5 + 0.5) * 255);
                normalImage.data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
                normalImage.data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
                normalImage.data[i + 3] = 255;

                const depthTint = THREE.MathUtils.clamp((h + 1.4) / 2.8, 0, 1);
                const coarse = Math.sin((u * 11 + v * 13) * Math.PI * 2) * 0.5 + 0.5;

                colorImage.data[i] = Math.round(120 + depthTint * 34 + coarse * 6);
                colorImage.data[i + 1] = Math.round(106 + depthTint * 28 + coarse * 5);
                colorImage.data[i + 2] = Math.round(78 + depthTint * 18 + coarse * 4);
                colorImage.data[i + 3] = 255;

                const roughness = THREE.MathUtils.clamp(0.9 - depthTint * 0.16 + Math.abs(h) * 0.08, 0.6, 1);
                const roughnessByte = Math.round(roughness * 255);
                roughnessImage.data[i] = roughnessByte;
                roughnessImage.data[i + 1] = roughnessByte;
                roughnessImage.data[i + 2] = roughnessByte;
                roughnessImage.data[i + 3] = 255;
            }
        }

        colorCtx.putImageData(colorImage, 0, 0);
        normalCtx.putImageData(normalImage, 0, 0);
        roughnessCtx.putImageData(roughnessImage, 0, 0);

        const floorMap = new THREE.CanvasTexture(colorCanvas);
        const floorNormalMap = new THREE.CanvasTexture(normalCanvas);
        const floorRoughnessMap = new THREE.CanvasTexture(roughnessCanvas);

        for (const texture of [floorMap, floorNormalMap, floorRoughnessMap]) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(14, 14);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.needsUpdate = true;
        }

        return { floorMap, floorNormalMap, floorRoughnessMap };
    }

    const floorTextures = createOceanFloorTextures();

    const material = new THREE.MeshStandardMaterial({
        color: 0xb39a72,
        map: floorTextures.floorMap,
        normalMap: floorTextures.floorNormalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: floorTextures.floorRoughnessMap,
        roughness: 0.93,
        metalness: 0.01
    });

    const oceanFloor = new THREE.Mesh(geometry, material);
    oceanFloor.rotation.x = -Math.PI / 2;
    oceanFloor.position.y = oceanFloorY;
    oceanFloor.receiveShadow = true;
    scene.add(oceanFloor);
    return oceanFloor;
}



// Scatter a reusable set of low-poly icebergs across the map.
function createIcebergField(options = {}) {
    const {
        count = 85,
        boundary = 1800,
        spawnClearRadius = 320,
        minSpacing = 42,
        exclusions = []
    } = options;

    const group = new THREE.Group();

    const baseGeometries = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.ConeGeometry(1, 2, 7)
    ];

    const materials = [
        new THREE.MeshStandardMaterial({ color: 0xe6f4ff, roughness: 0.9, metalness: 0.02, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0xd7ecff, roughness: 0.84, metalness: 0.05, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0xf0fbff, roughness: 0.8, metalness: 0.04, flatShading: false })
    ];

    const placed = [];
    const maxAttempts = count * 40;
    let attempts = 0;

    while (placed.length < count && attempts < maxAttempts) {
        attempts += 1;

        const x = THREE.MathUtils.randFloatSpread(boundary * 2);
        const z = THREE.MathUtils.randFloatSpread(boundary * 2);

        // Keep the immediate starting area mostly clear for player movement.
        if (x * x + z * z < spawnClearRadius * spawnClearRadius) {
            continue;
        }

        let blockedByExclusion = false;
        for (const exclusion of exclusions) {
            if (!exclusion) {
                continue;
            }

            if (exclusion.type === 'circle') {
                const dx = x - (exclusion.centerX || 0);
                const dz = z - (exclusion.centerZ || 0);
                if (dx * dx + dz * dz < (exclusion.radius || 0) * (exclusion.radius || 0)) {
                    blockedByExclusion = true;
                    break;
                }
            } else if (exclusion.type === 'rect') {
                const centerX = exclusion.centerX || 0;
                const halfWidth = exclusion.halfWidth || 0;
                const minZ = exclusion.minZ || 0;
                const maxZ = exclusion.maxZ || 0;
                if (Math.abs(x - centerX) < halfWidth && z >= minZ && z <= maxZ) {
                    blockedByExclusion = true;
                    break;
                }
            }
        }
        if (blockedByExclusion) {
            continue;
        }

        let tooClose = false;
        for (const point of placed) {
            const dx = point.x - x;
            const dz = point.z - z;
            if (dx * dx + dz * dz < minSpacing * minSpacing) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) {
            continue;
        }

        const geometry = baseGeometries[Math.floor(Math.random() * baseGeometries.length)];
        const material = materials[Math.floor(Math.random() * materials.length)].clone();
        material.color.offsetHSL(THREE.MathUtils.randFloat(-0.01, 0.01), THREE.MathUtils.randFloat(-0.03, 0.03), THREE.MathUtils.randFloat(-0.04, 0.05));

        const iceberg = new THREE.Mesh(geometry, material);
        const sx = THREE.MathUtils.randFloat(9, 28);
        const sy = THREE.MathUtils.randFloat(12, 62);
        const sz = THREE.MathUtils.randFloat(9, 28);

        iceberg.scale.set(sx, sy, sz);
        iceberg.position.set(x, sy * 0.24, z);
        iceberg.rotation.set(
            THREE.MathUtils.randFloat(-0.08, 0.08),
            THREE.MathUtils.randFloat(0, Math.PI * 2),
            THREE.MathUtils.randFloat(-0.08, 0.08)
        );
        iceberg.castShadow = true;
        iceberg.receiveShadow = true;

        group.add(iceberg);
        placed.push({ x, z });
    }

    scene.add(group);
    return group;
}

function buildGroupRectExclusionZone(group, padding = 36) {
    if (!group) {
        return null;
    }

    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (bounds.isEmpty()) {
        return null;
    }

    return {
        type: 'rect',
        centerX: (bounds.min.x + bounds.max.x) * 0.5,
        halfWidth: (bounds.max.x - bounds.min.x) * 0.5 + padding,
        minZ: bounds.min.z - padding,
        maxZ: bounds.max.z + padding
    };
}


// --- Titanic Ship Collision and Damage ---
const newYorkHarbor = createNewYorkHarbor();
const newYorkCollisionBounds = buildNewYorkCollisionBounds(newYorkHarbor);
const newYorkDynamicIceExclusion = buildGroupRectExclusionZone(newYorkHarbor, TITANIC_BOAT_LENGTH);
const icebergSpawnExclusions = newYorkDynamicIceExclusion
    ? NEW_YORK_ICE_EXCLUSION_ZONES.concat([newYorkDynamicIceExclusion, EUROPE_EXCLUSION])
    : NEW_YORK_ICE_EXCLUSION_ZONES.concat([EUROPE_EXCLUSION]);
const icebergField = createIcebergField({ exclusions: icebergSpawnExclusions });


// Place the breakup seam between funnel 2 (z=20) and funnel 3 (z=-10).
const shipSplitZ = 5;
const shipBreakSeamInset = 0;
const shipSplitDrift = {
    foreZSpeed: 3.1,
    aftZSpeed: 2.2,
    foreMaxOffsetZ: 54,
    aftMaxOffsetZ: -40,
    // Current effect: drag pieces further apart as ship sinks
    currentAccelerationStart: 4.0, // seconds into split sinking before current accelerates
    currentStrength: 2.4, // multiplier for drift speeds after current starts
    currentMaxOffsetMultiplier: 2.2 // how much current extends max offset distances
};
const shipCollisionProbeRadius = 5;
// More probes along the hull for better coverage
const shipCollisionProbeOffsets = [
    new THREE.Vector3(0, 8, 112),
    new THREE.Vector3(-8, 8, 105),
    new THREE.Vector3(8, 8, 105),
    new THREE.Vector3(-12, 8, 72),
    new THREE.Vector3(12, 8, 72),
    new THREE.Vector3(-14, 8, 40),
    new THREE.Vector3(14, 8, 40),
    new THREE.Vector3(-14, 8, -40),
    new THREE.Vector3(14, 8, -40),
    new THREE.Vector3(-12, 8, -72),
    new THREE.Vector3(12, 8, -72),
    new THREE.Vector3(0, 8, -112),
    new THREE.Vector3(-8, 8, -105),
    new THREE.Vector3(8, 8, -105),
    new THREE.Vector3(0, 8, 0),
    new THREE.Vector3(-6, 8, 90),
    new THREE.Vector3(6, 8, 90),
    new THREE.Vector3(-6, 8, -90),
    new THREE.Vector3(6, 8, -90)
];

function cloneMaterial(material) {
    if (Array.isArray(material)) {
        return material.map((entry) => entry.clone());
    }
    return material.clone();
}

function copyMeshTransform(source, target) {
    target.position.copy(source.position);
    target.rotation.copy(source.rotation);
    target.scale.copy(source.scale);
    target.castShadow = source.castShadow;
    target.receiveShadow = source.receiveShadow;
    target.onBeforeRender = source.onBeforeRender;
    target.onAfterRender = source.onAfterRender;
    target.userData = { ...source.userData };
    if (source.userData.localClipPlane instanceof THREE.Plane) {
        target.userData.localClipPlane = source.userData.localClipPlane.clone();
    }
    if (source.userData.localClipNormalMatrix instanceof THREE.Matrix3) {
        target.userData.localClipNormalMatrix = new THREE.Matrix3();
    }
}

function splitGeometryByZ(sourceGeometry, splitZ) {
    const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
    const position = geometry.getAttribute('position');
    const attributesToCopy = Object.entries(geometry.attributes).filter(([name]) => name !== 'normal');
    const triangleCount = position.count / 3;

    const foreData = {};
    const aftData = {};
    for (const [name] of attributesToCopy) {
        foreData[name] = [];
        aftData[name] = [];
    }

    for (let triangle = 0; triangle < triangleCount; triangle++) {
        const base = triangle * 3;
        const z0 = position.getZ(base);
        const z1 = position.getZ(base + 1);
        const z2 = position.getZ(base + 2);
        const minZ = Math.min(z0, z1, z2);
        const maxZ = Math.max(z0, z1, z2);
        const spansSeam = minZ < splitZ && maxZ > splitZ;
        const target = (z0 + z1 + z2) / 3 >= splitZ ? foreData : aftData;
        const targetIsFore = target === foreData;

        for (const [name, attribute] of attributesToCopy) {
            const itemSize = attribute.itemSize;
            for (let vertex = 0; vertex < 3; vertex++) {
                const vertexIndex = base + vertex;
                for (let component = 0; component < itemSize; component++) {
                    let value = attribute.array[vertexIndex * itemSize + component];

                    if (spansSeam && name === 'position' && component === 2) {
                        const seamZ = targetIsFore ? splitZ + shipBreakSeamInset : splitZ - shipBreakSeamInset;
                        value = targetIsFore ? Math.max(value, seamZ) : Math.min(value, seamZ);
                    }

                    target[name].push(value);
                }
            }
        }
    }

    function buildGeometry(attributeData) {
        if (!attributeData.position || attributeData.position.length === 0) {
            return null;
        }

        const builtGeometry = new THREE.BufferGeometry();
        for (const [name, attribute] of attributesToCopy) {
            builtGeometry.setAttribute(name, new THREE.Float32BufferAttribute(attributeData[name], attribute.itemSize));
        }
        builtGeometry.computeVertexNormals();
        return builtGeometry;
    }

    return {
        foreGeometry: buildGeometry(foreData),
        aftGeometry: buildGeometry(aftData)
    };
}

function createBrokenHalves(sourceModel, splitZ) {
    const brokenGroup = new THREE.Group();
    const foreHalf = new THREE.Group();
    const aftHalf = new THREE.Group();

    // Ensure all nested group transforms are baked into matrixWorld before we read them.
    sourceModel.updateMatrixWorld(true);

    sourceModel.traverse((child) => {
        if (!child.isMesh) {
            return;
        }

        const breakMode = child.userData.breakMode || 'whole';
        if (breakMode === 'split') {
            const localSplitZ = splitZ - child.position.z;
            const { foreGeometry, aftGeometry } = splitGeometryByZ(child.geometry, localSplitZ);

            if (foreGeometry) {
                const foreMesh = new THREE.Mesh(foreGeometry, cloneMaterial(child.material));
                copyMeshTransform(child, foreMesh);
                foreHalf.add(foreMesh);
            }

            if (aftGeometry) {
                const aftMesh = new THREE.Mesh(aftGeometry, cloneMaterial(child.material));
                copyMeshTransform(child, aftMesh);
                aftHalf.add(aftMesh);
            }
        } else {
            const clone = child.clone();
            clone.material = cloneMaterial(child.material);

            // Decompose the full world-space transform into the clone so that meshes
            // nested inside sub-groups (e.g. propeller screw assemblies) land at the
            // correct position in the half-groups, which have no parent offset.
            child.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
            clone.castShadow = child.castShadow;
            clone.receiveShadow = child.receiveShadow;

            (clone.position.z >= splitZ ? foreHalf : aftHalf).add(clone);
        }
    });


    brokenGroup.add(foreHalf);
    brokenGroup.add(aftHalf);
    brokenGroup.visible = false;
    brokenGroup.userData.foreHalf = foreHalf;
    brokenGroup.userData.aftHalf = aftHalf;
    return brokenGroup;
}

const icebergCollisionBounds = icebergField.children.map((iceberg) => {
    if (!iceberg.geometry.boundingSphere) {
        iceberg.geometry.computeBoundingSphere();
    }
    if (!iceberg.geometry.boundingBox) {
        iceberg.geometry.computeBoundingBox();
    }

    const bounds = iceberg.geometry.boundingBox;
    return {
        mesh: iceberg,
        radius: iceberg.geometry.boundingSphere.radius * Math.max(iceberg.scale.x, iceberg.scale.z) * 0.6,
        halfHeight: (bounds.max.y - bounds.min.y) * iceberg.scale.y * 0.5
    };
});

function detectIcebergCollision(ship) {
    ship.updateMatrixWorld(true);
    for (const probeOffset of shipCollisionProbeOffsets) {
        const probeWorld = ship.localToWorld(probeOffset.clone());
        for (const iceberg of icebergCollisionBounds) {
            const icebergPosition = iceberg.mesh.getWorldPosition(new THREE.Vector3());
            const dx = probeWorld.x - icebergPosition.x;
            const dz = probeWorld.z - icebergPosition.z;
            const combinedRadius = shipCollisionProbeRadius + iceberg.radius;
            if (dx * dx + dz * dz > combinedRadius * combinedRadius) {
                continue;
            }
            const verticalGap = Math.abs(probeWorld.y - icebergPosition.y);
            if (verticalGap <= iceberg.halfHeight + 6) {
                return iceberg.mesh;
            }
        }
    }

    return null;
}

function detectNewYorkCollision(ship) {
    ship.updateMatrixWorld(true);
    for (const probeOffset of shipCollisionProbeOffsets) {
        const probeWorld = ship.localToWorld(probeOffset.clone());
        for (const structure of newYorkCollisionBounds) {
            const structurePosition = structure.mesh.getWorldPosition(new THREE.Vector3());
            const dx = probeWorld.x - structurePosition.x;
            const dz = probeWorld.z - structurePosition.z;
            const combinedRadius = shipCollisionProbeRadius + structure.radius;

            if (dx * dx + dz * dz > combinedRadius * combinedRadius) {
                continue;
            }

            const verticalGap = Math.abs(probeWorld.y - structurePosition.y);
            if (verticalGap <= structure.halfHeight + 12) {
                return structure.mesh;
            }
        }
    }

    return null;
}

function getShipFocusPoint(ship) {
    const damageState = ship.userData.damageState;
    if (damageState.phase === 'splitSinking' || damageState.phase === 'resting') {
        const foreWorld = ship.userData.brokenGroup.userData.foreHalf.getWorldPosition(new THREE.Vector3());
        const aftWorld = ship.userData.brokenGroup.userData.aftHalf.getWorldPosition(new THREE.Vector3());
        return foreWorld.lerp(aftWorld, 0.5).add(new THREE.Vector3(0, 8, 0));
    }

    return ship.userData.intactGroup.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 10, 0));
}

function triggerIcebergImpact(ship, now, iceberg) {
    const damageState = ship.userData.damageState;
    if (damageState.phase !== 'sailing') {
        return;
    }

    damageState.phase = 'impactDelay';
    damageState.phaseStart = now;
    damageState.impactIceberg = iceberg;
    playImpactSound();
    // Spawn people falling into the water
    spawnFallingFigures(ship);
}

function createFloorSettleState(options = {}) {
    const {
        targetRotationX = 0,
        targetRotationZ = 0,
        rotationSpeedX = 0.24,
        rotationSpeedZ = 0.24,
        settleSinkSpeed = 1.1,
        settleThreshold = 0.012
    } = options;

    return {
        hasTouchedFloor: false,
        settled: false,
        restTime: 0,
        anchorLocal: null,
        anchorWorld: null,
        targetRotationX,
        targetRotationZ,
        rotationSpeedX,
        rotationSpeedZ,
        settleSinkSpeed,
        settleThreshold
    };
}

function resetFloorSettleState(state) {
    state.hasTouchedFloor = false;
    state.settled = false;
    state.restTime = 0;
    state.anchorLocal = null;
    state.anchorWorld = null;
}

function getLowestPointWorld(object) {
    object.updateMatrixWorld(true);

    let foundPoint = null;
    let lowestY = Infinity;
    const localPoint = new THREE.Vector3();

    object.traverse((child) => {
        if (!child.isMesh) {
            return;
        }

        const position = child.geometry.getAttribute('position');
        if (!position) {
            return;
        }

        // Sample vertices to keep this lightweight while still finding a stable floor contact.
        const step = Math.max(1, Math.floor(position.count / 240));
        for (let i = 0; i < position.count; i += step) {
            localPoint.set(position.getX(i), position.getY(i), position.getZ(i));
            child.localToWorld(localPoint);
            if (localPoint.y < lowestY) {
                lowestY = localPoint.y;
                foundPoint = localPoint.clone();
            }
        }
    });

    if (foundPoint) {
        return foundPoint;
    }

    return object.getWorldPosition(new THREE.Vector3());
}

function captureFloorPivotAnchor(object) {
    const anchorWorld = getLowestPointWorld(object);
    anchorWorld.y = getOceanFloorHeightAtWorld(anchorWorld.x, anchorWorld.z);
    return {
        anchorWorld,
        anchorLocal: object.worldToLocal(anchorWorld.clone())
    };
}

function keepObjectAnchoredToFloorPivot(object, settleState) {
    if (!settleState.anchorLocal || !settleState.anchorWorld) {
        return;
    }

    const currentAnchorWorld = object.localToWorld(settleState.anchorLocal.clone());
    const worldCorrection = settleState.anchorWorld.clone().sub(currentAnchorWorld);

    // Convert world correction into parent-local space before moving local position.
    if (object.parent) {
        const parentWorldPos = object.parent.getWorldPosition(new THREE.Vector3());
        const targetParentSpace = object.parent.worldToLocal(currentAnchorWorld.clone().add(worldCorrection));
        const currentParentSpace = object.parent.worldToLocal(currentAnchorWorld.clone());
        object.position.add(targetParentSpace.sub(currentParentSpace));
        object.parent.position.add(parentWorldPos.sub(object.parent.getWorldPosition(new THREE.Vector3())));
    } else {
        object.position.add(worldCorrection);
    }

    object.updateMatrixWorld(true);
}

function getOceanFloorClearance(object) {
    const lowestPoint = getLowestPointWorld(object);
    const floorHeight = getOceanFloorHeightAtWorld(lowestPoint.x, lowestPoint.z);
    return lowestPoint.y - floorHeight;
}

function snapObjectAboveOceanFloor(object, clearance) {
    if (clearance >= 0) {
        return;
    }

    object.position.y += -clearance;
    object.updateMatrixWorld(true);
}

function moveAngleToward(current, target, maxDelta) {
    return current + THREE.MathUtils.clamp(target - current, -maxDelta, maxDelta);
}

function shouldPlayEarlySettleThud(settleState) {
    // Fire slightly before final settle lock so audio matches perceived stop motion.
    return settleState.hasTouchedFloor && !settleState.settled && settleState.restTime >= 0.05;
}

function updateFloorSettle(object, settleState, deltaSeconds, fallSinkSpeed = settleState.settleSinkSpeed) {
    const firstClearance = getOceanFloorClearance(object);
    if (firstClearance <= 0) {
        if (!settleState.hasTouchedFloor) {
            settleState.hasTouchedFloor = true;
            snapObjectAboveOceanFloor(object, firstClearance);
            const pivot = captureFloorPivotAnchor(object);
            settleState.anchorLocal = pivot.anchorLocal;
            settleState.anchorWorld = pivot.anchorWorld;
        }
    }

    if (!settleState.hasTouchedFloor || settleState.settled) {
        return settleState.settled;
    }

    object.rotation.x = moveAngleToward(
        object.rotation.x,
        settleState.targetRotationX,
        settleState.rotationSpeedX * deltaSeconds
    );
    object.rotation.z = moveAngleToward(
        object.rotation.z,
        settleState.targetRotationZ,
        settleState.rotationSpeedZ * deltaSeconds
    );
    object.position.y -= Math.max(0, fallSinkSpeed) * deltaSeconds;
    keepObjectAnchoredToFloorPivot(object, settleState);

    // Never allow geometry to remain below the seabed while settling.
    let clearance = getOceanFloorClearance(object);
    if (clearance < 0) {
        snapObjectAboveOceanFloor(object, clearance);

        // Refresh pivot after a corrective snap so the contact patch can migrate naturally.
        const pivot = captureFloorPivotAnchor(object);
        settleState.anchorLocal = pivot.anchorLocal;
        settleState.anchorWorld = pivot.anchorWorld;

        clearance = getOceanFloorClearance(object);
    }

    const rotXError = Math.abs(object.rotation.x - settleState.targetRotationX);
    const rotZError = Math.abs(object.rotation.z - settleState.targetRotationZ);
    const contactGap = Math.abs(clearance);

    if (rotXError <= settleState.settleThreshold && rotZError <= settleState.settleThreshold && contactGap <= 0.02) {
        settleState.restTime += deltaSeconds;
    } else {
        settleState.restTime = 0;
    }

    if (settleState.restTime >= 0.8) {
        // Lock the current near-flat orientation instead of snapping to an old target.
        settleState.targetRotationX = object.rotation.x;
        settleState.targetRotationZ = object.rotation.z;
        const finalClearance = getOceanFloorClearance(object);
        if (finalClearance < 0) {
            snapObjectAboveOceanFloor(object, finalClearance);
        }
        settleState.settled = true;
    }

    return settleState.settled;
}

function updateShipDamage(ship, now, deltaSeconds) {
    const damageState = ship.userData.damageState;
    const intactGroup = ship.userData.intactGroup;
    const brokenGroup = ship.userData.brokenGroup;
    const foreHalf = brokenGroup.userData.foreHalf;
    const aftHalf = brokenGroup.userData.aftHalf;
    const intactFloorState = damageState.intactFloorState;
    const foreFloorState = damageState.foreFloorState;
    const aftFloorState = damageState.aftFloorState;
    const elapsed = now - damageState.phaseStart;

    if (damageState.phase === 'impactDelay') {
        intactGroup.rotation.z = THREE.MathUtils.lerp(intactGroup.rotation.z, -0.035, deltaSeconds * 1.2);
        if (elapsed >= 2.8) {
            damageState.phase = 'intactSinking';
            damageState.phaseStart = now;
        }
        return;
    }

    if (damageState.phase === 'intactSinking') {
        const intactSinkSpeed = 4.8;
        if (!intactFloorState.hasTouchedFloor) {
            intactGroup.position.y -= intactSinkSpeed * deltaSeconds;
            intactGroup.rotation.x = Math.min(0.38, intactGroup.rotation.x + 0.05 * deltaSeconds);
            intactGroup.rotation.z = THREE.MathUtils.lerp(intactGroup.rotation.z, -0.08, deltaSeconds * 0.8);
        }
        updateFloorSettle(intactGroup, intactFloorState, deltaSeconds, intactSinkSpeed);

        if (elapsed >= 8.5) {
            brokenGroup.visible = true;
            brokenGroup.position.copy(intactGroup.position);
            brokenGroup.rotation.copy(intactGroup.rotation);
            foreHalf.position.set(0, 0, 0);
            foreHalf.rotation.set(0, 0, 0);
            aftHalf.position.set(0, 0, 0);
            aftHalf.rotation.set(0, 0, 0);
            intactGroup.visible = false;
            resetFloorSettleState(foreFloorState);
            resetFloorSettleState(aftFloorState);

            // Counter inherited parent tilt so both halves can settle nearer to world-flat.
            foreFloorState.targetRotationX = -brokenGroup.rotation.x;
            foreFloorState.targetRotationZ = -brokenGroup.rotation.z;
            aftFloorState.targetRotationX = -brokenGroup.rotation.x;
            aftFloorState.targetRotationZ = -brokenGroup.rotation.z;

            if (!damageState.breakingSoundPlayed) {
                damageState.breakingSoundPlayed = true;
                playBreakingSound();
            }

            damageState.foreThudPlayed = false;
            damageState.aftThudPlayed = false;
            damageState.phase = 'splitSinking';
            damageState.phaseStart = now;
        }
        return;
    }

    if (damageState.phase === 'splitSinking') {
        const splitElapsed = elapsed;
        const foreSinkSpeed = 7.2;
        const aftRiseDuration = 1.0;
        const aftRiseSpeed = 1.0;
        const aftSinkSpeed = splitElapsed < aftRiseDuration ? 0 : 6.6;
        
        // Apply current effect: increase drift speeds and maximum offsets after a delay
        const currentActive = splitElapsed > shipSplitDrift.currentAccelerationStart;
        const currentMultiplier = currentActive ? shipSplitDrift.currentStrength : 1.0;
        const foreDriftStep = shipSplitDrift.foreZSpeed * currentMultiplier * deltaSeconds;
        const aftDriftStep = shipSplitDrift.aftZSpeed * currentMultiplier * deltaSeconds;
        
        // Extend maximum offsets as current pulls pieces apart
        const currentForeMaxOffsetZ = currentActive 
            ? shipSplitDrift.foreMaxOffsetZ * shipSplitDrift.currentMaxOffsetMultiplier
            : shipSplitDrift.foreMaxOffsetZ;
        const currentAftMaxOffsetZ = currentActive
            ? shipSplitDrift.aftMaxOffsetZ * shipSplitDrift.currentMaxOffsetMultiplier
            : shipSplitDrift.aftMaxOffsetZ;

        // Let the split parent slowly level while halves keep their own local settle motion.
        brokenGroup.rotation.x = THREE.MathUtils.lerp(brokenGroup.rotation.x, 0, deltaSeconds * 0.42);
        brokenGroup.rotation.z = THREE.MathUtils.lerp(brokenGroup.rotation.z, 0, deltaSeconds * 0.42);

        // Keep half settle targets aligned to world-flat as parent rotation changes.
        if (!foreFloorState.settled) {
            foreFloorState.targetRotationX = -brokenGroup.rotation.x;
            foreFloorState.targetRotationZ = -brokenGroup.rotation.z;
        }
        if (!aftFloorState.settled) {
            aftFloorState.targetRotationX = -brokenGroup.rotation.x;
            aftFloorState.targetRotationZ = -brokenGroup.rotation.z;
        }

        if (!foreFloorState.settled) {
            const foreTouchedBefore = foreFloorState.hasTouchedFloor;
            if (!foreFloorState.hasTouchedFloor) {
                foreHalf.position.z = Math.min(currentForeMaxOffsetZ, foreHalf.position.z + foreDriftStep);
                foreHalf.position.y -= foreSinkSpeed * deltaSeconds;
                foreHalf.rotation.x = Math.min(1.2, foreHalf.rotation.x + 0.16 * deltaSeconds);
                foreHalf.rotation.z = Math.max(-0.26, foreHalf.rotation.z - 0.05 * deltaSeconds);
            }
            updateFloorSettle(foreHalf, foreFloorState, deltaSeconds, foreSinkSpeed);
            if (!foreTouchedBefore && foreFloorState.hasTouchedFloor && !damageState.foreThudPlayed) {
                damageState.foreThudPlayed = true;
                playThudSound();
            }
            if (!damageState.foreSettledThudPlayed && shouldPlayEarlySettleThud(foreFloorState)) {
                damageState.foreSettledThudPlayed = true;
                playThudSound();
            }
        }

        if (!aftFloorState.settled) {
            const aftTouchedBefore = aftFloorState.hasTouchedFloor;
            if (!aftFloorState.hasTouchedFloor) {
                aftHalf.position.z = Math.max(currentAftMaxOffsetZ, aftHalf.position.z - aftDriftStep);
                aftHalf.position.y += splitElapsed < aftRiseDuration
                    ? aftRiseSpeed * deltaSeconds
                    : -aftSinkSpeed * deltaSeconds;
                aftHalf.rotation.x = Math.min(0.88, aftHalf.rotation.x + 0.11 * deltaSeconds);
                aftHalf.rotation.z = Math.min(0.18, aftHalf.rotation.z + 0.03 * deltaSeconds);
            }
            updateFloorSettle(aftHalf, aftFloorState, deltaSeconds, aftSinkSpeed);
            if (!aftTouchedBefore && aftFloorState.hasTouchedFloor && !damageState.aftThudPlayed) {
                damageState.aftThudPlayed = true;
                playThudSound();
            }
            if (!damageState.aftSettledThudPlayed && shouldPlayEarlySettleThud(aftFloorState)) {
                damageState.aftSettledThudPlayed = true;
                playThudSound();
            }
        }

        if (foreFloorState.settled && aftFloorState.settled) {
            damageState.phase = 'resting';
        }
        return;
    }

    if (damageState.phase === 'resting') {
        // Continue nudging any residual parent tilt down after both halves have settled.
        brokenGroup.rotation.x = THREE.MathUtils.lerp(brokenGroup.rotation.x, 0, deltaSeconds * 0.26);
        brokenGroup.rotation.z = THREE.MathUtils.lerp(brokenGroup.rotation.z, 0, deltaSeconds * 0.26);
    }
}

function isFiniteVector3(vector) {
    return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function clampFocusJump(candidateFocus, currentFocus, maxJumpDistance) {
    const delta = candidateFocus.clone().sub(currentFocus);
    const distance = delta.length();
    if (!Number.isFinite(distance) || distance <= maxJumpDistance) {
        return candidateFocus;
    }

    return currentFocus.clone().add(delta.multiplyScalar(maxJumpDistance / distance));
}

function createSmokeTexture(size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(
        size * 0.45,
        size * 0.42,
        size * 0.1,
        size * 0.5,
        size * 0.5,
        size * 0.5
    );

    gradient.addColorStop(0, 'rgba(235, 235, 235, 0.85)');
    gradient.addColorStop(0.35, 'rgba(190, 190, 190, 0.48)');
    gradient.addColorStop(0.7, 'rgba(120, 120, 120, 0.16)');
    gradient.addColorStop(1, 'rgba(80, 80, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function collectShipSmokeEmitters(shipRoot) {
    const intactEmitters = new Map();
    const brokenEmitters = new Map();

    shipRoot.userData.intactGroup.traverse((child) => {
        if (child.isMesh && child.userData.isSmokeEmitter && child.name) {
            intactEmitters.set(child.name, child);
        }
    });

    shipRoot.userData.brokenGroup.traverse((child) => {
        if (child.isMesh && child.userData.isSmokeEmitter && child.name) {
            brokenEmitters.set(child.name, child);
        }
    });

    return Array.from(intactEmitters.entries()).map(([name, intactMesh]) => ({
        intactMesh,
        brokenMesh: brokenEmitters.get(name) || null,
        tipOffsetY: intactMesh.userData.smokeTipOffsetY || 0,
        spawnAccumulator: Math.random()
    }));
}

function getSmokeEmissionStrength(phase) {
    switch (phase) {
        case 'sailing':
            return 1.9;
        case 'impactDelay':
            return 1.6;
        case 'intactSinking':
            return 0;
        case 'splitSinking':
            return 0;
        case 'resting':
            return 0;
        default:
            return 0;
    }
}

function createSmokeSystem(shipRoot) {
    const smokeTexture = createSmokeTexture(128);
    const baseMaterial = new THREE.SpriteMaterial({
        map: smokeTexture,
        color: 0x6f6f6f,
        transparent: true,
        depthWrite: false,
        opacity: 0
    });

    const particleCount = 760;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        const sprite = new THREE.Sprite(baseMaterial.clone());
        sprite.visible = false;
        sprite.renderOrder = 10;
        scene.add(sprite);
        particles.push({
            sprite,
            velocity: new THREE.Vector3(),
            age: 0,
            life: 1,
            startScale: 2,
            endScale: 10,
            spinSpeed: 0,
            active: false
        });
    }

    return {
        emitters: collectShipSmokeEmitters(shipRoot),
        particles,
        cursor: 0,
        spawnRate: 22,
        wind: new THREE.Vector3(0.42, 0.02, 0.08),
        tempLocal: new THREE.Vector3(),
        tempWorld: new THREE.Vector3()
    };
}

function collectPropellerScrews(shipRoot) {
    const screws = [];
    shipRoot.traverse((child) => {
        if (child.isGroup && child.userData && child.userData.isPropellerScrew) {
            screws.push(child);
        }
    });
    return screws;
}

function updatePropellerScrews(screws, spinStep) {
    if (!Array.isArray(screws) || screws.length === 0) {
        return;
    }

    for (const screw of screws) {
        screw.rotation.z += spinStep;
    }
}

function spawnSmokeParticle(smokeSystem, emitter, sourceMesh) {
    const particles = smokeSystem.particles;
    let chosen = null;

    for (let i = 0; i < particles.length; i++) {
        const particle = particles[(smokeSystem.cursor + i) % particles.length];
        if (!particle.active) {
            chosen = particle;
            smokeSystem.cursor = (smokeSystem.cursor + i + 1) % particles.length;
            break;
        }
    }

    if (!chosen) {
        chosen = particles[smokeSystem.cursor];
        smokeSystem.cursor = (smokeSystem.cursor + 1) % particles.length;
    }

    const ringAngle = Math.random() * Math.PI * 2;
    const ringRadius = Math.random() * 2.3;
    smokeSystem.tempLocal.set(
        Math.cos(ringAngle) * ringRadius,
        emitter.tipOffsetY + 0.2,
        Math.sin(ringAngle) * ringRadius
    );
    sourceMesh.localToWorld(smokeSystem.tempWorld.copy(smokeSystem.tempLocal));

    chosen.sprite.position.copy(smokeSystem.tempWorld);
    chosen.sprite.visible = true;
    chosen.sprite.material.opacity = 0.72;
    chosen.sprite.material.rotation = Math.random() * Math.PI * 2;

    chosen.startScale = THREE.MathUtils.randFloat(3.4, 5.4);
    chosen.endScale = THREE.MathUtils.randFloat(20, 32);
    chosen.sprite.scale.setScalar(chosen.startScale);

    chosen.velocity.set(
        THREE.MathUtils.randFloatSpread(0.42),
        THREE.MathUtils.randFloat(3.9, 5.8),
        THREE.MathUtils.randFloatSpread(0.42)
    );
    chosen.spinSpeed = THREE.MathUtils.randFloatSpread(0.38);
    chosen.life = THREE.MathUtils.randFloat(5.2, 7.8);
    chosen.age = 0;
    chosen.active = true;
}

function updateSmokeSystem(smokeSystem, shipRoot, phase, deltaSeconds) {
    if (!smokeSystem) {
        return;
    }

    const emissionStrength = getSmokeEmissionStrength(phase);


    const useBrokenFunnels = phase === 'splitSinking' || phase === 'resting';

    for (const emitter of smokeSystem.emitters) {
        const sourceMesh = useBrokenFunnels && emitter.brokenMesh ? emitter.brokenMesh : emitter.intactMesh;
        if (!sourceMesh || emissionStrength <= 0) {
            continue;
        }

        sourceMesh.localToWorld(smokeSystem.tempWorld.set(0, emitter.tipOffsetY, 0));
        if (smokeSystem.tempWorld.y < -1.5) {
            continue;
        }

        emitter.spawnAccumulator += smokeSystem.spawnRate * emissionStrength * deltaSeconds;
        while (emitter.spawnAccumulator >= 1) {
            spawnSmokeParticle(smokeSystem, emitter, sourceMesh);
            emitter.spawnAccumulator -= 1;
        }
    }

    for (const particle of smokeSystem.particles) {
        if (!particle.active) {
            continue;
        }

        particle.age += deltaSeconds;
        if (particle.age >= particle.life) {
            particle.active = false;
            particle.sprite.visible = false;
            continue;
        }

        const progress = particle.age / particle.life;
        const fade = Math.pow(1 - progress, 1.55);
        particle.velocity.addScaledVector(smokeSystem.wind, deltaSeconds * 0.5);
        particle.velocity.y += 0.55 * deltaSeconds;
        particle.sprite.position.addScaledVector(particle.velocity, deltaSeconds);
        particle.sprite.material.rotation += particle.spinSpeed * deltaSeconds;
        particle.sprite.scale.setScalar(THREE.MathUtils.lerp(particle.startScale, particle.endScale, progress));

        const aboveWaterFactor = THREE.MathUtils.clamp((particle.sprite.position.y + 2) / 6, 0.3, 1);
        particle.sprite.material.opacity = 0.72 * fade * aboveWaterFactor;
    }
}

// Create Titanic Ship
function createTitanic() {
    if (!window.BoatMeshes || typeof window.BoatMeshes.createBoatMesh !== 'function') {
        throw new Error('BoatMeshes.createBoatMesh is not available. Ensure TitanicMeshes.js loads before Boats.js.');
    }

    let meshType = 'titanic';
    let group = null;

    try {
        group = window.BoatMeshes.createBoatMesh('titanic', {
            superstructureHeight: 7.9
        });
    } catch (titanicMeshError) {
        group = window.BoatMeshes.createBoatMesh('modelMesh', {
            chimneyColor: 0xd4af37
        });
        meshType = 'modelMesh';
    }

    if (meshType === 'modelMesh') {
        group.rotation.x = -Math.PI / 2;

        const preScaleBounds = new THREE.Box3().setFromObject(group);
        const preScaleSize = preScaleBounds.getSize(new THREE.Vector3());
        const targetLength = TITANIC_BOAT_LENGTH;
        const uniformScale = targetLength / Math.max(preScaleSize.z, 0.001);
        group.scale.setScalar(uniformScale);

        const scaledBounds = new THREE.Box3().setFromObject(group);
        const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
        group.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z);

        group.traverse((child) => {
            if (!child.isMesh) {
                return;
            }
            child.userData.breakMode = 'split';
            child.castShadow = true;
            child.receiveShadow = true;
        });
    }

    const root = new THREE.Group();
    const brokenGroup = createBrokenHalves(group, shipSplitZ);

    root.add(group);
    root.add(brokenGroup);
    root.userData.intactGroup = group;
    root.userData.brokenGroup = brokenGroup;
    root.userData.damageState = {
        phase: 'sailing',
        phaseStart: 0,
        impactIceberg: null,
        breakingSoundPlayed: false,
        foreThudPlayed: false,
        aftThudPlayed: false,
        foreSettledThudPlayed: false,
        aftSettledThudPlayed: false,
        intactFloorState: createFloorSettleState({
            targetRotationX: 0,
            targetRotationZ: 0,
            rotationSpeedX: 0.22,
            rotationSpeedZ: 0.18,
            settleSinkSpeed: 0.8
        }),
        foreFloorState: createFloorSettleState({
            targetRotationX: 0,
            targetRotationZ: 0,
            rotationSpeedX: 0.34,
            rotationSpeedZ: 0.26,
            settleSinkSpeed: 1.25
        }),
        aftFloorState: createFloorSettleState({
            targetRotationX: 0,
            targetRotationZ: 0,
            rotationSpeedX: 0.28,
            rotationSpeedZ: 0.24,
            settleSinkSpeed: 1.05
        })
    };
    root.userData.propellerScrews = collectPropellerScrews(group);
    root.userData.smokeSystem = createSmokeSystem(root);

    scene.add(root);
    return root;
}



const STERN_OFFSET = -112; // stern-most Z in TitanicMeshes.js
const titanic = createTitanic();

// Input handling
const keys = {};

// Horn sound
const hornAudio = new Audio('horn.mp3');

window.addEventListener('keydown', (e) => {
    unlockImpactSound();
    keys[e.key.toLowerCase()] = true;

    // Handle special keys
    if (e.code === 'Space') keys[' '] = true;
    if (e.ctrlKey) keys['control'] = true;

    // Play horn on 'h' only when the ship is above water (sailing)
    if (e.key.toLowerCase() === 'h') {
        if (titanic.userData.damageState.phase === 'sailing') {
            hornAudio.currentTime = 0;
            hornAudio.play();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === 'Space') keys[' '] = false;
    if (e.ctrlKey) keys['control'] = false;
});

// Mouse look
let cameraRotation = { yaw: 0, pitch: 0 };
let mouseDown = false;
let rightMouseDown = false;

// Camera rig controls
let cameraDistance = 240;
const minCameraDistance = 30;
const maxCameraDistance = 300;
const zoomSensitivity = 0.08;
const touchLookSensitivity = 0.005;
const pinchZoomSensitivity = 0.22;
const panSensitivity = 0.25;
const panOffset = new THREE.Vector3(0, 0, 0);
const smoothedFocusPoint = new THREE.Vector3(0, 10, 0);
const smoothedLookAtPoint = new THREE.Vector3(0, 10, 0);
let cameraSmoothingInitialized = false;
let lastCameraDamagePhase = 'sailing';

let activeLookTouchId = null;
let lastLookTouchX = 0;
let lastLookTouchY = 0;
let pinchActive = false;
let lastPinchDistance = 0;
const joystickTouchIds = new Set();
let debugTouchCount = 0;
let debugCameraTouchCount = 0;

function clampCameraDistance() {
    cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
}

function clampCameraPitch() {
    cameraRotation.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraRotation.pitch));
}

function getTouchById(touches, id) {
    for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === id) {
            return touches[i];
        }
    }
    return null;
}

function getTouchDistance(t0, t1) {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getCameraTouches(touchList) {
    const touches = [];
    for (let i = 0; i < touchList.length; i++) {
        const touch = touchList[i];
        if (!joystickTouchIds.has(touch.identifier)) {
            touches.push(touch);
        }
    }
    return touches;
}

let _lastShipStatusLine = '';

function updateTouchDebug(extraMessage = '', shipStatusLine = '') {
    if (!touchDebugElement) {
        return;
    }

    if (shipStatusLine) {
        _lastShipStatusLine = shipStatusLine;
    }

    const pinchText = lastPinchDistance > 0 ? lastPinchDistance.toFixed(1) : '-';
    touchDebugElement.textContent =
        `${_lastShipStatusLine}\n` +
        `─────────────────\n` +
        `build: ${BUILD_VERSION}\n` +
        `all touches: ${debugTouchCount}\n` +
        `cam touches: ${debugCameraTouchCount}\n` +
        `pinch: ${pinchActive ? 'on' : 'off'} (${pinchText})\n` +
        `look id: ${activeLookTouchId === null ? '-' : activeLookTouchId}\n` +
        `cam dist: ${cameraDistance.toFixed(1)}\n` +
        `${extraMessage}`;
}

// Keep browser context menu from opening while using right-drag pan on canvas.
renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Positive deltaY zooms out, negative deltaY zooms in.
    cameraDistance += e.deltaY * zoomSensitivity;
    clampCameraDistance();
}, { passive: false });

// Disable browser gestures on the canvas so touch controls stay responsive.
renderer.domElement.style.touchAction = 'none';
document.body.style.touchAction = 'none';

// iOS Safari can still emit legacy gesture events; suppress them explicitly.
for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(eventName, (e) => {
        e.preventDefault();
    }, { passive: false });
}

function syncTouchCameraState(activeTouches) {
    if (activeTouches.length >= 2) {
        pinchActive = true;
        activeLookTouchId = null;
        lastPinchDistance = getTouchDistance(activeTouches[0], activeTouches[1]);
        return;
    }

    pinchActive = false;
    lastPinchDistance = 0;

    if (activeTouches.length === 1) {
        const touch = activeTouches[0];
        activeLookTouchId = touch.identifier;
        lastLookTouchX = touch.clientX;
        lastLookTouchY = touch.clientY;
    } else {
        activeLookTouchId = null;
    }
}

window.addEventListener('touchstart', (e) => {
    unlockImpactSound();
    // Don't intercept touches on UI elements (buttons, links, etc.) — doing so
    // blocks their click events on Android.
    if (e.target && e.target.closest('button, a, input, select, textarea, [role="button"]')) {
        updateTouchDebug('evt: start (ui element)');
        return;
    }

    const cameraTouches = getCameraTouches(e.touches);
    debugTouchCount = e.touches.length;
    debugCameraTouchCount = cameraTouches.length;
    if (cameraTouches.length === 0) {
        updateTouchDebug('evt: start (joystick only)');
        return;
    }

    syncTouchCameraState(cameraTouches);
    updateTouchDebug('evt: start');
    e.preventDefault();
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    const cameraTouches = getCameraTouches(e.touches);
    debugTouchCount = e.touches.length;
    debugCameraTouchCount = cameraTouches.length;
    if (cameraTouches.length === 0) {
        updateTouchDebug('evt: move (joystick only)');
        return;
    }

    if (cameraTouches.length >= 2) {
        const distance = getTouchDistance(cameraTouches[0], cameraTouches[1]);
        if (!pinchActive || lastPinchDistance === 0) {
            pinchActive = true;
            lastPinchDistance = distance;
            activeLookTouchId = null;
            updateTouchDebug('evt: move (pinch begin)');
            e.preventDefault();
            return;
        }

        const deltaDistance = distance - lastPinchDistance;

        // Fingers moving apart should zoom in (closer camera distance).
        cameraDistance -= deltaDistance * pinchZoomSensitivity;
        clampCameraDistance();
        lastPinchDistance = distance;
        updateTouchDebug('evt: move (pinch)');
        e.preventDefault();
        return;
    }

    if (pinchActive) {
        // If pinch drops to one finger, rebind look tracking cleanly.
        syncTouchCameraState(cameraTouches);
        updateTouchDebug('evt: move (pinch->look)');
        e.preventDefault();
        return;
    }

    if (activeLookTouchId === null) {
        syncTouchCameraState(cameraTouches);
    }

    const touch = getTouchById(cameraTouches, activeLookTouchId);
    if (!touch) {
        syncTouchCameraState(cameraTouches);
        return;
    }

    const dx = touch.clientX - lastLookTouchX;
    const dy = touch.clientY - lastLookTouchY;
    lastLookTouchX = touch.clientX;
    lastLookTouchY = touch.clientY;

    cameraRotation.yaw += dx * touchLookSensitivity;
    cameraRotation.pitch -= dy * touchLookSensitivity;
    clampCameraPitch();
    updateTouchDebug('evt: move (look)');
    e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', (e) => {
    const cameraTouches = getCameraTouches(e.touches);
    debugTouchCount = e.touches.length;
    debugCameraTouchCount = cameraTouches.length;
    syncTouchCameraState(cameraTouches);
    updateTouchDebug('evt: end');

    if (cameraTouches.length > 0) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchcancel', (e) => {
    const cameraTouches = getCameraTouches(e.touches);
    debugTouchCount = e.touches.length;
    debugCameraTouchCount = cameraTouches.length;
    syncTouchCameraState(cameraTouches);
    updateTouchDebug('evt: cancel');

    if (cameraTouches.length > 0) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('mousedown', (e) => {
    unlockImpactSound();
    if (e.button === 0) { // Left click only
        mouseDown = true;
        document.body.style.cursor = 'none';
    } else if (e.button === 2) {
        rightMouseDown = true;
        document.body.style.cursor = 'grabbing';
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        mouseDown = false;
        document.body.style.cursor = 'auto';
    } else if (e.button === 2) {
        rightMouseDown = false;
        document.body.style.cursor = mouseDown ? 'none' : 'auto';
    }
});

window.addEventListener('blur', () => {
    mouseDown = false;
    rightMouseDown = false;
    document.body.style.cursor = 'auto';
});

document.addEventListener('mousemove', (e) => {
    if (mouseDown) {
        cameraRotation.yaw += e.movementX * 0.005;
        cameraRotation.pitch -= e.movementY * 0.005;

        // Clamp vertical rotation
        clampCameraPitch();
    }

    if (rightMouseDown) {
        const cameraLookDir = cameraRotation.yaw;
        const panRight = new THREE.Vector3(Math.sin(cameraLookDir), 0, -Math.cos(cameraLookDir));

        panOffset.addScaledVector(panRight, -e.movementX * panSensitivity);
        panOffset.y += e.movementY * panSensitivity;
    }
});

// Navigation variables
const shipPosition = new THREE.Vector3(EUROPE_X, shipBaselineDraftY, EUROPE_Z + 30 - STERN_OFFSET);
const moveSpeed = 0.5;
const mobileMoveSpeedMultiplier = 1.8;
const rotationSpeed = 0.003;
let lastFrameTime = performance.now() * 0.001;

function getCurrentMoveSpeed() {
    const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const isTouchDriving = joystickTouchIds.size > 0 || activeLookTouchId !== null || pinchActive;
    return (isCoarsePointer || isTouchDriving) ? moveSpeed * mobileMoveSpeedMultiplier : moveSpeed;
}

// Forward direction vector for the ship. The bow faces +Z in the model.
const shipForward = new THREE.Vector3(0, 0, 1);
const shipRight = new THREE.Vector3(1, 0, 0);

// Euler angles for ship rotation
let shipYaw = 0;
shipYaw = 0; // Face positive Z (toward New York)
shipYaw = 0; // Face positive Z (toward New York)



// Update loop
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now() * 0.001;
    const deltaSeconds = Math.min(0.05, now - lastFrameTime);
    lastFrameTime = now;

    // Update wave animation
    if (sea.userData.updateWaves) {
        sea.userData.updateWaves();
    }

    // Camera zoom and pan for cheering after disembark
    if (window._cheeringCameraState) {
        const camState = window._cheeringCameraState;
        if (camState.active) {
            const nowMs = performance.now();
            const t = Math.min(1, (nowMs - camState.startTime) / camState.duration);
            // Smoothstep for ease in/out
            const smoothT = t * t * (3 - 2 * t);
            // Interpolate focus and distance
            smoothedFocusPoint.lerpVectors(camState.initialFocus, camState.targetFocus, smoothT);
            cameraDistance = camState.initialDistance + (camState.targetDistance - camState.initialDistance) * smoothT;
            if (t >= 1) {
                camState.active = false;
                // Lock camera on figures if requested
                if (camState.lockAfter) {
                    camState.lockedFocus = camState.targetFocus.clone();
                    camState.lockedDistance = camState.targetDistance;
                }
                // Start cheering animation
                if (window._cheeringFigures) {
                    for (const fig of window._cheeringFigures) {
                        fig.jumping = true;
                    }
                    window._cheeringStartTime = nowMs;
                }
            }
        } else if (camState.lockAfter && camState.lockedFocus && camState.lockedDistance) {
            // Keep camera fixed on cheering figures
            smoothedFocusPoint.copy(camState.lockedFocus);
            cameraDistance = camState.lockedDistance;
        }
    }

    // Cheering animation: make figures jump up and down randomly
    if (window._cheeringFigures) {
        const now = performance.now() * 0.001;
        for (const fig of window._cheeringFigures) {
            if (fig.jumping) {
                // Each figure jumps with a random phase and speed
                const jump = Math.abs(Math.sin(now * fig.jumpSpeed + fig.jumpPhase)) * 2.2;
                fig.body.position.y = fig.baseY + 1 + jump;
                fig.head.position.y = fig.baseY + 2 + jump;
            }
        }
    }

    // Handle movement input while the ship is still under player control.
    const damageState = titanic.userData.damageState;
    const previousShipPosition = shipPosition.clone();
    if (damageState.phase === 'sailing') {
        const currentMoveSpeed = getCurrentMoveSpeed();
        const forward = shipForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);

        if (keys['w']) {
            shipPosition.add(forward.clone().multiplyScalar(currentMoveSpeed));
        }
        if (keys['s']) {
            shipPosition.add(forward.clone().multiplyScalar(-currentMoveSpeed));
        }
        if (keys['a']) {
            shipYaw += rotationSpeed;
        }
        if (keys['d']) {
            shipYaw -= rotationSpeed;
        }
        if (keys[' ']) {
            shipPosition.y += currentMoveSpeed;
        }
        if (keys['control']) {
            shipPosition.y -= currentMoveSpeed;
        }

        // Rotate ship with Q and E keys (optional, but nice for ship rotation)
        if (keys['q']) {
            shipYaw += rotationSpeed;
        }
        if (keys['e']) {
            shipYaw -= rotationSpeed;
        }
    }

    // Disembark button logic
    // DEBUG: Always show button for manual testing
    // showDisembarkButton();
    // return;
    // DEBUG: Uncomment to always show the button for testing
    // showDisembarkButton();
    // return;
    if (!window._disembarkDone) {
        if (isShipReadyToDisembark() && damageState.phase === 'sailing') {
            showDisembarkButton();
        } else {
            hideDisembarkButton();
        }
    } else {
        hideDisembarkButton();
    }


    // Update ship position and rotation
    titanic.position.copy(shipPosition);
    titanic.rotation.y = shipYaw;

    const movementDelta = shipPosition.clone().sub(previousShipPosition);
    const horizontalMovementDistance = Math.hypot(movementDelta.x, movementDelta.z);
    // Engine sound logic with fade in/out
    if (damageState.phase === 'sailing' && horizontalMovementDistance > 0.0001) {
        // Play engine sound if not already playing
        if (!engineSoundIsPlaying) {
            engineSound.currentTime = 0;
            engineSound.volume = 0;
            const playAttempt = engineSound.play();
            engineSoundIsPlaying = true;
            if (playAttempt && typeof playAttempt.catch === 'function') {
                playAttempt.catch((error) => {
                    console.warn('Engine sound failed to play:', error);
                    engineSoundIsPlaying = false;
                });
            }
        }
        // Fade in if needed
        if (engineSound.volume < ENGINE_TARGET_VOLUME - 0.01 && !engineSound._fadeFrame) {
            fadeAudioVolume(engineSound, engineSound.volume, ENGINE_TARGET_VOLUME, 400);
        }
        const forwardNow = shipForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);
        const signedForwardDistance = movementDelta.dot(forwardNow);
        const spinDirection = signedForwardDistance < 0 ? -1 : 1;
        const screwSpinStep = horizontalMovementDistance * spinDirection * 0.2;
        updatePropellerScrews(titanic.userData.propellerScrews, screwSpinStep);
    } else {
        // Fade out and pause engine sound if playing
        if (engineSoundIsPlaying && engineSound.volume > 0.01 && !engineSound._fadeFrame) {
            fadeAudioVolume(engineSound, engineSound.volume, 0, 700, () => {
                engineSound.pause();
                engineSound.currentTime = 0;
                engineSoundIsPlaying = false;
            });
        } else if (engineSoundIsPlaying && engineSound.volume <= 0.01 && !engineSound._fadeFrame) {
            engineSound.pause();
            engineSound.currentTime = 0;
            engineSoundIsPlaying = false;
        }
    }

    titanic.updateMatrixWorld(true);

    if (damageState.phase === 'sailing') {
        const hitIceberg = detectIcebergCollision(titanic);
        if (hitIceberg) {
            triggerIcebergImpact(titanic, now, hitIceberg);
        }

        const hitNewYork = detectNewYorkCollision(titanic);
        if (hitNewYork) {
            // Block movement into New York but don't cause damage
            shipPosition.copy(previousShipPosition);
        }
    }

    updateShipDamage(titanic, now, deltaSeconds);
    titanic.updateMatrixWorld(true);
    updateSmokeSystem(titanic.userData.smokeSystem, titanic, damageState.phase, deltaSeconds);

    // Calculate camera position based on mouse look rotation
    const cameraHeight = 40;

    // Apply pitch and yaw to camera distance and height
    const adjustedDistance = cameraDistance * Math.cos(cameraRotation.pitch);
    const heightAdjustment = cameraDistance * Math.sin(cameraRotation.pitch);

    const shipLookDir = cameraRotation.yaw;
    const rawFocusPoint = getShipFocusPoint(titanic);

    const maxFocusJump = (damageState.phase === 'splitSinking' || damageState.phase === 'resting') ? 42 : 95;
    const safeFocusPoint = isFiniteVector3(rawFocusPoint)
        ? clampFocusJump(rawFocusPoint, smoothedFocusPoint, maxFocusJump)
        : smoothedFocusPoint.clone();

    if (!cameraSmoothingInitialized || damageState.phase !== lastCameraDamagePhase) {
        smoothedFocusPoint.copy(safeFocusPoint);
        smoothedLookAtPoint.copy(safeFocusPoint).add(panOffset);
        cameraSmoothingInitialized = true;
        lastCameraDamagePhase = damageState.phase;
    }

    // Use heavier damping during breakup/rest to reduce focus jitter from rapid local motion.
    const focusLambda = (damageState.phase === 'splitSinking' || damageState.phase === 'resting') ? 3.6 : 6.2;
    const lookLambda = (damageState.phase === 'splitSinking' || damageState.phase === 'resting') ? 4.2 : 7.4;
    const cameraPosLambda = (damageState.phase === 'splitSinking' || damageState.phase === 'resting') ? 3.4 : 5.6;
    const focusAlpha = 1 - Math.exp(-focusLambda * deltaSeconds);
    const lookAlpha = 1 - Math.exp(-lookLambda * deltaSeconds);
    const cameraPosAlpha = 1 - Math.exp(-cameraPosLambda * deltaSeconds);

    smoothedFocusPoint.lerp(safeFocusPoint, focusAlpha);

    // Follow the camera focus (including pan) so sea edges stay offscreen.
    anchorSeaToFocus(sea, smoothedFocusPoint.clone().add(panOffset));

    const rawLookAtPoint = safeFocusPoint.clone().add(panOffset);
    smoothedLookAtPoint.lerp(rawLookAtPoint, lookAlpha);

    const cameraPos = new THREE.Vector3(
        smoothedFocusPoint.x - Math.cos(shipLookDir) * adjustedDistance,
        smoothedFocusPoint.y + cameraHeight + heightAdjustment,
        smoothedFocusPoint.z - Math.sin(shipLookDir) * adjustedDistance
    ).add(panOffset);

    // Smooth camera movement
    camera.position.lerp(cameraPos, cameraPosAlpha);

    // Make camera look at the ship
    camera.lookAt(smoothedLookAtPoint);

    // Match the environment color to whether the camera is above or below the waterline.
    const isUnderwater = camera.position.y < 0;
    const envColor = isUnderwater ? UNDERWATER_ENV_COLOR : SKY_ENV_COLOR;
    if (scene.background.getHex() !== envColor) {
        scene.background.setHex(envColor);
    }
    if (scene.fog && scene.fog.color.getHex() !== envColor) {
        scene.fog.color.setHex(envColor);
    }
    updateSeaSurfaceAppearance(isUnderwater);


    // Clamp position to sea boundaries
    const seaBoundary = 2000;
    shipPosition.x = Math.max(-seaBoundary, Math.min(seaBoundary, shipPosition.x));
    shipPosition.z = Math.max(-seaBoundary, Math.min(seaBoundary, shipPosition.z));
    shipPosition.y = Math.max(shipBaselineDraftY, shipPosition.y);

    // Update info display
    const shipStatusLabels = {
        sailing: 'Cruising',
        impactDelay: 'Iceberg hit',
        intactSinking: 'Taking on water',
        splitSinking: 'Breaking apart',
        resting: 'On the ocean floor'
    };
    const shipStatusText = shipStatusLabels[titanic.userData.damageState.phase];
    const positionText = `Pos: (${shipPosition.x.toFixed(1)}, ${shipPosition.y.toFixed(1)}, ${shipPosition.z.toFixed(1)})\nStatus: ${shipStatusText}`;

    renderer.render(scene, camera);
    updateTouchDebug('', positionText);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Virtual Joystick (mobile / touch) ────────────────────────────────────────
(function setupJoystick() {
    const container = document.getElementById('joystick-container');
    const knob      = document.getElementById('joystick-knob');

    if (!container || !knob) return;

    const BASE_RADIUS  = 60;  // half the container width
    const KNOB_RADIUS  = 24;  // half the knob width
    const MAX_TRAVEL   = BASE_RADIUS - KNOB_RADIUS; // px knob centre can travel from base centre
    const DEAD_ZONE    = 0.15; // fraction of MAX_TRAVEL before input registers

    let activeTouchId = null;
    let baseX = 0, baseY = 0; // page-coords of container centre at touch-start

    // Joystick axis values in [-1, 1]
    const joystickAxis = { x: 0, y: 0 };

    function getContainerCentre() {
        const r = container.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function applyAxis(ax, ay) {
        joystickAxis.x = ax;
        joystickAxis.y = ay;

        // Map to WASD keys
        const threshold = DEAD_ZONE;
        keys['w'] = ay < -threshold;
        keys['s'] = ay >  threshold;
        keys['a'] = ax < -threshold;
        keys['d'] = ax >  threshold;
    }

    function resetJoystick() {
        if (activeTouchId !== null) {
            joystickTouchIds.delete(activeTouchId);
        }
        activeTouchId = null;
        applyAxis(0, 0);
        knob.style.transform = 'translate(-50%, -50%)';
    }

    function onTouchStart(e) {
        // Reveal the joystick on first touch (works for any touch on page too)
        if (container.style.display === 'none' || container.style.display === '') {
            container.style.display = 'block';
        }

        if (activeTouchId !== null) return; // already tracking a touch

        // Find a touch that started inside the container
        for (const t of e.changedTouches) {
            const c = getContainerCentre();
            const dx = t.clientX - c.x;
            const dy = t.clientY - c.y;
            if (Math.sqrt(dx * dx + dy * dy) <= BASE_RADIUS * 1.4) { // generous hit area
                activeTouchId = t.identifier;
                joystickTouchIds.add(activeTouchId);
                baseX = c.x;
                baseY = c.y;
                e.preventDefault();
                break;
            }
        }
    }

    function onTouchMove(e) {
        if (activeTouchId === null) return;
        for (const t of e.changedTouches) {
            if (t.identifier !== activeTouchId) continue;

            let dx = t.clientX - baseX;
            let dy = t.clientY - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Clamp knob travel
            if (dist > MAX_TRAVEL) {
                dx = (dx / dist) * MAX_TRAVEL;
                dy = (dy / dist) * MAX_TRAVEL;
            }

            // Move the knob visually
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

            // Normalise to [-1, 1]
            applyAxis(dx / MAX_TRAVEL, dy / MAX_TRAVEL);
            e.preventDefault();
            break;
        }
    }

    function onTouchEnd(e) {
        for (const t of e.changedTouches) {
            joystickTouchIds.delete(t.identifier);
            if (t.identifier === activeTouchId) {
                resetJoystick();
                break;
            }
        }
    }

    container.addEventListener('touchstart',  onTouchStart, { passive: false });
    window.addEventListener('touchmove',   onTouchMove,  { passive: false });
    window.addEventListener('touchend',    onTouchEnd,   { passive: false });
    window.addEventListener('touchcancel', onTouchEnd,   { passive: false });

    // On pointer-coarse (touch) devices show the joystick immediately
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        container.style.display = 'block';
    }
})();

