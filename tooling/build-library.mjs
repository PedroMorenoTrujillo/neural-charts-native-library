import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const source = load('package.json');
const compilerPath = 'node_modules/@angular/compiler-cli';
const compiler = load(compilerPath + '/package.json');
const core = source.dependencies['@neural-charts/core'];
assert.match(core, /^\d+\.\d+\.\d+$/);
assert.equal(load('node_modules/@neural-charts/core/package.json').version, core);
assert.equal(source.private, true);
assert.equal(source.license, 'UNLICENSED');

rmSync(join(root, 'dist'), {recursive: true, force: true});
execFileSync(process.execPath, [join(root, compilerPath, compiler.bin.ngc), '-p', 'tsconfig.native.json'], {cwd: root, stdio: 'inherit'});

const manifest = {
  name: source.name,
  version: source.version,
  private: true,
  license: source.license,
  type: 'module',
  description: source.description,
  repository: source.repository,
  homepage: source.homepage,
  exports: {
    '.': {types: './native/index.d.ts', default: './native/index.js'},
    './interaction': {types: './library/index.d.ts', default: './library/index.js'},
    './plan': {types: './native/plan.d.ts', default: './native/plan.js'},
  },
  dependencies: source.dependencies,
  peerDependencies: source.peerDependencies,
  sideEffects: false,
};
writeFileSync(join(root, 'dist/package.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const file of ['README.md', 'THIRD-PARTY-NOTICES.md']) copyFileSync(join(root, file), join(root, 'dist', file));
