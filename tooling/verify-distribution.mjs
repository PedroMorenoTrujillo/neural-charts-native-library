import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/package.json'), 'utf8'));
assert.equal(manifest.private, true);
assert.equal(manifest.license, 'UNLICENSED');
assert.equal(manifest.repository.url,'git+https://github.com/PedroMorenoTrujillo/neural-charts-native-library.git');
for (const [key, conditions] of Object.entries(manifest.exports)) for (const file of Object.values(conditions)) {
  assert.ok(fs.existsSync(path.join(root, 'dist', file)), `${key} -> ${file}`);
}
for (const file of fs.readdirSync(path.join(root, 'dist/library')).filter(x => x.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(root, 'dist/library', file), 'utf8');
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const forbidden = new Set(['document', 'HTMLElement', 'window', 'require', 'Angular']);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.Identifier) {
      assert.ok(!forbidden.has(scanner.getTokenText()), file + ' is not host independent: ' + scanner.getTokenText());
    }
  }
  const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(imports.every(i => i.startsWith('./') && i.endsWith('.js')), 'External runtime dependency: ' + imports);
}
const api = await import(pathToFileURL(path.join(root, 'dist/library/index.js')));
const planner = await import(pathToFileURL(path.join(root,'dist/native/plan.js')));
assert.equal(typeof planner.planNativeChart,'function');
assert.equal(planner.planNativeChart({family:'line'},{width:390,height:300}).status,'invalid');
assert.equal(manifest.dependencies['@neural-charts/core'],JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies['@neural-charts/core']);
assert.equal(manifest.dependencies['@neural-charts/core'],JSON.parse(fs.readFileSync(path.join(root,'node_modules/@neural-charts/core/package.json'),'utf8')).version);
assert.equal(manifest.peerDependencies['@neural-charts/core'],undefined);
assert.equal(typeof api.NativeChartSession, 'function');
assert.equal(api.identityKey({seriesId: 's', pointId: 'p'}), '["s","p"]');
for (const file of ['dist/native/chart.js', 'dist/native/haptics.js']) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/from ['"][^'"]+\.ts['"]/.test(text), 'Unrewritten TypeScript specifier');
  assert.ok(!text.includes('/Users/') && !text.includes('/private/tmp/'), 'Private absolute source import');
}
console.log('JavaScript distribution imports in Node without DOM; exports/declarations/private policy and zero-dependency interaction verified.');
