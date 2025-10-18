import http from 'http';
import app from './app.js';
import env from './config/env.js';
import { connectDatabase, registerDatabaseEvents } from './config/database.js';

async function bootstrap() {
  try {
    const connection = await connectDatabase();
    registerDatabaseEvents(connection);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }

  const server = http.createServer(app);

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.port}`);
  });
}

bootstrap();
