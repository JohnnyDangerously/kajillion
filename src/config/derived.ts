import { defaultConfigValues } from './defaults'
import { type GraphConfig, type GraphConfigInterface } from './schema'

/**
 * Returns a fresh copy of `defaultConfigValues` with arrays cloned so each Graph instance
 * gets its own copy rather than sharing array references with it.
 * `defaultConfigValues` is a module-level object — one instance shared across the entire codebase.
 * Called at construction time to initialise `Graph.config`, and via `resetConfigToDefaults` on every `setConfig()` call.
 */
export function createDefaultConfig (): GraphConfigInterface {
  const defaults: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultConfigValues)) {
    defaults[key] = Array.isArray(value) ? [...value] : value
  }
  return defaults as unknown as GraphConfigInterface
}

/**
 * Resets the config object to default values in place, preserving the object reference
 * so that modules (Zoom, Store, etc.) that hold a reference to it stay in sync.
 * Called at the start of `setConfig()` to wipe previous values before applying the new ones.
 */
export function resetConfigToDefaults (target: GraphConfigInterface): void {
  Object.assign(target, createDefaultConfig())
}

/**
 * Applies `source` values onto `target` in place, leaving absent keys unchanged.
 *
 * Mutates in place rather than returning a new object, because multiple modules
 * (Zoom, Store, etc.) hold a reference to the same config object and need to
 * see updates immediately.
 *
 * Called in three places:
 * - Constructor: applies the optional initial config on top of defaults.
 * - `setConfig()`: applies a full replacement after `resetConfigToDefaults`.
 * - `setConfigPartial()`: with `useDefaultsForUndefined = true`, so explicit
 *   `undefined` values reset that property to its default.
 *
 * Arrays from `source` are stored by reference — callers must not mutate them after passing.
 */
export function applyConfig (
  target: GraphConfigInterface,
  source: GraphConfig,
  useDefaultsForUndefined = false
): void {
  const overrides: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) { // skip explicit undefined; handled below if useDefaultsForUndefined
      overrides[key] = value
    } else if (useDefaultsForUndefined) { // explicit undefined → reset to default
      const def = (defaultConfigValues as Record<string, unknown>)[key]
      overrides[key] = Array.isArray(def) ? [...def] : def // clone so target doesn't share the array with defaultConfigValues
    }
  }
  Object.assign(target, overrides)
}
