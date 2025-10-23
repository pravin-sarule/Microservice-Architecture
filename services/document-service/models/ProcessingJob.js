
// const pool = require('../config/db');

// const ProcessingJob = {
//   async createJob(fileId, jobId, type = 'synchronous', gcsInputUri = null, gcsOutputUriPrefix = null) {
//     const res = await pool.query(
//       `
//       INSERT INTO processing_jobs (file_id, job_id, status, type, gcs_input_uri, gcs_output_uri_prefix)
//       VALUES ($1, $2, 'queued', $3, $4, $5)
//       RETURNING id
//       `,
//       [fileId, jobId, type, gcsInputUri, gcsOutputUriPrefix] // fileId is a UUID string
//     );
//     return res.rows[0].id;
//   },

//   async updateJobStatus(jobId, status, errorMessage = null) {
//     await pool.query(
//       `
//       UPDATE processing_jobs
//       SET status = $1, error_message = $2, updated_at = NOW()
//       WHERE job_id = $3
//       `,
//       [status, errorMessage, jobId]
//     );
//   },

//   async updateProcessingProgress(jobId, progress) {
//     await pool.query(
//       `
//       UPDATE processing_jobs
//       SET processing_progress = $1, updated_at = NOW()
//       WHERE job_id = $2
//       `,
//       [progress, jobId]
//     );
//   },

//   async getJobByFileId(fileId) {
//     const res = await pool.query(
//       `
//       SELECT * FROM processing_jobs
//       WHERE file_id = $1
//       ORDER BY created_at DESC
//       LIMIT 1
//       `,
//       [fileId] // fileId is a UUID string
//     );
//     return res.rows[0];
//   },

//   async getJobById(jobId) {
//     const res = await pool.query(
//       `
//       SELECT * FROM processing_jobs
//       WHERE job_id = $1
//       `,
//       [jobId]
//     );
//     return res.rows[0];
//   }
// };

// module.exports = ProcessingJob;
// src/models/ProcessingJob.js
// const db = require('../config/db');

// async function createJob(job) {
//   const query = `
//     INSERT INTO processing_jobs (
//       id,
//       file_id,
//       type,
//       gcs_input_uri,
//       gcs_output_prefix,
//       operation_name,
//       status
//     )
//     VALUES ($1, $2, $3, $4, $5, $6, $7)
//     RETURNING *;
//   `;

//   const values = [
//     job.id,               // UUID (jobId)
//     job.file_id,          // UUID (fileId)
//     job.type,         // e.g. "batch"
//     job.gcs_input_uri,    // GCS input path
//     job.gcs_output_prefix,// GCS output prefix
//     job.operation_name,   // Document AI operation ID
//     job.status || 'queued'
//   ];

//   const { rows } = await db.query(query, values);
//   return rows[0];
// }

// async function updateJobStatus(jobId, status, errorMessage = null) {
//   const query = `
//     UPDATE processing_jobs
//     SET status = $2, error_message = $3, updated_at = NOW()
//     WHERE id = $1
//     RETURNING *;
//   `;
//   const { rows } = await db.query(query, [jobId, status, errorMessage]);
//   return rows[0];
// }

// async function getJobByFileId(fileId) {
//   const query = `
//     SELECT *
//     FROM processing_jobs
//     WHERE file_id = $1
//     ORDER BY created_at DESC
//     LIMIT 1;
//   `;
//   const { rows } = await db.query(query, [fileId]);
//   return rows[0];
// }

// module.exports = {
//   createJob,
//   updateJobStatus,
//   getJobByFileId,
// };





// const db = require('../config/db');

// // Create new processing job
// async function createJob(job) {
//   const query = `
//     INSERT INTO processing_jobs (
//       job_id,
//       file_id,
//       type,
//       gcs_input_uri,
//       gcs_output_uri_prefix,
//       document_ai_operation_name,
//       status
//     )
//     VALUES ($1, $2, $3, $4, $5, $6, $7)
//     RETURNING *;
//   `;

//   const values = [
//     job.job_id,                     // UUID
//     job.file_id,                    // file UUID
//     job.type,                       // e.g. "batch"
//     job.gcs_input_uri,              // gs:// input folder
//     job.gcs_output_uri_prefix,      // gs:// output folder
//     job.document_ai_operation_name, // operationName from Document AI
//     job.status || 'queued'
//   ];

//   const { rows } = await db.query(query, values);
//   return rows[0];
// }

// // Update job status
// async function updateJobStatus(jobId, status, errorMessage = null) {
//   const query = `
//     UPDATE processing_jobs
//     SET status = $2,
//         error_message = $3,
//         updated_at = NOW()
//     WHERE job_id = $1
//     RETURNING *;
//   `;
//   const { rows } = await db.query(query, [jobId, status, errorMessage]);
//   return rows[0];
// }

// // Fetch latest job by file_id
// async function getJobByFileId(fileId) {
//   const query = `
//     SELECT *
//     FROM processing_jobs
//     WHERE file_id = $1
//     ORDER BY created_at DESC
//     LIMIT 1;
//   `;
//   const { rows } = await db.query(query, [fileId]);
//   return rows[0];
// }

// module.exports = {
//   createJob,
//   updateJobStatus,
//   getJobByFileId,
//   // Update multiple fields of a job
//   async updateJob(jobId, updates) {
//     const fields = Object.keys(updates);
//     const values = Object.values(updates);
//     const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

//     const query = `
//       UPDATE processing_jobs
//       SET ${setClause}, updated_at = NOW()
//       WHERE job_id = $1
//       RETURNING *;
//     `;
//     const { rows } = await db.query(query, [jobId, ...values]);
//     return rows[0];
//   },
// };



// const db = require('../config/db');

// /**
//  * 🧩 Create new processing job
//  * Includes optional secret_id (to link with secret_manager)
//  */
// async function createJob(job) {
//   const query = `
//     INSERT INTO processing_jobs (
//       job_id,
//       file_id,
//       type,
//       gcs_input_uri,
//       gcs_output_uri_prefix,
//       document_ai_operation_name,
//       status,
//       secret_id
//     )
//     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//     RETURNING *;
//   `;

//   const values = [
//     job.job_id,                     // UUID
//     job.file_id,                    // File UUID
//     job.type,                       // e.g., "batch" or "inline"
//     job.gcs_input_uri,              // gs:// input folder
//     job.gcs_output_uri_prefix,      // gs:// output folder
//     job.document_ai_operation_name, // operationName from Document AI
//     job.status || 'queued',         // Default status
//     job.secret_id || null           // ✅ Link to secret_manager.id (optional)
//   ];

//   const { rows } = await db.query(query, values);
//   return rows[0];
// }

// /**
//  * 🧩 Update only job status
//  */
// async function updateJobStatus(jobId, status, errorMessage = null) {
//   const query = `
//     UPDATE processing_jobs
//     SET status = $2,
//         error_message = $3,
//         updated_at = NOW()
//     WHERE job_id = $1
//     RETURNING *;
//   `;
//   const { rows } = await db.query(query, [jobId, status, errorMessage]);
//   return rows[0];
// }

// /**
//  * 🧩 Fetch latest job by file_id
//  */
// async function getJobByFileId(fileId) {
//   const query = `
//     SELECT *
//     FROM processing_jobs
//     WHERE file_id = $1
//     ORDER BY created_at DESC
//     LIMIT 1;
//   `;
//   const { rows } = await db.query(query, [fileId]);
//   return rows[0];
// }

// /**
//  * 🧩 Update multiple fields dynamically (e.g. status, secret_id, etc.)
//  */
// async function updateJob(jobId, updates) {
//   const fields = Object.keys(updates);
//   if (fields.length === 0) return null;

//   const values = Object.values(updates);
//   const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

//   const query = `
//     UPDATE processing_jobs
//     SET ${setClause}, updated_at = NOW()
//     WHERE job_id = $1
//     RETURNING *;
//   `;

//   const { rows } = await db.query(query, [jobId, ...values]);
//   return rows[0];
// }

// /**
//  * 🧩 Link a secret_id to a processing job (helper function)
//  * Used by triggerSecretLLM or other controllers.
//  */
// async function linkSecretToJob(fileId, secretId) {
//   const query = `
//     UPDATE processing_jobs
//     SET secret_id = $2, updated_at = NOW()
//     WHERE file_id = $1
//     RETURNING *;
//   `;
//   const { rows } = await db.query(query, [fileId, secretId]);
//   return rows[0];
// }

// module.exports = {
//   createJob,
//   updateJobStatus,
//   getJobByFileId,
//   updateJob,
//   linkSecretToJob, // ✅ new helper
// };
const db = require('../config/db');

/**
 * 🧩 Create new processing job
 * Includes optional secret_id (to link with secret_manager)
 */
async function createJob(job) {
  const query = `
    INSERT INTO processing_jobs (
      job_id,
      file_id,
      type,
      gcs_input_uri,
      gcs_output_uri_prefix,
      document_ai_operation_name,
      status,
      secret_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    job.job_id,                     // UUID
    job.file_id,                    // File UUID
    job.type,                       // e.g., "batch" or "inline"
    job.gcs_input_uri,              // gs:// input folder
    job.gcs_output_uri_prefix,      // gs:// output folder
    job.document_ai_operation_name, // operationName from Document AI
    job.status || 'queued',         // Default status
    job.secret_id || null           // ✅ Link to secret_manager.id (optional)
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
}

/**
 * 🧩 Update only job status
 */
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

/**
 * 🧩 Fetch latest job by file_id
 */
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

/**
 * 🧩 Update multiple fields dynamically (status, secret_id, etc.)
 */
async function updateJob(jobId, updates) {
  const fields = Object.keys(updates);
  if (fields.length === 0) return null;

  const values = Object.values(updates);
  const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');

  const query = `
    UPDATE processing_jobs
    SET ${setClause}, updated_at = NOW()
    WHERE job_id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(query, [jobId, ...values]);
  return rows[0];
}

/**
 * 🧩 Link a secret_id to latest job by file_id
 * Used by triggerSecretLLM or document controller.
 */
async function linkSecretToJob(fileId, secretId) {
  const query = `
    UPDATE processing_jobs
    SET secret_id = $2, updated_at = NOW()
    WHERE file_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    RETURNING *;
  `;
  const { rows } = await db.query(query, [fileId, secretId]);
  return rows[0];
}

module.exports = {
  createJob,
  updateJobStatus,
  getJobByFileId,
  updateJob,
  linkSecretToJob,
};
