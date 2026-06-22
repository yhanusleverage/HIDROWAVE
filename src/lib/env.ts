// Next.js solo reemplaza process.env.NEXT_PUBLIC_* cuando el nombre es literal (no dinámico)
function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Variable de entorno obligatoria: ${name}. Copia .env.example a .env.local y rellena tus credenciales de Supabase.`
    );
  }
  return trimmed;
}

const supabaseUrl = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
const supabaseAnonKey = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export { supabaseUrl, supabaseAnonKey };
