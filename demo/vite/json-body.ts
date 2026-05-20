import type { IncomingMessage } from 'http'

export function readJsonBody (req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolveJson, reject) => {
    const contentType = req.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
      reject(Object.assign(new Error('Content-Type must be application/json'), { statusCode: 415 }))
      return
    }

    const chunks: Buffer[] = []
    let total = 0
    let aborted = false
    req.on('data', chunk => {
      if (aborted) return
      total += chunk.length
      if (total > maxBytes) {
        aborted = true
        reject(Object.assign(new Error(`Payload exceeds ${maxBytes} bytes`), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (aborted) return
      try {
        resolveJson(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}
