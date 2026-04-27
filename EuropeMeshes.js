// --- New York style giant foundation for Europe ---
function addEuropeFoundationPrism({ x, z, width, depth, topY, extraInset = 0, group }) {
    // Use similar logic as NewYorkMeshes.js
    const halfWidth = Math.max(1, width * 0.5 - extraInset);
    const halfDepth = Math.max(1, depth * 0.5 - extraInset);
    const bottomY = getEuropeFoundationBottomY([
        { x, z },
        { x: x - halfWidth, z: z - halfDepth },
        { x: x + halfWidth, z: z - halfDepth },
        { x: x - halfWidth, z: z + halfDepth },
        { x: x + halfWidth, z: z + halfDepth }
    ]);
    const height = topY - bottomY;
    if (height <= 2) return;
    const foundation = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(2, width - extraInset * 2), height, Math.max(2, depth - extraInset * 2)),
        new THREE.MeshPhongMaterial({ color: 0x434850 }) // dark submerged
    );
    foundation.position.set(x, bottomY + height * 0.5, z);
    foundation.receiveShadow = true;
    foundation.userData.noCollision = true;
    group.add(foundation);
}
// EuropeMeshes.js
// Contains meshes for the Europe side: a big church and several smaller houses.
// Uses Three.js primitives for simplicity.

// Utility: pastel house colors
const HOUSE_COLORS = [0xf4cccc, 0xcfe2f3, 0xd9ead3, 0xffe599, 0xb4a7d6, 0xfce5cd, 0xead1dc, 0xc9daf8, 0xead1dc, 0xd0e0e3];

function createFoundation(width, depth, height) {
    const foundation = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshPhongMaterial({ color: 0x888888 })
    );
    foundation.position.set(0, height / 2, 0);
    return foundation;
}

function createSpire(height, radius) {
    const spire = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 8),
        new THREE.MeshPhongMaterial({ color: 0x888888 })
    );
    spire.position.set(0, height / 2, 0);
    return spire;
}

function createChurch() {
    const group = new THREE.Group();
    // Double all dimensions
    // Main body (tall, gothic)
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(20, 44, 36),
        new THREE.MeshPhongMaterial({ color: 0xcccccc })
    );
    body.position.set(0, 22, 0);
    group.add(body);
    // Roof (pointed)
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(16, 16, 4),
        new THREE.MeshPhongMaterial({ color: 0x888888 })
    );
    roof.position.set(0, 38, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Tall spire tower (left side)
    const tower = new THREE.Mesh(
        new THREE.BoxGeometry(8, 64, 8),
        new THREE.MeshPhongMaterial({ color: 0xdddddd })
    );
    tower.position.set(-14, 32, 0);
    group.add(tower);
    // Spire on tower
    const spire = createSpire(44, 4);
    spire.position.set(-14, 64 + 22, 0);
    group.add(spire);
    // Cross on spire
    const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 4, 0.6),
        new THREE.MeshPhongMaterial({ color: 0xffff00 })
    );
    cross.position.set(-14, 64 + 22 + 24, 0);
    group.add(cross);
    const crossBar = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.6, 0.6),
        new THREE.MeshPhongMaterial({ color: 0xffff00 })
    );
    crossBar.position.set(-14, 64 + 22 + 23, 0);
    group.add(crossBar);
    // Small side tower (right)
    const sideTower = new THREE.Mesh(
        new THREE.BoxGeometry(4, 28, 4),
        new THREE.MeshPhongMaterial({ color: 0xdddddd })
    );
    sideTower.position.set(16, 14, 0);
    group.add(sideTower);
    // Side tower roof
    const sideRoof = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 8, 4),
        new THREE.MeshPhongMaterial({ color: 0x555555 })
    );
    sideRoof.position.set(16, 28, 0);
    group.add(sideRoof);
    return group;
}

function createRowHouse(x, color, height = 10, width = 5, depth = 6) {
    const group = new THREE.Group();
    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshPhongMaterial({ color })
    );
    body.position.set(0, height / 2, 0);
    group.add(body);
    // Roof (simple gable)
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.7, 3, 4),
        new THREE.MeshPhongMaterial({ color: 0x8b0000 })
    );
    roof.position.set(0, height + 1.5, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Place at x
    group.position.set(x, 10, 0);
    return group;
}

// Helper to find the lowest ocean floor Y under a set of points
function getEuropeFoundationBottomY(samplePoints) {
    let minFloorY = Infinity;
    for (const point of samplePoints) {
        const floorY = getOceanFloorHeightAtWorld(point.x, point.z);
        minFloorY = Math.min(minFloorY, floorY);
    }
    return minFloorY - 10; // extra depth for robustness, as in New York
}

function createEuropeMeshes() {
    const group = new THREE.Group();
    // Add giant rectangular foundation column (same size as New York's, but at Europe location)
    const foundationWidth = 3120;
    const foundationDepth = 4700;
    const foundationX = 0;
    const foundationZ = 2.5 - foundationDepth / 2;
    const giantFoundationTopY = 10;
    addEuropeFoundationPrism({
        x: foundationX,
        z: foundationZ,
        width: foundationWidth,
        depth: foundationDepth,
        topY: giantFoundationTopY,
        extraInset: 12,
        group
    });

    // Add multiple rows of houses
    const houseRows = 4; // number of rows
    const houseCount = 18; // houses per row
    const houseWidth = 5;
    const rowSpacing = 9; // z distance between rows
    const startX = -((houseCount - 1) * houseWidth) / 2;
    for (let row = 0; row < houseRows; row++) {
        for (let i = 0; i < houseCount; i++) {
            const color = HOUSE_COLORS[(i + row) % HOUSE_COLORS.length];
            const height = 8 + Math.random() * 4;
            const house = createRowHouse(startX + i * houseWidth + (row % 2 === 0 ? 0 : houseWidth / 2), color, height);
            house.position.z = -20.5 - row * rowSpacing;
            group.add(house);
        }
    }
    // Church (centered, behind houses)
    const church = createChurch();
    // Place church further back to avoid overlap with new house rows
    church.position.set(0, 20, -20.5 - houseRows * rowSpacing - 20);
    group.add(church);
    return group;
}

// Make available globally for Boats.js (no import needed)
window.createEuropeMeshes = createEuropeMeshes;
