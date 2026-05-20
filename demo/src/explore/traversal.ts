/**
 * Traversal state for endless graph-walking: current focus, a breadcrumb
 * history, and a small working-set cache of recent ego-networks so that
 * jumping back is instant. Older networks are evicted; revisiting them
 * just re-fetches from CSR.
 */
import type { EgoNet } from './types'

const CACHE_CAP = 8

export class Traversal {
  private readonly cache = new Map<number, EgoNet>()
  readonly history: number[] = []
  current: number | null = null

  getCached (entityInt: number): EgoNet | undefined {
    return this.cache.get(entityInt)
  }

  /** Insert/refresh a network as most-recently-used; evict the oldest. */
  put (net: EgoNet): void {
    this.cache.delete(net.root)
    this.cache.set(net.root, net)
    while (this.cache.size > CACHE_CAP) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.cache.delete(oldest)
    }
  }

  /** Record a forward jump, pushing the prior focus onto the breadcrumb. */
  enter (entityInt: number): void {
    if (this.current !== null && this.current !== entityInt) {
      this.history.push(this.current)
    }
    this.current = entityInt
  }

  /** Pop the breadcrumb; returns the entity to jump back to, or null. */
  back (): number | null {
    const prev = this.history.pop() ?? null
    if (prev !== null) this.current = prev
    return prev
  }
}
