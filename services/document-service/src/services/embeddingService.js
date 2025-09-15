const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001"});
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("❌ Error generating embedding:", error.message);
    throw new Error("Failed to generate embedding.");
  }
}

async function generateEmbeddings(texts) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001"});
    const result = await model.batchEmbedContents({
      requests: texts.map(text => ({ content: { parts: [{ text }] } })),
    });
    return result.embeddings.map(e => e.values);
  } catch (error) {
    console.error("❌ Error generating batch embeddings:", error.message);
    throw new Error("Failed to generate batch embeddings.");
  }
}

module.exports = {
  generateEmbedding,
  generateEmbeddings
};