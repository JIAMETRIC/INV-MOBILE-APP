// Unit tests for the <Columns> layout decision (src/ui/columnsMode.ts).
// Run: node scripts/run-columns-tests.mjs
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const outDir = path.join(process.cwd(), '.tmp-columns');

execFileSync('npx', ['tsc', '--ignoreConfig', 'src/ui/columnsMode.ts',
  '--outDir', outDir, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck'],
  { stdio: 'inherit', shell: true });

const { columnsMode, CELL_MIN } = require(path.join(outDir, 'ui', 'columnsMode.js'));

let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
};
const phone = { width: 360, gap: 12, side: 20, bp: 'sm' };
const tablet = { width: 800, gap: 12, side: 20, bp: 'lg' };

t('2 inputs on a 360 phone stay side by side', () =>
  assert.equal(columnsMode({ ...phone, n: 2, minCell: CELL_MIN.input }), 'row'));
t('4 icon buttons on a 360 phone stay side by side (71 >= 44)', () =>
  assert.equal(columnsMode({ ...phone, n: 4, minCell: CELL_MIN.touch }), 'row'));
t('4 inputs on a 360 phone wrap (2 + 2) when wrap is on', () =>
  assert.equal(columnsMode({ ...phone, n: 4, minCell: CELL_MIN.input, wrap: true }), 'wrap'));
t('4 inputs on a 360 phone stack when wrap is off', () =>
  assert.equal(columnsMode({ ...phone, n: 4, minCell: CELL_MIN.input }), 'stack'));
t('3 inputs on a 360 phone wrap too (2 fit per line)', () =>
  assert.equal(columnsMode({ ...phone, n: 3, minCell: CELL_MIN.input, wrap: true }), 'wrap'));
t('4 inputs on an 800 tablet come back to one row', () =>
  assert.equal(columnsMode({ ...tablet, n: 4, minCell: CELL_MIN.input, wrap: true }), 'row'));
t('stackAt="sm" stacks on sm and xs, not on md', () => {
  assert.equal(columnsMode({ ...phone, n: 2, minCell: 44, stackAt: 'sm' }), 'stack');
  assert.equal(columnsMode({ ...phone, n: 2, minCell: 44, stackAt: 'sm', bp: 'xs' }), 'stack');
  assert.equal(columnsMode({ ...phone, n: 2, minCell: 44, stackAt: 'sm', bp: 'md', width: 600 }), 'row');
});
t('a 320 xs phone keeps 2 inputs side by side (134 >= 128)', () =>
  assert.equal(columnsMode({ ...phone, width: 320, bp: 'xs', n: 2, minCell: CELL_MIN.input }), 'row'));
t('wrap falls back to stack when not even 2 cells fit', () =>
  assert.equal(columnsMode({ ...phone, width: 280, bp: 'xs', n: 3, minCell: 128, wrap: true }), 'stack'));
t('a single child is always a row', () =>
  assert.equal(columnsMode({ ...phone, n: 1, minCell: 999 }), 'row'));

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `${failed} columns test(s) failed` : 'All columns tests passed.');
process.exit(failed ? 1 : 0);
