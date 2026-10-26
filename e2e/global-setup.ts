import { execFileSync } from 'node:child_process';

// Every run starts from the same fictional practice so tests are repeatable.
export default function globalSetup() {
  execFileSync('node', ['scripts/seed.mjs', '--reset'], { stdio: 'inherit' });
}
