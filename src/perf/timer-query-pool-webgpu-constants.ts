export const ROLLING_WINDOW = 60

// Each begin/end pair consumes 2 timestamp slots. The current per-frame call
// sites top out at ~9 passes; 128 leaves comfortable headroom.
const MAX_PASSES_PER_FRAME = 128
export const QUERY_SET_SIZE = MAX_PASSES_PER_FRAME * 2
export const BYTES_PER_TIMESTAMP = 8
