import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const ROOT_DIR = dirname(__dirname);
export const SEED_DIR = join(dirname(__dirname), 'storage/seed');
