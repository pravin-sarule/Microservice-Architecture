const { askLLM, resolveProviderName } = require('./aiService');

exports.askFolderLLM = async (providerFromDB, userMessage, context = '', chatHistory = []) => {
  if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
    throw new Error("User message for folder query is missing or invalid.");
  }

  const resolvedProvider = resolveProviderName(providerFromDB);

  // Construct the full message including chat history
  let fullUserMessage = '';
  if (chatHistory.length > 0) {
    fullUserMessage += 'Previous conversation:\n';
    chatHistory.forEach(chat => {
      fullUserMessage += `User: ${chat.question}\n`;
      fullUserMessage += `Assistant: ${chat.answer}\n`;
    });
    fullUserMessage += '\n';
  }
  fullUserMessage += userMessage;

  try {
    // The askLLM function already includes retry logic
    const answer = await askLLM(resolvedProvider, fullUserMessage, context);
    return answer;
  } catch (error) {
    console.error(`❌ Error asking folder LLM (${resolvedProvider}):`, error.message);
    throw new Error(`Failed to get AI answer for folder query from ${resolvedProvider}.`);
  }
};