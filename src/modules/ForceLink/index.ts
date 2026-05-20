import { CoreModule } from '@/graph/modules/core-module'

import { LinkDirection, type ForceLinkState } from './contracts'
import { destroyForceLinkState } from './destroy'
import { initForceLinkPrograms } from './pass-setup'
import { createForceLinkResources } from './resources'
import { runForceLink } from './run'
import { createForceLinkState } from './state'

export { LinkDirection }

export class ForceLink extends CoreModule {
  private readonly state: ForceLinkState = createForceLinkState()

  public create (direction: LinkDirection): void {
    createForceLinkResources(this, this.state, direction)
  }

  public initPrograms (): void {
    initForceLinkPrograms(this, this.state)
  }

  public run (): void {
    runForceLink(this, this.state)
  }

  public destroy (): void {
    destroyForceLinkState(this.state)
  }
}
