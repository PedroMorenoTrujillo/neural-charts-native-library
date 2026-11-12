import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const [archive] = process.argv.slice(2);
assert(archive, 'Usage: node tooling/verify-consumer.mjs CHARTS_ARCHIVE');

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const charts = manifest.name;
const native = '@neural-ui/native';
const nativeVersion = '0.1.0-beta.7';
const root = mkdtempSync(join(tmpdir(), 'neural-charts-consumer-'));
const writeJson = (name, value) => writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n');
try {
  const host = Object.fromEntries(
    [...Object.keys(manifest.peerDependencies), '@angular/compiler', 'react']
      .map(name => {
        const version = manifest.devDependencies[name];
        assert(version, 'Missing tested consumer dependency: ' + name);
        return [name, version];
      }),
  );
  const compiler = {'@angular/compiler-cli': manifest.devDependencies['@angular/compiler-cli'],
    typescript: manifest.devDependencies.typescript};
  writeJson('package.json', {
    name: 'neural-charts-consumer',
    private: true,
    type: 'module',
    dependencies: {...host, [charts]: 'file:' + resolve(archive), [native]: nativeVersion},
    devDependencies: compiler,
  });
  writeJson('tsconfig.json', {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    angularCompilerOptions: {strictTemplates: true},
    files: ['chart-screen.ts'],
  });
  copyFileSync(new URL('../test/consumer/chart-screen.ts', import.meta.url), join(root, 'chart-screen.ts'));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-legacy-peer-deps',
    '--no-force', '--no-audit', '--no-fund'], {cwd: root, stdio: 'inherit', timeout: 240_000});

  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  for (const [name, version] of Object.entries({...host, [charts]: manifest.version, [native]: nativeVersion})) {
    assert.equal(lock.packages['node_modules/' + name]?.version, version, name);
    for (const [location, entry] of Object.entries(lock.packages)) {
      if (location.endsWith('/node_modules/' + name)) assert.equal(entry.version, version, location);
    }
  }
  const installedCompiler = JSON.parse(readFileSync(join(root, 'node_modules/@angular/compiler-cli/package.json'), 'utf8'));
  execFileSync(process.execPath, [join(root, 'node_modules/@angular/compiler-cli', installedCompiler.bin.ngc),
    '-p', 'tsconfig.json'], {cwd: root, stdio: 'inherit', timeout: 60_000});
  console.log(charts + '@' + manifest.version + ' and ' + native + '@' + nativeVersion +
    ' install together with npm peer resolution and compile the consumer chart screen.');
} finally {
  rmSync(root, {recursive: true, force: true});
}
