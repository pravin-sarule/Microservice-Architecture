const DEFAULT_URL = process.env.REDIS_URL || null;

const connectionOptions = (() => {
  if (DEFAULT_URL) {
    return { url: DEFAULT_URL };
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || 6379);
  const password = process.env.REDIS_PASSWORD || undefined;
  const tls = process.env.REDIS_TLS === 'true' ? {} : undefined;

  return {
    host,
    port,
    password,
    tls,
  };
})();

const redisConnection = connectionOptions;

module.exports = {
  redisConnection,
};



