

// const { bucket, fileInputBucket } = require('../src/config/gcs'); // Make sure this is correctly importing your initialized bucket

// /**
//  * Upload a file buffer to Google Cloud Storage
//  */
// exports.uploadToGCS = async (filename, buffer, folder = 'uploads', isBatch = false) => {
//   const targetBucket = isBatch ? fileInputBucket : bucket;
//   const timestamp = Date.now();
//   const destination = `${folder}/${timestamp}_${filename}`;
//   const file = targetBucket.file(destination);

//   await file.save(buffer, {
//     resumable: false,
//     contentType: 'auto',
//     metadata: {
//       cacheControl: 'public, max-age=31536000'
//     },
//   });

//   // Return GCS path (not signed URL)
//   return { url: file.publicUrl(), path: destination };
// };

// /**
//  * Generate a temporary signed URL for download
//  */
// exports.getSignedUrl = async (gcsPath, expiresInSeconds = 300) => {
//   const file = bucket.file(gcsPath);

//   const [url] = await file.getSignedUrl({
//     version: 'v4',
//     action: 'read',
//     expires: Date.now() + expiresInSeconds * 1000, // Default 5 minutes
//   });

//   return url;
// };
const { bucket, fileInputBucket } = require('../config/gcs');
const path = require('path');

/**
 * Upload a file buffer to Google Cloud Storage
 *
 * @param {string} filename - Original file name
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Destination folder in GCS
 * @param {boolean} isBatch - If true, upload to fileInputBucket (for DocAI)
 * @param {string} mimetype - File MIME type
 * @returns {Promise<{ gsUri: string, gcsPath: string }>}
 */
exports.uploadToGCS = async (
  filename,
  buffer,
  folder = 'uploads',
  isBatch = false,
  mimetype = 'application/octet-stream'
) => {
  const targetBucket = isBatch ? fileInputBucket : bucket;
  const timestamp = Date.now();

  // Ensure safe filename
  const safeFilename = filename.replace(/\s+/g, '_');
  const destination = path.posix.join(folder, `${timestamp}_${safeFilename}`);
  const file = targetBucket.file(destination);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimetype,
      cacheControl: 'public, max-age=31536000',
    },
  });

  // Return gs:// URI for internal use
  return {
    gsUri: `gs://${targetBucket.name}/${destination}`,
    gcsPath: destination,
  };
};

/**
 * Generate a temporary signed URL for download
 *
 * @param {string} gcsPath - Path inside the main bucket
 * @param {number} expiresInSeconds - Expiry in seconds (default 5 min)
 * @returns {Promise<string>} Signed URL
 */
exports.getSignedUrl = async (gcsPath, expiresInSeconds = 300) => {
  const file = bucket.file(gcsPath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000,
  });

  return url;
};
