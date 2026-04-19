const fs = require('fs');
const os = require('os');
const path = require('path');

const { convertStlToThreeJs } = require('./stl-to-threejs');

const sampleStl = [
    'solid quad',
    '  facet normal 0 0 1',
    '    outer loop',
    '      vertex 0 0 0',
    '      vertex 1 0 0',
    '      vertex 1 1 0',
    '    endloop',
    '  endfacet',
    '  facet normal 0 0 1',
    '    outer loop',
    '      vertex 0 0 0',
    '      vertex 1 1 0',
    '      vertex 0 1 0',
    '    endloop',
    '  endfacet',
    'endsolid quad',
    ''
].join('\n');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stl-to-threejs-'));
const inputPath = path.join(tempRoot, 'quad.stl');
const outputPath = path.join(tempRoot, 'QuadMesh.js');

fs.writeFileSync(inputPath, sampleStl, 'utf8');

const result = convertStlToThreeJs({
    input: inputPath,
    output: outputPath,
    meshType: 'smokeQuad',
    functionName: 'createSmokeQuadMesh',
    scale: 2,
    center: true,
    register: true,
    materialColor: '0xffaa00'
});

const generated = fs.readFileSync(outputPath, 'utf8');
if (!generated.includes('function createSmokeQuadMesh')) {
    throw new Error('Generated file missing expected function declaration.');
}
if (!generated.includes('registerBoatMeshBuilder("smokeQuad"')) {
    throw new Error('Generated file missing BoatMeshes registration.');
}

console.log('Smoke test passed.');
console.log('Triangles: ' + result.triangleCount + ', vertices: ' + result.vertexCount);
console.log('Generated file: ' + outputPath);

