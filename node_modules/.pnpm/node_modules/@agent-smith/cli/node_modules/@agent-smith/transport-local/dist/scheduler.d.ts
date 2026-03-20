import type { IScheduler, ScheduledJob } from '@agent-smith/core';
export declare class LocalScheduler implements IScheduler {
    private jobs;
    schedule(id: string, cronExpr: string, fn: () => void): void;
    cancel(id: string): void;
    list(): ScheduledJob[];
}
//# sourceMappingURL=scheduler.d.ts.map