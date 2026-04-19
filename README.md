# Boats Utilities

This repo now includes a converter that turns an STL file into a JavaScript file that builds a `THREE.Mesh`.

## Setup

```powershell
cd D:\git\boats
npm install
```

## Convert STL to JavaScript mesh

```powershell
npm run convert:stl -- --input .\path\to\model.stl --output .\generated\ModelMesh.js --mesh-type modelMesh --center --scale 1
```

### Useful options

- `--function-name createMyMesh` sets the global function name.
- `--material-color 0xffaa00` sets default mesh color.
- `--no-register` avoids automatic `BoatMeshes` registration.

The generated file exports a global mesh factory function and, by default, registers it in `window.BoatMeshes` when available.

## Quick smoke test

```powershell
npm run test:stl-converter
```

