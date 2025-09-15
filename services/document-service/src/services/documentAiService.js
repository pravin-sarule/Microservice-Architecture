const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');
const { credentials } = require('../src/config/gcs');

const projectId = process.env.GCLOUD_PROJECT_ID;
const location = process.env.DOCUMENT_AI_LOCATION || 'us';
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

const client = new DocumentProcessorServiceClient({ credentials });
const storage = new Storage({ credentials });

/**
 * Process small documents (<20MB inline)
 */
async function extractTextFromDocument(fileBuffer, mimeType) {
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const request = {
    name,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  const [result] = await client.processDocument(request);
  return extractText(result.document);
}

/**
 * Batch process large documents asynchronously
 */
async function batchProcessDocument(inputUris, outputUriPrefix, mimeType = 'application/pdf') {
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const uris = Array.isArray(inputUris) ? inputUris : [inputUris];

  if (!outputUriPrefix.endsWith('/')) outputUriPrefix += '/';

  // Validate all input files exist
  await Promise.all(
    uris.map(async (uri) => {
      const { bucketName, prefix } = parseGcsUri(uri);
      const [exists] = await storage.bucket(bucketName).file(prefix).exists();
      if (!exists) throw new Error(`Input file not found in GCS: ${uri}`);
    })
  );

  const request = {
    name,
    inputDocuments: {
      gcsDocuments: {
        documents: uris.map(uri => ({ gcsUri: uri, mimeType })),
      },
    },
    documentOutputConfig: { gcsOutputConfig: { gcsUri: outputUriPrefix } },
  };

  const [operation] = await client.batchProcessDocuments(request);
  return operation.name;
}

/**
 * Get operation status
 */
async function getOperationStatus(operationName) {
  const [operation] = await client.operationsClient.getOperation({ name: operationName });
  return {
    done: operation.done || false,
    error: operation.error || null,
    response: operation.response || null,
  };
}

/**
 * Fetch batch results from GCS asynchronously and extract text only
 */
async function fetchBatchResults(bucketName, prefix) {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });

  const jsonFiles = files.filter(f => f.name.endsWith('.json'));

  // Download and process files in parallel
  const texts = await Promise.all(
    jsonFiles.map(async (file) => {
      const [contents] = await file.download();
      const json = JSON.parse(contents.toString());
      const doc = json.document || json;
      return extractText(doc); // returns array of page texts
    })
  );

  // Flatten array of arrays into a single array
  return texts.flat();
}

/**
 * Extracts structured content (text, page numbers) from a Document AI document object.
 * This function aims to preserve the document structure as much as possible for chunking.
 * @param {object} document - The Document AI document object.
 * @returns {Array<object>} An array of objects, each with 'text' and optional 'page_start', 'page_end'.
 */
function extractText(document) {
  if (!document) return [];

  const extractedContent = [];

  // Prioritize document.text if available, as it's the full document text
  if (document.text && document.text.trim()) {
    extractedContent.push({ text: document.text });
    return extractedContent;
  }

  // Fallback to page-by-page text extraction if document.text is not available or empty
  if (document.pages) {
    for (const page of document.pages) {
      if (page.text && page.text.trim()) {
        extractedContent.push({
          text: page.text,
          page_start: page.pageNumber,
          page_end: page.pageNumber,
        });
      }
    }
  }

  return extractedContent;
}

/**
 * Parse gs:// URI into bucket + prefix
 */
function parseGcsUri(gcsUri) {
  if (!gcsUri.startsWith('gs://')) throw new Error(`Invalid GCS URI: ${gcsUri}`);
  const parts = gcsUri.replace('gs://', '').split('/');
  const bucketName = parts.shift();
  const prefix = parts.join('/');
  return { bucketName, prefix };
}

module.exports = {
  extractTextFromDocument,
  batchProcessDocument,
  getOperationStatus,
  fetchBatchResults,
  extractText,
};
