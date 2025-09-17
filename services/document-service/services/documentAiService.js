
// const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
// const { Storage } = require('@google-cloud/storage');
// const { credentials } = require('../src/config/gcs');

// const projectId = process.env.GCLOUD_PROJECT_ID;
// const location = process.env.DOCUMENT_AI_LOCATION || 'us';
// const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

// const client = new DocumentProcessorServiceClient({ credentials });
// const storage = new Storage({ credentials });

// /**
//  * Process small documents (<20MB inline)
//  */
// async function extractTextFromDocument(fileBuffer, mimeType) {
//   const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
//   const request = {
//     name,
//     rawDocument: {
//       content: fileBuffer.toString('base64'),
//       mimeType,
//     },
//   };

//   const [result] = await client.processDocument(request);
//   return extractStructuredContent(result.document);
// }

// /**
//  * Batch process (large docs, up to 500 pages)
//  */
// async function batchProcessDocument(inputUris, outputUriPrefix, mimeType = 'application/pdf') {
//   const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
//   const uris = Array.isArray(inputUris) ? inputUris : [inputUris];

//   if (!outputUriPrefix.endsWith('/')) outputUriPrefix += '/';

//   // Validate input files exist
//   for (const uri of uris) {
//     const { bucketName, prefix } = parseGcsUri(uri);
//     const [exists] = await storage.bucket(bucketName).file(prefix).exists();
//     if (!exists) {
//       throw new Error(`Input file not found in GCS: ${uri}`);
//     }
//   }

//   const request = {
//     name,
//     inputDocuments: {
//       gcsDocuments: {
//         documents: uris.map(uri => ({ gcsUri: uri, mimeType })),
//       },
//     },
//     documentOutputConfig: { gcsOutputConfig: { gcsUri: outputUriPrefix } },
//   };

//   const [operation] = await client.batchProcessDocuments(request);
//   console.log(`📄 Started batch operation: ${operation.name}`);
//   return operation.name;
// }

// /**
//  * Get status of a long-running Document AI operation
//  */
// async function getOperationStatus(operationName) {
//   const [operation] = await client.operationsClient.getOperation({ name: operationName });
//   console.log(`[DocumentAIService] Operation response: ${JSON.stringify(operation)}`); // Add this line
//   return {
//     done: operation.done || false,
//     error: operation.error || null,
//     response: operation.response || null,
//   };
// }

// /**
//  * Fetch batch results from GCS
//  */
// async function fetchBatchResults(bucketName, prefix) {
//   console.log(`[fetchBatchResults] Fetching files from bucket: ${bucketName}, prefix: ${prefix}`);
//   const [files] = await storage.bucket(bucketName).getFiles({ prefix });
//   console.log(`[fetchBatchResults] Found ${files.length} files.`);

//   const extractedContent = [];
//   for (const file of files) {
//     console.log(`[fetchBatchResults] Processing file: ${file.name}`);
//     if (file.name.endsWith('.json')) {
//       const [contents] = await file.download();
//       const json = JSON.parse(contents.toString());
//       console.log(`[fetchBatchResults] JSON content for ${file.name}: ${JSON.stringify(json, null, 2)}`);
//       // Document AI batch output can sometimes wrap the document in a 'document' field, or directly contain pages.
//       const documentToProcess = json.document || json; // Try to get 'document' or use the whole JSON
//       if (documentToProcess) {
//         extractedContent.push(extractStructuredContent(documentToProcess));
//         console.log(`[fetchBatchResults] Extracted structured content from ${file.name}.`);
//       } else {
//         console.warn(`[fetchBatchResults] No 'document' or direct document content found in JSON for file: ${file.name}`);
//       }
//     } else {
//       console.log(`[fetchBatchResults] Skipping non-JSON file: ${file.name}`);
//     }
//   }
//   // Flatten the array of arrays into a single array of structured content
//   return extractedContent.flat();
// }

// /**
//  * Parse gs:// URI into bucket + prefix
//  */
// function parseGcsUri(gcsUri) {
//   if (!gcsUri.startsWith('gs://')) throw new Error(`Invalid GCS URI: ${gcsUri}`);
//   const parts = gcsUri.replace('gs://', '').split('/');
//   const bucketName = parts.shift();
//   const prefix = parts.join('/');
//   return { bucketName, prefix };
// }

// /**
//  * Extracts structured content (text, page numbers, headings) from a Document AI document object.
//  * This function aims to preserve the document structure as much as possible.
//  * @param {object} document - The Document AI document object.
//  * @returns {Array<string>} An array of plain text strings, each representing a logical section or page.
//  */
// function extractStructuredContent(document) {
//   const extractedTexts = [];
//   if (!document || !document.pages) {
//     console.warn("[extractStructuredContent] No document or pages found in Document AI response.");
//     return extractedTexts;
//   }

//   // Prioritize document.text if available, as it's the full document text
//   if (document.text && document.text.trim()) {
//     extractedTexts.push(document.text);
//     return extractedTexts;
//   }

//   // Fallback to page-by-page text extraction if document.text is not available or empty
//   for (const page of document.pages) {
//     if (page.text && page.text.trim()) {
//       extractedTexts.push(page.text);
//     } else if (page.paragraphs) {
//       // If page.text is empty, try to reconstruct from paragraphs
//       const paragraphTexts = [];
//       for (const p of page.paragraphs) {
//         const textSegment = p.layout?.textAnchor?.textSegments?.[0];
//         if (textSegment && document.text) {
//           const pStartIndex = parseInt(textSegment.startIndex);
//           const pEndIndex = parseInt(textSegment.endIndex);
//           paragraphTexts.push(document.text.substring(pStartIndex, pEndIndex));
//         }
//       }
//       const reconstructedPageText = paragraphTexts.filter(Boolean).join('\n\n');
//       if (reconstructedPageText.trim()) {
//         extractedTexts.push(reconstructedPageText);
//       }
//     }
//   }

//   return extractedTexts;
// }

// module.exports = {
//   extractTextFromDocument,
//   batchProcessDocument,
//   getOperationStatus,
//   fetchBatchResults,
//   extractStructuredContent, // Export for testing or other uses
// };
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');
const { credentials } = require('../config/gcs');

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
