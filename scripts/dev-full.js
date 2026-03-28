import { spawn } from 'node:child_process';

const run = (name, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });

  return child;
};

const server = run('server', 'npm', ['run', 'server']);
const vite = run('vite', 'npm', ['run', 'dev']);

const shutdown = () => {
  server.kill('SIGTERM');
  vite.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
