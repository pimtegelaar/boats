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
const SKY_ENV_COLOR = 0x87ceeb;
const UNDERWATER_ENV_COLOR = 0x021826;
const FOG_NEAR_DISTANCE = 100;
const FOG_FAR_DISTANCE = 2000;
scene.background = new THREE.Color(SKY_ENV_COLOR); // Sky blue
scene.fog = new THREE.Fog(SKY_ENV_COLOR, FOG_NEAR_DISTANCE, FOG_FAR_DISTANCE);

const oceanFloorY = -260;

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(0, 50, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

const BUILD_VERSION = 'v2026.04.19-full-screen5';

const ENABLE_TOUCH_DEBUG = true;
let touchDebugElement = null;
if (ENABLE_TOUCH_DEBUG) {
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
    touchDebugElement.style.pointerEvents = 'none';
    document.body.appendChild(touchDebugElement);
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

function anchorSeaToFocus(seaMesh, focusPoint) {
    // Continuous tracking avoids visible jumps from coarse recenter snapping.
    seaMesh.position.x = focusPoint.x;
    seaMesh.position.z = focusPoint.z;
}

function createOceanFloor() {
    const size = 14000;
    const geometry = new THREE.PlaneGeometry(size, size, 140, 140);
    const positionAttribute = geometry.getAttribute('position');

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

    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const u = (x / size) + 0.5;
        const v = (y / size) + 0.5;
        const height = sampleTileableFloorHeight(u, v);
        positionAttribute.setZ(i, height * 13);
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

const oceanFloor = createOceanFloor();

// Scatter a reusable set of low-poly icebergs across the map.
function createIcebergField(options = {}) {
    const {
        count = 85,
        boundary = 1800,
        spawnClearRadius = 320,
        minSpacing = 42
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

const icebergField = createIcebergField();

const shipSplitZ = -8;
const shipBreakSeamInset = 0.55;
const shipSplitDrift = {
    foreZSpeed: 3.1,
    aftZSpeed: 2.2,
    foreMaxOffsetZ: 54,
    aftMaxOffsetZ: -40
};
const shipCollisionProbeRadius = 18;
const shipCollisionProbeOffsets = [
    new THREE.Vector3(0, 8, 110),
    new THREE.Vector3(-11, 8, 72),
    new THREE.Vector3(11, 8, 72),
    new THREE.Vector3(-12, 8, -8),
    new THREE.Vector3(12, 8, -8),
    new THREE.Vector3(0, 8, -92)
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

function createBreakCap(isForeHalf, splitZ) {
    const capGroup = new THREE.Group();
    const capMaterial = new THREE.MeshStandardMaterial({
        color: 0x342922,
        roughness: 1,
        metalness: 0.05
    });
    const zOffset = isForeHalf ? 0.5 : -0.5;

    const mainCap = new THREE.Mesh(new THREE.BoxGeometry(14, 18, 1.1), capMaterial);
    mainCap.position.set(0, 9, splitZ + zOffset);
    mainCap.rotation.y = isForeHalf ? 0.025 : -0.025;
    mainCap.castShadow = true;
    mainCap.receiveShadow = true;
    capGroup.add(mainCap);

    const upperCap = new THREE.Mesh(new THREE.BoxGeometry(7.8, 5.4, 0.9), capMaterial.clone());
    upperCap.position.set(isForeHalf ? -1.15 : 1.15, 16.1, splitZ + zOffset * 0.82);
    upperCap.rotation.set(0.08, isForeHalf ? -0.1 : 0.1, isForeHalf ? -0.04 : 0.04);
    upperCap.castShadow = true;
    capGroup.add(upperCap);

    const keelCap = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5.8, 0.95), capMaterial.clone());
    keelCap.position.set(isForeHalf ? 0.95 : -0.95, 1.1, splitZ + zOffset * 0.72);
    keelCap.rotation.set(-0.09, isForeHalf ? 0.07 : -0.07, 0);
    keelCap.castShadow = true;
    capGroup.add(keelCap);

    return capGroup;
}

function createBrokenHalves(sourceModel, splitZ) {
    const brokenGroup = new THREE.Group();
    const foreHalf = new THREE.Group();
    const aftHalf = new THREE.Group();

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
            (child.position.z >= splitZ ? foreHalf : aftHalf).add(clone);
        }
    });

    foreHalf.add(createBreakCap(true, splitZ));
    aftHalf.add(createBreakCap(false, splitZ));

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
        radius: iceberg.geometry.boundingSphere.radius * Math.max(iceberg.scale.x, iceberg.scale.z) * 0.9,
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
            if (verticalGap <= iceberg.halfHeight + 12) {
                return iceberg.mesh;
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
    anchorWorld.y = oceanFloorY;
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

function getOceanFloorPenetration(object) {
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    return oceanFloorY - bounds.min.y;
}

function snapObjectAboveOceanFloor(object, penetration) {
    if (penetration <= 0) {
        return;
    }

    object.position.y += penetration;
    object.updateMatrixWorld(true);
}

function moveAngleToward(current, target, maxDelta) {
    return current + THREE.MathUtils.clamp(target - current, -maxDelta, maxDelta);
}

function updateFloorSettle(object, settleState, deltaSeconds, fallSinkSpeed = settleState.settleSinkSpeed) {
    const firstPenetration = getOceanFloorPenetration(object);
    if (firstPenetration > 0) {
        if (!settleState.hasTouchedFloor) {
            settleState.hasTouchedFloor = true;
            snapObjectAboveOceanFloor(object, firstPenetration);
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
    let penetration = getOceanFloorPenetration(object);
    if (penetration > 0) {
        snapObjectAboveOceanFloor(object, penetration);

        // Refresh pivot after a corrective snap so the contact patch can migrate naturally.
        const pivot = captureFloorPivotAnchor(object);
        settleState.anchorLocal = pivot.anchorLocal;
        settleState.anchorWorld = pivot.anchorWorld;

        penetration = getOceanFloorPenetration(object);
    }

    const rotXError = Math.abs(object.rotation.x - settleState.targetRotationX);
    const rotZError = Math.abs(object.rotation.z - settleState.targetRotationZ);
    const contactGap = Math.max(0, penetration);

    if (rotXError <= settleState.settleThreshold && rotZError <= settleState.settleThreshold && contactGap <= 0.02) {
        settleState.restTime += deltaSeconds;
    } else {
        settleState.restTime = 0;
    }

    if (settleState.restTime >= 0.8) {
        // Lock the current near-flat orientation instead of snapping to an old target.
        settleState.targetRotationX = object.rotation.x;
        settleState.targetRotationZ = object.rotation.z;
        const finalPenetration = getOceanFloorPenetration(object);
        if (finalPenetration > 0) {
            snapObjectAboveOceanFloor(object, finalPenetration);
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
        const foreDriftStep = shipSplitDrift.foreZSpeed * deltaSeconds;
        const aftDriftStep = shipSplitDrift.aftZSpeed * deltaSeconds;

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
            if (!foreFloorState.hasTouchedFloor) {
                foreHalf.position.z = Math.min(shipSplitDrift.foreMaxOffsetZ, foreHalf.position.z + foreDriftStep);
                foreHalf.position.y -= foreSinkSpeed * deltaSeconds;
                foreHalf.rotation.x = Math.min(1.2, foreHalf.rotation.x + 0.16 * deltaSeconds);
                foreHalf.rotation.z = Math.max(-0.26, foreHalf.rotation.z - 0.05 * deltaSeconds);
            }
            updateFloorSettle(foreHalf, foreFloorState, deltaSeconds, foreSinkSpeed);
        }

        if (!aftFloorState.settled) {
            if (!aftFloorState.hasTouchedFloor) {
                aftHalf.position.z = Math.max(shipSplitDrift.aftMaxOffsetZ, aftHalf.position.z - aftDriftStep);
                aftHalf.position.y += splitElapsed < aftRiseDuration
                    ? aftRiseSpeed * deltaSeconds
                    : -aftSinkSpeed * deltaSeconds;
                aftHalf.rotation.x = Math.min(0.88, aftHalf.rotation.x + 0.11 * deltaSeconds);
                aftHalf.rotation.z = Math.min(0.18, aftHalf.rotation.z + 0.03 * deltaSeconds);
            }
            updateFloorSettle(aftHalf, aftFloorState, deltaSeconds, aftSinkSpeed);
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

// Create Titanic Ship
function createTitanic() {
    const group = new THREE.Group();

    function createHullGeometry(options = {}) {
        const {
            length = 224,
            beam = 11.6,
            draft = 11.0,
            stations = 72,
            sectionSegments = 28,
            bowSharpness = 2.2,
            sternSharpness = 3.1,
            sternWidth = 0.34,
            bowRise = 2.2,
            sternRise = 0.9,
            bowStart = 0.58,
            sternStart = 0.22
        } = options;

        const vertices = [];
        const uvs = [];
        const indices = [];
        const ringSize = sectionSegments + 1;

        for (let s = 0; s <= stations; s++) {
            const t = s / stations;
            const z = (t - 0.5) * length;

            const bowT = THREE.MathUtils.clamp((t - bowStart) / (1 - bowStart), 0, 1);
            const sternT = THREE.MathUtils.clamp((sternStart - t) / sternStart, 0, 1);
            const bowFactor = 1 - Math.pow(bowT, bowSharpness);
            const sternFactor = sternWidth + (1 - sternWidth) * (1 - Math.pow(sternT, sternSharpness));
            const midFullness = 1 - 0.05 * Math.pow((t - 0.5) / 0.5, 4);
            const halfBeam = Math.max(0.08, beam * midFullness * bowFactor * sternFactor);
            const draftScale = 0.95 + 0.05 * Math.sin(Math.PI * t);
            const sheer = 0.25 + bowRise * Math.pow(t, 2.5) + sternRise * Math.pow(1 - t, 2.1);

            for (let a = 0; a <= sectionSegments; a++) {
                const u = a / sectionSegments;
                const angle = u * Math.PI;
                const cosA = Math.cos(angle);
                const side = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.72);
                const keelCurve = Math.pow(Math.sin(angle), 1.18);
                const tumblehome = 0.94 + 0.08 * keelCurve;

                const x = halfBeam * side * tumblehome;
                const y = sheer - draft * draftScale * keelCurve;
                vertices.push(x, y, z);
                uvs.push(u, t);
            }
        }

        for (let s = 0; s < stations; s++) {
            const ringStart = s * ringSize;
            const nextRingStart = (s + 1) * ringSize;

            for (let a = 0; a < sectionSegments; a++) {
                const current = ringStart + a;
                const next = nextRingStart + a;

                indices.push(current, next, current + 1);
                indices.push(next, next + 1, current + 1);
            }

            // Close the deck edge so the hull is one watertight mesh.
            const deckEdgeA = ringStart + sectionSegments;
            const deckEdgeB = nextRingStart + sectionSegments;
            const deckEdgeC = ringStart;
            const deckEdgeD = nextRingStart;

            indices.push(deckEdgeA, deckEdgeB, deckEdgeC);
            indices.push(deckEdgeB, deckEdgeD, deckEdgeC);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    function createTaperedSlabGeometry(options = {}) {
        const {
            length = 200,
            centerWidth = 20,
            bowWidth = 7,
            sternWidth = 11,
            thickness = 1,
            stations = 72,
            bowStart = 0.66,
            sternStart = 0.30,
            bowExponent = 1.5,
            sternExponent = 1.2
        } = options;

        const vertices = [];
        const uvs = [];
        const indices = [];
        const ringSize = 4; // LT, RT, LB, RB
        const halfThickness = thickness * 0.5;
        const centerHalf = centerWidth * 0.5;
        const bowHalf = bowWidth * 0.5;
        const sternHalf = sternWidth * 0.5;

        for (let s = 0; s <= stations; s++) {
            const t = s / stations;
            const z = (t - 0.5) * length;

            let halfWidth = centerHalf;
            if (t > bowStart) {
                const bowT = (t - bowStart) / (1 - bowStart);
                halfWidth = THREE.MathUtils.lerp(centerHalf, bowHalf, Math.pow(bowT, bowExponent));
            } else if (t < sternStart) {
                const sternT = (sternStart - t) / sternStart;
                halfWidth = THREE.MathUtils.lerp(centerHalf, sternHalf, Math.pow(sternT, sternExponent));
            }

            vertices.push(-halfWidth, halfThickness, z); // LT
            vertices.push(halfWidth, halfThickness, z);  // RT
            vertices.push(-halfWidth, -halfThickness, z); // LB
            vertices.push(halfWidth, -halfThickness, z);  // RB

            uvs.push(0, t, 1, t, 0, t, 1, t);
        }

        for (let s = 0; s < stations; s++) {
            const i = s * ringSize;
            const n = (s + 1) * ringSize;

            // Top face
            indices.push(i, n, i + 1);
            indices.push(n, n + 1, i + 1);

            // Bottom face
            indices.push(i + 2, i + 3, n + 2);
            indices.push(n + 2, i + 3, n + 3);

            // Port side
            indices.push(i, i + 2, n);
            indices.push(n, i + 2, n + 2);

            // Starboard side
            indices.push(i + 1, n + 1, i + 3);
            indices.push(n + 1, n + 3, i + 3);
        }

        // Stern cap
        indices.push(0, 1, 2);
        indices.push(1, 3, 2);

        // Bow cap
        const bowBase = stations * ringSize;
        indices.push(bowBase, bowBase + 2, bowBase + 1);
        indices.push(bowBase + 1, bowBase + 2, bowBase + 3);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.45, roughness: 0.55 });
    const lowerHullMaterial = new THREE.MeshStandardMaterial({ color: 0xb63a36, metalness: 0.25, roughness: 0.7 });
    const whitePaintMaterial = new THREE.MeshStandardMaterial({ color: 0xf1efe9, metalness: 0.15, roughness: 0.8 });
    const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x9f8660, metalness: 0.1, roughness: 0.85 });

    function markBreakMode(mesh, breakMode) {
        mesh.userData.breakMode = breakMode;
        return mesh;
    }

    // One continuous, ship-like hull with sharper bow and fuller stern sections.
    const hull = markBreakMode(new THREE.Mesh(createHullGeometry(), hullMaterial), 'split');
    hull.position.y = 11.1;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    // Red anti-fouling band follows the same hull profile for a clean paint split.
    const lowerHull = markBreakMode(new THREE.Mesh(createHullGeometry({
        length: 222,
        beam: 11.2,
        draft: 9.4,
        bowSharpness: 2.0,
        sternSharpness: 2.8,
        sternWidth: 0.38,
        bowRise: 1.2,
        sternRise: 0.45,
        bowStart: 0.56,
        sternStart: 0.24
    }), lowerHullMaterial), 'split');
    lowerHull.position.y = 8.45;
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    group.add(lowerHull);


    const mainDeckThickness = 1.4;
    const mainDeckY = 14.25;
    const mainDeck = markBreakMode(new THREE.Mesh(createTaperedSlabGeometry({
        length: 202,
        centerWidth: 21.1,
        bowWidth: 4.8,
        sternWidth: 14.4,
        thickness: mainDeckThickness,
        bowStart: 0.57,
        sternStart: 0.24,
        bowExponent: 0.95,
        sternExponent: 1.8
    }), deckMaterial), 'split');
    mainDeck.position.y = mainDeckY;
    mainDeck.castShadow = true;
    mainDeck.receiveShadow = true;
    group.add(mainDeck);

    const sheerStripe = markBreakMode(new THREE.Mesh(createTaperedSlabGeometry({
        length: 206,
        centerWidth: 21.7,
        bowWidth: 4.4,
        sternWidth: 13.8,
        thickness: 0.7,
        bowStart: 0.57,
        sternStart: 0.24,
        bowExponent: 0.9,
        sternExponent: 1.85
    }), whitePaintMaterial), 'split');
    sheerStripe.position.y = 13.4;
    sheerStripe.castShadow = true;
    group.add(sheerStripe);

    // Single long superstructure block
    const superstructureHeight = 4.6;
    const superstructureDeckOverlap = 0.12;
    const superstructureY = mainDeckY + mainDeckThickness * 0.5 + superstructureHeight * 0.5 - superstructureDeckOverlap;
    const superstructure = markBreakMode(new THREE.Mesh(new THREE.BoxGeometry(12.8, superstructureHeight, 168), whitePaintMaterial), 'split');
    superstructure.position.set(0, superstructureY, 3);
    superstructure.castShadow = true;
    group.add(superstructure);


    // Four buff funnels with black tops and slight aft rake.
    const funnelPositions = [50, 20, -10, -40];
    const funnelRake = -0.09;
    const funnelBodyHeight = 26;
    const funnelBaseOverlap = 0.12;
    const superstructureTopY = superstructure.position.y + superstructureHeight * 0.5;
    const funnelBodyY = superstructureTopY + Math.cos(funnelRake) * (funnelBodyHeight * 0.5) - funnelBaseOverlap;
    const funnelTopHeight = 5;
    const funnelCapOverlap = 0.15;
    const topCenterOffset = (funnelBodyHeight + funnelTopHeight) * 0.5 - funnelCapOverlap;
    const funnelBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcda563, metalness: 0.2, roughness: 0.75 });
    const funnelTopMaterial = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.3, roughness: 0.6 });
    for (const z of funnelPositions) {
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, funnelBodyHeight, 16), funnelBodyMaterial);
        funnel.position.set(0, funnelBodyY, z);
        funnel.rotation.x = funnelRake;
        funnel.castShadow = true;
        group.add(funnel);

        const funnelTop = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, funnelTopHeight, 16), funnelTopMaterial);
        funnelTop.position.set(
            0,
            funnelBodyY + Math.cos(funnelRake) * topCenterOffset,
            z + Math.sin(funnelRake) * topCenterOffset
        );
        funnelTop.rotation.x = funnelRake;
        funnelTop.castShadow = true;
        group.add(funnelTop);
    }

    const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x876337, metalness: 0.15, roughness: 0.8 });
    const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 62, 8), mastMaterial);
    foreMast.position.set(0, 40, 92);
    foreMast.castShadow = true;
    group.add(foreMast);

    const aftMast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 56, 8), mastMaterial);
    aftMast.position.set(0, 36, -86);
    aftMast.castShadow = true;
    group.add(aftMast);


    group.castShadow = true;
    group.receiveShadow = true;

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

    scene.add(root);
    return root;
}

const titanic = createTitanic();
titanic.position.set(0, 0, 0);

// Input handling
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    // Handle special keys
    if (e.code === 'Space') keys[' '] = true;
    if (e.ctrlKey) keys['control'] = true;
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
let cameraDistance = 100;
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
const shipPosition = new THREE.Vector3(0, 0, 0);
const moveSpeed = 0.5;
const rotationSpeed = 0.003;
let lastFrameTime = performance.now() * 0.001;

// Forward direction vector for the ship. The bow faces +Z in the model.
const shipForward = new THREE.Vector3(0, 0, 1);
const shipRight = new THREE.Vector3(1, 0, 0);

// Euler angles for ship rotation
let shipYaw = 0;

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

    // Handle movement input while the ship is still under player control.
    const damageState = titanic.userData.damageState;
    if (damageState.phase === 'sailing') {
        const forward = shipForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);

        if (keys['w']) {
            shipPosition.add(forward.clone().multiplyScalar(moveSpeed));
        }
        if (keys['s']) {
            shipPosition.add(forward.clone().multiplyScalar(-moveSpeed));
        }
        if (keys['a']) {
            shipYaw += rotationSpeed;
        }
        if (keys['d']) {
            shipYaw -= rotationSpeed;
        }
        if (keys[' ']) {
            shipPosition.y += moveSpeed;
        }
        if (keys['control']) {
            shipPosition.y -= moveSpeed;
        }

        // Rotate ship with Q and E keys (optional, but nice for ship rotation)
        if (keys['q']) {
            shipYaw += rotationSpeed;
        }
        if (keys['e']) {
            shipYaw -= rotationSpeed;
        }
    }

    // Update ship position and rotation
    titanic.position.copy(shipPosition);
    titanic.rotation.y = shipYaw;
    titanic.updateMatrixWorld(true);

    if (damageState.phase === 'sailing') {
        const hitIceberg = detectIcebergCollision(titanic);
        if (hitIceberg) {
            triggerIcebergImpact(titanic, now, hitIceberg);
        }
    }

    updateShipDamage(titanic, now, deltaSeconds);
    titanic.updateMatrixWorld(true);

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
    const envColor = camera.position.y < 0 ? UNDERWATER_ENV_COLOR : SKY_ENV_COLOR;
    if (scene.background.getHex() !== envColor) {
        scene.background.setHex(envColor);
    }
    if (scene.fog && scene.fog.color.getHex() !== envColor) {
        scene.fog.color.setHex(envColor);
    }


    // Clamp position to sea boundaries
    const seaBoundary = 2000;
    shipPosition.x = Math.max(-seaBoundary, Math.min(seaBoundary, shipPosition.x));
    shipPosition.z = Math.max(-seaBoundary, Math.min(seaBoundary, shipPosition.z));
    shipPosition.y = Math.max(0, shipPosition.y);

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
    const posElement = document.getElementById('position');
    if (posElement) {
        posElement.textContent = positionText;
    }

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

