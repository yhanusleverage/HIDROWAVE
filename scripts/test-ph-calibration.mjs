/**
 * Testes calibragem pH (domínio pH)
 * node scripts/test-ph-calibration.mjs
 */

const MIN_DELTA_PH = 0.05;

function mlPerPhUnitFromDose(mlDosed, phBefore, phAfter) {
  if (mlDosed <= 0) return null;
  const deltaPh = Math.abs(phAfter - phBefore);
  if (deltaPh < MIN_DELTA_PH) return null;
  return mlDosed / deltaPh;
}

function mlPerLiterPerPhUnit(mlPerPhUnit, volumeL) {
  if (volumeL <= 0) return null;
  return mlPerPhUnit / volumeL;
}

const cases = [
  {
    ml: 1.0,
    before: 6.5,
    after: 6.3,
    volume: 100,
    expectMlUnit: 5.0,
    label: 'ácido: 1 ml → Δ0.2',
  },
  {
    ml: 2.0,
    before: 5.8,
    after: 6.0,
    volume: 50,
    expectMlUnit: 10.0,
    label: 'base: 2 ml → Δ0.2',
  },
];

let failed = 0;
for (const c of cases) {
  const mlUnit = mlPerPhUnitFromDose(c.ml, c.before, c.after);
  const mlL = mlPerLiterPerPhUnit(mlUnit, c.volume);
  const ok = Math.abs(mlUnit - c.expectMlUnit) < 0.001;
  if (!ok) failed++;
  console.log(
    `${ok ? '✓' : '✗'} ${c.label}: ${mlUnit?.toFixed(2)} ml/unid, ${mlL?.toFixed(4)} ml/L/unid`
  );
}

const invalid = mlPerPhUnitFromDose(1, 6.0, 6.01);
if (invalid !== null) {
  failed++;
  console.log('✗ ΔpH pequeno deveria retornar null');
} else {
  console.log('✓ ΔpH < 0.05 rejeitado');
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}
console.log('\nTodos os testes passaram.');
