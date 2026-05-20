import {
  CTRL_WHEEL_DELTA_SCALE,
  WHEEL_LINE_DELTA_PIXELS,
} from './constants'

export function wheelDeltaToPixels (event: WheelEvent): number {
  let delta = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= WHEEL_LINE_DELTA_PIXELS
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= window.innerHeight
  if (event.ctrlKey) delta *= CTRL_WHEEL_DELTA_SCALE
  return delta
}
