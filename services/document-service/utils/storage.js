const { bucket } = require('../config/gcs');
const File = require('../models/File');
const db = require('../config/db'); // Import db for querying user subscriptions

// MAX_STORAGE_BYTES will now come from the user's subscription plan
// const MAX_STORAGE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB in bytes

const uploadFileToGCS = (file, userId, folderPath = '') => {
  return new Promise(async (resolve, reject) => {
    const gcsFileName = `${userId}/${folderPath ? folderPath + '/' : ''}${Date.now()}-${file.originalname}`;
    const blob = bucket.file(gcsFileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      console.error('GCS Upload Error:', err);
      reject(err);
    });

    blobStream.on('finish', async () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      try {
        const newFile = await File.create({
          user_id: userId,
          originalname: file.originalname,
          gcs_path: blob.name,
          folder_path: folderPath,
          mimetype: file.mimetype,
          size: file.size,
        });
        resolve(newFile);
      } catch (dbError) {
        console.error('Database Error after GCS upload:', dbError);
        // Optionally delete the file from GCS if DB insertion fails
        await blob.delete().catch(console.error);
        reject(dbError);
      }
    });

    blobStream.end(file.buffer);
  });
};

const checkStorageLimit = async (userId, newFileSize = 0) => {
  console.log(`DEBUG: checkStorageLimit function entered for user ${userId}, newFileSize: ${newFileSize}`);
  try {
    // Fetch user's active subscription and its storage_limit_gb
    const userSubscriptionQuery = `
      SELECT
          sp.storage_limit_gb
      FROM
          user_subscriptions us
      JOIN
          subscription_plans sp ON us.plan_id = sp.id
      WHERE
          us.user_id = $1 AND us.status = 'active';
    `;
    console.log(`DEBUG: checkStorageLimit - Executing subscription query for user ${userId}`);
    const result = await db.query(userSubscriptionQuery, [userId]);
    console.log(`DEBUG: checkStorageLimit - Subscription query result rows: ${result.rows.length}`);

    if (result.rows.length === 0) {
      console.warn(`User ${userId} has no active subscription for storage limit check. Denying upload.`);
      return false; // No active subscription, so no storage allowed
    }

    const storageLimitGB = result.rows[0].storage_limit_gb;
    const storageLimitBytes = parseFloat(storageLimitGB) * 1024 * 1024 * 1024; // Convert GB to Bytes, ensure float parsing
    console.log(`DEBUG: checkStorageLimit - Plan storageLimitGB: ${storageLimitGB}, converted to Bytes: ${storageLimitBytes}`);

    const totalUsed = await File.getTotalStorageUsed(userId);
    console.log(`DEBUG: checkStorageLimit - User ${userId} - Total Used: ${totalUsed} bytes, New File Size: ${newFileSize} bytes, Storage Limit: ${storageLimitGB} GB (${storageLimitBytes} bytes)`);

    const isAllowed = (totalUsed + newFileSize) <= storageLimitBytes;
    console.log(`DEBUG: checkStorageLimit - Is allowed: ${isAllowed} (Total Used + New File Size: ${totalUsed + newFileSize} vs Limit: ${storageLimitBytes})`);
    return isAllowed;
  } catch (error) {
    console.error(`❌ Error in checkStorageLimit for user ${userId}:`, error);
    // Re-throw or return false based on desired error handling
    return false;
  }
};

const getSignedUrlForFile = async (gcsPath) => {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  const [url] = await bucket.file(gcsPath).getSignedUrl(options);
  return url;
};

module.exports = { uploadFileToGCS, checkStorageLimit, getSignedUrlForFile };