export const SOURCE_SPACE_SIZE = 4096
export const DEMO_SPACE_SIZE = 8192
export const DEMO_CONTENT_SCALE = 1.25
export const ANALYST_MIN_ZOOM_LEVEL = 0.25
export const ANALYST_MAX_ZOOM_LEVEL = 2.05
export const ANALYST_MACRO_IMPOSTOR_DISTANCE = 50
export const ANALYST_CLOSE_NODE_SIZE = 21.5

export function zoomDistanceToLevelForRange (distance: number, minZoom: number, maxZoom: number): number {
  const safeDistance = Math.max(1, Math.min(100, distance))
  const t = (100 - safeDistance) / 99
  return Math.exp(Math.log(minZoom) + t * (Math.log(maxZoom) - Math.log(minZoom)))
}

export const ANALYST_MACRO_IMPOSTOR_MAX_ZOOM = zoomDistanceToLevelForRange(
  ANALYST_MACRO_IMPOSTOR_DISTANCE,
  ANALYST_MIN_ZOOM_LEVEL,
  ANALYST_MAX_ZOOM_LEVEL
)

export const WORK_GROUP_LAYOUT: Array<{ x: number; y: number }> = [
  { x: 0.345, y: 0.555 },
  { x: 0.430, y: 0.675 },
  { x: 0.570, y: 0.645 },
  { x: 0.655, y: 0.505 },
  { x: 0.575, y: 0.370 },
  { x: 0.430, y: 0.345 },
  { x: 0.315, y: 0.440 },
]

export const ANALYST_GROUP_COLORS: [number, number, number][] = [
  [0.15, 0.43, 0.86],
  [0.03, 0.58, 0.52],
  [0.92, 0.34, 0.24],
  [0.58, 0.39, 0.88],
  [0.87, 0.56, 0.12],
  [0.82, 0.28, 0.52],
  [0.32, 0.62, 0.26],
  [0.11, 0.60, 0.78],
]

export const WORK_COMPANY_NAMES = [
  'HubSpot', 'ezCater', 'Stripe', 'Notion', 'Figma', 'Atlassian', 'Ramp', 'Linear',
  'OpenAI', 'Anthropic', 'Datadog', 'Snowflake', 'Salesforce', 'Vercel', 'Rippling',
  'Airtable', 'Brex', 'Shopify', 'Plaid', 'Segment', 'Intercom', 'Toast', 'Asana',
  'Gusto', 'Canva', 'Monday', 'Okta', 'Klaviyo', 'Zapier', 'Twilio', 'ServiceNow',
  'Carta', 'GitHub', 'Dropbox', 'Zendesk', 'Cloudflare', 'MongoDB', 'Miro', 'Slack',
]

export const WORK_FIRST_NAMES = [
  'Avery', 'Blake', 'Casey', 'Drew', 'Emerson', 'Finley', 'Gray', 'Harper', 'Jordan',
  'Kai', 'Logan', 'Morgan', 'Noah', 'Parker', 'Quinn', 'Reese', 'Riley', 'Rowan',
  'Sawyer', 'Taylor', 'Alex', 'Jamie', 'Sam', 'Maya', 'Priya', 'Nina', 'Owen', 'Leah',
]

export const WORK_LAST_NAMES = [
  'Chen', 'Patel', 'Rivera', 'Kim', 'Nguyen', 'Brooks', 'Stone', 'Bennett', 'Singh',
  'Carter', 'Morris', 'Diaz', 'Walker', 'Reed', 'Foster', 'Shah', 'Cohen', 'Ortiz',
  'Price', 'Hayes', 'Ibrahim', 'Keller', 'Wright', 'Park', 'Santos', 'Meyer',
]
