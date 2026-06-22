import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeChannelStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED';

type SharedChannelEntry<TListener> = {
  listeners: Set<TListener>;
  channel: RealtimeChannel;
};

const sharedChannels = new Map<string, SharedChannelEntry<unknown>>();

/** Supabase devuelve el mismo canal si el nombre ya existe; hay que quitarlo antes de .on() */
export function removeRealtimeChannelByName(channelName: string): void {
  const topic = `realtime:${channelName}`;
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) {
    void supabase.removeChannel(existing);
  }
}

export function createRealtimeChannel(channelName: string): RealtimeChannel {
  removeRealtimeChannelByName(channelName);
  return supabase.channel(channelName);
}

/**
 * Un canal Realtime por clave; varios consumidores añaden listeners sin repetir .on()/subscribe().
 * setup() se ejecuta una sola vez y debe registrar todos los postgres_changes antes de subscribe().
 */
export function addSharedChannelListener<TListener>(
  key: string,
  listener: TListener,
  setup: (listeners: Set<TListener>) => RealtimeChannel
): () => void {
  let entry = sharedChannels.get(key) as SharedChannelEntry<TListener> | undefined;

  if (!entry) {
    const listeners = new Set<TListener>();
    const channel = setup(listeners);
    entry = { listeners, channel };
    sharedChannels.set(key, entry as SharedChannelEntry<unknown>);
  }

  entry.listeners.add(listener);

  return () => {
    entry!.listeners.delete(listener);
    if (entry!.listeners.size === 0) {
      void supabase.removeChannel(entry!.channel);
      sharedChannels.delete(key);
    }
  };
}

export function notifySharedChannelStatus<TListener>(
  listeners: Set<TListener>,
  status: RealtimeChannelStatus,
  notify: (listener: TListener, status: RealtimeChannelStatus) => void
): void {
  listeners.forEach((listener) => notify(listener, status));
}
