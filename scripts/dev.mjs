import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const colorText = (text, colorCode) => `\x1b[${colorCode}m${text}\x1b[0m`;

const processes = [
  { name: 'Vite', color: '36', command: 'npx', args: ['vite'] },
  { name: 'Server', color: '32', command: 'node', args: ['server/index.js'] },
];

console.log(colorText('Starting Vite + backend server...\n', '1;35'));

const running = processes.map((proc) => {
  const p = spawn(proc.command, proc.args, {
    cwd: rootDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = colorText(`[${proc.name}]`, proc.color);

  p.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line.trim()) console.log(`${prefix} ${line}`);
    });
  });

  p.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line.trim()) console.error(`${prefix} ${colorText(line, '31')}`);
    });
  });

  p.on('close', (code) => {
    console.log(`${prefix} Process exited with code ${code}`);
  });

  return p;
});

const cleanExit = () => {
  console.log(colorText('\nStopping dev processes...', '1;31'));
  running.forEach((p) => p.kill('SIGINT'));
  process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
