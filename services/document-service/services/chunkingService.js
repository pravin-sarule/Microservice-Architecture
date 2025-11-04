// const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

// /**
//  * Main chunking function that routes to appropriate chunking method
//  * @param {Array<Object>} structuredContent - Array of content blocks with text, page_start, page_end, heading
//  * @param {string} documentId - Unique identifier for the document
//  * @param {string} method - Chunking method: 'fixed_size', 'recursive', 'structural', 'semantic', 'agentic'
//  * @param {number} chunkSize - Maximum size of each chunk (default: 4000)
//  * @param {number} chunkOverlap - Number of characters to overlap between chunks (default: 400)
//  * @returns {Array<Object>} Array of chunk objects with content, metadata, and token_count
//  */
// async function chunkDocument(
//   structuredContent,
//   documentId,
//   method = 'recursive',
//   chunkSize = 4000,
//   chunkOverlap = 400
// ) {
//   // Validate input
//   if (!structuredContent || !Array.isArray(structuredContent) || structuredContent.length === 0) {
//     console.warn('Empty or invalid structured content provided.');
//     return [];
//   }

//   // Helper function to format chunks with metadata
//   const formatChunk = (content, metadata) => ({
//     content,
//     metadata: {
//       ...metadata,
//       document_id: documentId,
//     },
//     token_count: estimateTokenCount(content),
//   });

//   let chunks = [];

//   // Route to appropriate chunking method
//   const effectiveMethod = method || 'recursive';

//   switch (effectiveMethod) {
//     case 'fixed_size':
//       chunks = await fixedSizeChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
//       break;
//     case 'recursive':
//       chunks = await recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
//       break;
//     case 'structural':
//       chunks = await structuralChunker(structuredContent, formatChunk);
//       break;
//     case 'semantic':
//       chunks = await semanticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
//       break;
//     case 'agentic':
//       chunks = await agenticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
//       break;
//     default:
//       console.warn(`Unknown chunking method: ${method}. Falling back to recursive.`);
//       chunks = await recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
//       break;
//   }

//   console.log(`Chunked document ${documentId} using ${method} method: ${chunks.length} chunks created.`);
//   return chunks;
// }

// /**
//  * Estimate token count (more accurate than simple character count)
//  * Rough estimation: 1 token ≈ 4 characters for English text
//  */
// function estimateTokenCount(text) {
//   if (!text) return 0;
//   return Math.ceil(text.length / 4);
// }

// /**
//  * FIXED SIZE CHUNKING
//  * Splits text into fixed-size pieces with overlap
//  * Best for: Simple documents without complex structure
//  */
// async function fixedSizeChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
//   const allChunks = [];

//   for (const contentBlock of structuredContent) {
//     const { text, page_start, page_end, heading } = contentBlock;

//     if (!text || text.trim() === '') {
//       continue;
//     }

//     let currentPosition = 0;
//     const step = Math.max(1, chunkSize - chunkOverlap); // Prevent infinite loop

//     while (currentPosition < text.length) {
//       const endPosition = Math.min(currentPosition + chunkSize, text.length);
//       const chunkContent = text.substring(currentPosition, endPosition);

//       allChunks.push(
//         formatChunk(chunkContent, {
//           page_start,
//           page_end,
//           heading,
//           chunk_method: 'fixed_size',
//         })
//       );

//       currentPosition += step;
//     }
//   }

//   return allChunks;
// }

// /**
//  * RECURSIVE CHUNKING
//  * Uses LangChain's RecursiveCharacterTextSplitter
//  * Preserves structure by splitting on different delimiters hierarchically
//  * Best for: General purpose, maintains some document structure
//  */
// async function recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
//   const splitter = new RecursiveCharacterTextSplitter({
//     chunkSize,
//     chunkOverlap,
//     separators: ['\n\n', '\n', '. ', ' ', ''], // Split by paragraphs, lines, sentences, words
//   });

//   const allChunks = [];

//   for (const contentBlock of structuredContent) {
//     const { text, page_start, page_end, heading } = contentBlock;

//     if (!text || text.trim() === '') {
//       continue;
//     }

//     const output = await splitter.createDocuments([text]);

//     output.forEach((doc) => {
//       allChunks.push(
//         formatChunk(doc.pageContent, {
//           page_start,
//           page_end,
//           heading,
//           chunk_method: 'recursive',
//           ...doc.metadata,
//         })
//       );
//     });
//   }

//   return allChunks;
// }

// /**
//  * STRUCTURAL CHUNKING
//  * Splits based on document structure: headings, sections, page breaks
//  * Best for: Well-structured documents with clear hierarchies
//  */
// async function structuralChunker(structuredContent, formatChunk) {
//   const allChunks = [];

//   for (const contentBlock of structuredContent) {
//     const { text, page_start, page_end, heading } = contentBlock;

//     if (!text || text.trim() === '') {
//       continue;
//     }

//     // Split by structural elements
//     const structuralSections = splitByStructuralElements(text);

//     structuralSections.forEach((section) => {
//       if (section.content.trim().length > 0) {
//         allChunks.push(
//           formatChunk(section.content, {
//             page_start,
//             page_end,
//             heading: section.heading || heading,
//             section_type: section.type,
//             chunk_method: 'structural',
//           })
//         );
//       }
//     });
//   }

//   return allChunks;
// }

// /**
//  * Helper function to identify and split by structural elements
//  */
// function splitByStructuralElements(text) {
//   const sections = [];
//   const lines = text.split('\n');
//   let currentSection = { content: '', heading: null, type: 'paragraph' };

//   for (let i = 0; i < lines.length; i++) {
//     const line = lines[i];

//     // Detect headings (various formats)
//     if (isHeading(line)) {
//       // Save previous section
//       if (currentSection.content.trim()) {
//         sections.push({ ...currentSection });
//       }
//       // Start new section with heading
//       currentSection = {
//         content: line + '\n',
//         type: 'section',
//         heading: line.trim(),
//       };
//     } else if (line.trim() === '') {
//       // Empty line - might indicate section break
//       if (currentSection.content.trim()) {
//         currentSection.content += line + '\n';
//       }
//     } else {
//       currentSection.content += line + '\n';
//     }
//   }

//   // Add final section
//   if (currentSection.content.trim()) {
//     sections.push(currentSection);
//   }

//   return sections;
// }

// /**
//  * Detect if a line is a heading
//  */
// function isHeading(line) {
//   const trimmed = line.trim();
  
//   // Check for common heading patterns in legal documents
//   const headingPatterns = [
//     /^[A-Z][A-Z\s]{3,}$/, // ALL CAPS (minimum 4 chars)
//     /^(?:SECTION|ARTICLE|CHAPTER|PART)\s+\d+/i, // SECTION 1, ARTICLE II, etc.
//     /^\d+\.\s+[A-Z]/, // 1. Heading
//     /^[IVXLCDM]+\.\s+/, // Roman numerals: I. II. III.
//     /^#{1,6}\s+/, // Markdown style headings
//   ];

//   return headingPatterns.some((pattern) => pattern.test(trimmed));
// }

// /**
//  * SEMANTIC CHUNKING
//  * Splits based on semantic meaning and context
//  * Currently falls back to enhanced recursive chunking
//  * Best for: Documents where meaning and context matter most
//  */
// async function semanticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
//   console.log('Semantic chunking: using enhanced recursive approach with semantic separators.');
  
//   // Use semantic-aware separators
//   const splitter = new RecursiveCharacterTextSplitter({
//     chunkSize,
//     chunkOverlap,
//     separators: [
//       '\n\n\n', // Multiple line breaks (strong semantic boundary)
//       '\n\n', // Paragraph breaks
//       '.\n', // Sentence ending with new line
//       '. ', // Sentence endings
//       ';\n', // Clause endings with new line
//       '; ', // Clause endings
//       ',\n', // List items with new line
//       '\n', // Line breaks
//       ' ', // Words
//       '', // Characters
//     ],
//   });

//   const allChunks = [];

//   for (const contentBlock of structuredContent) {
//     const { text, page_start, page_end, heading } = contentBlock;

//     if (!text || text.trim() === '') {
//       continue;
//     }

//     const output = await splitter.createDocuments([text]);

//     output.forEach((doc) => {
//       allChunks.push(
//         formatChunk(doc.pageContent, {
//           page_start,
//           page_end,
//           heading,
//           chunk_method: 'semantic',
//           ...doc.metadata,
//         })
//       );
//     });
//   }

//   return allChunks;
// }

// /**
//  * AGENTIC CHUNKING
//  * Intelligent splitting: detects and preserves meaningful units
//  * - Paragraphs as single chunks
//  * - Tables as single chunks
//  * - Numbered clauses as separate chunks
//  * - Bullet points grouped intelligently
//  * - Headings kept with their content
//  * Best for: Legal documents, contracts, complex structured documents
//  */
// async function agenticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
//   const allChunks = [];

//   for (const contentBlock of structuredContent) {
//     const { text, page_start, page_end, heading } = contentBlock;

//     if (!text || text.trim() === '') {
//       continue;
//     }

//     // Parse text into intelligent units
//     const intelligentUnits = parseIntelligentUnits(text, chunkSize);

//     intelligentUnits.forEach((unit) => {
//       allChunks.push(
//         formatChunk(unit.content, {
//           page_start,
//           page_end,
//           heading: unit.heading || heading,
//           unit_type: unit.type,
//           chunk_method: 'agentic',
//         })
//       );
//     });
//   }

//   return allChunks;
// }

// /**
//  * Parse text into intelligent units for agentic chunking
//  */
// function parseIntelligentUnits(text, maxSize) {
//   const units = [];
//   const lines = text.split('\n');
//   let currentUnit = { content: '', type: 'paragraph', heading: null };

//   for (let i = 0; i < lines.length; i++) {
//     const line = lines[i];
//     const trimmed = line.trim();

//     // Skip empty lines unless they're section breaks
//     if (trimmed === '') {
//       if (currentUnit.content.trim()) {
//         currentUnit.content += '\n';
//       }
//       continue;
//     }

//     // Detect unit type
//     const lineType = detectLineType(line);

//     // Handle tables - keep as single unit
//     if (lineType === 'table' || currentUnit.type === 'table') {
//       if (currentUnit.type !== 'table') {
//         // Save previous unit and start table
//         if (currentUnit.content.trim()) {
//           units.push({ ...currentUnit });
//         }
//         currentUnit = { content: line + '\n', type: 'table', heading: null };
//       } else {
//         currentUnit.content += line + '\n';
//         // Check if table ended
//         if (!isTableLine(lines[i + 1])) {
//           units.push({ ...currentUnit });
//           currentUnit = { content: '', type: 'paragraph', heading: null };
//         }
//       }
//       continue;
//     }

//     // Handle headings
//     if (lineType === 'heading') {
//       if (currentUnit.content.trim()) {
//         units.push({ ...currentUnit });
//       }
//       currentUnit = {
//         content: line + '\n',
//         type: 'section',
//         heading: trimmed,
//       };
//       continue;
//     }

//     // Handle numbered clauses (legal documents)
//     if (lineType === 'numbered_clause') {
//       if (currentUnit.content.trim() && currentUnit.type !== 'numbered_clause') {
//         units.push({ ...currentUnit });
//         currentUnit = { content: '', type: 'numbered_clause', heading: null };
//       }
//       currentUnit.content += line + '\n';
      
//       // Check if this clause is complete (next line is new clause or different type)
//       const nextLineType = i + 1 < lines.length ? detectLineType(lines[i + 1]) : null;
//       if (nextLineType !== 'continuation' && nextLineType !== null) {
//         if (currentUnit.content.length < maxSize * 0.8) {
//           units.push({ ...currentUnit });
//           currentUnit = { content: '', type: 'paragraph', heading: null };
//         }
//       }
//       continue;
//     }

//     // Handle bullet points
//     if (lineType === 'bullet_point') {
//       if (currentUnit.type !== 'bullet_list') {
//         if (currentUnit.content.trim()) {
//           units.push({ ...currentUnit });
//         }
//         currentUnit = { content: '', type: 'bullet_list', heading: null };
//       }
//       currentUnit.content += line + '\n';
//       continue;
//     }

//     // Regular paragraph text
//     currentUnit.content += line + '\n';

//     // Split if unit becomes too large
//     if (currentUnit.content.length > maxSize) {
//       const splitUnits = splitLargeUnit(currentUnit.content, maxSize, currentUnit.type);
//       splitUnits.forEach((splitContent) => {
//         units.push({
//           content: splitContent,
//           type: currentUnit.type,
//           heading: currentUnit.heading,
//         });
//       });
//       currentUnit = { content: '', type: 'paragraph', heading: null };
//     }
//   }

//   // Add final unit
//   if (currentUnit.content.trim()) {
//     units.push(currentUnit);
//   }

//   return units;
// }

// /**
//  * Detect the type of a line
//  */
// function detectLineType(line) {
//   if (!line) return null;
  
//   const trimmed = line.trim();

//   // Table detection (simple heuristic - contains multiple pipes or tabs)
//   if (trimmed.includes('|') || (trimmed.match(/\t/g) || []).length > 2) {
//     return 'table';
//   }

//   // Heading detection
//   if (isHeading(trimmed)) {
//     return 'heading';
//   }

//   // Numbered clause (legal style): 1.1, 2.3.4, (a), (i), etc.
//   if (/^(?:\d+\.)+\d*\s+|^\([a-z0-9]+\)\s+|^[a-z]\)\s+/i.test(trimmed)) {
//     return 'numbered_clause';
//   }

//   // Bullet points
//   if (/^[-•*]\s+|^[►▪▸]\s+/.test(trimmed)) {
//     return 'bullet_point';
//   }

//   // Continuation of previous element
//   if (trimmed.length > 0 && !/^[A-Z0-9]/.test(trimmed)) {
//     return 'continuation';
//   }

//   return 'paragraph';
// }

// /**
//  * Check if a line is part of a table
//  */
// function isTableLine(line) {
//   if (!line) return false;
//   const trimmed = line.trim();
//   return trimmed.includes('|') || trimmed.match(/\t{2,}/) || trimmed.match(/\s{4,}/);
// }

// /**
//  * Split a large unit into smaller chunks while preserving meaning
//  */
// function splitLargeUnit(content, maxSize, unitType) {
//   const chunks = [];
  
//   // For tables, don't split - return as is even if large
//   if (unitType === 'table') {
//     return [content];
//   }

//   // Split by sentences for paragraphs
//   const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
//   let currentChunk = '';

//   for (const sentence of sentences) {
//     if ((currentChunk + sentence).length > maxSize && currentChunk.length > 0) {
//       chunks.push(currentChunk.trim());
//       currentChunk = sentence;
//     } else {
//       currentChunk += sentence;
//     }
//   }

//   if (currentChunk.trim()) {
//     chunks.push(currentChunk.trim());
//   }

//   return chunks;
// }

// module.exports = {
//   chunkDocument,
//   fixedSizeChunker,
//   recursiveChunker,
//   structuralChunker,
//   semanticChunker,
//   agenticChunker,
// };


const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

/* ────────────────────────────────────────────────
 * Utility: Estimate token count
 * Rough rule of thumb: 1 token ≈ 4 characters (English)
 * ──────────────────────────────────────────────── */
function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/* ────────────────────────────────────────────────
 * Utility: Merge small chunks to reduce token cost
 * ──────────────────────────────────────────────── */
function mergeSmallChunks(chunks, minChunkSize = 300) {
  if (!Array.isArray(chunks)) return [];
  const merged = [];
  let buffer = '';

  for (const chunk of chunks) {
    if ((buffer + chunk).length < minChunkSize) {
      buffer += chunk + ' ';
    } else {
      if (buffer.trim()) {
        merged.push(buffer.trim());
        buffer = '';
      }
      merged.push(chunk.trim());
    }
  }

  if (buffer.trim()) merged.push(buffer.trim());
  return merged;
}

/* ────────────────────────────────────────────────
 * Detect headings (for structural / agentic chunking)
 * ──────────────────────────────────────────────── */
function isHeading(line) {
  const trimmed = line.trim();
  const headingPatterns = [
    /^[A-Z][A-Z\s]{3,}$/, // ALL CAPS (minimum 4 chars)
    /^(?:SECTION|ARTICLE|CHAPTER|PART)\s+\d+/i,
    /^\d+\.\s+[A-Z]/,
    /^[IVXLCDM]+\.\s+/,
    /^#{1,6}\s+/,
  ];
  return headingPatterns.some((pattern) => pattern.test(trimmed));
}

/* ────────────────────────────────────────────────
 * Utility: Split text by structural elements
 * ──────────────────────────────────────────────── */
function splitByStructuralElements(text) {
  const sections = [];
  const lines = text.split('\n');
  let current = { content: '', heading: null, type: 'paragraph' };

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.content.trim()) sections.push({ ...current });
      current = { content: line + '\n', heading: line.trim(), type: 'section' };
    } else {
      current.content += line + '\n';
    }
  }

  if (current.content.trim()) sections.push(current);
  return sections;
}

/* ────────────────────────────────────────────────
 * Line type detector (for agentic chunking)
 * ──────────────────────────────────────────────── */
function detectLineType(line) {
  if (!line) return null;
  const trimmed = line.trim();

  if (trimmed.includes('|') || (trimmed.match(/\t/g) || []).length > 2)
    return 'table';
  if (isHeading(trimmed)) return 'heading';
  if (/^(?:\d+\.)+\d*\s+|^\([a-z0-9]+\)\s+/i.test(trimmed))
    return 'numbered_clause';
  if (/^[-•*]\s+|^[►▪▸]\s+/.test(trimmed)) return 'bullet_point';
  return 'paragraph';
}

/* ────────────────────────────────────────────────
 * Split large paragraph into smaller ones
 * ──────────────────────────────────────────────── */
function splitLargeUnit(content, maxSize) {
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else current += s;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/* ────────────────────────────────────────────────
 * 1️⃣ FIXED SIZE CHUNKER
 * ──────────────────────────────────────────────── */
async function fixedSizeChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
  const chunks = [];
  const step = Math.max(1, chunkSize - chunkOverlap);

  for (const block of structuredContent) {
    const { text, page_start, page_end, heading } = block;
    if (!text || !text.trim()) continue;

    for (let i = 0; i < text.length; i += step) {
      const end = Math.min(i + chunkSize, text.length);
      const content = text.substring(i, end);
      chunks.push(formatChunk(content, {
        page_start, page_end, heading,
        chunk_method: 'fixed_size'
      }));
    }
  }

  return chunks;
}

/* ────────────────────────────────────────────────
 * 2️⃣ RECURSIVE CHUNKER (optimized for cost)
 * ──────────────────────────────────────────────── */
async function recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '. ', '; ', '\n', ' ', ''],
  });

  const chunks = [];

  for (const block of structuredContent) {
    const { text, page_start, page_end, heading } = block;
    if (!text || !text.trim()) continue;

    const docs = await splitter.createDocuments([text]);
    const mergedDocs = mergeSmallChunks(docs.map((d) => d.pageContent));

    mergedDocs.forEach((content, i) => {
      chunks.push(formatChunk(content, {
        page_start, page_end, heading,
        chunk_method: 'recursive',
        chunk_index: i + 1
      }));
    });
  }

  return chunks;
}

/* ────────────────────────────────────────────────
 * 3️⃣ STRUCTURAL CHUNKER
 * ──────────────────────────────────────────────── */
async function structuralChunker(structuredContent, formatChunk) {
  const chunks = [];

  for (const block of structuredContent) {
    const { text, page_start, page_end, heading } = block;
    if (!text || !text.trim()) continue;

    const sections = splitByStructuralElements(text);
    sections.forEach((s) => {
      chunks.push(formatChunk(s.content, {
        page_start, page_end,
        heading: s.heading || heading,
        section_type: s.type,
        chunk_method: 'structural'
      }));
    });
  }

  return chunks;
}

/* ────────────────────────────────────────────────
 * 4️⃣ SEMANTIC CHUNKER (enhanced recursive)
 * ──────────────────────────────────────────────── */
async function semanticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: [
      '\n\n\n', '\n\n', '.\n', '. ', ';\n', '; ', '\n', ' ', ''
    ],
  });

  const chunks = [];

  for (const block of structuredContent) {
    const { text, page_start, page_end, heading } = block;
    if (!text || !text.trim()) continue;

    const docs = await splitter.createDocuments([text]);
    const merged = mergeSmallChunks(docs.map((d) => d.pageContent));

    merged.forEach((content, i) => {
      chunks.push(formatChunk(content, {
        page_start, page_end, heading,
        chunk_method: 'semantic',
        chunk_index: i + 1
      }));
    });
  }

  return chunks;
}

/* ────────────────────────────────────────────────
 * 5️⃣ AGENTIC CHUNKER (intelligent)
 * ──────────────────────────────────────────────── */
async function agenticChunker(structuredContent, chunkSize, formatChunk) {
  const chunks = [];

  for (const block of structuredContent) {
    const { text, page_start, page_end, heading } = block;
    if (!text || !text.trim()) continue;

    const lines = text.split('\n');
    let current = { content: '', type: 'paragraph', heading: null };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const type = detectLineType(line);

      if (type === 'heading') {
        if (current.content.trim()) chunks.push(formatChunk(current.content, {
          page_start, page_end,
          heading: current.heading || heading,
          chunk_method: 'agentic',
          unit_type: current.type
        }));
        current = { content: line + '\n', type: 'section', heading: line.trim() };
      } else {
        current.content += line + '\n';
      }

      // Split if too long
      if (current.content.length > chunkSize * 1.2) {
        const parts = splitLargeUnit(current.content, chunkSize);
        parts.forEach((p) =>
          chunks.push(formatChunk(p, {
            page_start, page_end,
            heading: current.heading || heading,
            chunk_method: 'agentic',
            unit_type: current.type
          }))
        );
        current.content = '';
      }
    }

    if (current.content.trim()) {
      chunks.push(formatChunk(current.content, {
        page_start, page_end,
        heading: current.heading || heading,
        chunk_method: 'agentic',
        unit_type: current.type
      }));
    }
  }

  return chunks;
}

/* ────────────────────────────────────────────────
 * MAIN ENTRYPOINT
 * ──────────────────────────────────────────────── */
async function chunkDocument(
  structuredContent,
  documentId,
  method = 'optimized_recursive',
  chunkSize = 1200,
  chunkOverlap = 150
) {
  if (!structuredContent || !structuredContent.length) {
    console.warn('⚠️ Empty structured content.');
    return [];
  }

  const formatChunk = (content, metadata) => ({
    content,
    metadata: { ...metadata, document_id: documentId },
    token_count: estimateTokenCount(content),
  });

  let chunks = [];

  switch (method) {
    case 'fixed_size':
      chunks = await fixedSizeChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
      break;
    case 'recursive':
    case 'optimized_recursive':
      chunks = await recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
      break;
    case 'structural':
      chunks = await structuralChunker(structuredContent, formatChunk);
      break;
    case 'semantic':
      chunks = await semanticChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
      break;
    case 'agentic':
      chunks = await agenticChunker(structuredContent, chunkSize, formatChunk);
      break;
    default:
      console.warn(`Unknown method "${method}", defaulting to optimized recursive.`);
      chunks = await recursiveChunker(structuredContent, chunkSize, chunkOverlap, formatChunk);
  }

  console.log(`✅ Document ${documentId}: ${chunks.length} chunks created (method=${method}).`);
  return chunks;
}

/* ────────────────────────────────────────────────
 * EXPORTS
 * ──────────────────────────────────────────────── */
module.exports = {
  chunkDocument,
  fixedSizeChunker,
  recursiveChunker,
  structuralChunker,
  semanticChunker,
  agenticChunker,
  estimateTokenCount,
};
