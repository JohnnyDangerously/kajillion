import type { DemoControlActions } from './types'

export function reportDemoControlError (actions: DemoControlActions, err: unknown): void {
  if (actions.handleError) actions.handleError(err)
  else console.error(err)
}
