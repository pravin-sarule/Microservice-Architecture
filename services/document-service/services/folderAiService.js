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

exports.queryFolderWithGemini = async (prompt, chatHistory = []) => {
  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    throw new Error("Prompt for folder query is missing or invalid.");
  }

  const runChat = async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const history = [
        {
          role: "user",
          parts: [{ text: prompt.slice(0, 100000) }], // Use the entire prompt as the user's input
        },
        ...chatHistory // Add existing chat history
      ];

      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 3000,
        },
      });

      const result = await chat.sendMessage("Please provide your answer based on the context provided."); // Send a generic message to trigger response
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("❌ Error querying folder with Gemini:", error.message);
      throw new Error("Failed to get AI answer for folder query from Gemini.");
    }
  };

  return await retryWithBackoff(runChat);
};