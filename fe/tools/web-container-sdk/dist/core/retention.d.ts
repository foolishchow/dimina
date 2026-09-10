export interface RetentionPolicy {
    /** Number of cached background apps. Zero disables retention. */
    maxBackgroundApps?: number;
    /** Milliseconds since last hide; zero disables expiry. */
    backgroundTimeoutMs?: number;
}
export declare function resolveRetentionPolicy(policy?: RetentionPolicy): Required<RetentionPolicy>;
/** One deadline per container, no polling and no timer per retained app. */
export declare class RetentionManager<T> {
    private reconcile;
    private now;
    policy: Required<RetentionPolicy>;
    private hidden;
    private timer?;
    private pressure;
    constructor(reconcile: () => void, now?: () => number);
    configure(policy: RetentionPolicy): void;
    hide(app: T): void;
    forget(app: T): void;
    memoryPressure(): void;
    collect(canEvict: (app: T) => boolean): T[];
}
