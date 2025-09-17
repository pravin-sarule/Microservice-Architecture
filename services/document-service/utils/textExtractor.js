const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractText(fileBuffer, mimetype) {
  let extracted = '';
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(fileBuffer);
    extracted = data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    extracted = result.value;
  } else {
    throw new Error('Unsupported file type for text extraction');
  }
  return normalizeText(extracted);
}

/**
 * Normalizes text by removing excessive whitespace, trimming, and standardizing newlines.
 * @param {string} text The input text to normalize.
 * @returns {string} The normalized text.
 */
function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  // Replace multiple spaces/tabs with a single space
  let cleanedText = text.replace(/[ \t]+/g, ' ');
  // Replace multiple newlines with at most two newlines (for paragraph separation)
  cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n');
  // Trim leading/trailing whitespace from each line and the whole text
  cleanedText = cleanedText.split('\n').map(line => line.trim()).join('\n');
  return cleanedText.trim();
}

module.exports = { extractText, normalizeText };