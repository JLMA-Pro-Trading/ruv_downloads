#!/usr/bin/env node

// Wrapper to forward all commands to aidefence
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const aidefence = spawn('aidefence', args, {
  stdio: 'inherit',
  shell: true
});

aidefence.on('exit', (code) => {
  process.exit(code || 0);
});
