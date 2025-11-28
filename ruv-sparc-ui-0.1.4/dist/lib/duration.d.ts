type Unit = 'ms' | 's' | 'm' | 'h' | 'd';
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;
/**
 * Convert a human readable duration to milliseconds
 */
export declare function ms(d: Duration): number;
export {};
//# sourceMappingURL=duration.d.ts.map