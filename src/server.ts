import { createApp } from './app.js';
import { environment } from './config.js';

const app = await createApp();

await app.listen({ host: environment.HOST, port: environment.PORT });