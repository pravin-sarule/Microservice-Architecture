// // require('dotenv').config();
// // const axios = require('axios');
// // const { GoogleGenerativeAI } = require('@google/generative-ai');

// // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // // ---------------------------
// // // Helper: Retry with exponential backoff
// // // ---------------------------
// // async function retryWithBackoff(fn, retries = 3, delay = 2000) {
// //   for (let attempt = 1; attempt <= retries; attempt++) {
// //     try {
// //       return await fn();
// //     } catch (err) {
// //       console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
// //       if (
// //         err.message.includes('overloaded') ||
// //         err.message.includes('503') ||
// //         err.message.includes('temporarily unavailable') ||
// //         err.message.includes('quota') ||
// //         err.message.includes('rate limit')
// //       ) {
// //         if (attempt < retries) {
// //           await new Promise(res => setTimeout(res, delay * attempt));
// //         } else {
// //           throw new Error('LLM provider is temporarily unavailable. Please try again later.');
// //         }
// //       } else {
// //         throw err;
// //       }
// //     }
// //   }
// // }

// // // ---------------------------
// // // LLM Configurations for HTTP-based providers
// // // ---------------------------
// // const LLM_CONFIGS = {
// //   openai: {
// //     apiUrl: 'https://api.openai.com/v1/chat/completions',
// //     model: 'gpt-4o-mini',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
// //     },
// //   },
// //   'gpt-4o': {
// //     apiUrl: 'https://api.openai.com/v1/chat/completions',
// //     model: 'gpt-4o',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
// //     },
// //   },
// //   anthropic: {
// //     apiUrl: 'https://api.anthropic.com/v1/messages',
// //     model: 'claude-3-5-haiku-20241022',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'x-api-key': process.env.ANTHROPIC_API_KEY,
// //       'anthropic-version': '2023-06-01',
// //     },
// //   },
// //   'claude-sonnet-4': {
// //     apiUrl: 'https://api.anthropic.com/v1/messages',
// //     model: 'claude-sonnet-4-20250514',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'x-api-key': process.env.ANTHROPIC_API_KEY,
// //       'anthropic-version': '2023-06-01',
// //     },
// //   },
// //   deepseek: {
// //     apiUrl: 'https://api.deepseek.com/chat/completions',
// //     model: 'deepseek-chat',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
// //     },
// //   },
// // };

// // // ---------------------------
// // // Model name mappings for Gemini
// // // ---------------------------
// // const GEMINI_MODELS = {
// //   'gemini': [
// //     'gemini-2.5-flash',
// //     'gemini-1.5-flash',
// //   ],
// //   'gemini-pro-2.5': [
// //     'gemini-2.5-pro',
// //     'gemini-1.5-pro',
// //     'gemini-2.5-flash'
// //   ]
// // };

// // // ---------------------------
// // // Unified askLLM function
// // // ---------------------------
// // async function askLLM(provider, userMessage, context = '') {
// //   console.log(`[askLLM] provider=${provider}, messageLen=${userMessage.length}, contextLen=${context.length}`);

// //   // Handle Gemini variants
// //   if (provider === 'gemini' || provider === 'gemini-pro-2.5') {
// //     const runGemini = async () => {
// //       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
// //       let lastError;
     
// //       for (const modelName of modelNames) {
// //         try {
// //           const model = genAI.getGenerativeModel({ model: modelName });
// //           const prompt = context
// //             ? `Context:\n${context}\n\nQuestion: ${userMessage}`
// //             : userMessage;

// //           const result = await model.generateContent(prompt);
// //           const response = await result.response;
// //           console.log(`✅ Successfully used Gemini model: ${modelName}`);
// //           return response.text().trim();
// //         } catch (error) {
// //           console.warn(`Model ${modelName} failed:`, error.message);
// //           lastError = error;
         
// //           if (error.message.includes('quota') || error.message.includes('429')) {
// //             console.log(`Quota exceeded for ${modelName}, trying next model...`);
// //             continue;
// //           }
         
// //           if (error.message.includes('404') || error.message.includes('not found')) {
// //             console.log(`Model ${modelName} not found, trying next model...`);
// //             continue;
// //             }
         
// //           console.error(`Detailed error for ${modelName}:`, error);
// //           continue;
// //         }
// //       }
     
// //       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
// //     };
// //     return retryWithBackoff(runGemini);
// //   }

// //   const config = LLM_CONFIGS[provider];
// //   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

// //   const runHttpProvider = async () => {
// //     let requestBody;
   
// //     // Handle Anthropic variants
// //     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
// //       requestBody = {
// //         model: config.model,
// //         max_tokens: 2000,
// //         system: 'You are a helpful AI assistant. Use context if available.',
// //         messages: [
// //           { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${userMessage}` : userMessage },
// //         ],
// //       };
// //     } else {
// //       // OpenAI, GPT-4o, and DeepSeek
// //       requestBody = {
// //         model: config.model,
// //         messages: [
// //           { role: 'system', content: 'You are a helpful AI assistant. Use context if available.' },
// //           { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${userMessage}` : userMessage },
// //         ],
// //         max_tokens: 2000,
// //         temperature: 0.7,
// //       };
// //     }

// //     const response = await axios.post(config.apiUrl, requestBody, { headers: config.headers, timeout: 30000 });

// //     let answer;
// //     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
// //       answer = response.data?.content?.[0]?.text || response.data?.completion;
// //     } else {
// //       answer = response.data?.choices?.[0]?.message?.content;
// //     }

// //     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
// //     return answer;
// //   };

// //   return retryWithBackoff(runHttpProvider);
// // }

// // // ---------------------------
// // // Gemini Wrappers
// // // ---------------------------
// // async function askGemini(context, question, modelType = 'gemini') {
// //   return askLLM(modelType, question, context);
// // }

// // async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
// //   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
// //   return askLLM(modelType, prompt);
// // }

// // async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
// //   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
// //   return askLLM(modelType, prompt);
// // }

// // // ---------------------------
// // // List available providers
// // // ---------------------------
// // function getAvailableProviders() {
// //   return Object.fromEntries(
// //     Object.entries({
// //       ...LLM_CONFIGS,
// //       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
// //       'gemini-pro-2.5': { model: 'gemini-1.5-pro-latest', headers: {} }
// //     }).map(([provider, cfg]) => {
// //       let key;
// //       if (provider.startsWith('gemini')) {
// //         key = process.env.GEMINI_API_KEY;
// //       } else if (provider.startsWith('claude') || provider === 'anthropic') {
// //         key = process.env.ANTHROPIC_API_KEY;
// //       } else {
// //         key = process.env[`${provider.toUpperCase()}_API_KEY`];
// //       }
     
// //       return [
// //         provider,
// //         {
// //           available: !!key,
// //           reason: key ? 'Available' : `Missing API key`,
// //           model: cfg.model
// //         }
// //       ];
// //     })
// //   );
// // }

// // module.exports = {
// //   askLLM,
// //   askGemini,
// //   analyzeWithGemini,
// //   getSummaryFromChunks,
// //   getAvailableProviders,
// // };



// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   'gemini': [
//     'gemini-2.5-flash',
//     'gemini-1.5-flash',
//   ],
//   'gemini-pro-2.5': [
//     'gemini-2.5-pro',
//     'gemini-1.5-pro',
//     'gemini-2.5-flash'
//   ]
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   // Use a fallback message if userMessage is empty (though controller should now prevent this)
//   const finalUserMessage = userMessage.trim() || 'Please follow the system context and acknowledge my request.';
  
//   console.log(`[askLLM] provider=${provider}, messageLen=${finalUserMessage.length}, contextLen=${context.length}`);

//   // Handle Gemini variants
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;
     
//       for (const modelName of modelNames) {
//         try {
//           // 💡 IMPROVEMENT: Use the context (secretValue) as the System Instruction
//           const modelConfig = context
//             ? { model: modelName, config: { systemInstruction: context } }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
          
//           // Send only the user's message as the content
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           // ... (Error handling logic remains the same)
//           console.warn(`Model ${modelName} failed:`, error.message);
//           lastError = error;
         
//           if (error.message.includes('quota') || error.message.includes('429')) {
//             console.log(`Quota exceeded for ${modelName}, trying next model...`);
//             continue;
//           }
         
//           if (error.message.includes('404') || error.message.includes('not found')) {
//             console.log(`Model ${modelName} not found, trying next model...`);
//             continue;
//             }
         
//           console.error(`Detailed error for ${modelName}:`, error);
//           continue;
//         }
//       }
     
//       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     let requestBody;
    
//     // 💡 IMPROVEMENT: Use the context (secretValue) as the system prompt for all HTTP providers
//     const systemPrompt = context || 'You are a helpful AI assistant. Use context if available.';
   
//     // Handle Anthropic variants
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 2000,
//         system: systemPrompt, // Use secretValue/context here
//         messages: [
//           // Send only the user's actual question as the user message
//           { role: 'user', content: finalUserMessage }, 
//         ],
//       };
//     } else {
//       // OpenAI, GPT-4o, and DeepSeek
//       requestBody = {
//         model: config.model,
//         messages: [
//           // Use secretValue/context here
//           { role: 'system', content: systemPrompt }, 
//           // Send only the user's actual question as the user message
//           { role: 'user', content: finalUserMessage }, 
//         ],
//         max_tokens: 2000,
//         temperature: 0.7,
//       };
//     }

//     const response = await axios.post(config.apiUrl, requestBody, { headers: config.headers, timeout: 30000 });

//     let answer;
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       answer = response.data?.content?.[0]?.text || response.data?.completion;
//     } else {
//       answer = response.data?.choices?.[0]?.message?.content;
//     }

//     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Gemini Wrappers (Updated to use askLLM correctly)
// // ---------------------------
// async function askGemini(context, question, modelType = 'gemini') {
//   return askLLM(modelType, question, context);
// }

// async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
//   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
//   // When context is the document itself, it should be the user message, and the instruction is the system context (which is empty here)
//   return askLLM(modelType, prompt); 
// }

// async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
//   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
//   return askLLM(modelType, prompt);
// }

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-1.5-pro-latest', headers: {} }
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) {
//         key = process.env.GEMINI_API_KEY;
//       } else if (provider.startsWith('claude') || provider === 'anthropic') {
//         key = process.env.ANTHROPIC_API_KEY;
//       } else if (provider === 'deepseek') {
//         key = process.env.DEEPSEEK_API_KEY;
//       } else {
//         key = process.env.OPENAI_API_KEY; // Covers openai and gpt-4o
//       }
     
//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : `Missing API key`,
//           model: cfg.model
//         }
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
// };


// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   'gemini': [
//     'gemini-2.0-flash-exp',
//     'gemini-1.5-flash',
//   ],
//   'gemini-pro-2.5': [
//     'gemini-2.0-pro-exp',
//     'gemini-1.5-pro',
//     'gemini-2.0-flash-exp'
//   ]
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   // Use a fallback message if userMessage is empty
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
  
//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);
//   console.log(`[askLLM] Context length: ${context.length}`);

//   // Handle Gemini variants
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;
     
//       for (const modelName of modelNames) {
//         try {
//           console.log(`[askLLM] Trying Gemini model: ${modelName}`);
          
//           // 💡 When context is provided, use it as system instruction
//           const modelConfig = context
//             ? { 
//                 model: modelName, 
//                 systemInstruction: context 
//               }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
          
//           // Send only the user's message as the content
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           console.warn(`Model ${modelName} failed:`, error.message);
//           lastError = error;
         
//           if (error.message.includes('quota') || error.message.includes('429')) {
//             console.log(`Quota exceeded for ${modelName}, trying next model...`);
//             continue;
//           }
         
//           if (error.message.includes('404') || error.message.includes('not found')) {
//             console.log(`Model ${modelName} not found, trying next model...`);
//             continue;
//           }
         
//           console.error(`Detailed error for ${modelName}:`, error);
//           continue;
//         }
//       }
     
//       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     let requestBody;
    
//     // 💡 Use the context as the system prompt for all HTTP providers
//     const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
   
//     // Handle Anthropic variants
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 1000000,
//         system: systemPrompt, // Use context/secret as system instruction
//         messages: [
//           { role: 'user', content: finalUserMessage }, 
//         ],
//       };
//     } else {
//       // OpenAI, GPT-4o, and DeepSeek
//       requestBody = {
//         model: config.model,
//         messages: [
//           { role: 'system', content: systemPrompt }, 
//           { role: 'user', content: finalUserMessage }, 
//         ],
//         max_tokens: 1000000,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, { 
//       headers: config.headers, 
//       timeout: 60000 
//     });

//     let answer;
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       answer = response.data?.content?.[0]?.text || response.data?.completion;
//     } else {
//       answer = response.data?.choices?.[0]?.message?.content;
//     }

//     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
//     console.log(`[askLLM] Received response from ${provider}, length: ${answer.length}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Gemini Wrappers
// // ---------------------------
// async function askGemini(context, question, modelType = 'gemini') {
//   return askLLM(modelType, question, context);
// }

// async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
//   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
//   return askLLM(modelType, prompt, '');
// }

// async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
//   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
//   return askLLM(modelType, prompt, '');
// }

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} }
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) {
//         key = process.env.GEMINI_API_KEY;
//       } else if (provider.startsWith('claude') || provider === 'anthropic') {
//         key = process.env.ANTHROPIC_API_KEY;
//       } else if (provider === 'deepseek') {
//         key = process.env.DEEPSEEK_API_KEY;
//       } else {
//         key = process.env.OPENAI_API_KEY;
//       }
     
//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : `Missing API key`,
//           model: cfg.model
//         }
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
// };


// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Alias Mapping for flexible LLM names from DB
// // ---------------------------
// const PROVIDER_ALIASES = {
//   // OpenAI
//   'gpt-4o-mini': 'openai',
//   'gpt-4-mini': 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4': 'gpt-4o',

//   // Gemini
//   'gemini': 'gemini',
//   'gemini-2.0-flash': 'gemini',
//   'gemini-1.5-flash': 'gemini',
//   'gemini-pro': 'gemini-pro-2.5',
//   'gemini-pro-2.5': 'gemini-pro-2.5',

//   // Anthropic
//   'claude': 'anthropic',
//   'claude-haiku': 'anthropic',
//   'claude-3-5-haiku': 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',

//   // DeepSeek
//   'deepseek': 'deepseek',
//   'deepseek-chat': 'deepseek'
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash'],
//   'gemini-pro-2.5': ['gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);
//   console.log(`[askLLM] Context length: ${context.length}`);

//   // Handle Gemini
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
//           console.warn(`❌ Gemini model ${modelName} failed:`, error.message);
//           continue;
//         }
//       }
//       throw new Error(`All Gemini models failed: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   // Handle OpenAI / Anthropic / DeepSeek
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
//     let requestBody;

//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 4096,
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
//         max_tokens: 4096,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 60000,
//     });

//     let answer =
//       provider === 'anthropic' || provider === 'claude-sonnet-4'
//         ? response.data?.content?.[0]?.text || response.data?.completion
//         : response.data?.choices?.[0]?.message?.content;

//     if (!answer) throw new Error(`Empty response from ${provider}`);
//     console.log(`[askLLM] Received response from ${provider}, length: ${answer.length}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Provider Resolver
// // ---------------------------
// function resolveProviderName(nameFromDB = '') {
//   const lowerName = nameFromDB.trim().toLowerCase();
//   return PROVIDER_ALIASES[lowerName] || 'gemini'; // default fallback
// }

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} },
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
//       else if (provider.startsWith('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
//       else key = process.env.OPENAI_API_KEY;

//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : 'Missing API key',
//           model: cfg.model,
//         },
//       ];
//     })
//   );
// }

// module.exports = {
//   askLLM,
//   getAvailableProviders,
//   resolveProviderName,
// };


// // services/aiService.js
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
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
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
//   'gemini-pro-2.5': ['gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
// };

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
//         max_tokens: 4096,
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
//         max_tokens: 4096,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 60000,
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
// // Provider Resolver
// // ---------------------------
// function resolveProviderName(nameFromDB = '') {
//   const lower = nameFromDB.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[lower] || 'gemini';
//   console.log(`[resolveProviderName] DB name: ${nameFromDB} → Provider: ${resolved}`);
//   return resolved;
// }

// // ---------------------------
// // Provider Availability Checker
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} },
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
//   getAvailableProviders,
//   resolveProviderName,
// };
// services/aiService.js
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
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
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
//   'gemini-pro-2.5': ['gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
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
//         max_tokens: 4096,
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
//         max_tokens: 4096,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 60000,
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
// // Provider Availability Checker
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} },
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
//   getAvailableProviders,
//   resolveProviderName,
// };


// // require('dotenv').config();
// // const axios = require('axios');
// // const { GoogleGenerativeAI } = require('@google/generative-ai');

// // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // // ---------------------------
// // // Helper: Retry with exponential backoff
// // // ---------------------------
// // async function retryWithBackoff(fn, retries = 3, delay = 2000) {
// //   for (let attempt = 1; attempt <= retries; attempt++) {
// //     try {
// //       return await fn();
// //     } catch (err) {
// //       console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
// //       if (
// //         err.message.includes('overloaded') ||
// //         err.message.includes('503') ||
// //         err.message.includes('temporarily unavailable') ||
// //         err.message.includes('quota') ||
// //         err.message.includes('rate limit')
// //       ) {
// //         if (attempt < retries) {
// //           await new Promise(res => setTimeout(res, delay * attempt));
// //         } else {
// //           throw new Error('LLM provider is temporarily unavailable. Please try again later.');
// //         }
// //       } else {
// //         throw err;
// //       }
// //     }
// //   }
// // }

// // // ---------------------------
// // // LLM Configurations for HTTP-based providers
// // // ---------------------------
// // const LLM_CONFIGS = {
// //   openai: {
// //     apiUrl: 'https://api.openai.com/v1/chat/completions',
// //     model: 'gpt-4o-mini',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
// //     },
// //   },
// //   'gpt-4o': {
// //     apiUrl: 'https://api.openai.com/v1/chat/completions',
// //     model: 'gpt-4o',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
// //     },
// //   },
// //   anthropic: {
// //     apiUrl: 'https://api.anthropic.com/v1/messages',
// //     model: 'claude-3-5-haiku-20241022',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'x-api-key': process.env.ANTHROPIC_API_KEY,
// //       'anthropic-version': '2023-06-01',
// //     },
// //   },
// //   'claude-sonnet-4': {
// //     apiUrl: 'https://api.anthropic.com/v1/messages',
// //     model: 'claude-sonnet-4-20250514',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'x-api-key': process.env.ANTHROPIC_API_KEY,
// //       'anthropic-version': '2023-06-01',
// //     },
// //   },
// //   deepseek: {
// //     apiUrl: 'https://api.deepseek.com/chat/completions',
// //     model: 'deepseek-chat',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
// //     },
// //   },
// // };

// // // ---------------------------
// // // Model name mappings for Gemini
// // // ---------------------------
// // const GEMINI_MODELS = {
// //   'gemini': [
// //     'gemini-2.5-flash',
// //     'gemini-1.5-flash',
// //   ],
// //   'gemini-pro-2.5': [
// //     'gemini-2.5-pro',
// //     'gemini-1.5-pro',
// //     'gemini-2.5-flash'
// //   ]
// // };

// // // ---------------------------
// // // Unified askLLM function
// // // ---------------------------
// // async function askLLM(provider, userMessage, context = '') {
// //   console.log(`[askLLM] provider=${provider}, messageLen=${userMessage.length}, contextLen=${context.length}`);

// //   // Handle Gemini variants
// //   if (provider === 'gemini' || provider === 'gemini-pro-2.5') {
// //     const runGemini = async () => {
// //       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
// //       let lastError;
     
// //       for (const modelName of modelNames) {
// //         try {
// //           const model = genAI.getGenerativeModel({ model: modelName });
// //           const prompt = context
// //             ? `Context:\n${context}\n\nQuestion: ${userMessage}`
// //             : userMessage;

// //           const result = await model.generateContent(prompt);
// //           const response = await result.response;
// //           console.log(`✅ Successfully used Gemini model: ${modelName}`);
// //           return response.text().trim();
// //         } catch (error) {
// //           console.warn(`Model ${modelName} failed:`, error.message);
// //           lastError = error;
         
// //           if (error.message.includes('quota') || error.message.includes('429')) {
// //             console.log(`Quota exceeded for ${modelName}, trying next model...`);
// //             continue;
// //           }
         
// //           if (error.message.includes('404') || error.message.includes('not found')) {
// //             console.log(`Model ${modelName} not found, trying next model...`);
// //             continue;
// //             }
         
// //           console.error(`Detailed error for ${modelName}:`, error);
// //           continue;
// //         }
// //       }
     
// //       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
// //     };
// //     return retryWithBackoff(runGemini);
// //   }

// //   const config = LLM_CONFIGS[provider];
// //   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

// //   const runHttpProvider = async () => {
// //     let requestBody;
   
// //     // Handle Anthropic variants
// //     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
// //       requestBody = {
// //         model: config.model,
// //         max_tokens: 2000,
// //         system: 'You are a helpful AI assistant. Use context if available.',
// //         messages: [
// //           { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${userMessage}` : userMessage },
// //         ],
// //       };
// //     } else {
// //       // OpenAI, GPT-4o, and DeepSeek
// //       requestBody = {
// //         model: config.model,
// //         messages: [
// //           { role: 'system', content: 'You are a helpful AI assistant. Use context if available.' },
// //           { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${userMessage}` : userMessage },
// //         ],
// //         max_tokens: 2000,
// //         temperature: 0.7,
// //       };
// //     }

// //     const response = await axios.post(config.apiUrl, requestBody, { headers: config.headers, timeout: 30000 });

// //     let answer;
// //     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
// //       answer = response.data?.content?.[0]?.text || response.data?.completion;
// //     } else {
// //       answer = response.data?.choices?.[0]?.message?.content;
// //     }

// //     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
// //     return answer;
// //   };

// //   return retryWithBackoff(runHttpProvider);
// // }

// // // ---------------------------
// // // Gemini Wrappers
// // // ---------------------------
// // async function askGemini(context, question, modelType = 'gemini') {
// //   return askLLM(modelType, question, context);
// // }

// // async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
// //   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
// //   return askLLM(modelType, prompt);
// // }

// // async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
// //   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
// //   return askLLM(modelType, prompt);
// // }

// // // ---------------------------
// // // List available providers
// // // ---------------------------
// // function getAvailableProviders() {
// //   return Object.fromEntries(
// //     Object.entries({
// //       ...LLM_CONFIGS,
// //       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
// //       'gemini-pro-2.5': { model: 'gemini-1.5-pro-latest', headers: {} }
// //     }).map(([provider, cfg]) => {
// //       let key;
// //       if (provider.startsWith('gemini')) {
// //         key = process.env.GEMINI_API_KEY;
// //       } else if (provider.startsWith('claude') || provider === 'anthropic') {
// //         key = process.env.ANTHROPIC_API_KEY;
// //       } else {
// //         key = process.env[`${provider.toUpperCase()}_API_KEY`];
// //       }
     
// //       return [
// //         provider,
// //         {
// //           available: !!key,
// //           reason: key ? 'Available' : `Missing API key`,
// //           model: cfg.model
// //         }
// //       ];
// //     })
// //   );
// // }

// // module.exports = {
// //   askLLM,
// //   askGemini,
// //   analyzeWithGemini,
// //   getSummaryFromChunks,
// //   getAvailableProviders,
// // };



// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   'gemini': [
//     'gemini-2.5-flash',
//     'gemini-1.5-flash',
//   ],
//   'gemini-pro-2.5': [
//     'gemini-2.5-pro',
//     'gemini-1.5-pro',
//     'gemini-2.5-flash'
//   ]
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   // Use a fallback message if userMessage is empty (though controller should now prevent this)
//   const finalUserMessage = userMessage.trim() || 'Please follow the system context and acknowledge my request.';
  
//   console.log(`[askLLM] provider=${provider}, messageLen=${finalUserMessage.length}, contextLen=${context.length}`);

//   // Handle Gemini variants
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;
     
//       for (const modelName of modelNames) {
//         try {
//           // 💡 IMPROVEMENT: Use the context (secretValue) as the System Instruction
//           const modelConfig = context
//             ? { model: modelName, config: { systemInstruction: context } }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
          
//           // Send only the user's message as the content
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           // ... (Error handling logic remains the same)
//           console.warn(`Model ${modelName} failed:`, error.message);
//           lastError = error;
         
//           if (error.message.includes('quota') || error.message.includes('429')) {
//             console.log(`Quota exceeded for ${modelName}, trying next model...`);
//             continue;
//           }
         
//           if (error.message.includes('404') || error.message.includes('not found')) {
//             console.log(`Model ${modelName} not found, trying next model...`);
//             continue;
//             }
         
//           console.error(`Detailed error for ${modelName}:`, error);
//           continue;
//         }
//       }
     
//       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     let requestBody;
    
//     // 💡 IMPROVEMENT: Use the context (secretValue) as the system prompt for all HTTP providers
//     const systemPrompt = context || 'You are a helpful AI assistant. Use context if available.';
   
//     // Handle Anthropic variants
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 2000,
//         system: systemPrompt, // Use secretValue/context here
//         messages: [
//           // Send only the user's actual question as the user message
//           { role: 'user', content: finalUserMessage }, 
//         ],
//       };
//     } else {
//       // OpenAI, GPT-4o, and DeepSeek
//       requestBody = {
//         model: config.model,
//         messages: [
//           // Use secretValue/context here
//           { role: 'system', content: systemPrompt }, 
//           // Send only the user's actual question as the user message
//           { role: 'user', content: finalUserMessage }, 
//         ],
//         max_tokens: 2000,
//         temperature: 0.7,
//       };
//     }

//     const response = await axios.post(config.apiUrl, requestBody, { headers: config.headers, timeout: 30000 });

//     let answer;
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       answer = response.data?.content?.[0]?.text || response.data?.completion;
//     } else {
//       answer = response.data?.choices?.[0]?.message?.content;
//     }

//     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Gemini Wrappers (Updated to use askLLM correctly)
// // ---------------------------
// async function askGemini(context, question, modelType = 'gemini') {
//   return askLLM(modelType, question, context);
// }

// async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
//   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
//   // When context is the document itself, it should be the user message, and the instruction is the system context (which is empty here)
//   return askLLM(modelType, prompt); 
// }

// async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
//   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
//   return askLLM(modelType, prompt);
// }

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-1.5-pro-latest', headers: {} }
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) {
//         key = process.env.GEMINI_API_KEY;
//       } else if (provider.startsWith('claude') || provider === 'anthropic') {
//         key = process.env.ANTHROPIC_API_KEY;
//       } else if (provider === 'deepseek') {
//         key = process.env.DEEPSEEK_API_KEY;
//       } else {
//         key = process.env.OPENAI_API_KEY; // Covers openai and gpt-4o
//       }
     
//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : `Missing API key`,
//           model: cfg.model
//         }
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
// };


// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   'gemini': [
//     'gemini-2.0-flash-exp',
//     'gemini-1.5-flash',
//   ],
//   'gemini-pro-2.5': [
//     'gemini-2.0-pro-exp',
//     'gemini-1.5-pro',
//     'gemini-2.0-flash-exp'
//   ]
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   // Use a fallback message if userMessage is empty
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';
  
//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);
//   console.log(`[askLLM] Context length: ${context.length}`);

//   // Handle Gemini variants
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//       let lastError;
     
//       for (const modelName of modelNames) {
//         try {
//           console.log(`[askLLM] Trying Gemini model: ${modelName}`);
          
//           // 💡 When context is provided, use it as system instruction
//           const modelConfig = context
//             ? { 
//                 model: modelName, 
//                 systemInstruction: context 
//               }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);
          
//           // Send only the user's message as the content
//           const result = await model.generateContent(finalUserMessage);
//           const response = await result.response;
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return response.text().trim();

//         } catch (error) {
//           console.warn(`Model ${modelName} failed:`, error.message);
//           lastError = error;
         
//           if (error.message.includes('quota') || error.message.includes('429')) {
//             console.log(`Quota exceeded for ${modelName}, trying next model...`);
//             continue;
//           }
         
//           if (error.message.includes('404') || error.message.includes('not found')) {
//             console.log(`Model ${modelName} not found, trying next model...`);
//             continue;
//           }
         
//           console.error(`Detailed error for ${modelName}:`, error);
//           continue;
//         }
//       }
     
//       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
//     };
//     return retryWithBackoff(runGemini);
//   }

//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     let requestBody;
    
//     // 💡 Use the context as the system prompt for all HTTP providers
//     const systemPrompt = context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';
   
//     // Handle Anthropic variants
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 1000000,
//         system: systemPrompt, // Use context/secret as system instruction
//         messages: [
//           { role: 'user', content: finalUserMessage }, 
//         ],
//       };
//     } else {
//       // OpenAI, GPT-4o, and DeepSeek
//       requestBody = {
//         model: config.model,
//         messages: [
//           { role: 'system', content: systemPrompt }, 
//           { role: 'user', content: finalUserMessage }, 
//         ],
//         max_tokens: 1000000,
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, { 
//       headers: config.headers, 
//       timeout: 60000 
//     });

//     let answer;
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       answer = response.data?.content?.[0]?.text || response.data?.completion;
//     } else {
//       answer = response.data?.choices?.[0]?.message?.content;
//     }

//     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
//     console.log(`[askLLM] Received response from ${provider}, length: ${answer.length}`);
//     return answer;
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// // ---------------------------
// // Gemini Wrappers
// // ---------------------------
// async function askGemini(context, question, modelType = 'gemini') {
//   return askLLM(modelType, question, context);
// }

// async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
//   const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
//   return askLLM(modelType, prompt, '');
// }

// async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
//   const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
//   return askLLM(modelType, prompt, '');
// }

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} }
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) {
//         key = process.env.GEMINI_API_KEY;
//       } else if (provider.startsWith('claude') || provider === 'anthropic') {
//         key = process.env.ANTHROPIC_API_KEY;
//       } else if (provider === 'deepseek') {
//         key = process.env.DEEPSEEK_API_KEY;
//       } else {
//         key = process.env.OPENAI_API_KEY;
//       }
     
//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : `Missing API key`,
//           model: cfg.model
//         }
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
// };



// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Helper: Retry with exponential backoff
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
// // LLM Configurations for HTTP-based providers
// // ---------------------------
// const LLM_CONFIGS = {
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   anthropic: {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-3-5-haiku-20241022',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-20250514',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
// };

// // ---------------------------
// // Model name mappings for Gemini
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: [
//     'gemini-2.0-flash-exp',
//     'gemini-1.5-flash',
//   ],
//   'gemini-pro-2.5': [
//     'gemini-2.0-pro-exp',
//     'gemini-1.5-pro',
//     'gemini-2.0-flash-exp',
//   ],
// };

// // ---------------------------
// // Unified askLLM function
// // ---------------------------
// async function askLLM(provider, userMessage, context = '') {
//   const finalUserMessage = userMessage.trim() || 'Please provide an analysis.';

//   console.log(`[askLLM] Provider: ${provider}`);
//   console.log(`[askLLM] User message length: ${finalUserMessage.length}`);
//   console.log(`[askLLM] Context length: ${context.length}`);

//   // ---------------------------
//   // Handle Gemini variants
//   // ---------------------------
//   if (provider.startsWith('gemini')) {
//     const runGemini = async () => {
//       const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS.gemini;
//       let lastError;

//       for (const modelName of modelNames) {
//         try {
//           console.log(`[askLLM] Trying Gemini model: ${modelName}`);

//           const modelConfig = context
//             ? { model: modelName, systemInstruction: context }
//             : { model: modelName };

//           const model = genAI.getGenerativeModel(modelConfig);

//           const result = await model.generateContent(finalUserMessage, {
//             generationConfig: {
//               maxOutputTokens: 1000000, // allow full response
//               temperature: 0.7,
//               topP: 1,
//               topK: 1,
//             },
//           });

//           const response = await result.response;
//           const text = response.text().trim();
//           console.log(`✅ Successfully used Gemini model: ${modelName}`);
//           return text;
//         } catch (error) {
//           console.warn(`Model ${modelName} failed:`, error.message);
//           lastError = error;

//           if (error.message.includes('quota') || error.message.includes('429')) {
//             console.log(`Quota exceeded for ${modelName}, trying next model...`);
//             continue;
//           }

//           if (error.message.includes('404') || error.message.includes('not found')) {
//             console.log(`Model ${modelName} not found, trying next model...`);
//             continue;
//           }

//           console.error(`Detailed error for ${modelName}:`, error);
//           continue;
//         }
//       }

//       throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
//     };

//     return retryWithBackoff(runGemini);
//   }

//   // ---------------------------
//   // Handle HTTP-based providers
//   // ---------------------------
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`Unsupported LLM provider: ${provider}`);

//   const runHttpProvider = async () => {
//     const systemPrompt =
//       context || 'You are a helpful AI assistant. Provide detailed and accurate responses.';

//     let requestBody;

//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       requestBody = {
//         model: config.model,
//         max_tokens: 1000000, // allow full generation
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
//         max_tokens: 1000000, // allow full generation
//         temperature: 0.7,
//       };
//     }

//     console.log(`[askLLM] Calling ${provider} API...`);
//     const response = await axios.post(config.apiUrl, requestBody, {
//       headers: config.headers,
//       timeout: 180000, // 3-minute timeout for long responses
//     });

//     let answer;
//     if (provider === 'anthropic' || provider === 'claude-sonnet-4') {
//       answer = response.data?.content?.[0]?.text || response.data?.completion;
//     } else {
//       answer = response.data?.choices?.[0]?.message?.content;
//     }

//     if (!answer) throw new Error(`Empty response from ${provider.toUpperCase()}`);
//     console.log(`[askLLM] Received response from ${provider}, length: ${answer.length}`);
//     return answer.trim();
//   };

//   return retryWithBackoff(runHttpProvider);
// }

// ---------------------------
// Gemini Wrappers
// ---------------------------
async function askGemini(context, question, modelType = 'gemini') {
  return askLLM(modelType, question, context);
}

async function analyzeWithGemini(documentText, modelType = 'gemini-pro-2.5') {
  const prompt = `Analyze this document thoroughly:\n\n${documentText}\n\nReturn key themes, summary, critical points, and recommendations.`;
  return askLLM(modelType, prompt, '');
}

async function getSummaryFromChunks(text, modelType = 'gemini-pro-2.5') {
  const prompt = `Summarize this text clearly and concisely:\n\n${text}`;
  return askLLM(modelType, prompt, '');
}

// // ---------------------------
// // List available providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries({
//       ...LLM_CONFIGS,
//       gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
//       'gemini-pro-2.5': { model: 'gemini-2.0-pro-exp', headers: {} },
//     }).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) {
//         key = process.env.GEMINI_API_KEY;
//       } else if (provider.startsWith('claude') || provider === 'anthropic') {
//         key = process.env.ANTHROPIC_API_KEY;
//       } else if (provider === 'deepseek') {
//         key = process.env.DEEPSEEK_API_KEY;
//       } else {
//         key = process.env.OPENAI_API_KEY;
//       }

//       return [
//         provider,
//         {
//           available: !!key,
//           reason: key ? 'Available' : 'Missing API key',
//           model: cfg.model,
//         },
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
// };




require('dotenv').config();
const axios = require('axios');
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  'gpt-4o': {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  'claude-sonnet-4': {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  deepseek: {
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
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
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash'],
  'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
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
      const modelNames = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
      let lastError;

      for (const modelName of modelNames) {
        try {
          console.log(`[askLLM] Trying Gemini model: ${modelName}`);
          const modelConfig = context
            ? { model: modelName, systemInstruction: context }
            : { model: modelName };

          const model = genAI.getGenerativeModel(modelConfig);
          const result = await model.generateContent(finalUserMessage);
          const response = await result.response;
          console.log(`✅ Successfully used Gemini model: ${modelName}`);
          return response.text().trim();

        } catch (error) {
          lastError = error;
          console.warn(`❌ Gemini model ${modelName} failed: ${error.message}`);
          continue;
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
        max_tokens: 4096,
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
        max_tokens: 4096,
        temperature: 0.7,
      };
    }

    console.log(`[askLLM] Calling ${provider} API...`);
    const response = await axios.post(config.apiUrl, requestBody, {
      headers: config.headers,
      timeout: 600000, // Increased timeout to 3 minutes for potentially longer LLM responses
    });

    const answer =
      provider === 'anthropic' || provider === 'claude-sonnet-4'
        ? response.data?.content?.[0]?.text || response.data?.completion
        : response.data?.choices?.[0]?.message?.content;

    if (!answer) throw new Error(`Empty response from ${provider}`);
    console.log(`[askLLM] ✅ Received response from ${provider}, length: ${answer.length}`);
    return answer;
  };

  return retryWithBackoff(runHttpProvider);
}

// ---------------------------
// Provider Availability Checker
// ---------------------------
function getAvailableProviders() {
  return Object.fromEntries(
    Object.entries({
      ...LLM_CONFIGS,
      gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
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
