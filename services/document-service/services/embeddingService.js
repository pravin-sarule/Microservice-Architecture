// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function generateEmbedding(text) {
//   try {
//     const model = genAI.getGenerativeModel({ model: "embedding-001"});
//     const result = await model.embedContent(text);
//     return result.embedding.values;
//   } catch (error) {
//     console.error("❌ Error generating embedding:", error.message);
//     throw new Error("Failed to generate embedding.");
//   }
// }

// async function generateEmbeddings(texts) {
//   try {
//     const model = genAI.getGenerativeModel({ model: "embedding-001"});
//     const result = await model.batchEmbedContents({
//       requests: texts.map(text => ({ content: { parts: [{ text }] } })),
//     });
//     return result.embeddings.map(e => e.values);
//   } catch (error) {
//     console.error("❌ Error generating batch embeddings:", error.message);
//     throw new Error("Failed to generate batch embeddings.");
//   }
// }

// module.exports = {
//   generateEmbedding,
//   generateEmbeddings
// };


const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MAX_CHARS = 8000;     // Safe limit per chunk
const BATCH_SIZE = 100;     // Safe batch size per Gemini API call

/** ✅ Clean text so Gemini won't reject it */
function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
}

/** ✅ Single text embedding */
async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });

    const cleaned = cleanText(text);
    const result = await model.embedContent({
      content: { parts: [{ text: cleaned }] },
    });

    return result.embedding.values;
  } catch (error) {
    console.error("❌ Error generating embedding:", error?.message || error);
    throw new Error("Failed to generate embedding.");
  }
}

/** ✅ Batch embeddings for MANY chunks (auto-batched) */
async function generateEmbeddings(texts) {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  const allEmbeddings = [];

  // Process chunks in safe batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const requests = batch.map(t => ({
      content: { parts: [{ text: cleanText(t) }] }
    }));

    try {
      const result = await model.batchEmbedContents({ requests });
      const batchEmbeddings = result.embeddings.map(e => e.values);
      allEmbeddings.push(...batchEmbeddings);

      console.log(`✅ Embedded batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(texts.length / BATCH_SIZE)}`);
    } catch (error) {
      console.error(`❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error?.message || error);
      throw new Error("Failed to generate batch embeddings.");
    }
  }

  return allEmbeddings;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
};
