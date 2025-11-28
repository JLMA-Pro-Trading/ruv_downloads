import { Duration } from './duration';
export default function ratelimit(key: string | null, maxRequests: number, window: Duration): Promise<{
    amount: number;
    reset: number;
    remaining: number;
} | undefined>;
//# sourceMappingURL=ratelimit.d.ts.map