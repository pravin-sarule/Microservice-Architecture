/**
 * Job Manager for tracking async infographic generation jobs
 * In-memory storage (can be replaced with Redis in production)
 */

const jobs = new Map();

/**
 * Create a new job
 * @param {string} jobId - Unique job ID
 * @param {Object} initialData - Initial job data
 * @returns {Object} Job object
 */
function createJob(jobId, initialData = {}) {
  const job = {
    id: jobId,
    status: 'pending', // pending, processing, analyzing, designing, rendering, completed, failed
    step: 'Initializing...',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initialData
  };
  
  jobs.set(jobId, job);
  console.log(`📋 Job created: ${jobId} - ${job.status}`);
  return job;
}

/**
 * Update job status
 * @param {string} jobId - Job ID
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} Updated job or null if not found
 */
function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  
  Object.assign(job, updates, {
    updatedAt: new Date()
  });
  
  jobs.set(jobId, job);
  console.log(`🔄 Job updated: ${jobId} - ${job.status} - ${job.step}`);
  return job;
}

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 * @returns {Object|null} Job or null if not found
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Delete job (cleanup)
 * @param {string} jobId - Job ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteJob(jobId) {
  return jobs.delete(jobId);
}

/**
 * Cleanup old jobs (older than 24 hours)
 */
function cleanupOldJobs() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt < oneDayAgo) {
      jobs.delete(jobId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old jobs`);
  }
}

// Run cleanup every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

module.exports = {
  createJob,
  updateJob,
  getJob,
  deleteJob,
  cleanupOldJobs
};



