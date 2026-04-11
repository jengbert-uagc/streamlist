import { spawn } from 'node:child_process';

const run = (name, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true
  });

  return child;
};

const server = run('server', 'npm', ['run', 'server']);
const vite = run('vite', 'npm', ['run', 'dev']);
let shuttingDown = false;

const shutdown = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  server.kill('SIGTERM');
  vite.kill('SIGTERM');
  process.exit(exitCode);
};

const bindExit = (name, child) => {
  child.on('exit', (code) => {
    if (shuttingDown) {
      return;
    }
    if (code === 0 || code === null) {
      shutdown(0);
      return;
    }
    console.error(`${name} exited with code ${code}`);
    shutdown(code);
  });
};

bindExit('server', server);
bindExit('vite', vite);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
