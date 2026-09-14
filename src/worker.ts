import { environment } from './config.js';

console.info(`Care reminder worker started in ${environment.NODE_ENV} mode.`);

process.on('SIGTERM', () => process.exit(0));