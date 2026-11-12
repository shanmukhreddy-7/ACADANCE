import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const destination = fileURLToPath(new URL('../.env.local', import.meta.url));
if (!existsSync(destination)) {
  writeFileSync(destination, 'SESSION_SECRET=' + randomBytes(32).toString('hex') + '\n', {
    mode: 0o600,
  });
  console.log('Created a private local session secret.');
}
