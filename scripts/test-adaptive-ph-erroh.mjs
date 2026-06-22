/**
 * Testes da convenção ErroH = Hmedido − Hsetpoint (domínio H = 10^(-pH))
 * Executar: node scripts/test-adaptive-ph-erroh.mjs
 */

function toH(ph) {
  return Math.pow(10, -ph);
}

function errorH(phSetpoint, phMeasured) {
  return toH(phMeasured) - toH(phSetpoint);
}

function selectPath(phSetpoint, phMeasured, tolerancePh) {
  if (Math.abs(phMeasured - phSetpoint) <= tolerancePh) return 'NONE';
  const err = errorH(phSetpoint, phMeasured);
  if (err > 0) return 'BASE'; // pH baixo → pH+
  if (err < 0) return 'ACID'; // pH alto → pH-
  return 'NONE';
}

const tolerance = 0.2;
const sp = 6.0;

const cases = [
  { ph: 5.5, expectPath: 'BASE', label: 'pH baixo → base (pH+)' },
  { ph: 6.5, expectPath: 'ACID', label: 'pH alto → ácido (pH-)' },
  { ph: 6.0, expectPath: 'NONE', label: 'dentro da banda → neutro' },
  { ph: 5.9, expectPath: 'NONE', label: 'dentro da tolerância ±0.2' },
];

let failed = 0;
for (const c of cases) {
  const path = selectPath(sp, c.ph, tolerance);
  const err = errorH(sp, c.ph);
  const ok = path === c.expectPath;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${c.label}: pH=${c.ph} ErroH=${err.toExponential(3)} path=${path}`);
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}
console.log('\nTodos os 4 casos passaram.');
