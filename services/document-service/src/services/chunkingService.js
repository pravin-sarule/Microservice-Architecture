

const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

async function chunkDocument(structuredContent, documentId, chunkSize = 4000, chunkOverlap = 400) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const allChunks = [];

  for (const contentBlock of structuredContent) {
    const { text, page_start, page_end, heading } = contentBlock;

    if (!text || text.trim() === '') {
      continue; // Skip empty text blocks
    }

    const output = await splitter.createDocuments([text]);

    output.forEach(doc => {
      allChunks.push({
        content: doc.pageContent,
        metadata: {
          ...doc.metadata, // Preserve any metadata from the splitter
          page_start: page_start,
          page_end: page_end,
          heading: heading,
          document_id: documentId,
        },
        token_count: doc.pageContent.length, // Simple token count
      });
    });
  }
  return allChunks;
}

module.exports = {
  chunkDocument
};