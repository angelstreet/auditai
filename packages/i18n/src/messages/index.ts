import type { SupportedLocale } from '../index.js';
import { en } from './en.js';
import { fr } from './fr.js';

/** Shape of a catalog: same keys as `en`, every leaf a string. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Messages = Shape<typeof en>;
export type AdminMessages = Messages['admin'];
export type ClientMessages = Messages['client'];

export const messages: Record<SupportedLocale, Messages> = { en, fr };
