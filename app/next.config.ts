import path from 'node:path';
import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  serverExternalPackages: ['@tensorflow/tfjs', 'sharp'],
  outputFileTracingIncludes: { '/api/portal': ['./src/data/captcha-weights.bin'] },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  devIndicators: false,
};
export default config;
