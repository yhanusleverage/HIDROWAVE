/**
 * setInterval que se pausa cuando la pestaña está en background.
 * Reduce requests innecesarios sin afectar Realtime (WSS sigue activo).
 */
export function setVisibleInterval(fn: () => void, ms: number): () => void {
  if (typeof document === 'undefined') {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  let id: ReturnType<typeof setInterval> | undefined;

  const start = () => {
    if (id !== undefined) return;
    id = setInterval(fn, ms);
  };

  const stop = () => {
    if (id === undefined) return;
    clearInterval(id);
    id = undefined;
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  if (!document.hidden) start();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
