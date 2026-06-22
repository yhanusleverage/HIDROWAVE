/**
 * Verifica fórmulas de diluição EC (espelho EcDilutionController / ec-dilution.ts).
 * Uso: node scripts/verify-ec-dilution-formula.js
 */

function needsDilution(sp, ec, tolerance) {
  if (!Number.isFinite(sp) || !Number.isFinite(ec) || sp <= 0 || ec <= 0) return false;
  return ec - sp > tolerance;
}

function calcDrainVolumeL(sp, ec, tankVolumeL) {
  if (tankVolumeL <= 0 || ec <= sp || sp <= 0 || ec <= 0) return 0;
  const fraction = 1 - sp / ec;
  if (fraction <= 0) return 0;
  return tankVolumeL * fraction;
}

let failed = 0;

function assertClose(label, actual, expected, eps = 0.01) {
  if (Math.abs(actual - expected) > eps) {
    console.error(`FAIL ${label}: got ${actual}, expected ${expected}`);
    failed++;
  } else {
    console.log(`OK   ${label}`);
  }
}

function assertBool(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: got ${actual}, expected ${expected}`);
    failed++;
  } else {
    console.log(`OK   ${label}`);
  }
}

// Plano: V=100, SP=555, EC=740 → V ≈ 25 L
assertClose('exemplo plano', calcDrainVolumeL(555, 740, 100), 25, 0.5);

// Sem overshoot
assertClose('sem overshoot', calcDrainVolumeL(555, 555, 100), 0);
assertClose('abaixo SP', calcDrainVolumeL(555, 500, 100), 0);

// needsDilution simétrico à banda
assertBool('overshoot dentro banda', needsDilution(555, 600, 50), false);
assertBool('overshoot fora banda', needsDilution(555, 606, 50), true);
assertBool('deficit', needsDilution(555, 400, 50), false);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}
console.log('\nTodos os testes de fórmula passaram.');
