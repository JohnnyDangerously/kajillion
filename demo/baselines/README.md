# Baselines

Snapshots of kajillion engine performance at specific points in time.
Each `baseline-vN-*.json` is checked into git as a reference point against
which future work is measured.

## Files

- `baseline-v0-webgpu-full.json` — initial post-port baseline (2026-05-12).
  Captured via the bench harness, 5-repeat medians, n=100k Barabási-Albert,
  full WebGPU path with MSAA 4×, add-blend, adaptive DPR. AC power, M5 Max.
  This is the reference point against which the polish-pass will be measured.

## Recording

Two paths exist:

1. **Bench harness** (headless-friendly, source of truth for numbers):

   ```bash
   npm run bench:dev
   # navigate to http://localhost:4173/?n=100000&m=3&seed=42&repeat=5&useWebGPU=1&msaa=4&linkBlendMode=add&adaptiveDpr=1&label=baseline-vN
   # bench writes to benchmarks/results/latest.json
   cp benchmarks/results/latest.json demo/baselines/baseline-vN-<label>.json
   ```

2. **Demo recorder** (human-readable surface, looks like the published demo):

   ```bash
   npm run demo:dev
   # open http://localhost:4174/ — click "Record 5-repeat baseline"
   # writes to demo/baselines/<timestamp>.json (gitignored unless renamed)
   ```

Both protocols use the same warmup/measure windows (2 s / 8 s) and report
median GPU timings + wall fps over 5 repeats.

## Power-state protocol

Run on **AC power, GPU cool** (5+ min idle since the last bench). The
bench harness reports `power.throttleSuspected` and `power.charging` in
the JSON so stale baselines can be filtered out if comparison shows
unusual drift.
