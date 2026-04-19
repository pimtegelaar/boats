#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function toPascalCase(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');
}

function sanitizeFunctionName(name, fallback) {
    const cleaned = String(name || '')
        .replace(/[^a-zA-Z0-9_$]/g, '_')
        .replace(/^[^a-zA-Z_$]+/, '');
    return cleaned || fallback;
}

function printHelp() {
    console.log([
        'Usage:',
        '  npm run convert:stl -- --input <file.stl> --output <generated.js> [options]',
        '',
        'Options:',
        '  --input, -i         STL file path (required)',
        '  --output, -o        Output JavaScript file path (required)',
        '  --mesh-type         BoatMeshes registration key (default: stlMesh)',
        '  --function-name     Exported function name (default: create<MeshType>Mesh)',
        '  --scale             Uniform scale factor (default: 1)',
        '  --center            Center vertices around origin',
        '  --material-color    Hex color for default material, e.g. 0xffaa00',
        '  --no-register       Skip auto registration to window.BoatMeshes',
        '  --help, -h          Show this help message'
    ].join('\n'));
}

function parseArgs(argv) {
    const options = {
        input: '',
        output: '',
        meshType: 'stlMesh',
        functionName: '',
        scale: 1,
        center: false,
        register: true,
        materialColor: '0xaaaaaa'
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            return options;
        }

        if (arg === '--input' || arg === '-i') {
            options.input = argv[++i] || '';
            continue;
        }
        if (arg === '--output' || arg === '-o') {
            options.output = argv[++i] || '';
            continue;
        }
        if (arg === '--mesh-type') {
            options.meshType = argv[++i] || options.meshType;
            continue;
        }
        if (arg === '--function-name') {
            options.functionName = argv[++i] || options.functionName;
            continue;
        }
        if (arg === '--scale') {
            const value = Number(argv[++i]);
            if (!Number.isFinite(value) || value === 0) {
                throw new Error('--scale must be a finite non-zero number.');
            }
            options.scale = value;
            continue;
        }
        if (arg === '--center') {
            options.center = true;
            continue;
        }
        if (arg === '--material-color') {
            const rawColor = (argv[++i] || '').trim();
            if (!/^0x[0-9a-fA-F]{1,6}$/.test(rawColor)) {
                throw new Error('--material-color must look like 0xffaa00.');
            }
            options.materialColor = rawColor.toLowerCase();
            continue;
        }
        if (arg === '--no-register') {
            options.register = false;
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    if (!options.input) {
        throw new Error('Missing required --input argument.');
    }
    if (!options.output) {
        throw new Error('Missing required --output argument.');
    }

    if (!options.functionName) {
        const pascalType = toPascalCase(options.meshType) || 'Stl';
        options.functionName = sanitizeFunctionName('create' + pascalType + 'Mesh', 'createStlMesh');
    } else {
        options.functionName = sanitizeFunctionName(options.functionName, 'createStlMesh');
    }

    return options;
}

function vectorLength(x, y, z) {
    return Math.sqrt((x * x) + (y * y) + (z * z));
}

function computeFaceNormal(a, b, c) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];

    const acx = c[0] - a[0];
    const acy = c[1] - a[1];
    const acz = c[2] - a[2];

    let nx = (aby * acz) - (abz * acy);
    let ny = (abz * acx) - (abx * acz);
    let nz = (abx * acy) - (aby * acx);

    const length = vectorLength(nx, ny, nz);
    if (length <= 1e-8) {
        return [0, 1, 0];
    }

    nx /= length;
    ny /= length;
    nz /= length;
    return [nx, ny, nz];
}

function parseBinaryStl(buffer) {
    const triangleCount = buffer.readUInt32LE(80);
    const triangles = [];
    let offset = 84;

    for (let i = 0; i < triangleCount; i++) {
        const normal = [
            buffer.readFloatLE(offset),
            buffer.readFloatLE(offset + 4),
            buffer.readFloatLE(offset + 8)
        ];
        offset += 12;

        const vertices = [];
        for (let v = 0; v < 3; v++) {
            vertices.push([
                buffer.readFloatLE(offset),
                buffer.readFloatLE(offset + 4),
                buffer.readFloatLE(offset + 8)
            ]);
            offset += 12;
        }

        offset += 2; // attribute byte count
        triangles.push({ normal, vertices });
    }

    return triangles;
}

function parseAsciiStl(text) {
    const lines = text.split(/\r?\n/);
    const triangles = [];
    let currentNormal = null;
    let currentVertices = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        if (trimmed.startsWith('facet normal')) {
            const parts = trimmed.split(/\s+/);
            currentNormal = [Number(parts[2]), Number(parts[3]), Number(parts[4])];
            currentVertices = [];
            continue;
        }

        if (trimmed.startsWith('vertex')) {
            const parts = trimmed.split(/\s+/);
            currentVertices.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
            continue;
        }

        if (trimmed.startsWith('endfacet')) {
            if (currentVertices.length === 3) {
                triangles.push({ normal: currentNormal || [0, 0, 0], vertices: currentVertices });
            }
            currentNormal = null;
            currentVertices = [];
        }
    }

    if (triangles.length === 0) {
        throw new Error('No triangles found in ASCII STL file.');
    }

    return triangles;
}

function parseStl(buffer) {
    if (buffer.length >= 84) {
        const triangleCount = buffer.readUInt32LE(80);
        const expectedLength = 84 + (triangleCount * 50);
        if (expectedLength === buffer.length) {
            return parseBinaryStl(buffer);
        }
    }

    return parseAsciiStl(buffer.toString('utf8'));
}

function buildGeometryData(triangles, options) {
    const positions = [];
    const normals = [];
    const scale = options.scale;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const triangle of triangles) {
        const scaled = triangle.vertices.map((vertex) => {
            const x = vertex[0] * scale;
            const y = vertex[1] * scale;
            const z = vertex[2] * scale;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);

            return [x, y, z];
        });

        let normal = triangle.normal || [0, 0, 0];
        if (!Number.isFinite(normal[0]) || !Number.isFinite(normal[1]) || !Number.isFinite(normal[2]) || vectorLength(normal[0], normal[1], normal[2]) <= 1e-8) {
            normal = computeFaceNormal(scaled[0], scaled[1], scaled[2]);
        }

        for (let i = 0; i < 3; i++) {
            positions.push(scaled[i][0], scaled[i][1], scaled[i][2]);
            normals.push(normal[0], normal[1], normal[2]);
        }
    }

    if (options.center) {
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const cz = (minZ + maxZ) * 0.5;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] -= cx;
            positions[i + 1] -= cy;
            positions[i + 2] -= cz;
        }
    }

    return { positions, normals };
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return '0';
    }
    const rounded = Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6));
    return String(rounded);
}

function formatArray(values, chunkSize) {
    if (values.length === 0) {
        return '[]';
    }

    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        const section = values.slice(i, i + chunkSize).map(formatNumber).join(', ');
        chunks.push('        ' + section);
    }

    return '[\n' + chunks.join(',\n') + '\n    ]';
}

function emitJsModule(data, options, sourceFileName) {
    const positionsLiteral = formatArray(data.positions, 9);
    const normalsLiteral = formatArray(data.normals, 9);
    const registrationBlock = options.register
        ? [
            '    if (global.BoatMeshes && typeof global.BoatMeshes.registerBoatMeshBuilder === "function") {',
            `        global.BoatMeshes.registerBoatMeshBuilder(${JSON.stringify(options.meshType)}, ${options.functionName});`,
            '    }'
        ].join('\n')
        : '';

    return [
        '(function initGeneratedStlMesh(global) {',
        '    // Generated by scripts/stl-to-threejs.js',
        `    // Source STL: ${sourceFileName}`,
        `    const POSITIONS = ${positionsLiteral};`,
        `    const NORMALS = ${normalsLiteral};`,
        '',
        `    function ${options.functionName}(options) {`,
        '        const geometry = new THREE.BufferGeometry();',
        '        geometry.setAttribute("position", new THREE.Float32BufferAttribute(POSITIONS, 3));',
        '        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(NORMALS, 3));',
        '        geometry.computeBoundingBox();',
        '        geometry.computeBoundingSphere();',
        '',
        '        const resolvedOptions = options || {};',
        `        const material = resolvedOptions.material || new THREE.MeshStandardMaterial({ color: resolvedOptions.color || ${options.materialColor}, metalness: 0.2, roughness: 0.7 });`,
        '        const mesh = new THREE.Mesh(geometry, material);',
        '        mesh.castShadow = true;',
        '        mesh.receiveShadow = true;',
        '        return mesh;',
        '    }',
        '',
        `    global.${options.functionName} = ${options.functionName};`,
        '    if (!global.GeneratedBoatMeshes) {',
        '        global.GeneratedBoatMeshes = Object.create(null);',
        '    }',
        `    global.GeneratedBoatMeshes[${JSON.stringify(options.meshType)}] = ${options.functionName};`,
        registrationBlock,
        '})(typeof window !== "undefined" ? window : globalThis);',
        ''
    ].filter(Boolean).join('\n');
}

function convertStlToThreeJs(options) {
    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    if (!fs.existsSync(inputPath)) {
        throw new Error('Input file does not exist: ' + inputPath);
    }

    const buffer = fs.readFileSync(inputPath);
    const triangles = parseStl(buffer);
    const geometryData = buildGeometryData(triangles, options);
    const jsSource = emitJsModule(geometryData, options, path.basename(inputPath));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, jsSource, 'utf8');

    return {
        inputPath,
        outputPath,
        triangleCount: triangles.length,
        vertexCount: geometryData.positions.length / 3
    };
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2));
        if (options.help) {
            printHelp();
            process.exit(0);
        }

        const result = convertStlToThreeJs(options);
        console.log('Generated ' + path.basename(result.outputPath) + ' from ' + path.basename(result.inputPath) + '.');
        console.log('Triangles: ' + result.triangleCount + ', vertices: ' + result.vertexCount);
        console.log('Output: ' + result.outputPath);
    } catch (error) {
        console.error('STL conversion failed: ' + error.message);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    parseStl,
    convertStlToThreeJs
};

