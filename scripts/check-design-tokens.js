#!/usr/bin/env node
/**
 * CI helper: falha se houver classes gray-* / blue-* legacy em componentes.
 * Uso: node scripts/check-design-tokens.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'components');
const LEGACY = /\b(text|bg|border|hover:bg|hover:text|from|to)-(gray|blue)-/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(path.join(__dirname, '..'), file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (LEGACY.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}

if (violations.length) {
  console.error('Legacy gray/blue classes found in components:\n');
  violations.forEach((v) => console.error(v));
  process.exit(1);
}

console.log('OK: no legacy gray/blue utility classes in src/components');
