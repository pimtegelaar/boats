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

    function createHullGeometry(options) {
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
            sternExponent = 1.2
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

            let halfWidth = centerHalf;
            if (t > bowStart) {
                const bowT = (t - bowStart) / (1 - bowStart);
                halfWidth = THREE.MathUtils.lerp(centerHalf, bowHalf, Math.pow(bowT, bowExponent));
            } else if (t < sternStart) {
                const sternT = (sternStart - t) / sternStart;
                halfWidth = THREE.MathUtils.lerp(centerHalf, sternHalf, Math.pow(sternT, sternExponent));
            }

            vertices.push(-halfWidth, halfThickness, z);
            vertices.push(halfWidth, halfThickness, z);
            vertices.push(-halfWidth, -halfThickness, z);
            vertices.push(halfWidth, -halfThickness, z);

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

    function markBreakMode(mesh, breakMode) {
        mesh.userData.breakMode = breakMode;
        return mesh;
    }

    function createTitanicIntactMesh() {
        const group = new THREE.Group();

        const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.45, roughness: 0.55 });
        const lowerHullMaterial = new THREE.MeshStandardMaterial({ color: 0xb63a36, metalness: 0.25, roughness: 0.7 });
        const whitePaintMaterial = new THREE.MeshStandardMaterial({ color: 0xf1efe9, metalness: 0.15, roughness: 0.8 });
        const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x9f8660, metalness: 0.1, roughness: 0.85 });

        const hull = markBreakMode(new THREE.Mesh(createHullGeometry(), hullMaterial), 'split');
        hull.position.y = 11.1;
        hull.castShadow = true;
        hull.receiveShadow = true;
        group.add(hull);

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

        const superstructureHeight = 4.6;
        const superstructureLength = 132;
        const superstructureDeckOverlap = 0.12;
        const superstructureY = mainDeckY + mainDeckThickness * 0.5 + superstructureHeight * 0.5 - superstructureDeckOverlap;
        const superstructure = markBreakMode(new THREE.Mesh(new THREE.BoxGeometry(12.8, superstructureHeight, superstructureLength), whitePaintMaterial), 'split');
        superstructure.position.set(0, superstructureY, 3);
        superstructure.castShadow = true;
        group.add(superstructure);

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
        return group;
    }

    global.BoatMeshes.registerBoatMeshBuilder('titanic', createTitanicIntactMesh);
})(window);

