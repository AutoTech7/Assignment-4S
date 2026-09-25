/** Runtime configuration, validated once. Nothing else reads `process.env`. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv, type Env } from './parse-env';

// Optional local overrides. Real environment variables take precedence over the file.
const dotEnvFile = resolve(process.cwd(), '.env');
if (existsSync(dotEnvFile)) process.loadEnvFile(dotEnvFile);

export const env: Env = parseEnv(process.env);
