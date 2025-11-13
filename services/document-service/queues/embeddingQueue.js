const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');

const EMBEDDING_QUEUE_NAME = process.env.EMBEDDING_QUEUE_NAME || 'document-embedding-jobs';

const limiter = {
  max: Number(process.env.EMBEDDING_QUEUE_RATE_MAX || 8),
  duration: Number(process.env.EMBEDDING_QUEUE_RATE_DURATION_MS || 1000),
};

const defaultJobOptions = {
  attempts: Number(process.env.EMBEDDING_QUEUE_ATTEMPTS || 3),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.EMBEDDING_QUEUE_BACKOFF_DELAY_MS || 5000),
  },
  removeOnComplete: Number(process.env.EMBEDDING_QUEUE_KEEP_COMPLETE || 100),
  removeOnFail: false,
};

const embeddingQueue = new Queue(EMBEDDING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions,
  limiter,
});

async function warmQueue() {
  try {
    await embeddingQueue.waitUntilReady();
    console.log(`[EmbeddingQueue] Ready (limiter=${limiter.max}/${limiter.duration}ms)`);
  } catch (error) {
    console.error('[EmbeddingQueue] Failed to initialize queue', error);
  }
}

async function enqueueEmbeddingJob(payload, options = {}) {
  const jobId = options.jobId || `embedding:${payload.fileId}:${Date.now()}`;
  return embeddingQueue.add('embed-chunks', payload, {
    jobId,
    priority: options.priority || 1,
    attempts: options.attempts,
    backoff: options.backoff,
  });
}

module.exports = {
  embeddingQueue,
  enqueueEmbeddingJob,
  warmQueue,
  EMBEDDING_QUEUE_NAME,
};


