import type { NextConfig } from 'next'

const config: NextConfig = {
  // Disable the X-Powered-By header to avoid leaking stack info
  poweredByHeader: false,
}

export default config
