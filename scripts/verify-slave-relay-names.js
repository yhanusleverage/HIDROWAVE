/**
 * Verifica relay_names persistidos em relay_slaves (pós-fix master não sobrescreve).
 * Uso: EXPECTED_NAME="Mi Bomba" RELAY_INDEX=0 SLAVE_MAC=14:33:5C:38:BF:60 node scripts/verify-slave-relay-names.js
 */
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mac = (process.env.SLAVE_MAC || '14:33:5C:38:BF:60').toUpperCase();
const relayIndex = parseInt(process.env.RELAY_INDEX || '0', 10);
const expectedName = process.env.EXPECTED_NAME?.trim();

if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou anon)');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('relay_slaves')
    .select('device_id, slave_mac_address, relay_names, relay_states, last_update')
    .ilike('slave_mac_address', `%${mac.replace(/:/g, '%')}%`);

  if (error) {
    console.error('❌', error.message);
    process.exit(1);
  }

  if (!data?.length) {
    console.error(`❌ Sin fila relay_slaves para MAC ${mac}`);
    process.exit(1);
  }

  for (const row of data) {
    const names = row.relay_names || [];
    const saved = names[relayIndex] && String(names[relayIndex]).trim();
    console.log(
      JSON.stringify(
        {
          device_id: row.device_id,
          slave_mac_address: row.slave_mac_address,
          relay_index: relayIndex,
          relay_name: saved || null,
          relay_names: names,
          last_update: row.last_update,
        },
        null,
        2
      )
    );

    if (expectedName) {
      if (saved === expectedName) {
        console.log(`✅ relay_names[${relayIndex}] = "${expectedName}"`);
        process.exit(0);
      }
      console.error(
        `❌ Esperado "${expectedName}", obtido "${saved || '(vazio)'}"`
      );
      process.exit(2);
    }
  }

  console.log('ℹ️ Sem EXPECTED_NAME — apenas listagem');
  process.exit(0);
}

main();
