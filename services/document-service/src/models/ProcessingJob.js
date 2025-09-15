


const db = require('../config/db');

// Create new processing job
async function createJob(job) {
  const query = `
    INSERT INTO processing_jobs (
      job_id,
      file_id,
      type,
      gcs_input_uri,
      gcs_output_uri_prefix,
      document_ai_operation_name,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    job.job_id,                     // UUID
    job.file_id,                    // file UUID
    job.type,                       // e.g. "batch"
    job.gcs_input_uri,              // gs:// input folder
    job.gcs_output_uri_prefix,      // gs:// output folder
    job.document_ai_operation_name, // operationName from Document AI
    job.status || 'queued'
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
}

// Update job status
async function updateJobStatus(jobId, status, errorMessage = null) {
  const query = `
    UPDATE processing_jobs
    SET status = $2,
        error_message = $3,
        updated_at = NOW()
    WHERE job_id = $1
    RETURNING *;
  `;
  const { rows } = await db.query(query, [jobId, status, errorMessage]);
  return rows[0];
}

// Fetch latest job by file_id
async function getJobByFileId(fileId) {
  const query = `
    SELECT *
    FROM processing_jobs
    WHERE file_id = $1
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [fileId]);
  return rows[0];
}

module.exports = {
  createJob,
  updateJobStatus,
  getJobByFileId,
};
