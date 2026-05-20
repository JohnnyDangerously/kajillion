import { sanitizeHtml } from '@/graph/helper'

export function createAttributionElement (attribution: string): HTMLDivElement | undefined {
  if (!attribution) return undefined

  const attributionDivElement = document.createElement('div')
  attributionDivElement.style.cssText = `
      user-select: none;
      position: absolute;
      bottom: 0;
      right: 0;
      color: var(--cosmosgl-attribution-color);
      margin: 0 0.6rem 0.6rem 0;
      font-size: 0.7rem;
      font-family: inherit;
    `
  // Use permissive settings for attribution since it is controlled by the library user.
  attributionDivElement.innerHTML = sanitizeHtml(attribution, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br', 'img'],
    ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style', 'src', 'alt', 'title'],
  })
  return attributionDivElement
}
