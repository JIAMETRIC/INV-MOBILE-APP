// Verifies the integer-paise money core compiled from TypeScript sources,
// mirroring desktop rules from backend/services/record_service.py.
// Run from the mobile/ directory: npm run test:money
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const outDir = path.join(root, '.tmp-money-test');

execFileSync('npx', ['tsc', '--ignoreConfig', 'src/data/money.ts', 'src/data/types.ts',
  '--outDir', outDir, '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2020', '--skipLibCheck'], { stdio: 'inherit', shell: true });

const m = require(path.join(outDir, 'money.js'));

let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
};

t('roundHalfUp basic', () => {
  assert.equal(m.roundHalfUp(2.5), 3);
  assert.equal(m.roundHalfUp(2.4999), 2);
  assert.equal(m.roundHalfUp(-0.5), 0);
});

t('line paise: qty x integer rate', () => {
  assert.equal(m.linePaise(3, 150050), 450150);
  assert.equal(m.linePaise(2.5, 20000), 50000);
  assert.equal(m.linePaise(1, 1), 1);
});

t('plain totals: gross minus discount, rupee round-off', () => {
  const lines = [
    { sno: 1, product_id: null, description: 'Design', qty: 1, unit_paise: 150000, line_paise: 150000 },
    { sno: 2, product_id: null, description: 'Hosting', qty: 2, unit_paise: 20000, line_paise: 40000 },
  ];
  const tot = m.computeTotals(lines, 0);
  assert.equal(tot.gross, 190000);
  assert.equal(tot.discount, 0);
  assert.equal(tot.net, 190000);
  assert.equal(tot.total, 190000);
  assert.equal(tot.roundOff, 0);
});

t('discount + round-off behaviour', () => {
  const lines = [{ sno: 1, product_id: null, description: 'x', qty: 7, unit_paise: 9950, line_paise: 69650 }];
  const tot = m.computeTotals(lines, 10);
  assert.equal(tot.gross, 69650);
  assert.equal(tot.discount, 6965);
  assert.equal(tot.net, 62685);
  // raw 626.85 → Math.round half-up at rupee level = 627.00, round-off +0.15
  assert.equal(tot.total, 62700);
  assert.equal(tot.roundOff, 15);
});

t('full discount collapses to zero', () => {
  const lines = [{ sno: 1, product_id: null, description: 'x', qty: 1, unit_paise: 50000, line_paise: 50000 }];
  const tot = m.computeTotals(lines, 100);
  assert.equal(tot.net, 0);
  assert.equal(tot.total, 0);
  assert.equal(tot.roundOff, 0);
});

t('Indian amount in words', () => {
  assert.equal(m.numberToWordsIndian(190000), 'Rupees One Thousand Nine Hundred Only');
  assert.equal(m.numberToWordsIndian(10000000), 'Rupees One Lakh Only');
  assert.equal(m.numberToWordsIndian(1000000000), 'Rupees One Crore Only');
  assert.equal(m.numberToWordsIndian(123456789), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven And Eighty Nine Paise Only');
});

t('formatting and numbering', () => {
  assert.equal(m.formatInvoiceNo('PRE-', 42), 'PRE-042');
  assert.equal(m.formatPaise(1234567), '12,345.67');
  assert.equal(m.formatPaise(190000, true), '₹1,900.00');
});

rmSync(outDir, { recursive: true, force: true });
if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log('All money-core tests passed.');
