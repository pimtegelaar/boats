// New York Harbor meshes and collision detection for Boats
// Requires: THREE.js, getOceanFloorHeightAtWorld(), NEW_YORK_CONFIG to be defined globally

function createNewYorkHarbor(config = NEW_YORK_CONFIG) {
    const group = new THREE.Group();

    const graniteMaterial = new THREE.MeshStandardMaterial({ color: 0x64676f, roughness: 0.88, metalness: 0.1 });
    const promenadeMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4c, roughness: 0.94, metalness: 0.05 });
    const pierWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x755e45, roughness: 0.9, metalness: 0.03 });
    const limestoneMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c2b6, roughness: 0.78, metalness: 0.08 });
    const masonryMaterial = new THREE.MeshStandardMaterial({ color: 0x8d7e72, roughness: 0.84, metalness: 0.06 });
    const darkMasonryMaterial = new THREE.MeshStandardMaterial({ color: 0x5b5451, roughness: 0.86, metalness: 0.08 });
    const copperRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x4b6b67, roughness: 0.58, metalness: 0.3 });
    const submergedFoundationMaterial = new THREE.MeshStandardMaterial({ color: 0x434850, roughness: 0.92, metalness: 0.04 });

    function getFoundationBottomY(samplePoints) {
        let minFloorY = Infinity;
        for (const point of samplePoints) {
            const floorY = getOceanFloorHeightAtWorld(point.x, point.z);
            minFloorY = Math.min(minFloorY, floorY);
        }
        return minFloorY - 10;
    }

    function addFoundationPrism({ x, z, width, depth, topY, extraInset = 0 }) {
        const halfWidth = Math.max(1, width * 0.5 - extraInset);
        const halfDepth = Math.max(1, depth * 0.5 - extraInset);
        const bottomY = getFoundationBottomY([
            { x, z },
            { x: x - halfWidth, z: z - halfDepth },
            { x: x + halfWidth, z: z - halfDepth },
            { x: x - halfWidth, z: z + halfDepth },
            { x: x + halfWidth, z: z + halfDepth }
        ]);
        const height = topY - bottomY;
        if (height <= 2) {
            return;
        }

        const foundation = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(2, width - extraInset * 2), height, Math.max(2, depth - extraInset * 2)),
            submergedFoundationMaterial
        );
        foundation.position.set(x, bottomY + height * 0.5, z);
        foundation.receiveShadow = true;
        foundation.userData.noCollision = true;
        group.add(foundation);
    }

    const shoreline = new THREE.Mesh(new THREE.BoxGeometry(3120, 52, 470), graniteMaterial);
    shoreline.position.set(config.harborCenter.x, -24, config.harborCenter.z + 280);
    shoreline.receiveShadow = true;
    shoreline.userData.noCollision = true;
    group.add(shoreline);
    addFoundationPrism({
        x: shoreline.position.x,
        z: shoreline.position.z,
        width: 3120,
        depth: 470,
        topY: shoreline.position.y - 26,
        extraInset: 12
    });

    const cityPlate = new THREE.Mesh(new THREE.BoxGeometry(2820, 10, 360), promenadeMaterial);
    cityPlate.position.set(config.harborCenter.x, 5, config.harborCenter.z + 295);
    cityPlate.receiveShadow = true;
    cityPlate.userData.noCollision = true;
    group.add(cityPlate);

    function addBlock(width, height, depth, x, y, z, material, castsShadow = true) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.set(x, y + height * 0.5, z);
        mesh.castShadow = castsShadow;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    function addStackedTower(x, z, segments, material, capMaterial = null) {
        let y = 8;
        let width = segments[0].width;
        let depth = segments[0].depth;
        for (let index = 0; index < segments.length; index++) {
            const segment = segments[index];
            width = segment.width;
            depth = segment.depth;
            addBlock(width, segment.height, depth, x, y, z, material, index < 3);
            y += segment.height;
        }

        if (capMaterial) {
            const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.34, 34, 8), capMaterial);
            cap.position.set(x, y + 12, z);
            cap.castShadow = true;
            group.add(cap);
        }
    }

    const waterfrontStartZ = config.harborCenter.z + 188;
    for (let index = 0; index < 54; index++) {
        const x = -1290 + index * 50;
        if (Math.abs(x) < 130) {
            continue;
        }
        const depth = 38 + (index % 3) * 8;
        const height = 36 + (index % 4) * 9;
        addBlock(42, height, depth, x, 8, waterfrontStartZ + (index % 2) * 18, darkMasonryMaterial, false);
    }

    const skylineBaseZ = config.harborCenter.z + 314;

    // Singer Building-inspired profile with cupola-like cap.
    addStackedTower(
        config.harborCenter.x + 22,
        skylineBaseZ - 44,
        [
            { width: 64, depth: 56, height: 92 },
            { width: 44, depth: 38, height: 126 },
            { width: 30, depth: 26, height: 126 },
            { width: 20, depth: 18, height: 92 }
        ],
        limestoneMaterial,
        copperRoofMaterial
    );

    // Metropolitan Life-style clock-tower massing.
    addStackedTower(
        config.harborCenter.x - 168,
        skylineBaseZ + 4,
        [
            { width: 56, depth: 52, height: 104 },
            { width: 36, depth: 34, height: 116 },
            { width: 26, depth: 24, height: 92 }
        ],
        limestoneMaterial,
        copperRoofMaterial
    );

    // Woolworth-era gothic massing (opened 1913, close enough to the target period look).
    addStackedTower(
        config.harborCenter.x + 156,
        skylineBaseZ + 18,
        [
            { width: 72, depth: 58, height: 116 },
            { width: 50, depth: 42, height: 144 },
            { width: 34, depth: 30, height: 126 }
        ],
        limestoneMaterial,
        copperRoofMaterial
    );

    // --- LEFT (west) extension landmark buildings ---

    // Wide flat-topped ziggurat: many setbacks, no cap — like an early NYC office block
    addStackedTower(
        config.harborCenter.x - 560,
        skylineBaseZ - 18,
        [
            { width: 90, depth: 70, height: 48 },
            { width: 72, depth: 54, height: 44 },
            { width: 54, depth: 40, height: 40 },
            { width: 36, depth: 26, height: 36 },
            { width: 22, depth: 16, height: 28 }
        ],
        darkMasonryMaterial
    );

    // Narrow slab tower — tall and thin, no ornamental cap, brick-red masonry
    addStackedTower(
        config.harborCenter.x - 720,
        skylineBaseZ + 36,
        [
            { width: 28, depth: 62, height: 68 },
            { width: 22, depth: 50, height: 112 },
            { width: 16, depth: 38, height: 88 }
        ],
        masonryMaterial
    );

    // Broad warehouse-loft block — squat but very wide, flat roof with a small water tower cylinder
    {
        const loftX = config.harborCenter.x - 900;
        const loftZ = skylineBaseZ + 10;
        addBlock(130, 58, 72, loftX, 8, loftZ, darkMasonryMaterial, false);
        // Water tower on the roof
        const tankGeom = new THREE.CylinderGeometry(7, 7, 18, 10);
        const tank = new THREE.Mesh(tankGeom, pierWoodMaterial);
        tank.position.set(loftX + 32, 8 + 58 + 9, loftZ - 14);
        tank.castShadow = true;
        group.add(tank);
        const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 10, 10), darkMasonryMaterial);
        tankRoof.position.set(loftX + 32, 8 + 58 + 18 + 5, loftZ - 14);
        tankRoof.castShadow = true;
        group.add(tankRoof);
        // Second smaller water tower
        const tank2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 14, 10), pierWoodMaterial);
        tank2.position.set(loftX - 28, 8 + 58 + 7, loftZ + 10);
        tank2.castShadow = true;
        group.add(tank2);
        const tankRoof2 = new THREE.Mesh(new THREE.ConeGeometry(6.5, 8, 10), darkMasonryMaterial);
        tankRoof2.position.set(loftX - 28, 8 + 58 + 14 + 4, loftZ + 10);
        tankRoof2.castShadow = true;
        group.add(tankRoof2);
    }

    // Stepped tower with a cylindrical turret crown — Beaux-Arts style
    {
        const tx = config.harborCenter.x - 1080;
        const tz = skylineBaseZ - 6;
        addStackedTower(tx, tz,
            [
                { width: 66, depth: 58, height: 72 },
                { width: 48, depth: 42, height: 96 },
                { width: 32, depth: 28, height: 68 }
            ],
            limestoneMaterial
        );
        // Cylindrical turret on top
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 52, 12), limestoneMaterial);
        turret.position.set(tx, 8 + 72 + 96 + 68 + 26, tz);
        turret.castShadow = true;
        group.add(turret);
        const turretCap = new THREE.Mesh(new THREE.ConeGeometry(13, 22, 12), copperRoofMaterial);
        turretCap.position.set(tx, 8 + 72 + 96 + 68 + 52 + 11, tz);
        turretCap.castShadow = true;
        group.add(turretCap);
    }

    // Low, sprawling commercial block — wide setback with a plain parapet
    addStackedTower(
        config.harborCenter.x - 1240,
        skylineBaseZ + 28,
        [
            { width: 110, depth: 68, height: 38 },
            { width: 80, depth: 50, height: 32 },
            { width: 50, depth: 32, height: 24 }
        ],
        masonryMaterial
    );

    // --- RIGHT (east) extension landmark buildings ---

    // Palazzo-style broad tower: wide base, two strong setbacks, pyramidal top
    {
        const px = config.harborCenter.x + 620;
        const pz = skylineBaseZ - 12;
        addStackedTower(px, pz,
            [
                { width: 88, depth: 66, height: 60 },
                { width: 62, depth: 48, height: 72 },
                { width: 38, depth: 30, height: 54 }
            ],
            limestoneMaterial
        );
        // Pyramid cap instead of cone
        const pyramid = new THREE.Mesh(new THREE.ConeGeometry(28, 36, 4), copperRoofMaterial);
        pyramid.position.set(px, 8 + 60 + 72 + 54 + 18, pz);
        pyramid.rotation.y = Math.PI / 4;
        pyramid.castShadow = true;
        group.add(pyramid);
    }

    // Pair of twin towers side by side — matching height, slightly different widths
    {
        const baseX = config.harborCenter.x + 820;
        const baseZ = skylineBaseZ + 22;
        // Left twin
        addStackedTower(baseX - 26, baseZ,
            [
                { width: 30, depth: 46, height: 80 },
                { width: 22, depth: 36, height: 102 }
            ],
            darkMasonryMaterial
        );
        // Right twin (slightly taller, offset z)
        addStackedTower(baseX + 26, baseZ - 14,
            [
                { width: 28, depth: 42, height: 86 },
                { width: 20, depth: 32, height: 110 }
            ],
            darkMasonryMaterial
        );
        // Shared cornice band between them
        addBlock(68, 6, 48, baseX, 8 + 80 + 102 - 6, baseZ - 6, masonryMaterial, false);
    }

    // Art-deco spire: many thin setbacks tapering to a needle
    addStackedTower(
        config.harborCenter.x + 1020,
        skylineBaseZ + 8,
        [
            { width: 70, depth: 60, height: 52 },
            { width: 54, depth: 46, height: 56 },
            { width: 38, depth: 32, height: 52 },
            { width: 24, depth: 20, height: 46 },
            { width: 14, depth: 12, height: 56 },
            { width: 8,  depth: 8,  height: 48 }
        ],
        limestoneMaterial,
        copperRoofMaterial
    );

    // Broad flat-roofed factory/customs hall — very wide, low, dark brick
    {
        const fx = config.harborCenter.x + 1220;
        const fz = skylineBaseZ + 20;
        addBlock(150, 44, 80, fx, 8, fz, darkMasonryMaterial, false);
        // Sawtooth roofline detail: a row of small gabled ridges
        for (let i = -3; i <= 3; i++) {
            const ridge = new THREE.Mesh(new THREE.ConeGeometry(10, 14, 4), darkMasonryMaterial);
            ridge.position.set(fx + i * 22, 8 + 44 + 7, fz);
            ridge.rotation.y = Math.PI / 4;
            ridge.castShadow = false;
            group.add(ridge);
        }
    }

    // Historic downtown shoulder buildings around the landmark towers.
    const shoulderPositions = [
        [-272, skylineBaseZ + 12, 98, 68, 58],
        [-228, skylineBaseZ - 46, 86, 58, 50],
        [-120, skylineBaseZ - 72, 112, 68, 62],
        [-72, skylineBaseZ + 34, 96, 56, 46],
        [92, skylineBaseZ + 62, 92, 56, 48],
        [224, skylineBaseZ - 24, 96, 62, 54],
        [288, skylineBaseZ + 22, 88, 58, 46],
        // Left extension shoulder buildings
        [-420, skylineBaseZ - 12, 84, 58, 50],
        [-490, skylineBaseZ + 44, 72, 48, 40],
        [-640, skylineBaseZ - 52, 68, 52, 44],
        [-680, skylineBaseZ + 20, 78, 56, 46],
        [-800, skylineBaseZ - 28, 62, 44, 38],
        [-970, skylineBaseZ + 48, 74, 50, 42],
        [-1020, skylineBaseZ - 16, 80, 54, 44],
        [-1160, skylineBaseZ + 14, 58, 46, 38],
        [-1300, skylineBaseZ - 38, 66, 50, 42],
        // Right extension shoulder buildings
        [360, skylineBaseZ - 20, 78, 54, 46],
        [460, skylineBaseZ + 38, 86, 60, 50],
        [520, skylineBaseZ - 48, 64, 48, 40],
        [700, skylineBaseZ + 44, 72, 50, 42],
        [750, skylineBaseZ - 14, 88, 62, 52],
        [920, skylineBaseZ + 52, 66, 48, 40],
        [980, skylineBaseZ - 22, 76, 52, 44],
        [1120, skylineBaseZ + 18, 70, 50, 42],
        [1160, skylineBaseZ - 44, 60, 46, 38],
        [1300, skylineBaseZ + 30, 82, 58, 48]
    ];
    for (const [x, z, height, width, depth] of shoulderPositions) {
        addBlock(width, height, depth, config.harborCenter.x + x, 8, z, masonryMaterial, false);
    }

    // Place a small Liberty silhouette off to the port side for immediate recognizability.
    const libertyIsland = new THREE.Mesh(new THREE.CylinderGeometry(32, 48, 8, 16), graniteMaterial);
    libertyIsland.position.set(config.harborCenter.x - 360, -1, config.harborCenter.z + 84);
    libertyIsland.receiveShadow = true;
    libertyIsland.userData.noCollision = true;
    group.add(libertyIsland);

    const libertyPedestal = new THREE.Mesh(new THREE.BoxGeometry(18, 20, 18), limestoneMaterial);
    libertyPedestal.position.set(config.harborCenter.x - 360, 10, config.harborCenter.z + 84);
    libertyPedestal.castShadow = true;
    libertyPedestal.receiveShadow = true;
    group.add(libertyPedestal);

    const libertyFigure = new THREE.Mesh(new THREE.ConeGeometry(5.8, 22, 8), copperRoofMaterial);
    libertyFigure.position.set(config.harborCenter.x - 360, 30, config.harborCenter.z + 84);
    libertyFigure.castShadow = true;
    group.add(libertyFigure);

    const libertyTorch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 6), limestoneMaterial);
    libertyTorch.position.set(config.harborCenter.x - 356.5, 40.2, config.harborCenter.z + 84);
    libertyTorch.rotation.z = -0.22;
    libertyTorch.castShadow = true;
    group.add(libertyTorch);

    const skyline = new THREE.Group();
    const cityCenterZ = config.harborCenter.z + 320;
    for (let gx = -18; gx <= 18; gx++) {
        for (let gz = -2; gz <= 3; gz++) {
            const x = gx * 48;
            const z = cityCenterZ + gz * 58;
            if (Math.abs(x) < 150 && z < cityCenterZ - 70) {
                continue;
            }

            const heightNoise = Math.sin(gx * 1.72 + gz * 0.58) * 0.5 + 0.5;
            const towerHeight = 42 + heightNoise * 128;
            const width = 22 + ((gx + 8) % 3) * 8;
            const depth = 20 + ((gz + 9) % 4) * 6;
            const towerMaterial = towerHeight > 120 ? limestoneMaterial : masonryMaterial;
            const tower = new THREE.Mesh(new THREE.BoxGeometry(width, towerHeight, depth), towerMaterial);
            tower.position.set(config.harborCenter.x + x, towerHeight * 0.5 + 8, z);
            tower.castShadow = towerHeight > 115;
            tower.receiveShadow = true;
            skyline.add(tower);
        }
    }

    group.add(skyline);
    scene.add(group);
    return group;
}

function buildNewYorkCollisionBounds(harborGroup) {
    const bounds = [];
    harborGroup.traverse((child) => {
        if (!child.isMesh || !child.geometry) {
            return;
        }

        if (child.userData.noCollision) {
            return;
        }

        if (!child.geometry.boundingSphere) {
            child.geometry.computeBoundingSphere();
        }
        if (!child.geometry.boundingBox) {
            child.geometry.computeBoundingBox();
        }

        const boxBounds = child.geometry.boundingBox;
        const sphereBounds = child.geometry.boundingSphere;
        const maxScale = Math.max(child.scale.x, child.scale.y, child.scale.z);

        bounds.push({
            mesh: child,
            radius: sphereBounds.radius * maxScale * 0.28,
            halfHeight: (boxBounds.max.y - boxBounds.min.y) * child.scale.y * 0.5
        });
    });
    return bounds;
}
