import mongoose from 'mongoose';
import env from './env.js';

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error('Missing MongoDB connection string. Set MONGODB_URI in the environment variables.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
  });

  return mongoose.connection;
}

export function registerDatabaseEvents(connection = mongoose.connection) {
  connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.info('MongoDB connected');
  });

  connection.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error', error);
  });

  connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('MongoDB disconnected');
  });
}
