/* eslint-disable @typescript-eslint/naming-convention */
import { resolve } from 'path'
import { defineConfig } from 'vite'

import { agentCommandPlugin } from './vite/agent-command-plugin'
import { captureBakePlugin } from './vite/capture-bake-plugin'
import { captureJsonPlugin } from './vite/capture-json-plugin'
import { MAX_BASELINE_BYTES, MAX_REPLAY_BYTES } from './vite/constants'

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  root: __dirname,
  server: {
    port: 4174,
    open: false,
    proxy: {
      // Dev proxy so the browser can reach the internal CSR service
      // (private Route53 host, VPN-only) without CORS. Requires VPN.
      '/csr': {
        target: 'http://csr-postings.internal.connectvia.ai:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/csr/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@/graph': resolve(__dirname, '../src/'),
      '@kajillion/graph': resolve(__dirname, '../src/'),
    },
  },
  plugins: [
    agentCommandPlugin(),
    captureJsonPlugin('/record-baseline', 'baselines', MAX_BASELINE_BYTES, 'kajillion-demo-capture'),
    captureJsonPlugin('/record-replay', 'replays', MAX_REPLAY_BYTES, 'kajillion-demo-replay-capture'),
    captureBakePlugin(),
  ],
})
