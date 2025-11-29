#!/usr/bin/env node

console.log('🔍 DIAGNÓSTICO DE DEPLOYMENT - HIDROWAVE');
console.log('=====================================\n');

// 1. Verificar variables de entorno
console.log('📋 VARIABLES DE ENTORNO:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ NO DEFINIDA');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ DEFINIDA' : '❌ NO DEFINIDA');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');

// 2. Verificar dependencias críticas
console.log('📦 VERIFICANDO DEPENDENCIAS:');
try {
  require('@supabase/supabase-js');
  console.log('✅ @supabase/supabase-js: OK');
} catch (e) {
  console.log('❌ @supabase/supabase-js: ERROR -', e.message);
}

try {
  require('next');
  console.log('✅ next: OK');
} catch (e) {
  console.log('❌ next: ERROR -', e.message);
}

try {
  require('react');
  console.log('✅ react: OK');
} catch (e) {
  console.log('❌ react: ERROR -', e.message);
}

try {
  require('tailwindcss');
  console.log('✅ tailwindcss: OK');
} catch (e) {
  console.log('❌ tailwindcss: ERROR -', e.message);
}

console.log('');

// 3. Verificar archivos críticos
const fs = require('fs');
const path = require('path');

console.log('📁 VERIFICANDO ARCHIVOS CRÍTICOS:');
const criticalFiles = [
  'package.json',
  'next.config.js',
  'tailwind.config.js',
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/lib/supabase.ts'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: OK`);
  } else {
    console.log(`❌ ${file}: NO ENCONTRADO`);
  }
});

console.log('');

// 4. Verificar configuración de Supabase
console.log('🗄️ CONFIGURACIÓN DE SUPABASE:');
try {
  const supabaseConfig = require('./src/lib/supabase.ts');
  console.log('✅ Archivo de configuración de Supabase: OK');
} catch (e) {
  console.log('❌ Error en configuración de Supabase:', e.message);
}

console.log('');
console.log('🎯 RECOMENDACIONES:');
console.log('1. Verifica que las variables de entorno estén configuradas en Vercel');
console.log('2. Revisa los logs de build en Vercel Dashboard');
console.log('3. Asegúrate de que todas las dependencias estén instaladas');
console.log('4. Verifica que no haya errores de sintaxis en los archivos'); 