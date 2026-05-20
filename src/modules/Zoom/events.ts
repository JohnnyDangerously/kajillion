import { type GraphConfigInterface } from '@/graph/config/schema'
import {
  createNativeZoomEvent,
  type NativeZoomEvent,
  NativeZoomTransform,
  type ZoomCallback,
} from './native'

interface ZoomEventControllerOptions {
  getConfig: () => GraphConfigInterface;
  getTransform: () => NativeZoomTransform;
  setRunning: (isRunning: boolean) => void;
  clearSimulationOverride: () => void;
  getCallbacks: () => {
    onStart?: ZoomCallback;
    onZoom?: ZoomCallback;
    onEnd?: ZoomCallback;
  };
}

export class ZoomEventController {
  private readonly options: ZoomEventControllerOptions

  public constructor (options: ZoomEventControllerOptions) {
    this.options = options
  }

  public notifyStart (sourceEvent: Event | undefined): void {
    this.options.setRunning(true)
    if (sourceEvent) this.options.clearSimulationOverride()
    const event = this.createEvent('start', sourceEvent)
    this.options.getConfig().onZoomStart?.(event, !!sourceEvent)
    this.options.getCallbacks().onStart?.(event)
  }

  public notifyZoom (sourceEvent: Event | undefined): void {
    const event = this.createEvent('zoom', sourceEvent)
    this.options.getConfig().onZoom?.(event, !!sourceEvent)
    this.options.getCallbacks().onZoom?.(event)
  }

  public notifyEnd (sourceEvent: Event | undefined): void {
    this.options.setRunning(false)
    const event = this.createEvent('end', sourceEvent)
    this.options.getConfig().onZoomEnd?.(event, !!sourceEvent)
    this.options.getCallbacks().onEnd?.(event)
  }

  private createEvent (type: NativeZoomEvent['type'], sourceEvent: Event | undefined): NativeZoomEvent {
    return createNativeZoomEvent(type, this.options.getTransform(), sourceEvent)
  }
}
