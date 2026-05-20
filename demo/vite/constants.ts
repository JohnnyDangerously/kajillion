export const MAX_BASELINE_BYTES = 5 * 1024 * 1024
export const MAX_REPLAY_BYTES = 10 * 1024 * 1024
export const MAX_AGENT_COMMAND_BYTES = 64 * 1024 * 1024

// Baked layouts at 1M nodes are ~32 MB raw (positions + links), gzipped
// closer to ~6-10 MB. Cap at 128 MB to leave headroom for label variants
// without letting a runaway request fill the disk.
export const MAX_BAKE_BYTES = 128 * 1024 * 1024
