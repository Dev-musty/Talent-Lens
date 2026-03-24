export const envs = () => ({
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? '*',
  //gemini: {
  // apiKey: process.env.GEMINI_API_KEY,
  //},
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
  },
  db: {
    type: process.env.DB_TYPE ?? 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB,
    ssl: process.env.DB_SSL === 'true',
  },
});
