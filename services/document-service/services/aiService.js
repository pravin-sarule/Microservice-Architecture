


// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Retry Helper (exponential backoff)
// // ---------------------------
// async function retryWithBackoff(fn, retries = 3, delay = 2000) {
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
//       if (
//         err.message.includes('overloaded') ||
//         err.message.includes('503') ||
//         err.message.includes('temporarily unavailable') ||
//         err.message.includes('quota') ||
//         err.message.includes('rate limit')
//       ) {
//         if (attempt < retries) {
//           await new Promise(res => setTimeout(res, delay * attempt));
//         } else {
//           throw new Error('LLM provider is temporarily unavailable. Please try again later.');
//         }
//       } else {
//         throw err;
//       }
//     }
//   }
// }

// // ---------------------------
// // LLM Configurations
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20241022', // Fixed: Use actual existing model
//     maxTokens: 8192,
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Provider Aliases (maps DB names to internal config keys)
// // ---------------------------
// const PROVIDER_ALIASES = {
//   // OpenAI
//   'gpt-4o-mini': 'openai',
//   'gpt-4-mini': 'openai',
//   'openai': 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4': 'gpt-4o',

//   // Gemini
//   'gemini': 'gemini',
//   'gemini-pro': 'gemini-pro-2.5',
//   'gemini-pro-2.5': 'gemini-pro-2.5',
//   'gemini-2.5-pro': 'gemini-pro-2.5',
//   'gemini-2.0-flash': 'gemini',
//   'gemini-1.5-flash': 'gemini',

//   // Anthropic
//   'claude': 'anthropic',
//   'anthropic': 'anthropic',
//   'claude-haiku': 'anthropic',
//   'claude-3-5-haiku': 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',

//   // DeepSeek
//   'deepseek': 'deepseek',
//   'deepseek-chat': 'deepseek'
// };

// // ---------------------------
// // Gemini Model Mapping
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash'],
//   'gemini-pro-2.5': ['gemini-exp-1206', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'],
// };

// // ---------------------------
// // Provider Resolver
// // ---------------------------
// function resolveProviderName(nameFromDB = '') {
//   const lower = nameFromDB.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[lower] || 'gemini';
//   console.log(`[resolveProviderName] DB name: "${nameFromDB}" → Provider: "${resolved}"`);
//   return resolved;
// }

// // ---------------------------
// // askLLM — unified LLM caller
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);

//   // Gemini Handling
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;

//       for (const modelName of modelNames) {
//         try {
//           console.log(`[askLLM] Trying Gemini model: ${modelName}`);
//           const modelConfig = context
//             ? { model: modelName, systemInstruction: context }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           lastError = error;
//           console.warn(`❌ Gemini model ${modelName} failed: ${error.message}`);
//           continue;
//         }
//       }

//       throw new Error(`All Gemini models failed: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   // OpenAI / Anthropic / DeepSeek
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
//     let requestBody;

//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: config.maxTokens,
//         system: systemPrompt,
//         messages: [{ role: 'user', content: finalUserMessage }],
//       };
//     } else {
//       requestBody = {
//         model: config.model,
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: finalUserMessage },
//         ],
//         max_tokens: config.maxTokens,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Request Body prepared for ${provider}`);
//     console.log(`[askLLM] Calling ${provider} API...`);
    
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 120000, // 2 minutes timeout
//     });

//     const answer =
//       provider === 'anthropic' || provider === 'claude-sonnet-4'
//         ? response.data?.content?.[0]?.text || response.data?.completion
//         : response.data?.choices?.[0]?.message?.content;

//     if (!answer) throw new Error(`Empty response from ${provider}`);
//     console.log(`[askLLM] ✅ Received response from ${provider}, length: ${answer.length}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Helper function for Gemini (backward compatibility)
// // ---------------------------
// async function askGemini(userMessage, context = '') {
//   return askLLM('gemini', userMessage, context);
// }

// // ---------------------------
// // Analyze with Gemini (backward compatibility)
// // ---------------------------
// async function analyzeWithGemini(prompt, context = '') {
//   return askLLM('gemini', prompt, context);
// }

// // ---------------------------
// // Get summary from chunks
// // ---------------------------
// async function getSummaryFromChunks(chunks, provider = 'gemini') {
//   const combinedText = chunks.join('\n\n');
//   const prompt = `Please provide a concise summary of the following text:\n\n${combinedText}`;
//   return askLLM(provider, prompt);
// }

// // ---------------------------
// // Provider Availability Checker
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-exp-1206', headers: {} },
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
//       else if (provider.startsWith('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
//       else key = process.env.OPENAI_API_KEY;

//       return [
//         provider,
//         { available: !!key, reason: key ? 'Available' : 'Missing API key', model: cfg.model },
//       ];
//     })
//   );
// }

// module.exports = {
//   askLLM,
//   askGemini,
//   analyzeWithGemini,
//   getSummaryFromChunks,
//   getAvailableProviders,
//   resolveProviderName,
// };


// require('dotenv').config();
// const axios = require('axios');
// // NOTE: The '@google/generative-ai' package is deprecated.
// // The new, recommended package is '@google/genai'.
// // This code will still work, but you may want to migrate in the future.
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Retry Helper (exponential backoff)
// // ---------------------------
// async function retryWithBackoff(fn, retries = 3, delay = 2000) {
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
//       if (
//         err.message.includes('overloaded') ||
//         err.message.includes('503') ||
//         err.message.includes('temporarily unavailable') ||
//         err.message.includes('quota') ||
//         err.message.includes('rate limit')
//       ) {
//         if (attempt < retries) {
//           await new Promise(res => setTimeout(res, delay * attempt));
//         } else {
//           throw new Error('LLM provider is temporarily unavailable. Please try again later.');
//         }
//       } else {
//         throw err;
//       }
//     }
//   }
// }

// // ---------------------------
// // LLM Configurations
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20241022', // Fixed: Use actual existing model
//     maxTokens: 8192,
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     maxTokens: 4096,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Provider Aliases (maps DB names to internal config keys)
// // ---------------------------
// const PROVIDER_ALIASES = {
//   // OpenAI
//   'gpt-4o-mini': 'openai',
//   'gpt-4-mini': 'openai',
//   'openai': 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4': 'gpt-4o',

//   // Gemini
//   'gemini': 'gemini',
//   'gemini-pro': 'gemini-pro-2.5',
//   'gemini-pro-2.5': 'gemini-pro-2.5',
//   'gemini-2.5-pro': 'gemini-pro-2.5',
//   'gemini-2.0-flash': 'gemini',
//   'gemini-1.5-flash': 'gemini',

//   // Anthropic
//   'claude': 'anthropic',
//   'anthropic': 'anthropic',
//   'claude-haiku': 'anthropic',
//   'claude-3-5-haiku': 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',

//   // DeepSeek
//   'deepseek': 'deepseek',
//   'deepseek-chat': 'deepseek'
// };

// // ---------------------------
// // Gemini Model Mapping
// // ---------------------------
// //
// // *** THIS IS THE CORRECTED SECTION ***
// //
// // The model names are now the current, stable IDs.
// // The fallback logic you built will still work, but it will now
// // try the correct Pro model first.
// //
// const GEMINI_MODELS = {
//   // 'gemini' key (Flash) now points to the stable 2.5 Flash model
//   gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
  
//   // 'gemini-pro-2.5' key (Pro) now points to the stable 2.5 Pro model first.
//   // If 'gemini-2.5-pro' fails, it will fall back to 'gemini-2.5-flash'.
//   'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
// };

// // ---------------------------
// // Provider Resolver
// // ---------------------------
// function resolveProviderName(nameFromDB = '') {
//   const lower = nameFromDB.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[lower] || 'gemini';
//   console.log(`[resolveProviderName] DB name: "${nameFromDB}" → Provider: "${resolved}"`);
//   return resolved;
// }

// // ---------------------------
// // askLLM — unified LLM caller
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);

//   // Gemini Handling
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       // This will now correctly select ['gemini-2.5-pro', 'gemini-2.5-flash']
//       // when the provider is 'gemini-pro-2.5'
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;

//       for (const modelName of modelNames) {
//         try {
//           console.log(`[askLLM] Trying Gemini model: ${modelName}`);
//           const modelConfig = context
//             ? { model: modelName, systemInstruction: context }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
          
//           // Added check for empty response
//           if (!response || !response.text()) {
//              throw new Error(`Empty response from Gemini model ${modelName}`);
//           }
            
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           lastError = error;
//           console.warn(`❌ Gemini model ${modelName} failed: ${error.message}`);
//           continue; // Your logic to try the next model (the fallback)
//         }
//       }

//       throw new Error(`All Gemini models failed: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   // OpenAI / Anthropic / DeepSeek
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
//     let requestBody;

//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: config.maxTokens,
//         system: systemPrompt,
//         messages: [{ role: 'user', content: finalUserMessage }],
//       };
//     } else {
//       requestBody = {
//         model: config.model,
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: finalUserMessage },
//         ],
//         max_tokens: config.maxTokens,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Request Body prepared for ${provider}`);
//     console.log(`[askLLM] Calling ${provider} API...`);
    
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 120000, // 2 minutes timeout
//     });

//     const answer =
//       provider === 'anthropic' || provider === 'claude-sonnet-4'
//         ? response.data?.content?.[0]?.text || response.data?.completion
//         : response.data?.choices?.[0]?.message?.content;

//     if (!answer) throw new Error(`Empty response from ${provider}`);
//     console.log(`[askLLM] ✅ Received response from ${provider}, length: ${answer.length}`);
//     return answer.trim();
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Helper function for Gemini (backward compatibility)
// // ---------------------------
// async function askGemini(userMessage, context = '') {
//   // Defaulting to 'gemini' (which is now 'gemini-2.5-flash')
//   return askLLM('gemini', userMessage, context);
// }

// // ---------------------------
// // Analyze with Gemini (backward compatibility)
// // ---------------------------
// async function analyzeWithGemini(prompt, context = '') {
//   // Defaulting to 'gemini' (which is now 'gemini-2.5-flash')
//   return askLLM('gemini', prompt, context);
// }

// // ---------------------------
// // Get summary from chunks
// // ---------------------------
// async function getSummaryFromChunks(chunks, provider = 'gemini') {
//   const combinedText = chunks.join('\n\n');
//   const prompt = `Please provide a concise summary of the following text:\n\n${combinedText}`;
//   // Ensure the provider name is resolved, e.g. 'gemini' -> 'gemini'
//   const resolvedProvider = resolveProviderName(provider);
//   return askLLM(resolvedProvider, prompt);
// }

// // ---------------------------
// // Provider Availability Checker
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       // *** THIS IS THE SECOND CORRECTED SECTION ***
//       // Updated to show the correct primary models
//       gemini: { model: 'gemini-2.5-flash', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.5-pro', headers: {} },
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
//       else if (provider.startsWith('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
//       else key = process.env.OPENAI_API_KEY;

//       return [
//         provider,
//         { available: !!key, reason: key ? 'Available' : 'Missing API key', model: cfg.model },
//       ];
//     })
//   );
// }

// module.exports = {
//   askLLM,
//   askGemini,
//   analyzeWithGemini,
//   getSummaryFromChunks,
//   getAvailableProviders,
//   resolveProviderName,
// };

require('dotenv').config();
const axios = require('axios');
// NOTE: The '@google/generative-ai' package is deprecated.
// The new, recommended package is '@google/genai'.
// This code will still work, but you may want to migrate in the future.
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------
// Retry Helper (exponential backoff)
// ---------------------------
async function retryWithBackoff(fn, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
      if (
        err.message.includes('overloaded') ||
        err.message.includes('503') ||
        err.message.includes('temporarily unavailable') ||
        err.message.includes('quota') ||
        err.message.includes('rate limit')
      ) {
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, delay * attempt));
        } else {
          throw new Error('LLM provider is temporarily unavailable. Please try again later.');
        }
      } else {
        throw err;
      }
    }
  }
}

// ---------------------------
// LLM Configurations
// ---------------------------
const LLM_CONFIGS = {
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  'gpt-4o': {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    maxTokens: 4096,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 4096,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  'claude-sonnet-4': {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20241022', // Fixed: Use actual existing model
    maxTokens: 8192,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  deepseek: {
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 4096,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  },
};

// ---------------------------
// Provider Aliases (maps DB names to internal config keys)
// ---------------------------
const PROVIDER_ALIASES = {
  // OpenAI
  'gpt-4o-mini': 'openai',
  'gpt-4-mini': 'openai',
  'openai': 'openai',
  'gpt-4o': 'gpt-4o',
  'gpt-4': 'gpt-4o',

  // Gemini
  'gemini': 'gemini',
  'gemini-pro': 'gemini-pro-2.5',
  'gemini-pro-2.5': 'gemini-pro-2.5',
  'gemini-2.5-pro': 'gemini-pro-2.5',
  'gemini-2.0-flash': 'gemini',
  'gemini-1.5-flash': 'gemini',

  // Anthropic
  'claude': 'anthropic',
  'anthropic': 'anthropic',
  'claude-haiku': 'anthropic',
  'claude-3-5-haiku': 'anthropic',
  'claude-sonnet-4': 'claude-sonnet-4',

  // DeepSeek
  'deepseek': 'deepseek',
  'deepseek-chat': 'deepseek'
};

// ---------------------------
// Gemini Model Mapping
// ---------------------------
const GEMINI_MODELS = {
  // 'gemini' key (Flash) now points to the stable 2.5 Flash model
  gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
  
  // 'gemini-pro-2.5' key (Pro) now points to the stable 2.5 Pro model first.
  // If 'gemini-2.5-pro' fails, it will fall back to 'gemini-2.5-flash'.
  'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

// ---------------------------
// Provider Resolver
// ---------------------------
function resolveProviderName(nameFromDB = '') {
  const lower = nameFromDB.trim().toLowerCase();
  const resolved = PROVIDER_ALIASES[lower] || 'gemini';
  console.log(`[resolveProviderName] DB name: "${nameFromDB}" → Provider: "${resolved}"`);
  return resolved;
}

// ---------------------------
// askLLM — unified LLM caller
// ---------------------------
async function askLLM(provider, userMessage, context = '') {
  const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
  console.log(`[askLLM] Provider: ${provider}`);
  console.log(`[askLLM] User message length: ${finalUserMessage.length}`);

  // Gemini Handling
  if (provider.startsWith('gemini')) {
    const runGemini = async () => {
      // This will now correctly select ['gemini-2.5-pro', 'gemini-2.5-flash']
      // when the provider is 'gemini-pro-2.5'
      const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
      let lastError;

      for (const modelName of modelNames) {
        try {
          console.log(`[askLLM] Trying Gemini model: ${modelName}`);
          
          // Define modelConfig to include thinkingConfig
          // 'thinkingBudget: -1' uses the default Dynamic Thinking (up to 32k tokens for Pro)
          // 'includeThoughts: true' requests the thought process for logging
          const modelConfig = {
            model: modelName,
            ...(context && { systemInstruction: context }),
            generationConfig: {
              thinkingConfig: {
                thinkingBudget: -1, 
                includeThoughts: true, 
              },
            },
          };

          const model = genAI.getGenerativeModel(modelConfig);
          const result = await model.generateContent(finalUserMessage);
          const response = await result.response;
          
          // Added check for empty response
          if (!response || !response.text()) {
             throw new Error(`Empty response from Gemini model ${modelName}`);
          }
            
          console.log(`✅ Successfully used Gemini model: ${modelName}`);
          
          // --- LOGGING TOKEN USAGE AND THOUGHTS ---
          
          // 1. Log the token usage
          if (response.usageMetadata) {
            console.log(`[askLLM] Token Usage: ${response.usageMetadata.promptTokenCount} (prompt) + ${response.usageMetadata.candidatesTokenCount} (candidate) = ${response.usageMetadata.totalTokenCount} (total)`);
            console.log(`[askLLM] Note: 'candidatesTokenCount' (${response.usageMetadata.candidatesTokenCount}) includes both thinking tokens and the final response tokens.`);
          }

          // 2. Log the actual thought process
          const thoughtParts = response.candidates[0]?.content.parts.filter(part => part.thought);
          if (thoughtParts && thoughtParts.length > 0) {
            console.log('\n--- 🧠 MODEL THOUGHTS ---');
            for (const part of thoughtParts) {
              console.log(part.thought);
            }
            console.log('--- END THOUGHTS ---\n');
          } else {
            console.log('[askLLM] No separate thought summary was returned for this query (only Pro models use this heavily).');
          }
          // --- END LOGGING ---

          return response.text().trim();

        } catch (error) {
          lastError = error;
          console.warn(`❌ Gemini model ${modelName} failed: ${error.message}`);
          continue; // Your logic to try the next model (the fallback)
        }
      }

      throw new Error(`All Gemini models failed: ${lastError?.message || 'Unknown error'}`);
    };
    return retryWithBackoff(runGemini);
  }

  // OpenAI / Anthropic / DeepSeek
  const config = LLM_CONFIGS[provider];
  if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

  const runHttpProvider = async () => {
    const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
    let requestBody;

    if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
      requestBody = {
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: finalUserMessage }],
      };
    } else {
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserMessage },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.7,
      };
    }

    console.log(`[askLLM] Request Body prepared for ${provider}`);
    console.log(`[askLLM] Calling ${provider} API...`);
    
    const response = await axios.post(config.apiUrl, requestBody, {
      headers: config.headers,
      timeout: 120000, // 2 minutes timeout
    });

    const answer =
      provider === 'anthropic' || provider === 'claude-sonnet-4'
        ? response.data?.content?.[0]?.text || response.data?.completion
        : response.data?.choices?.[0]?.message?.content;

    if (!answer) throw new Error(`Empty response from ${provider}`);
    console.log(`[askLLM] ✅ Received response from ${provider}, length: ${answer.length}`);
    return answer.trim();
  };

  return retryWithBackoff(runHttpProvider);
}

// ---------------------------
// Helper function for Gemini (backward compatibility)
// ---------------------------
async function askGemini(userMessage, context = '') {
  // Defaulting to 'gemini' (which is now 'gemini-2.5-flash')
  return askLLM('gemini', userMessage, context);
}

// ---------------------------
// Analyze with Gemini (backward compatibility)
// ---------------------------
async function analyzeWithGemini(prompt, context = '') {
  // Defaulting to 'gemini' (which is now 'gemini-2.5-flash')
  return askLLM('gemini', prompt, context);
}

// ---------------------------
// Get summary from chunks
// ---------------------------
async function getSummaryFromChunks(chunks, provider = 'gemini') {
  const combinedText = chunks.join('\n\n');
  const prompt = `Please provide a concise summary of the following text:\n\n${combinedText}`;
  // Ensure the provider name is resolved, e.g. 'gemini' -> 'gemini'
  const resolvedProvider = resolveProviderName(provider);
  return askLLM(resolvedProvider, prompt);
}

// ---------------------------
// Provider Availability Checker
// ---------------------------
function getAvailableProviders() {
  return Object.fromEntries(
    Object.entries({
      ...LLM_CONFIGS,
      // Updated to show the correct primary models
      gemini: { model: 'gemini-2.5-flash', headers: {} },
      'gemini-pro-2.5': { model: 'gemini-2.5-pro', headers: {} },
    }).map(([provider, cfg]) => {
      let key;
      if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
      else if (provider.startsWith('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
      else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
      else key = process.env.OPENAI_API_KEY;

      return [
        provider,
        { available: !!key, reason: key ? 'Available' : 'Missing API key', model: cfg.model },
      ];
    })
  );
}

module.exports = {
  askLLM,
  askGemini,
  analyzeWithGemini,
  getSummaryFromChunks,
  getAvailableProviders,
  resolveProviderName,
};