import { environment } from './config.js';

console.info(`Care reminder worker started in ${environment.NODE_ENV} mode.`);

const keepAlive = setInterval(() => undefined, 60_000);

function stopWorker() {
	clearInterval(keepAlive);
	process.exit(0);
}

process.once('SIGINT', stopWorker);
process.once('SIGTERM', stopWorker);