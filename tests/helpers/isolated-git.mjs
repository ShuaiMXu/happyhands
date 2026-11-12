import { fileURLToPath } from 'node:url';

// Fixture commits must not run the contributor's personal Git hooks or inherit
// external ref maintenance. The Harness itself still uses the real Git config.
process.env.GIT_CONFIG_GLOBAL = fileURLToPath(new URL('./test-gitconfig', import.meta.url));
process.env.GIT_CONFIG_NOSYSTEM = '1';
