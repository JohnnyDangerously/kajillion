/**
 * Requires all keys from T to be present, while preserving
 * the original value types (including `| undefined` for optional properties).
 */
export type Complete<T> = { [K in keyof Required<T>]: T[K] }
