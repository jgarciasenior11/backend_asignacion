import 'dotenv/config';

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'insecure-development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
};

export default env;
