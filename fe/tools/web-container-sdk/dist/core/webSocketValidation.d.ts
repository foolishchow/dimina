type ValidationResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
/** Web 容器与 Android/iOS/HarmonyOS 共用的 WebSocket 参数校验。 */
export declare const WebSocketValidation: {
    DEFAULT_TIMEOUT_MS: number;
    MAX_TIMEOUT_MS: number;
    MAX_REASON_UTF8_BYTES: number;
    validateUrl(rawUrl: unknown): ValidationResult<string>;
    validateTimeout(rawTimeout: unknown, appDefaultMs?: number): ValidationResult<number>;
    validateProtocols(rawProtocols: unknown): ValidationResult<string[]>;
    validateHeader(rawHeader: unknown): ValidationResult<Record<string, string>>;
    validateCloseCode(rawCode: unknown): ValidationResult<number>;
    validateReason(rawReason: unknown): ValidationResult<string>;
};
export type { ValidationResult };
