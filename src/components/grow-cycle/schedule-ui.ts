/** Schedule lane UI version — P0 legacy text, P1 chip design. */
export type ScheduleUiVersion = 'p0' | 'p1';

export function parseScheduleUiVersion(param: string | null): ScheduleUiVersion {
  return param === 'p0' ? 'p0' : 'p1';
}
