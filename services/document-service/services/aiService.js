

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper: Retry logic
async function retryWithBackoff(fn, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`⚠️ Gemini call failed (attempt ${attempt}):`, err.message);

      if (
        err.message.includes("overloaded") ||
        err.message.includes("503") ||
        err.message.includes("temporarily unavailable")
      ) {
        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, delay));
        } else {
          throw new Error("Gemini model is overloaded. Please try again later.");
        }
      } else {
        throw err;
      }
    }
  }
}

// =======================
// 🔍 ANALYZE DOCUMENT
// =======================
exports.analyzeWithGemini = async (documentText) => {
  if (!documentText || typeof documentText !== "string" || documentText.trim() === "") {
    console.error("Invalid document text input:", documentText);
    throw new Error("Document content is missing or invalid.");
  }

  const prompt = `Analyze the following legal document and provide the following fields in JSON format:
- summary
- legal_grounds
- key_issues
- citations (include page and paragraph if known)
- timeline (chronological legal steps)
- confidence (as a percentage)

Document:
${documentText.slice(0, 100000)}

Respond strictly in JSON format only. Example:
{
  "summary": "...",
  "legal_grounds": ["..."],
  "key_issues": ["..."],
  "citations": [{"page": 1, "para": 3, "text": "..."}, {"page": 2, "para": 5, "text": "..."}],
  "timeline": ["...", "..."],
  "confidence": "95%"
}`;

  const runAnalysis = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const jsonString = text.substring(jsonStart, jsonEnd + 1);

      return JSON.parse(jsonString);
    } catch (error) {
      console.error("❌ Gemini analysis failed:", error.message);
      throw new Error("Failed to analyze document with Gemini.");
    }
  };

  return await retryWithBackoff(runAnalysis);
};

// =======================
// 💬 ASK QUESTION TO DOCUMENT
// =======================
exports.askGemini = async (docText, question, chatHistory = []) => {
  if (!docText || typeof docText !== "string") {
    throw new Error("Document text is missing or invalid.");
  }

  if (!question || typeof question !== "string") {
    throw new Error("Question is missing or invalid.");
  }

  const runChat = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const history = [
        {
          role: "user",
          parts: [{ text: `Here is the legal document content:\n\n${docText.slice(0, 100000)}` }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I'm ready to answer questions about the document." }],
        },
        ...chatHistory // Add existing chat history
      ];

      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 3000,
        },
      });

      const result = await chat.sendMessage(question);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("❌ Error asking Gemini:", error.message);
      throw new Error("Failed to get AI answer from Gemini.");
    }
  };

  return await retryWithBackoff(runChat);
};

// =======================
// 📝 GET SUMMARY FROM CHUNKS
// =======================
exports.getSummaryFromChunks = async (chunkText) => {
  if (!chunkText || typeof chunkText !== "string" || chunkText.trim() === "") {
    console.error("Invalid chunk text input for summary:", chunkText);
    throw new Error("Chunk content is missing or invalid for summary generation.");
  }

  const prompt = `Please provide a concise summary of the following text. Focus on the main points and key information.

Text:
${chunkText.slice(0, 100000)}

Provide a summary of approximately 2500 words if the content allows.

Summary:`;

  const runSummary = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return text;
    } catch (error) {
      console.error("❌ Error generating summary with Gemini:", error.message);
      throw new Error("Failed to generate summary with AI.");
    }
  };

  return await retryWithBackoff(runSummary);
};