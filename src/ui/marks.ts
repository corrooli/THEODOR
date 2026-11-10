import type { Fn } from '../core/intervals';

/** How a note is drawn on an instrument. */
export type MarkKind = 'on' | 'ghost' | 'scale' | 'guide';
export interface Mark {
  kind: MarkKind;
  fn: Fn;
  /** text inside the dot (note or interval) */
  text: string;
  /** tooltip */
  title?: string;
  /** extra emphasis ring (guide tones, targets) */
  ring?: boolean;
}
export type FretMarks = Map<string, Mark>;
export type KeyMarks = Map<number, Mark>;
export const fk = (s: number, f: number) => `${s}:${f}`;
