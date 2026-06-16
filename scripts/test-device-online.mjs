/**
 * Tests resolveDeviceOnline — falso offline bridge vs last_seen fresco.
 * Uso: node scripts/test-device-online.mjs
 */

function minutesAgo(min) {
  return new Date(Date.now() - min * 60_000).toISOString();
}

const ONLINE_THRESHOLD_MINUTES = 5;

function isOnlineFromLastSeen(lastSeen, thresholdMinutes = ONLINE_THRESHOLD_MINUTES) {
  if (!lastSeen) return false;
  const minutes = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  return minutes < thresholdMinutes;
}

function resolveDeviceOnline(row) {
  if (row.last_seen && isOnlineFromLastSeen(row.last_seen)) {
    return true;
  }
  if (row.is_online === false) return false;
  if (!row.last_seen) return false;
  return isOnlineFromLastSeen(row.last_seen);
}

let failed = 0;

function assert(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else {
    console.log('OK', name);
  }
}

assert('fresh last_seen + is_online false → online', resolveDeviceOnline({
  last_seen: minutesAgo(0.5),
  is_online: false,
}));

assert('stale last_seen + is_online false → offline', !resolveDeviceOnline({
  last_seen: minutesAgo(10),
  is_online: false,
}));

assert('fresh last_seen + is_online true → online', resolveDeviceOnline({
  last_seen: minutesAgo(1),
  is_online: true,
}));

assert('no last_seen → offline', !resolveDeviceOnline({
  is_online: true,
}));

process.exit(failed > 0 ? 1 : 0);
