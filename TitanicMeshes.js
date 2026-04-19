(function initTitanicMeshes(global) {
    if (!global.BoatMeshes) {
        const meshBuilders = Object.create(null);
        global.BoatMeshes = {
            createBoatMesh(type, options) {
                const builder = meshBuilders[type];
                if (!builder) {
                    throw new Error('Unknown boat mesh type: ' + type);
                }
                return builder(options);
            },
            registerBoatMeshBuilder(type, builder) {
                if (typeof type !== 'string' || !type) {
                    throw new Error('Boat type must be a non-empty string.');
                }
                if (typeof builder !== 'function') {
                    throw new Error('Boat mesh builder must be a function.');
                }
                meshBuilders[type] = builder;
            }
        };
    }

    if (typeof global.BoatMeshes.registerBoatMeshBuilder !== 'function') {
        throw new Error('BoatMeshes registry is invalid.');
    }

    function getCircularSternCurve(progress, exponent) {
        const p = THREE.MathUtils.clamp(progress, 0, 1);
        const circle = Math.sqrt(Math.max(0, 1 - Math.pow(1 - p, 2)));
        return Math.pow(circle, exponent);
    }

    function getHullTopHalfWidthAtT(t, options) {
        const {
            beam = 12.6,
            bowSharpness = 1.85,
            sternSharpness = 3.1,
            sternWidth = 0.32,
            bowStart = 0.76,
            sternStart = 0.20,
            sternRound = false,
            sternRoundExponent = 1.0,
            topEdgeScale = 0.94
        } = options || {};

        const bowT = THREE.MathUtils.clamp((t - bowStart) / (1 - bowStart), 0, 1);
        const sternT = THREE.MathUtils.clamp((sternStart - t) / sternStart, 0, 1);
        const bowFactor = 1 - Math.pow(bowT, bowSharpness);

        let sternFactor = sternWidth + (1 - sternWidth) * (1 - Math.pow(sternT, sternSharpness));
        if (sternRound && t < sternStart) {
            const sternProgress = t / Math.max(sternStart, 0.0001);
            sternFactor = getCircularSternCurve(sternProgress, sternRoundExponent);
        }

        const midFullness = 1 - 0.05 * Math.pow((t - 0.5) / 0.5, 4);
        const halfBeam = Math.max(0, beam * midFullness * bowFactor * sternFactor);
        return halfBeam * topEdgeScale;
    }

    function getHullSheerAtT(t, options) {
        const {
            bowRise = 2.2,
            sternRise = 0.9
        } = options || {};

        return 5 + bowRise * Math.pow(t, 2.5) + sternRise * Math.pow(1 - t, 2.1);
    }

    function createHullGeometry(options) {
        const {
            length = 224,
            beam = 12.6,
            draft = 11.0,
            stations = 72,
            sectionSegments = 28,
            bowSharpness = 1.85,
            sternSharpness = 3.1,
            sternWidth = 0.32,
            bowRise = 2.2,
            sternRise = 0.9,
            bowStart = 0.76,
            sternStart = 0.20,
            sternRound = false,
            sternRoundExponent = 1.0
        } = options || {};

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
            let sternFactor = sternWidth + (1 - sternWidth) * (1 - Math.pow(sternT, sternSharpness));
            if (sternRound && t < sternStart) {
                const sternProgress = t / Math.max(sternStart, 0.0001);
                sternFactor = getCircularSternCurve(sternProgress, sternRoundExponent);
            }
            const midFullness = 1 - 0.05 * Math.pow((t - 0.5) / 0.5, 4);
            const halfBeam = Math.max(0, beam * midFullness * bowFactor * sternFactor);
            const draftScale = 0.95 + 0.05 * Math.sin(Math.PI * t);
            const sheer = getHullSheerAtT(t, { bowRise, sternRise });

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

            // Keep this watertight so split geometry does not leave open seams.
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

    function createTaperedSlabGeometry(options) {
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
            sternExponent = 1.2,
            sternRound = false,
            sternRoundExponent = 1.0,
            halfWidthAtT = null,
            centerYAtT = null
        } = options || {};

        const vertices = [];
        const uvs = [];
        const indices = [];
        const ringSize = 4;
        const halfThickness = thickness * 0.5;
        const centerHalf = centerWidth * 0.5;
        const bowHalf = bowWidth * 0.5;
        const sternHalf = sternWidth * 0.5;

        for (let s = 0; s <= stations; s++) {
            const t = s / stations;
            const z = (t - 0.5) * length;
            const centerY = typeof centerYAtT === 'function' ? centerYAtT(t) : 0;

            let halfWidth = centerHalf;
            if (typeof halfWidthAtT === 'function') {
                halfWidth = Math.max(0, halfWidthAtT(t));
            } else if (t > bowStart) {
                const bowT = (t - bowStart) / (1 - bowStart);
                halfWidth = THREE.MathUtils.lerp(centerHalf, bowHalf, Math.pow(bowT, bowExponent));
            } else if (t < sternStart) {
                if (sternRound) {
                    // Circular stern profile avoids a sharp teardrop-looking aft tip.
                    const sternProgress = t / Math.max(sternStart, 0.0001);
                    const sternCurve = getCircularSternCurve(sternProgress, sternRoundExponent);
                    halfWidth = THREE.MathUtils.lerp(sternHalf, centerHalf, sternCurve);
                } else {
                    const sternT = (sternStart - t) / sternStart;
                    halfWidth = THREE.MathUtils.lerp(centerHalf, sternHalf, Math.pow(sternT, sternExponent));
                }
            }

            vertices.push(-halfWidth, centerY + halfThickness, z);
            vertices.push(halfWidth, centerY + halfThickness, z);
            vertices.push(-halfWidth, centerY - halfThickness, z);
            vertices.push(halfWidth, centerY - halfThickness, z);

            uvs.push(0, t, 1, t, 0, t, 1, t);
        }

        for (let s = 0; s < stations; s++) {
            const i = s * ringSize;
            const n = (s + 1) * ringSize;

            indices.push(i, n, i + 1);
            indices.push(n, n + 1, i + 1);

            indices.push(i + 2, i + 3, n + 2);
            indices.push(n + 2, i + 3, n + 3);

            indices.push(i, i + 2, n);
            indices.push(n, i + 2, n + 2);

            indices.push(i + 1, n + 1, i + 3);
            indices.push(n + 1, n + 3, i + 3);
        }

        indices.push(0, 1, 2);
        indices.push(1, 3, 2);

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

    function createSideWindowGeometry(panels) {
        const vertices = [];
        const uvs = [];
        const indices = [];

        for (const panel of panels) {
            const {
                x = 0,
                y = 0,
                z = 0,
                halfHeight = 0.1,
                halfWidth = 0.2,
                normalSign = 1
            } = panel || {};

            const zMin = z - halfWidth;
            const zMax = z + halfWidth;
            const yMin = y - halfHeight;
            const yMax = y + halfHeight;
            const base = vertices.length / 3;

            if (normalSign >= 0) {
                vertices.push(
                    x, yMin, zMin,
                    x, yMax, zMin,
                    x, yMin, zMax,
                    x, yMax, zMax
                );
                indices.push(base, base + 1, base + 2);
                indices.push(base + 2, base + 1, base + 3);
            } else {
                vertices.push(
                    x, yMin, zMin,
                    x, yMin, zMax,
                    x, yMax, zMin,
                    x, yMax, zMax
                );
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }

            uvs.push(
                0, 0,
                0, 1,
                1, 0,
                1, 1
            );
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    function markBreakMode(mesh, breakMode) {
        mesh.userData.breakMode = breakMode;
        return mesh;
    }

    function applyLocalClippingPlane(mesh, localPlane) {
        mesh.userData.localClipPlane = localPlane.clone();
        mesh.userData.localClipNormalMatrix = new THREE.Matrix3();
        mesh.onBeforeRender = function updateMeshLocalClipPlane() {
            const sourcePlane = this.userData.localClipPlane;
            const normalMatrix = this.userData.localClipNormalMatrix;
            if (!(sourcePlane instanceof THREE.Plane) || !(normalMatrix instanceof THREE.Matrix3)) {
                return;
            }

            normalMatrix.getNormalMatrix(this.matrixWorld);
            const materials = Array.isArray(this.material) ? this.material : [this.material];
            for (const material of materials) {
                if (!material || !material.clippingPlanes || material.clippingPlanes.length === 0) {
                    continue;
                }
                material.clippingPlanes[0]
                    .copy(sourcePlane)
                    .applyMatrix4(this.matrixWorld, normalMatrix);
            }
        };
    }

    function createTitanicIntactMesh() {
        const group = new THREE.Group();

        const hullPlacementY = 11.1;
        const paintSplitEpsilon = 0.02;
        // Keep paint separation fixed to hull space so it stays stable while sinking.
        const hullPaintSplitY = -3.9;
        const upperHullMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.45,
            roughness: 0.55,
            clippingPlanes: [new THREE.Plane()],
            clipShadows: true
        });
        const lowerHullMaterial = new THREE.MeshStandardMaterial({
            color: 0xb63a36,
            metalness: 0.25,
            roughness: 0.7,
            clippingPlanes: [new THREE.Plane()],
            clipShadows: true
        });
        const whitePaintMaterial = new THREE.MeshStandardMaterial({ color: 0xf1efe9, metalness: 0.15, roughness: 0.8 });
        const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x9f8660, metalness: 0.1, roughness: 0.85 });
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x111722,
            emissive: 0x273142,
            emissiveIntensity: 0.35,
            metalness: 0.08,
            roughness: 0.45
        });

        const hullGeometryOptions = {
            sternStart: 0.1,
            sternRound: true,
            sternRoundExponent: 0.95,
            draft: 20.0,
            bowRise: 2.8,
            sternRise: 1.3
        };
        const hullGeometry = createHullGeometry(hullGeometryOptions);

        const hull = markBreakMode(new THREE.Mesh(hullGeometry, upperHullMaterial), 'split');
        applyLocalClippingPlane(
            hull,
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -hullPaintSplitY + paintSplitEpsilon)
        );
        hull.position.y = hullPlacementY;
        hull.castShadow = true;
        hull.receiveShadow = true;
        group.add(hull);

        const lowerHull = markBreakMode(new THREE.Mesh(hullGeometry, lowerHullMaterial), 'split');
        applyLocalClippingPlane(
            lowerHull,
            new THREE.Plane(new THREE.Vector3(0, -1, 0), hullPaintSplitY + paintSplitEpsilon)
        );
        lowerHull.position.y = hullPlacementY;
        lowerHull.castShadow = true;
        lowerHull.receiveShadow = true;
        group.add(lowerHull);

        const hullStripeThickness = 0.7;
        const hullStripe = markBreakMode(new THREE.Mesh(createTaperedSlabGeometry({
            length: 221,
            thickness: hullStripeThickness,
            stations: 72,
            halfWidthAtT(t) {
                return Math.max(0, getHullTopHalfWidthAtT(t, hullGeometryOptions) - 0.16);
            },
            centerYAtT(t) {
                return getHullSheerAtT(t, hullGeometryOptions) - 1.1;
            }
        }), whitePaintMaterial), 'split');
        hullStripe.position.y = hullPlacementY;
        hullStripe.castShadow = true;
        hullStripe.receiveShadow = true;
        group.add(hullStripe);

        const mainDeckThickness = 1.4;
        // Slight inset avoids a visible floating seam while keeping the deck visually on the hull.
        const mainDeckSeatInset = 0.05;
        const superstructureDeckReferenceT = (3 / 224) + 0.5;
        const mainDeck = markBreakMode(new THREE.Mesh(createTaperedSlabGeometry({
            length: 224,
            thickness: mainDeckThickness,
            stations: 72,
            halfWidthAtT(t) {
                // Slight inset keeps the deck edge just inside the hull lip.
                return Math.max(0, getHullTopHalfWidthAtT(t, hullGeometryOptions) - 0.45);
            },
            centerYAtT(t) {
                return getHullSheerAtT(t, hullGeometryOptions) - mainDeckSeatInset;
            }
        }), deckMaterial), 'split');
        mainDeck.position.y = hullPlacementY;
        mainDeck.castShadow = true;
        mainDeck.receiveShadow = true;
        group.add(mainDeck);

        const superstructureHeight = 4.6;
        const superstructureLength = 132;
        const superstructureDeckOverlap = 0.12;
        const superstructureY = hullPlacementY
            + getHullSheerAtT(superstructureDeckReferenceT, hullGeometryOptions)
            - mainDeckSeatInset
            + mainDeckThickness * 0.5
            + superstructureHeight * 0.5
            - superstructureDeckOverlap;
        const superstructure = markBreakMode(new THREE.Mesh(createTaperedSlabGeometry({
            length: superstructureLength,
            centerWidth: 12.8,
            bowWidth: 12.8,
            sternWidth: 12.8,
            thickness: superstructureHeight,
            stations: 72,
            halfWidthAtT() {
                return 6.4; // constant half-width
            },
            centerYAtT() {
                return 0; // constant height, positioned via mesh.position
            }
        }), whitePaintMaterial), 'split');
        superstructure.position.set(0, superstructureY, 3);
        superstructure.castShadow = true;
        group.add(superstructure);

        const hullWindowPanels = [];
        const hullWindowRows = [-2.25, -3.55, -4.85];
        for (let t = 0.11; t <= 0.93; t += 0.022) {
            const halfWidth = getHullTopHalfWidthAtT(t, hullGeometryOptions);
            if (halfWidth < 2.2) {
                continue;
            }

            const z = (t - 0.5) * 224;
            const localX = halfWidth + 0.08;
            for (const rowOffset of hullWindowRows) {
                const y = getHullSheerAtT(t, hullGeometryOptions) + rowOffset;
                hullWindowPanels.push({ x: localX, y, z, halfHeight: 0.1, halfWidth: 0.22, normalSign: 1 });
                hullWindowPanels.push({ x: -localX, y, z, halfHeight: 0.1, halfWidth: 0.22, normalSign: -1 });
            }
        }

        const hullWindows = markBreakMode(new THREE.Mesh(createSideWindowGeometry(hullWindowPanels), windowMaterial), 'split');
        hullWindows.position.y = hullPlacementY;
        group.add(hullWindows);

        const superstructureWindowPanels = [];
        const superstructureWindowRows = [-1.35, -0.15, 1.05];
        for (let z = -58; z <= 58; z += 3.2) {
            const localZ = z + superstructure.position.z;
            const localX = 6.4 + 0.05;
            for (const rowOffset of superstructureWindowRows) {
                const y = superstructureY + rowOffset;
                superstructureWindowPanels.push({ x: localX, y, z: localZ, halfHeight: 0.15, halfWidth: 0.46, normalSign: 1 });
                superstructureWindowPanels.push({ x: -localX, y, z: localZ, halfHeight: 0.15, halfWidth: 0.46, normalSign: -1 });
            }
        }

        const superstructureWindows = markBreakMode(
            new THREE.Mesh(createSideWindowGeometry(superstructureWindowPanels), windowMaterial),
            'split'
        );
        group.add(superstructureWindows);

        const funnelPositions = [50, 20, -10, -40];
        const funnelRake = -0.09;
        const funnelBodyHeight = 22;
        const funnelBaseOverlap = 0.12;
        const superstructureTopY = superstructure.position.y + superstructureHeight * 0.5;
        const funnelBodyY = superstructureTopY + Math.cos(funnelRake) * (funnelBodyHeight * 0.5) - funnelBaseOverlap;
        const funnelTopHeight = 5;
        const funnelCapOverlap = 0.15;
        const topCenterOffset = (funnelBodyHeight + funnelTopHeight) * 0.5 - funnelCapOverlap;
        const funnelBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.2, roughness: 0.75 });
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
        const guideWireMaterial = new THREE.MeshStandardMaterial({ color: 0x3d3d3f, metalness: 0.35, roughness: 0.65 });
        const mastHeight = 56;
        const guideWireAttachRatio = 0.5;
        const guideWireInset = 0.75;
        const guideWireDeckLift = 0.08;
        const guideWireUpAxis = new THREE.Vector3(0, 1, 0);

        function addGuideWire(start, end) {
            const direction = new THREE.Vector3().subVectors(end, start);
            const wireLength = direction.length();
            if (wireLength <= 0.0001) {
                return;
            }

            const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, wireLength, 6), guideWireMaterial);
            wire.position.copy(start).add(end).multiplyScalar(0.5);
            wire.quaternion.setFromUnitVectors(guideWireUpAxis, direction.normalize());
            wire.castShadow = true;
            group.add(wire);
        }

        function addMastGuideWires(mastCenterY, mastZ) {
            const t = THREE.MathUtils.clamp((mastZ / 224) + 0.5, 0, 1);
            const mastBaseY = mastCenterY - mastHeight * 0.5;
            const attachY = mastBaseY + mastHeight * guideWireAttachRatio;
            const attachPoint = new THREE.Vector3(0, attachY, mastZ);
            const deckY = hullPlacementY
                + getHullSheerAtT(t, hullGeometryOptions)
                - mainDeckSeatInset
                + mainDeckThickness * 0.5
                + guideWireDeckLift;
            const guideWireRunDistance = Math.max(2.3, getHullTopHalfWidthAtT(t, hullGeometryOptions) - guideWireInset);
            const foreZ = THREE.MathUtils.clamp(mastZ + guideWireRunDistance, -112, 112);
            const aftZ = THREE.MathUtils.clamp(mastZ - guideWireRunDistance, -112, 112);

            addGuideWire(attachPoint, new THREE.Vector3(0, deckY, foreZ));
            addGuideWire(attachPoint, new THREE.Vector3(0, deckY, aftZ));
        }

        const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, mastHeight, 8), mastMaterial);
        foreMast.position.set(0, 40, 92);
        foreMast.castShadow = true;
        group.add(foreMast);
        addMastGuideWires(foreMast.position.y, foreMast.position.z);

        const aftMast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, mastHeight, 8), mastMaterial);
        aftMast.position.set(0, 36, -86);
        aftMast.castShadow = true;
        group.add(aftMast);
        addMastGuideWires(aftMast.position.y, aftMast.position.z);

        group.castShadow = true;
        group.receiveShadow = true;
        return group;
    }

    global.BoatMeshes.registerBoatMeshBuilder('titanic', createTitanicIntactMesh);
})(window);

