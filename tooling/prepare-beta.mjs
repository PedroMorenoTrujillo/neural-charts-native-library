import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const [input, destination] = process.argv.slice(2);
assert(input && destination, 'Usage: node prepare-beta.mjs DIST NEW_DESTINATION');
const dist = realpathSync(input);
const output = resolve(destination);
assert(!existsSync(output), 'Destination must be new');
assert(!output.startsWith(dist + '/'), 'Destination cannot be inside the source build');

const metadata = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'));
assert.equal(metadata.name, '@neural-charts/native');
assert.match(metadata.version, /^\d+\.\d+\.\d+-beta\.\d+$/);
assert.equal(metadata.private, true, 'Use a regular verified private dist build as input');
assert.equal(metadata.license, 'UNLICENSED');
assert.deepEqual(Object.keys(metadata.dependencies), ['@neural-charts/core']);
const core = metadata.dependencies['@neural-charts/core'];
assert.match(core, /^\d+\.\d+\.\d+$/, 'Build Native against a published stable Core release');
assert.deepEqual(Object.keys(metadata.exports).sort(), ['.', './interaction', './plan']);
for (const exported of Object.values(metadata.exports)) {
  for (const entry of Object.values(exported)) {
    assert(/^\.\/(?:native|library)\/[A-Za-z0-9/_-]+(?:\.d\.ts|\.js)$/.test(entry), 'Unexpected export: ' + entry);
    assert(lstatSync(join(dist, entry)).isFile());
  }
}
const readme = readFileSync(join(dist, 'README.md'), 'utf8');
assert(readme.includes('npm install @neural-charts/native@beta'), 'Beta install command missing');

function verifyRuntimeTree(folder) {
  for (const name of readdirSync(folder)) {
    const item = join(folder, name);
    const stat = lstatSync(item);
    assert(!stat.isSymbolicLink(), 'Unexpected symbolic link in dist: ' + item);
    if (stat.isDirectory()) verifyRuntimeTree(item);
    else {
      assert(stat.isFile());
      assert(/(?:\.js|\.d\.ts)(?:\.map)?$/.test(name), 'Unexpected compiled output: ' + item);
      if (name.endsWith('.map')) {
        const map = JSON.parse(readFileSync(item, 'utf8'));
        assert(!map.sourcesContent?.some(Boolean), 'Source map contains original code: ' + item);
        assert(map.sources.every(source => !/^(?:[/\\]|file:|[A-Z]:[/\\])/i.test(source)), 'Source map contains an absolute path: ' + item);
      }
    }
  }
}

verifyRuntimeTree(join(dist, 'native'));
verifyRuntimeTree(join(dist, 'library'));
for (const name of ['README.md', 'THIRD-PARTY-NOTICES.md']) assert(lstatSync(join(dist, name)).isFile());

mkdirSync(output);
const candidate = join(output, 'dist');
const archiveDir = join(output, 'archive');
mkdirSync(candidate, {recursive: true});
mkdirSync(archiveDir);
try {
  for (const name of ['native', 'library', 'README.md', 'THIRD-PARTY-NOTICES.md']) {
    cpSync(join(dist, name), join(candidate, name), {recursive: true, errorOnExist: true, force: false});
  }
  delete metadata.scripts;
  delete metadata.private;
  metadata.repository = {type: 'git', url: 'git+https://github.com/PedroMorenoTrujillo/neural-charts-native-library.git'};
  metadata.files = ['native', 'library', 'README.md', 'THIRD-PARTY-NOTICES.md'];
  metadata.publishConfig = {access: 'public', tag: 'beta', registry: 'https://registry.npmjs.org/'};
  writeFileSync(join(candidate, 'package.json'), JSON.stringify(metadata, null, 2) + '\n');

  const packResult = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', archiveDir], {cwd: candidate, encoding: 'utf8'});
  const [pack] = JSON.parse(packResult);
  assert.equal(pack.name, metadata.name);
  assert.equal(pack.version, metadata.version);
  const filenames = pack.files.map(file => file.path).sort();
  for (const name of filenames) {
    assert(/^(?:README\.md|THIRD-PARTY-NOTICES\.md|package\.json|(?:native|library)\/[\w./-]+\.(?:js|d\.ts)(?:\.map)?)$/.test(name) && !name.includes('..'), 'Unexpected archive file: ' + name);
  }
  const archive = join(archiveDir, pack.filename);
  const bytes = readFileSync(archive);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  assert.equal(integrity, pack.integrity);
  const receipt = {name: pack.name, version: pack.version, channel: 'beta', core, archive, sha256, integrity, files: filenames.length};
  writeFileSync(join(output, 'archive-files.txt'), filenames.join('\n') + '\n');
  writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(receipt);
} catch (error) {
  rmSync(output, {recursive: true, force: true});
  throw error;
}
