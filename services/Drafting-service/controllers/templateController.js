
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mammoth = require('mammoth');
const pool = require('../config/db');
const Template = require('../models/Template');
const axios = require('axios'); // For making HTTP requests to payment service

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003'; // Assuming payment service runs on 5003

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(Buffer.from(process.env.GCS_KEY_BASE64, 'base64').toString())
});

const BUCKET_NAME = process.env.GCS_BUCKET;

/**
 * Normalize GCS key
 */
function normalizeGcsKey(gcsPath) {
  if (!gcsPath) return null;
  let key = gcsPath.trim();

  if (key.startsWith(`gs://${BUCKET_NAME}/`)) key = key.replace(`gs://${BUCKET_NAME}/`, '');
  else if (key.startsWith(`https://storage.googleapis.com/${BUCKET_NAME}/`)) key = key.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, '');
  else if (key.startsWith(`/${BUCKET_NAME}/`)) key = key.replace(`/${BUCKET_NAME}/`, '');

  return key.replace(/^\/+/, '');
}

/**
 * Get all active templates
 */
exports.getTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { rows } = await pool.query(`SELECT * FROM templates WHERE status = 'active';`);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ message: 'Error fetching templates', error: err.message });
  }
};

/**
 * Get templates created by a specific user
 */
exports.getUserTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const templates = await Template.findByUserId(userId);
    res.json(templates);
  } catch (err) {
    console.error('Error fetching user templates:', err);
    res.status(500).json({ message: 'Error fetching user templates' });
  }
};


/**
 * Open a DOCX template from GCS and convert to HTML
 */
exports.openDocxTemplateAsHtml = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { rows } = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Template not found' });

    const template = rows[0];
    const srcKey = normalizeGcsKey(template.gcs_path);
    if (!srcKey) return res.status(500).json({ message: 'Invalid GCS path' });

    const tmpFilePath = path.join(os.tmpdir(), `${Date.now()}-${path.basename(srcKey)}`);
    const [fileBuffer] = await storage.bucket(BUCKET_NAME).file(srcKey).download();
    fs.writeFileSync(tmpFilePath, fileBuffer);

    const { value: html } = await mammoth.convertToHtml({ path: tmpFilePath });
    fs.unlinkSync(tmpFilePath);

    res.json({ html, name: template.name });
  } catch (err) {
    console.error('Error converting DOCX to HTML:', err);
    res.status(500).json({ message: 'Error converting DOCX to HTML', error: err.message });
  }
};


// exports.openDocxTemplateAsHtml = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user?.id;
//     if (!userId) return res.status(401).json({ message: 'Unauthorized' });

//     const { rows } = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
//     if (!rows.length) return res.status(404).json({ message: 'Template not found' });

//     const template = rows[0];
//     const srcKey = normalizeGcsKey(template.gcs_path);
//     const [fileBuffer] = await storage.bucket(BUCKET_NAME).file(srcKey).download();

//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
//     res.setHeader('Content-Disposition', `inline; filename="${template.name}.docx"`);
//     res.send(fileBuffer);
//   } catch (err) {
//     console.error('Error serving DOCX:', err);
//     res.status(500).json({ message: 'Error fetching DOCX', error: err.message });
//   }
// };


/**
 * Get template by ID
 */
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const template = await Template.findById(id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    res.json(template);
  } catch (err) {
    console.error('Error fetching template by ID:', err);
    res.status(500).json({ message: 'Error fetching template', error: err.message });
  }
};



exports.getDocxTemplatePreview = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[getDocxTemplatePreview] Attempting to fetch preview for template ID: ${id}`);

    // We can remove the userId check if this is a public preview endpoint.
    // If authorization is required, keep the check.
    // const userId = req.user?.id;
    // if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { rows } = await pool.query('SELECT gcs_path FROM templates WHERE id = $1 AND status = \'active\'', [id]);
    
    if (!rows.length) {
      console.warn(`[getDocxTemplatePreview] Template with ID ${id} not found or not active.`);
      return res.status(404).json({ message: 'Template not found' });
    }
    console.log(`[getDocxTemplatePreview] Found template with GCS path: ${rows[0].gcs_path}`);

    const srcKey = normalizeGcsKey(rows[0].gcs_path);
    if (!srcKey) {
      console.error(`[getDocxTemplatePreview] Invalid GCS path for template ID ${id}: ${rows[0].gcs_path}`);
      return res.status(500).json({ message: 'Template has an invalid GCS path' });
    }
    console.log(`[getDocxTemplatePreview] Normalized GCS key: ${srcKey}. Starting stream.`);

    // --- CHANGE: From downloading to streaming ---

    // 1. Set the correct headers before starting the stream.
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="preview.docx"`);

    // 2. Create a read stream from the GCS file.
    const readStream = storage.bucket(BUCKET_NAME).file(srcKey).createReadStream();

    // 3. Add error handling for the stream itself.
    // This catches errors during the file transfer from GCS.
    readStream.on('error', (err) => {
      console.error('Error streaming file from GCS:', err);
      // Can't send a JSON response here as headers are already sent.
      // We just end the response, which the client will see as a failed download.
      res.end();
    });

    // 4. Pipe the GCS stream directly to the HTTP response.
    // This sends the data chunk-by-chunk without storing it all in memory.
    readStream.pipe(res);

  } catch (err) {
    // This outer catch handles errors from the database query or initial setup.
    console.error('Error fetching DOCX for preview:', err);
    
    // Check if headers have already been sent before sending a JSON error.
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error fetching template preview', error: err.message });
    }
  }
};
/**
 * @description Saves an edited HTML template as a new user draft.
 * @route POST /api/templates/draft/html
 */
exports.saveEditedHtmlDraft = async (req, res) => {
  let draftSaveCost;
  try {
    const { templateId, name, htmlContent } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!htmlContent) {
      return res.status(400).json({ message: 'No HTML content provided' });
    }

    // Calculate cost based on HTML content length (e.g., 1 token per 100 characters)
    draftSaveCost = Math.ceil(htmlContent.length / 100);

    const checkReserveResponse = await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/token/check-reserve`, {
      userId,
      operationCost: draftSaveCost
    }, {
      headers: { Authorization: req.headers.authorization } // Forward auth token
    });

    if (!checkReserveResponse.data.success) {
      return res.status(403).json({ message: checkReserveResponse.data.message || 'User token limit is exceeded for saving drafts.' });
    }

    // Define GCS path for HTML drafts
    const gcsPath = `nexintel-uploads/${userId}/draft_template/User_Draft/${Date.now()}-${name || 'untitled'}.html`;
    const file = storage.bucket(BUCKET_NAME).file(gcsPath);

    // Save HTML content to GCS
    await file.save(htmlContent, {
      metadata: { contentType: 'text/html' }
    });

    // Insert draft record into user_drafts table
    const { rows } = await pool.query(
      `INSERT INTO user_drafts (user_id, template_id, name, gcs_path)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, templateId, name, gcsPath]
    );

    await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/token/commit`, {
      userId,
      tokensUsed: draftSaveCost,
      actionDescription: `Save HTML draft: ${name}`
    }, {
      headers: { Authorization: req.headers.authorization }
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error saving edited HTML draft:', err);
    if (draftSaveCost) {
      await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/token/rollback`, {
        userId,
        tokensToRollback: draftSaveCost,
        actionDescription: `Rollback HTML draft save: ${name}`
      }, {
        headers: { Authorization: req.headers.authorization }
      });
    }
    res.status(500).json({ message: 'Error saving edited HTML draft', error: err.message });
  }
};

/**
 * @description Downloads a saved HTML draft as a PDF.
 * @route GET /api/templates/draft/:id/pdf
 */
exports.downloadHtmlDraftAsPdf = async (req, res) => {
  let browser;
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { rows } = await pool.query('SELECT * FROM user_drafts WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    const draft = rows[0];
    const srcKey = normalizeGcsKey(draft.gcs_path);
    if (!srcKey) {
      return res.status(500).json({ message: 'Invalid GCS path for draft.' });
    }

    // Download HTML content from GCS
    const [htmlBuffer] = await storage.bucket(BUCKET_NAME).file(srcKey).download();
    const htmlContent = htmlBuffer.toString('utf8');

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({ format: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${draft.name || 'document'}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Error downloading HTML draft as PDF:', err);
    res.status(500).json({ message: 'Error downloading PDF', error: err.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};