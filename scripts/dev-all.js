import { spawn } from 'child_process';
import path from 'path';

console.log('\n[The Grand Chess Room] Launching Backend + Frontend Development Servers...\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve('backend'),
  stdio: 'inherit',
  shell: false,
});

const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve('frontend'),
  stdio: 'inherit',
  shell: false,
});

const shutdown = () => {
  console.log('\n[The Grand Chess Room] Shutting down servers...');
  try {
    if (backend && !backend.killed) {
      if (isWin && backend.pid) {
        spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t']);
      } else {
        backend.kill('SIGINT');
      }
    }
    if (frontend && !frontend.killed) {
      if (isWin && frontend.pid) {
        spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t']);
      } else {
        frontend.kill('SIGINT');
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

backend.on('error', (err) => {
  console.error('[Backend Error]:', err);
});

frontend.on('error', (err) => {
  console.error('[Frontend Error]:', err);
});
