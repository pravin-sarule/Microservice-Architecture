const db = require('../config/db');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');

let secretClient;

function setupGCPClientFromBase64() {
  const base64Key = process.env.GCS_KEY_BASE64;
  if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

  const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
  const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
  fs.writeFileSync(tempFilePath, keyJson);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

  secretClient = new SecretManagerServiceClient();
}

if (!secretClient) {
  setupGCPClientFromBase64();
}

const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
if (!GCLOUD_PROJECT_ID) {
  throw new Error('GCLOUD_PROJECT_ID not set in env');
}

/**
 * @description Fetches a secret's value from Google Cloud Secret Manager using its internal ID.
 * @route GET /api/secrets/:id
 */
const fetchSecretValueFromGCP = async (req, res) => {
  const { id } = req.params;

  try {
    console.log('📦 Fetching secret config from DB for ID:', id);

    const result = await db.query(
      'SELECT secret_manager_id, version FROM secret_manager WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '❌ Secret config not found in DB' });
    }

    const { secret_manager_id, version } = result.rows[0];
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;

    console.log('🔐 Fetching from GCP Secret Manager:', secretName);

    const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
    const secretValue = accessResponse.payload.data.toString('utf8');

    res.status(200).json({
      secretManagerId: secret_manager_id,
      version,
      value: secretValue,
    });
  } catch (err) {
    console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

/**
 * @description Creates a new secret in Google Cloud Secret Manager and records its metadata in the database.
 * @route POST /api/secrets/create
 */
const createSecretInGCP = async (req, res) => {
  const {
    name,
    description,
    secret_manager_id,
    secret_value,
    version = '1',
    created_by = 1,
    template_type = 'system',
    status = 'active',
    usage_count = 0,
    success_rate = 0,
    avg_processing_time = 0,
    template_metadata = {},
  } = req.body;

  try {
    const parent = `projects/${GCLOUD_PROJECT_ID}`;
    const secretName = `${parent}/secrets/${secret_manager_id}`;

    const [secrets] = await secretClient.listSecrets({ parent });
    const exists = secrets.find((s) => s.name === secretName);

    if (!exists) {
      console.log(`🆕 Creating secret: ${secret_manager_id}`);
      await secretClient.createSecret({
        parent,
        secretId: secret_manager_id,
        secret: { replication: { automatic: {} } },
      });
    } else {
      console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
    }

    const [versionResponse] = await secretClient.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(secret_value, 'utf8') },
    });

    const versionId = versionResponse.name.split('/').pop();

    const result = await db.query(
      `
      INSERT INTO secret_manager (
        id, name, description, template_type, status,
        usage_count, success_rate, avg_processing_time,
        created_by, updated_by, created_at, updated_at,
        activated_at, last_used_at, template_metadata,
        secret_manager_id, version
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $8, now(), now(),
        now(), NULL, $9::jsonb,
        $10, $11
      ) RETURNING *;
      `,
      [
        name,
        description,
        template_type,
        status,
        usage_count,
        success_rate,
        avg_processing_time,
        created_by,
        JSON.stringify(template_metadata),
        secret_manager_id,
        versionId,
      ]
    );

    res.status(201).json({
      message: '✅ Secret created and version added to GCP',
      gcpSecret: secret_manager_id,
      gcpVersion: versionId,
      dbRecord: result.rows[0],
    });
  } catch (error) {
    console.error('🚨 Error creating secret in GCP:', error.message);
    res.status(500).json({ error: 'Failed to create secret: ' + error.message });
  }
};

/**
 * @description Retrieves all secrets from the database, with an option to fetch their values from Google Cloud Secret Manager.
 * @route GET /api/secrets
 */
const getAllSecrets = async (req, res) => {
  const includeValues = req.query.fetch === 'true';

  try {
    const result = await db.query('SELECT * FROM secret_manager ORDER BY created_at DESC');
    const rows = result.rows;

    if (!includeValues) {
      return res.status(200).json(rows);
    }

    const enriched = await Promise.all(
      rows.map(async (row) => {
        try {
          const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
          const [accessResponse] = await secretClient.accessSecretVersion({ name });
          const value = accessResponse.payload.data.toString('utf8');
          return { ...row, value };
        } catch (err) {
          return { ...row, value: '[ERROR: Cannot fetch]' };
        }
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error('Error fetching secrets:', error);
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
};

module.exports = {
  getAllSecrets,
  fetchSecretValueFromGCP,
  createSecretInGCP,
};
