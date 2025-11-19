

// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Estimate token count (approx)
// // ---------------------------
// function estimateTokenCount(text = '') {
//   return Math.ceil(text.length / 4); // 4 chars per token on average
// }

// // ---------------------------
// // Smart Context Trimmer - REDUCES TOKENS BY 70-90%
// // ---------------------------
// function trimContext(context, maxTokens = 200) {
//   if (!context) return '';
//   const tokens = estimateTokenCount(context);
//   if (tokens <= maxTokens) return context;
  
//   // Take only first portion (most relevant usually at start)
//   const ratio = maxTokens / tokens;
//   const trimmedLength = Math.floor(context.length * ratio);
//   return context.substring(0, trimmedLength) + '...';
// }

// // ---------------------------
// // Smart Chunk Filtering - REDUCES CHUNKS BY 80%
// // ---------------------------
// function filterRelevantChunks(chunks, userMessage, maxChunks = 1) {
//   if (!chunks) return '';
  
//   const chunkArray = chunks.split('\n\n').filter(Boolean);
//   if (chunkArray.length <= maxChunks) return chunks;
  
//   // Simple keyword matching to find most relevant chunks
//   const keywords = userMessage.toLowerCase()
//     .split(/\s+/)
//     .filter(w => w.length > 3)
//     .slice(0, 5); // Top 5 keywords only
  
//   const scored = chunkArray.map(chunk => {
//     const chunkLower = chunk.toLowerCase();
//     const score = keywords.reduce((sum, kw) => {
//       return sum + (chunkLower.includes(kw) ? 1 : 0);
//     }, 0);
//     return { chunk, score };
//   });
  
//   // Sort by relevance and take top N
//   return scored
//     .sort((a, b) => b.score - a.score)
//     .slice(0, maxChunks)
//     .map(s => s.chunk)
//     .join('\n\n');
// }

// // ---------------------------
// // Retry Helper
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
// // Gemini model mappings
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
//   'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
// };

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
//   "gpt-4o": {
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
//     model: 'claude-sonnet-4-20241022',
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
// // Combined LLM Configurations
// // ---------------------------
// const ALL_LLM_CONFIGS = {
//   ...LLM_CONFIGS,
//   gemini: { model: 'gemini-2.5-flash', headers: {} },
//   'gemini-pro-2.5': { model: 'gemini-2.5-pro', headers: {} },
// };

// // ---------------------------
// // Provider Availability Checker
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries(ALL_LLM_CONFIGS).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
//       else if (provider.includes('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
//       else key = process.env.OPENAI_API_KEY;

//       return [
//         provider,
//         { available: !!key, model: cfg.model, reason: key ? 'Available' : 'Missing API key' },
//       ];
//     })
//   );
// }

// // ---------------------------
// // Provider Aliases
// // ---------------------------
// const PROVIDER_ALIASES = {
//   openai: 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4o-mini': 'openai',
//   gemini: 'gemini',
//   'gemini-2.0-flash': 'gemini',
//   'gemini-1.5-flash': 'gemini',
//   'gemini-pro-2.5': 'gemini-pro-2.5',
//   anthropic: 'anthropic',
//   'claude': 'anthropic',
//   'claude-3-5-haiku': 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',
//   deepseek: 'deepseek',
//   'deepseek-chat': 'deepseek',
// };

// // ---------------------------
// // Resolve Provider
// // ---------------------------
// function resolveProviderName(name = '') {
//   const key = name.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[key] || 'gemini';
//   console.log(`[resolveProviderName] DB name: "${name}" → "${resolved}"`);
//   return resolved;
// }

// // ---------------------------
// // Main Optimized LLM Caller - MASSIVE TOKEN REDUCTION
// // ---------------------------
// async function askLLM(providerName, userMessage, context = '', relevant_chunks = null) {
//   const provider = resolveProviderName(providerName);
//   const config = ALL_LLM_CONFIGS[provider];
//   if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

//   // Ensure context is always a string
//   const safeContext = typeof context === 'string' ? context : '';

//   // ✅ OPTIMIZATION 1: Trim context aggressively (200 tokens max)
//   const trimmedContext = trimContext(safeContext, 200);
  
//   // ✅ OPTIMIZATION 2: Filter only top 3 most relevant chunks
//   const filteredChunks = filterRelevantChunks(relevant_chunks, userMessage, 3);
  
//   // ✅ OPTIMIZATION 3: Trim filtered chunks to reduce token count further
//   const trimmedFilteredChunks = trimContext(filteredChunks, 500); // Limit chunk content to 500 tokens
  
//   // ✅ OPTIMIZATION 4: Build minimal prompt
//   let prompt = userMessage.trim();
//   if (trimmedFilteredChunks) {
//     prompt += `\n\nRelevant Context:\n${trimmedFilteredChunks}`;
//   }

//   const totalTokens = estimateTokenCount(prompt + trimmedContext);
//   console.log(`[askLLM] Optimized Tokens: ${totalTokens} (context: ${estimateTokenCount(trimmedContext)}, chunks: ${estimateTokenCount(trimmedFilteredChunks || '')})`);

//   // ✅ OPTIMIZATION 4: Single request only (no chunking - saves massive tokens)
//   return await retryWithBackoff(() => callSinglePrompt(provider, prompt, trimmedContext));
// }

// // ---------------------------
// // Core LLM Call Logic
// // ---------------------------
// async function callSinglePrompt(provider, prompt, context = '') {
//   const config = ALL_LLM_CONFIGS[provider];
//   const isClaude = provider.startsWith('claude') || provider === 'anthropic';
//   const isGemini = provider.startsWith('gemini');

//   // ---- Gemini ----
//   if (isGemini) {
//     const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//     for (const modelName of models) {
//       try {
//         const model = genAI.getGenerativeModel(
//           context ? { model: modelName, systemInstruction: context } : { model: modelName }
//         );
//         const result = await model.generateContent(prompt);
//         const geminiResponse = await result.response.text();
//         const inputTokens = result.response.usageMetadata?.promptTokenCount || 0;
//         const outputTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
//         console.log(`✅ Gemini (${modelName}) - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens}`);
//         return geminiResponse;
//       } catch (err) {
//         console.warn(`❌ Gemini model ${modelName} failed: ${err.message}`);
//         continue;
//       }
//     }
//     throw new Error(`❌ All Gemini models failed.`);
//   }

//   // ---- Claude / OpenAI / DeepSeek ----
//   const messages = isClaude
//     ? [{ role: 'user', content: prompt }]
//     : [
//         { role: 'system', content: context || 'You are a helpful assistant.' },
//         { role: 'user', content: prompt },
//       ];

//   const payload = isClaude
//     ? {
//         model: config.model,
//         max_tokens: 4096, // Increased to allow larger responses
//         system: context,
//         messages,
//       }
//     : {
//         model: config.model,
//         messages,
//         max_tokens: 4096, // Increased to allow larger responses
//         temperature: 0.5,
//       };

//   const response = await axios.post(config.apiUrl, payload, {
//     headers: config.headers,
//     timeout: 120000, // ✅ REDUCED timeout
//   });

//   let inputTokens = 0;
//   let outputTokens = 0;

//   if (isClaude) {
//     inputTokens = response.data?.usage?.input_tokens || 0;
//     outputTokens = response.data?.usage?.output_tokens || 0;
//   } else {
//     inputTokens = response.data?.usage?.prompt_tokens || 0;
//     outputTokens = response.data?.usage?.completion_tokens || 0;
//   }

//   console.log(`✅ ${provider} - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens}`);

//   return isClaude
//     ? response.data?.content?.[0]?.text || response.data?.completion
//     : response.data?.choices?.[0]?.message?.content || '';
// }

// // ---------------------------
// // Exports
// // ---------------------------
// module.exports = {
//   askLLM,
//   resolveProviderName,
//   getAvailableProviders,
// };





// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ---------------------------
// // Token Estimation Helper
// // ---------------------------
// function estimateTokenCount(text = '') {
//   return Math.ceil(text.length / 4); // ~4 characters per token
// }

// // ---------------------------
// // Context Trimmer (reduces up to 90% safely)
// // ---------------------------
// function trimContext(context = '', maxTokens = 200) {
//   if (!context) return '';
//   const tokens = estimateTokenCount(context);
//   if (tokens <= maxTokens) return context;
//   const ratio = maxTokens / tokens;
//   const trimmedLength = Math.floor(context.length * ratio);
//   return context.substring(0, trimmedLength) + '...';
// }

// // ---------------------------
// // Chunk Filter (reduces by 80%)
// // ---------------------------
// function filterRelevantChunks(chunks, userMessage, maxChunks = 3) {
//   if (!chunks) return '';
//   const chunkArray = chunks.split('\n\n').filter(Boolean);
//   if (chunkArray.length <= maxChunks) return chunks;

//   const keywords = userMessage
//     .toLowerCase()
//     .split(/\s+/)
//     .filter(w => w.length > 3)
//     .slice(0, 5);

//   const scored = chunkArray.map(chunk => {
//     const text = chunk.toLowerCase();
//     const score = keywords.reduce(
//       (sum, kw) => sum + (text.includes(kw) ? 1 : 0),
//       0
//     );
//     return { chunk, score };
//   });

//   return scored
//     .sort((a, b) => b.score - a.score)
//     .slice(0, maxChunks)
//     .map(s => s.chunk)
//     .join('\n\n');
// }

// // ---------------------------
// // Retry Helper with Backoff
// // ---------------------------
// async function retryWithBackoff(fn, retries = 3, delay = 2000) {
//   for (let i = 1; i <= retries; i++) {
//     try {
//       return await fn();
//     } catch (err) {
//       console.warn(`⚠️ Attempt ${i} failed: ${err.message}`);
//       const transient =
//         err.message.includes('overloaded') ||
//         err.message.includes('temporarily unavailable') ||
//         err.message.includes('quota') ||
//         err.message.includes('rate limit') ||
//         err.message.includes('503');
//       if (transient && i < retries) {
//         await new Promise(res => setTimeout(res, delay * i));
//       } else if (i === retries) {
//         return '⚠️ The AI service is temporarily overloaded. Please try again.';
//       }
//     }
//   }
// }

// // ---------------------------
// // Model Configuration
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
//   'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
// };

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
//     model: 'claude-sonnet-4-20241022',
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
//   gemini: { model: 'gemini-2.5-flash' },
//   'gemini-pro-2.5': { model: 'gemini-2.5-pro' },
// };

// // ---------------------------
// // Provider Aliases
// // ---------------------------
// const PROVIDER_ALIASES = {
//   openai: 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4o-mini': 'openai',
//   gemini: 'gemini',
//   'gemini-2.0-flash': 'gemini',
//   'gemini-1.5-flash': 'gemini',
//   'gemini-pro-2.5': 'gemini-pro-2.5',
//   anthropic: 'anthropic',
//   claude: 'anthropic',
//   'claude-3-5-haiku': 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',
//   deepseek: 'deepseek',
//   'deepseek-chat': 'deepseek',
// };

// // ---------------------------
// // Provider Resolver
// // ---------------------------
// function resolveProviderName(name = '') {
//   const key = name.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[key] || 'gemini';
//   console.log(`[resolveProviderName] "${name}" → "${resolved}"`);
//   return resolved;
// }

// // ---------------------------
// // Available Providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries(LLM_CONFIGS).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini'))
//         key = process.env.GEMINI_API_KEY;
//       else if (provider.includes('claude') || provider === 'anthropic')
//         key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek')
//         key = process.env.DEEPSEEK_API_KEY;
//       else
//         key = process.env.OPENAI_API_KEY;
//       return [
//         provider,
//         {
//           available: !!key,
//           model: cfg.model,
//           reason: key ? 'Available' : 'Missing API key',
//         },
//       ];
//     })
//   );
// }

// // ---------------------------
// // Main AI Ask Function
// // ---------------------------
// async function askLLM(providerName, userMessage, context = '', relevant_chunks = '') {
//   const provider = resolveProviderName(providerName);
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

//   const safeContext = typeof context === 'string' ? context : '';

//   const trimmedContext = trimContext(safeContext, 200);
//   const filteredChunks = filterRelevantChunks(relevant_chunks, userMessage, 3);
//   const trimmedChunks = trimContext(filteredChunks, 500);

//   let prompt = userMessage.trim();
//   if (trimmedChunks) prompt += `\n\nRelevant Context:\n${trimmedChunks}`;

//   const totalTokens = estimateTokenCount(prompt + trimmedContext);
//   console.log(`[askLLM] Tokens: ${totalTokens}`);

//   return await retryWithBackoff(() =>
//     callSinglePrompt(provider, prompt, trimmedContext)
//   );
// }

// // ---------------------------
// // Core API Caller
// // ---------------------------
// async function callSinglePrompt(provider, prompt, context = '') {
//   const config = LLM_CONFIGS[provider];
//   const isGemini = provider.startsWith('gemini');
//   const isClaude = provider.startsWith('claude') || provider === 'anthropic';

//   // ---- Gemini ----
//   if (isGemini) {
//     const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//     for (const modelName of models) {
//       try {
//         const model = genAI.getGenerativeModel(
//           context
//             ? { model: modelName, systemInstruction: context }
//             : { model: modelName }
//         );
//         const result = await model.generateContent(prompt);
//         const text = await result.response.text();
//         const usage = result.response.usageMetadata || {};
//         console.log(
//           `✅ Gemini (${modelName}) - Tokens: ${usage.promptTokenCount || 0} + ${usage.candidatesTokenCount || 0}`
//         );
//         return text;
//       } catch (err) {
//         console.warn(`⚠️ Gemini model ${modelName} failed: ${err.message}`);
//       }
//     }
//     return '⚠️ Gemini could not process this input (auto-trimmed).';
//   }

//   // ---- Claude, OpenAI, DeepSeek ----
//   const messages = isClaude
//     ? [{ role: 'user', content: prompt }]
//     : [
//         { role: 'system', content: context || 'You are a helpful assistant.' },
//         { role: 'user', content: prompt },
//       ];

//   const payload = isClaude
//     ? {
//         model: config.model,
//         max_tokens: 4096,
//         messages,
//         system: context,
//       }
//     : {
//         model: config.model,
//         messages,
//         max_tokens: 4096,
//         temperature: 0.5,
//       };

//   const response = await axios.post(config.apiUrl, payload, {
//     headers: config.headers,
//     timeout: 120000,
//   });

//   const usage = response.data?.usage || {};
//   console.log(
//     `✅ ${provider} - Tokens: ${usage.prompt_tokens || usage.input_tokens || 0} + ${usage.completion_tokens || usage.output_tokens || 0}`
//   );

//   return (
//     response.data?.choices?.[0]?.message?.content ||
//     response.data?.content?.[0]?.text ||
//     '⚠️ AI returned no text.'
//   );
// }

// // ---------------------------
// // Exports
// // ---------------------------
// module.exports = {
//   askLLM,
//   resolveProviderName,
//   getAvailableProviders,
// };




// require('dotenv').config();
// const axios = require('axios');
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const { GoogleGenAI } = require('@google/genai');
// const pool = require('../config/db');
// const SystemPrompt = require('../models/SystemPrompt');

// // Old SDK for legacy Gemini models
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // New SDK for Gemini 3.0 Pro
// const genAI3 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // ---------------------------
// // Web Search Service using Serper.dev
// // ---------------------------
// async function performWebSearch(query, numResults = 5) {
//   try {
//     if (!process.env.SERPER_API_KEY) {
//       console.warn('[Web Search] SERPER_API_KEY not found, skipping web search');
//       return null;
//     }

//     const response = await axios.post(
//       'https://google.serper.dev/search',
//       {
//         q: query,
//         num: numResults,
//       },
//       {
//         headers: {
//           'X-API-KEY': process.env.SERPER_API_KEY,
//           'Content-Type': 'application/json',
//         },
//         timeout: 10000,
//       }
//     );

//     const results = response.data?.organic || [];
//     const citations = results.map((result, index) => ({
//       index: index + 1,
//       title: result.title || '',
//       link: result.link || '',
//       snippet: result.snippet || '',
//     }));

//     // Format search results for LLM context
//     const formattedResults = results
//       .map((result, index) => {
//         return `[${index + 1}] ${result.title || 'No title'}\nURL: ${result.link || 'No URL'}\n${result.snippet || 'No snippet'}`;
//       })
//       .join('\n\n');

//     return {
//       results: formattedResults,
//       citations,
//       rawResults: results,
//     };
//   } catch (error) {
//     console.error('[Web Search] Error performing search:', error.message);
//     return null;
//   }
// }

// // ---------------------------
// // Auto-detect if web search is needed
// // ---------------------------
// function shouldTriggerWebSearch(userMessage, context = '', relevantChunks = '') {
//   if (!userMessage) return false;

//   const message = userMessage.toLowerCase();
//   const contextLower = (context || '').toLowerCase();
//   const chunksLower = (relevantChunks || '').toLowerCase();
  
//   // ============================================
//   // FIRST: Check if question is about user's own data/profile (NEVER trigger web search)
//   // ============================================
//   const personalPronouns = [
//     'my',
//     'my own',
//     'my personal',
//     'my profile',
//     'my account',
//     'my information',
//     'my data',
//   ];
  
//   const personalDataKeywords = [
//     'my case',
//     'my organization',
//     'my company',
//     'my firm',
//     'my practice',
//     'my jurisdiction',
//     'my bar',
//     'my credentials',
//     'my role',
//     'my experience',
//     'my details',
//     'my name',
//     'my email',
//     'my phone',
//     'my address',
//     'my license',
//     'my registration',
//     'my status',
//     'my type',
//     'my category',
//   ];
  
//   // Check if question contains personal pronouns
//   const hasPersonalPronoun = personalPronouns.some(pronoun => {
//     // Use word boundaries to match whole words
//     const regex = new RegExp(`\\b${pronoun}\\b`, 'i');
//     return regex.test(userMessage);
//   });
  
//   // Check if question is about personal data
//   const isPersonalDataQuestion = personalDataKeywords.some(keyword => message.includes(keyword));
  
//   // If question is about user's own data/profile, NEVER trigger web search
//   if (hasPersonalPronoun || isPersonalDataQuestion) {
//     console.log('[Web Search] Personal data/profile question detected - skipping web search (like Claude/ChatGPT)');
//     return false;
//   }
  
//   // Check if there's substantial document context provided
//   const hasDocumentContext = (contextLower.length > 500) || (chunksLower.length > 500);
  
//   // Keywords that explicitly request web search (ALWAYS trigger, even with document context)
//   const explicitWebSearchTriggers = [
//     'search for',
//     'search from web',
//     'search from the web',
//     'search on web',
//     'search on the web',
//     'search online',
//     'search the internet',
//     'search the web',
//     'find information about',
//     'find on web',
//     'find on the web',
//     'find online',
//     'look up',
//     'look up online',
//     'look up on web',
//     'google',
//     'google search',
//     'web search',
//     'internet search',
//     'search google',
//     'use web search',
//     'use web',
//     'check online',
//     'check the web',
//     'get from web',
//     'get from internet',
//   ];
  
//   // Keywords that suggest need for CURRENT/REAL-TIME information (not in documents)
//   const currentInfoTriggers = [
//     'latest news',
//     'current events',
//     'recent updates',
//     'what happened today',
//     'news about',
//     'breaking news',
//     'current status',
//     'latest developments',
//     'recent changes',
//   ];
  
//   // Time-based triggers that indicate need for recent information
//   const timeBasedTriggers = [
//     'today',
//     'this week',
//     'this month',
//     'this year',
//     'now',
//     'currently',
//     'as of now',
//     'right now',
//   ];
  
//   // Check for explicit web search requests FIRST - these ALWAYS trigger regardless of document context
//   const hasExplicitTrigger = explicitWebSearchTriggers.some(trigger => message.includes(trigger));
//   if (hasExplicitTrigger) {
//     console.log('[Web Search] ✅ Explicit web search request detected - ALWAYS triggering web search');
//     return true;
//   }
  
//   // Check for current/real-time information requests
//   const hasCurrentInfoTrigger = currentInfoTriggers.some(trigger => message.includes(trigger));
//   if (hasCurrentInfoTrigger) {
//     console.log('[Web Search] Current/real-time information request detected');
//     return true;
//   }
  
//   // Check for time-based triggers combined with information requests
//   const hasTimeTrigger = timeBasedTriggers.some(trigger => message.includes(trigger));
//   const isInfoRequest = message.includes('what') || message.includes('who') || message.includes('when') || 
//                        message.includes('where') || message.includes('how') || message.includes('why');
  
//   if (hasTimeTrigger && isInfoRequest && !hasDocumentContext) {
//     console.log('[Web Search] Time-based information request without document context');
//     return true;
//   }
  
//   // Check for general knowledge questions that are clearly NOT about documents
//   const generalKnowledgePatterns = [
//     /^what is (.+)\?/i,
//     /^who is (.+)\?/i,
//     /^when did (.+) happen\?/i,
//     /^where is (.+)\?/i,
//   ];
  
//   const isGeneralKnowledgeQuestion = generalKnowledgePatterns.some(pattern => pattern.test(userMessage));
  
//   // Document-related keywords that suggest question is ABOUT the documents
//   const documentRelatedKeywords = [
//     'document',
//     'this document',
//     'the document',
//     'these documents',
//     'in the document',
//     'from the document',
//     'according to',
//     'based on',
//     'analyze',
//     'summarize',
//     'explain',
//     'what does it say',
//     'what is mentioned',
//     'what is stated',
//     'extract',
//     'find in',
//     'show me from',
//   ];
  
//   const isDocumentQuestion = documentRelatedKeywords.some(keyword => message.includes(keyword));
  
//   // If question is about documents and we have context, don't search web
//   if (isDocumentQuestion && hasDocumentContext) {
//     console.log('[Web Search] Question is about documents and context is available - skipping web search');
//     return false;
//   }
  
//   // If it's a general knowledge question and NO document context, trigger web search
//   if (isGeneralKnowledgeQuestion && !hasDocumentContext) {
//     console.log('[Web Search] General knowledge question without document context');
//     return true;
//   }
  
//   // If there's substantial document context, be conservative - only search if explicitly needed
//   if (hasDocumentContext) {
//     // Only trigger if explicitly asking for current/recent info or web search
//     const needsCurrentInfo = hasCurrentInfoTrigger || hasTimeTrigger;
//     if (needsCurrentInfo) {
//       console.log('[Web Search] Current information needed despite document context');
//       return true;
//     }
//     // Otherwise, assume answer is in documents
//     console.log('[Web Search] Document context available - assuming answer is in documents');
//     return false;
//   }
  
//   // For pre-upload chats (no document context), only trigger for specific patterns
//   if (!hasDocumentContext) {
//     // Trigger for questions that clearly need web search
//     if (isGeneralKnowledgeQuestion || hasTimeTrigger || hasCurrentInfoTrigger) {
//       console.log('[Web Search] No document context - triggering for general knowledge/time-based question');
//       return true;
//     }
//   }
  
//   // Default: don't trigger web search
//   return false;
// }

// // ---------------------------
// // Token Estimation Helper
// // ---------------------------
// function estimateTokenCount(text = '') {
//   return Math.ceil(text.length / 4); // ~4 characters per token
// }

// // ---------------------------
// // Smart Context Trimmer (adaptive)
// // ---------------------------
// function trimContext(context = '', maxTokens = 20000) {
//   if (!context) return '';
//   const tokens = estimateTokenCount(context);
//   if (tokens <= maxTokens) return context;
//   const ratio = maxTokens / tokens;
//   const trimmedLength = Math.floor(context.length * ratio);
//   return (
//     context.substring(0, trimmedLength) +
//     '\n\n[...context truncated due to model limits...]'
//   );
// }

// // ---------------------------
// // Chunk Relevance Filter
// // ---------------------------
// function filterRelevantChunks(chunks, userMessage, maxChunks = 12) {
//   if (!chunks) return '';
//   const chunkArray = chunks.split('\n\n').filter(Boolean);
//   if (chunkArray.length <= maxChunks) return chunks;

//   const keywords = userMessage
//     .toLowerCase()
//     .split(/\s+/)
//     .filter(w => w.length > 3)
//     .slice(0, 10);

//   const scored = chunkArray.map(chunk => {
//     const text = chunk.toLowerCase();
//     const score = keywords.reduce(
//       (sum, kw) => sum + (text.includes(kw) ? 1 : 0),
//       0
//     );
//     return { chunk, score };
//   });

//   return scored
//     .sort((a, b) => b.score - a.score)
//     .slice(0, maxChunks)
//     .map(s => s.chunk)
//     .join('\n\n');
// }

// // ---------------------------
// // Retry Helper (resilient)
// // ---------------------------
// async function retryWithBackoff(fn, retries = 3, delay = 3000) {
//   for (let i = 1; i <= retries; i++) {
//     try {
//       return await fn();
//     } catch (err) {
//       console.warn(`⚠️ Attempt ${i} failed: ${err.message}`);
//       const transient =
//         err.message.includes('overloaded') ||
//         err.message.includes('temporarily unavailable') ||
//         err.message.includes('quota') ||
//         err.message.includes('rate limit') ||
//         err.message.includes('503');
//       if (transient && i < retries) {
//         await new Promise(res => setTimeout(res, delay * i));
//       } else if (i === retries) {
//         return '⚠️ The AI service is temporarily overloaded. Please try again.';
//       }
//     }
//   }
// }

// // ---------------------------
// // Model Configuration
// // ---------------------------
// const GEMINI_MODELS = {
//   gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
//   'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
//   'gemini-3-pro': ['gemini-3-pro-preview'], // Uses new SDK
// };

// const LLM_CONFIGS = {
//   'gpt-4o': {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//   },
//   openai: {
//     apiUrl: 'https://api.openai.com/v1/chat/completions',
//     model: 'gpt-4o-mini',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
//   'claude-opus-4-1': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-opus-4-1-20250805',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-sonnet-4-5': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-sonnet-4-5-20250929',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
//     },
//   },
//   'claude-haiku-4-5': {
//     apiUrl: 'https://api.anthropic.com/v1/messages',
//     model: 'claude-haiku-4-5-20251001',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-api-key': process.env.ANTHROPIC_API_KEY,
//       'anthropic-version': '2023-06-01',
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
//   deepseek: {
//     apiUrl: 'https://api.deepseek.com/chat/completions',
//     model: 'deepseek-chat',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
//     },
//   },
//   gemini: { model: 'gemini-2.5-flash' },
//   'gemini-pro-2.5': { model: 'gemini-2.5-pro' },
//   'gemini-3-pro': { model: 'gemini-3-pro-preview' }, // Uses new SDK
// };

// const llmTokenCache = new Map();

// function normalizeProviderForDb(provider = '') {
//   const key = provider.toLowerCase();
//   if (key.includes('claude') || key === 'anthropic') return 'anthropic';
//   if (key.startsWith('gemini')) return 'gemini';
//   if (key.startsWith('gpt-') || key.includes('openai')) return 'openai';
//   if (key.includes('deepseek')) return 'deepseek';
//   return provider;
// }

// async function queryMaxTokensByProvider(provider, modelName) {
//   const query = `
//     SELECT max_output_tokens
//     FROM llm_max_tokens
//     WHERE LOWER(provider) = LOWER($1)
//       AND LOWER(model_name) = LOWER($2)
//     ORDER BY updated_at DESC
//     LIMIT 1;
//   `;
//   const { rows } = await pool.query(query, [provider, modelName]);
//   return rows[0]?.max_output_tokens ?? null;
// }

// async function queryMaxTokensByModel(modelName) {
//   const query = `
//     SELECT max_output_tokens
//     FROM llm_max_tokens
//     WHERE LOWER(model_name) = LOWER($1)
//     ORDER BY updated_at DESC
//     LIMIT 1;
//   `;
//   const { rows } = await pool.query(query, [modelName]);
//   return rows[0]?.max_output_tokens ?? null;
// }

// async function getModelMaxTokens(provider, modelName) {
//   if (!modelName) {
//     throw new Error('LLM configuration missing model name when resolving max tokens.');
//   }

//   const cacheKey = `${provider.toLowerCase()}::${modelName.toLowerCase()}`;
//   if (llmTokenCache.has(cacheKey)) return llmTokenCache.get(cacheKey);

//   const providerCandidates = [provider];
//   const normalized = normalizeProviderForDb(provider);
//   if (normalized && normalized !== provider) providerCandidates.push(normalized);
//   providerCandidates.push(null); // final fallback: model-name only

//   for (const candidate of providerCandidates) {
//     let value = null;
//     try {
//       value =
//         candidate === null
//           ? await queryMaxTokensByModel(modelName)
//           : await queryMaxTokensByProvider(candidate, modelName);
//     } catch (err) {
//       console.error(`[LLM Max Tokens] Error querying max tokens for provider="${candidate}" model="${modelName}": ${err.message}`);
//       continue;
//     }

//     if (value != null) {
//       llmTokenCache.set(cacheKey, value);
//       console.log(
//         `[LLM Max Tokens] Using max_output_tokens=${value} for provider="${candidate || 'model-only'}" model="${modelName}"`
//       );
//       return value;
//     }
//   }

//   // Fallback defaults for models not in database
//   const defaultMaxTokens = {
//     'gemini-3-pro-preview': 8192, // Gemini 3.0 Pro default
//     'gemini-2.5-pro': 8192,
//     'gemini-2.5-flash': 8192,
//     'gemini-1.5-flash-latest': 8192,
//     'gemini-1.5-flash': 8192,
//   };

//   const modelLower = modelName.toLowerCase();
//   if (defaultMaxTokens[modelLower]) {
//     const defaultValue = defaultMaxTokens[modelLower];
//     llmTokenCache.set(cacheKey, defaultValue);
//     console.log(
//       `[LLM Max Tokens] Using default max_output_tokens=${defaultValue} for model="${modelName}" (not found in database)`
//     );
//     return defaultValue;
//   }

//   throw new Error(
//     `Max token configuration not found for provider="${provider}", model="${modelName}". Please insert a row into llm_max_tokens.`
//   );
// }

// // ---------------------------
// // Provider Resolver
// // ---------------------------
// const PROVIDER_ALIASES = {
//   openai: 'openai',
//   'gpt-4o': 'gpt-4o',
//   'gpt-4o-mini': 'openai',
//   gemini: 'gemini',
//   'gemini-pro-2.5': 'gemini-pro-2.5',
//   'gemini-3-pro': 'gemini-3-pro',
//   'gemini-3.0-pro': 'gemini-3-pro',
//   claude: 'anthropic',
//   anthropic: 'anthropic',
//   'claude-sonnet-4': 'claude-sonnet-4',
//   'claude-opus-4-1': 'claude-opus-4-1',
//   'claude-opus-4.1': 'claude-opus-4-1',
//   'claude-sonnet-4-5': 'claude-sonnet-4-5',
//   'claude-sonnet-4.5': 'claude-sonnet-4-5',
//   'claude-haiku-4-5': 'claude-haiku-4-5',
//   'claude-haiku-4.5': 'claude-haiku-4-5',
//   deepseek: 'deepseek',
//   'deepseek-chat': 'deepseek',
// };

// function resolveProviderName(name = '') {
//   const key = name.trim().toLowerCase();
//   const resolved = PROVIDER_ALIASES[key] || 'gemini';
//   console.log(`[resolveProviderName] "${name}" → "${resolved}"`);
//   return resolved;
// }

// // ---------------------------
// // Get Available Providers
// // ---------------------------
// function getAvailableProviders() {
//   return Object.fromEntries(
//     Object.entries(LLM_CONFIGS).map(([provider, cfg]) => {
//       let key;
//       if (provider.startsWith('gemini'))
//         key = process.env.GEMINI_API_KEY;
//       else if (provider.includes('claude') || provider === 'anthropic')
//         key = process.env.ANTHROPIC_API_KEY;
//       else if (provider === 'deepseek')
//         key = process.env.DEEPSEEK_API_KEY;
//       else key = process.env.OPENAI_API_KEY;
//       return [
//         provider,
//         {
//           available: !!key,
//           model: cfg.model,
//           reason: key ? 'Available' : 'Missing API key',
//         },
//       ];
//     })
//   );
// }

// // ---------------------------
// // Main Ask Function
// // ---------------------------
// async function askLLM(providerName, userMessage, context = '', relevant_chunks = '', originalQuestion = null) {
//   const provider = resolveProviderName(providerName);
//   const config = LLM_CONFIGS[provider];
//   if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

//   const safeContext = typeof context === 'string' ? context : '';

//   // Extract original user question for web search (before context is added)
//   // If originalQuestion is provided, use it; otherwise try to extract from userMessage
//   let userQuestionForSearch = originalQuestion || userMessage;
  
//   // Try to extract the actual question if userMessage contains context markers
//   if (!originalQuestion && userMessage) {
//     // Look for patterns like "USER QUESTION:" or extract first line if it's a simple question
//     const userQuestionMatch = userMessage.match(/USER QUESTION:\s*(.+?)(?:\n\n===|$)/s);
//     if (userQuestionMatch) {
//       userQuestionForSearch = userQuestionMatch[1].trim();
//     } else {
//       // If no marker, try to extract the first meaningful line (before context sections)
//       const lines = userMessage.split('\n');
//       const contextMarkers = ['===', '---', 'Relevant Context', 'DOCUMENT', 'PROFILE'];
//       for (let i = 0; i < lines.length; i++) {
//         if (contextMarkers.some(marker => lines[i].includes(marker))) {
//           userQuestionForSearch = lines.slice(0, i).join(' ').trim();
//           break;
//         }
//       }
//       // If still no good extraction, use first 200 chars as fallback
//       if (!userQuestionForSearch || userQuestionForSearch.length > 500) {
//         userQuestionForSearch = userMessage.substring(0, 200).trim();
//       }
//     }
//   }

//   // Large input handling
//   const trimmedContext = trimContext(safeContext, 20000);
//   const filteredChunks = filterRelevantChunks(relevant_chunks, userQuestionForSearch, 12);
//   const trimmedChunks = trimContext(filteredChunks, 20000);

//   // Check if web search is needed - ONLY use the original user question, not the full prompt
//   // Pass document context and chunks to determine if web search is actually needed
//   let webSearchData = null;
//   let citations = [];
  
//   // Check if web search is needed based on question and available document context
//   if (shouldTriggerWebSearch(userQuestionForSearch, trimmedContext, trimmedChunks)) {
//     console.log('[Web Search] 🔍 Auto-triggering web search for user question:', userQuestionForSearch.substring(0, 100));
//     webSearchData = await performWebSearch(userQuestionForSearch, 5);
    
//     if (webSearchData && webSearchData.results) {
//       citations = webSearchData.citations;
//       console.log(`[Web Search] ✅ Found ${citations.length} search results with citations`);
//     } else {
//       console.log('[Web Search] ⚠️ No search results found');
//     }
//   }

//   let prompt = userMessage.trim();
//   if (trimmedChunks) prompt += `\n\nRelevant Context:\n${trimmedChunks}`;
  
//   // Add web search results to prompt if available
//   if (webSearchData && webSearchData.results) {
//     prompt += `\n\n[Web Search Results - Use this information to provide accurate, up-to-date answers. Include citations when referencing these sources:]\n${webSearchData.results}`;
//   }

//   const totalTokens = estimateTokenCount(prompt + trimmedContext);
//   console.log(`[askLLM] Total tokens estimated: ${totalTokens}${webSearchData ? ' (with web search)' : ''}`);

//   const response = await retryWithBackoff(() =>
//     callSinglePrompt(provider, prompt, trimmedContext)
//   );

//   // Append citations to response if web search was performed
//   if (citations.length > 0) {
//     const citationsText = '\n\n---\n**Sources:**\n' + citations.map(c => `${c.index}. [${c.title}](${c.link})`).join('\n');
//     return response + citationsText;
//   }

//   return response;
// }

// // ---------------------------
// // Get System Prompt from Database
// // ---------------------------
// async function getSystemPrompt(context = '') {
//   try {
//     const dbSystemPrompt = await SystemPrompt.getLatestSystemPrompt();
    
//     // Combine database system prompt with context if both exist
//     if (dbSystemPrompt && context) {
//       console.log('[SystemPrompt] 🔄 Using database system prompt + context for system instruction');
//       return `${dbSystemPrompt}\n\n${context}`;
//     }
    
//     // Use database system prompt if available
//     if (dbSystemPrompt) {
//       console.log('[SystemPrompt] ✅ Using system prompt from database for system instruction');
//       return dbSystemPrompt;
//     }
    
//     // Fallback to context or default
//     console.log('[SystemPrompt] ⚠️ No database prompt found, using fallback system instruction');
//     return context || 'You are a helpful legal AI assistant.';
//   } catch (err) {
//     console.error('[SystemPrompt] ❌ Error getting system prompt, using fallback:', err.message);
//     return context || 'You are a helpful legal AI assistant.';
//   }
// }

// // ---------------------------
// // Core API Caller
// // ---------------------------
// async function callSinglePrompt(provider, prompt, context = '') {
//   const config = LLM_CONFIGS[provider];
//   const isGemini = provider.startsWith('gemini');
//   const isClaude = provider.startsWith('claude') || provider === 'anthropic';

//   // Get system prompt from database
//   const systemPrompt = await getSystemPrompt(context);
//   console.log(`[SystemPrompt] 📝 Applying system instruction for ${provider} (length: ${systemPrompt.length} chars)`);

//   // ---- Gemini ----
//   if (isGemini) {
//     const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
//     for (const modelName of models) {
//       try {
//         const maxOutputTokens = await getModelMaxTokens(provider, modelName);
//         console.log(`[LLM Max Tokens] Gemini model ${modelName} using maxOutputTokens=${maxOutputTokens}`);
        
//         // Check if this is Gemini 3.0 Pro (uses new SDK)
//         const isGemini3Pro = modelName === 'gemini-3-pro-preview';
        
//         if (isGemini3Pro) {
//           // Use new SDK for Gemini 3.0 Pro
//           console.log(`[SystemPrompt] 🎯 Gemini 3.0 Pro ${modelName} using new SDK with system instruction`);
          
//           // Build contents for new SDK - can be string or array of content objects
//           // For system prompts, we'll combine system prompt with user prompt
//           const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
          
//           const response = await genAI3.models.generateContent({
//             model: modelName,
//             contents: fullPrompt,
//             config: {
//               maxOutputTokens,
//               // Optional: Enable thinking mode for complex reasoning
//               // thinkingConfig: {
//               //   thinkingLevel: 'HIGH' // Options: 'LOW', 'HIGH'
//               // }
//             },
//           });
          
//           // Extract text from response - the new SDK may return text directly or in candidates
//           const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
//           const usage = response.usageMetadata || {};
//           console.log(
//             `✅ Gemini 3.0 Pro (${modelName}) - Tokens used: ${usage.promptTokenCount || 0} + ${usage.candidatesTokenCount || 0} | max=${maxOutputTokens}`
//           );
//           return text;
//         } else {
//           // Use old SDK for legacy Gemini models
//           console.log(`[SystemPrompt] 🎯 Gemini ${modelName} using legacy SDK with systemInstruction from database`);
//           const model = genAI.getGenerativeModel(
//             systemPrompt
//               ? { model: modelName, systemInstruction: systemPrompt }
//               : { model: modelName }
//           );
//           const result = await model.generateContent(prompt, {
//             generationConfig: {
//               maxOutputTokens,
//             },
//           });
//           const text = await result.response.text();
//           const usage = result.response.usageMetadata || {};
//           console.log(
//             `✅ Gemini (${modelName}) - Tokens used: ${usage.promptTokenCount || 0} + ${usage.candidatesTokenCount || 0} | max=${maxOutputTokens}`
//           );
//           return text;
//         }
//       } catch (err) {
//         console.warn(`⚠️ Gemini model ${modelName} failed: ${err.message}`);
//       }
//     }
//     return '⚠️ Gemini could not process this input (auto-trimmed).';
//   }

//   // ---- Claude / OpenAI / DeepSeek ----
//   const messages = isClaude
//     ? [{ role: 'user', content: prompt }]
//     : [
//         { role: 'system', content: systemPrompt },
//         { role: 'user', content: prompt },
//       ];

//   const resolvedModelName = config.model;
//   const maxTokens = await getModelMaxTokens(provider, resolvedModelName);

//   if (isClaude) {
//     console.log(`[SystemPrompt] 🎯 Claude ${resolvedModelName} using system field from database`);
//   } else {
//     console.log(`[SystemPrompt] 🎯 ${provider} ${resolvedModelName} using system role in messages from database`);
//   }

//   const payload = isClaude
//     ? {
//         model: config.model,
//         max_tokens: maxTokens,
//         messages,
//         system: systemPrompt,
//       }
//     : {
//         model: config.model,
//         messages,
//         max_tokens: maxTokens,
//         temperature: 0.5,
//       };
//   console.log(`[LLM Max Tokens] ${provider} model ${resolvedModelName} using max_tokens=${maxTokens}`);

//   const response = await axios.post(config.apiUrl, payload, {
//     headers: config.headers,
//     timeout: 240000, // 4 minutes for long responses
//   });

//   const usage = response.data?.usage || {};
//   console.log(
//     `✅ ${provider} - Tokens: ${usage.prompt_tokens || usage.input_tokens || 0} + ${usage.completion_tokens || usage.output_tokens || 0}`
//   );

//   return (
//     response.data?.choices?.[0]?.message?.content ||
//     response.data?.content?.[0]?.text ||
//     '⚠️ AI returned no text.'
//   );
// }

// // ---------------------------
// // Exports
// // ---------------------------
// async function getSummaryFromChunks(chunks) {
//   if (!chunks || chunks.length === 0) {
//     return null;
//   }
//   const combinedText = chunks.join('\n\n');
//   const prompt = `Provide a concise summary of the following text:\n\n${combinedText}`;
  
//   // Use the existing askLLM function to get the summary
//   const summary = await askLLM('gemini', prompt);
//   return summary;
// }

// module.exports = {
//   askLLM,
//   resolveProviderName,
//   getAvailableProviders,
//   getSummaryFromChunks,
// };

require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/db');
const SystemPrompt = require('../models/SystemPrompt');

// Old SDK for legacy Gemini models
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// New SDK for Gemini 3.0 Pro
const genAI3 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------------------
// Web Search Service using Serper.dev
// ---------------------------
async function performWebSearch(query, numResults = 5) {
  try {
    if (!process.env.SERPER_API_KEY) {
      console.warn('[Web Search] SERPER_API_KEY not found, skipping web search');
      return null;
    }

    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: query,
        num: numResults,
      },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const results = response.data?.organic || [];
    const citations = results.map((result, index) => ({
      index: index + 1,
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
    }));

    // Format search results for LLM context with clear attribution
    const formattedResults = results
      .map((result, index) => {
        return `[Source ${index + 1}] ${result.title || 'No title'}\nURL: ${result.link || 'No URL'}\nSnippet: ${result.snippet || 'No snippet'}`;
      })
      .join('\n\n');

    return {
      results: formattedResults,
      citations,
      rawResults: results,
    };
  } catch (error) {
    console.error('[Web Search] Error performing search:', error.message);
    return null;
  }
}

// ---------------------------
// Auto-detect if web search is needed
// ---------------------------
function shouldTriggerWebSearch(userMessage, context = '', relevantChunks = '') {
  if (!userMessage) return false;

  const message = userMessage.toLowerCase();
  const contextLower = (context || '').toLowerCase();
  const chunksLower = (relevantChunks || '').toLowerCase();
  
  // ============================================
  // FIRST: Check if question is about user's own data/profile (NEVER trigger web search)
  // ============================================
  const personalPronouns = [
    'my',
    'my own',
    'my personal',
    'my profile',
    'my account',
    'my information',
    'my data',
  ];
  
  const personalDataKeywords = [
    'my case',
    'my organization',
    'my company',
    'my firm',
    'my practice',
    'my jurisdiction',
    'my bar',
    'my credentials',
    'my role',
    'my experience',
    'my details',
    'my name',
    'my email',
    'my phone',
    'my address',
    'my license',
    'my registration',
    'my status',
    'my type',
    'my category',
  ];
  
  // Check if question contains personal pronouns
  const hasPersonalPronoun = personalPronouns.some(pronoun => {
    // Use word boundaries to match whole words
    const regex = new RegExp(`\\b${pronoun}\\b`, 'i');
    return regex.test(userMessage);
  });
  
  // Check if question is about personal data
  const isPersonalDataQuestion = personalDataKeywords.some(keyword => message.includes(keyword));
  
  // If question is about user's own data/profile, NEVER trigger web search
  if (hasPersonalPronoun || isPersonalDataQuestion) {
    console.log('[Web Search] Personal data/profile question detected - skipping web search');
    return false;
  }
  
  // Check if there's substantial document context provided
  const hasDocumentContext = (contextLower.length > 500) || (chunksLower.length > 500);
  
  // Keywords that explicitly request web search (ALWAYS trigger, even with document context)
  const explicitWebSearchTriggers = [
    'search for',
    'search from web',
    'search from the web',
    'search on web',
    'search on the web',
    'search online',
    'search the internet',
    'search the web',
    'find information about',
    'find on web',
    'find on the web',
    'find online',
    'look up',
    'look up online',
    'look up on web',
    'google',
    'google search',
    'web search',
    'internet search',
    'search google',
    'use web search',
    'use web',
    'check online',
    'check the web',
    'get from web',
    'get from internet',
  ];
  
  // Keywords that suggest need for CURRENT/REAL-TIME information (not in documents)
  const currentInfoTriggers = [
    'latest news',
    'current events',
    'recent updates',
    'what happened today',
    'news about',
    'breaking news',
    'current status',
    'latest developments',
    'recent changes',
    'what is happening',
    'latest',
    'current',
    'recent',
  ];
  
  // Time-based triggers that indicate need for recent information
  const timeBasedTriggers = [
    'today',
    'this week',
    'this month',
    'this year',
    'now',
    'currently',
    'as of now',
    'right now',
    '2024',
    '2025',
  ];
  
  // Check for explicit web search requests FIRST - these ALWAYS trigger regardless of document context
  const hasExplicitTrigger = explicitWebSearchTriggers.some(trigger => message.includes(trigger));
  if (hasExplicitTrigger) {
    console.log('[Web Search] ✅ Explicit web search request detected - triggering web search');
    return true;
  }
  
  // Check for current/real-time information requests
  const hasCurrentInfoTrigger = currentInfoTriggers.some(trigger => message.includes(trigger));
  if (hasCurrentInfoTrigger) {
    console.log('[Web Search] ✅ Current/real-time information request detected - triggering web search');
    return true;
  }
  
  // Check for time-based triggers combined with information requests
  const hasTimeTrigger = timeBasedTriggers.some(trigger => message.includes(trigger));
  const isInfoRequest = message.includes('what') || message.includes('who') || message.includes('when') || 
                       message.includes('where') || message.includes('how') || message.includes('why');
  
  if (hasTimeTrigger && isInfoRequest && !hasDocumentContext) {
    console.log('[Web Search] ✅ Time-based information request without document context - triggering web search');
    return true;
  }
  
  // Check for general knowledge questions that are clearly NOT about documents
  const generalKnowledgePatterns = [
    /^what is (.+)\?/i,
    /^who is (.+)\?/i,
    /^when did (.+) happen\?/i,
    /^where is (.+)\?/i,
    /^how to (.+)\?/i,
    /^why (.+)\?/i,
  ];
  
  const isGeneralKnowledgeQuestion = generalKnowledgePatterns.some(pattern => pattern.test(userMessage));
  
  // Document-related keywords that suggest question is ABOUT the documents
  const documentRelatedKeywords = [
    'document',
    'this document',
    'the document',
    'these documents',
    'in the document',
    'from the document',
    'according to',
    'based on',
    'analyze',
    'summarize',
    'explain',
    'what does it say',
    'what is mentioned',
    'what is stated',
    'extract',
    'find in',
    'show me from',
  ];
  
  const isDocumentQuestion = documentRelatedKeywords.some(keyword => message.includes(keyword));
  
  // If question is about documents and we have context, don't search web
  if (isDocumentQuestion && hasDocumentContext) {
    console.log('[Web Search] Question is about documents and context is available - skipping web search');
    return false;
  }
  
  // If it's a general knowledge question and NO document context, trigger web search
  if (isGeneralKnowledgeQuestion && !hasDocumentContext) {
    console.log('[Web Search] ✅ General knowledge question without document context - triggering web search');
    return true;
  }
  
  // If there's substantial document context, be conservative - only search if explicitly needed
  if (hasDocumentContext) {
    // Only trigger if explicitly asking for current/recent info or web search
    const needsCurrentInfo = hasCurrentInfoTrigger || hasTimeTrigger;
    if (needsCurrentInfo) {
      console.log('[Web Search] ✅ Current information needed despite document context - triggering web search');
      return true;
    }
    // Otherwise, assume answer is in documents
    console.log('[Web Search] Document context available - assuming answer is in documents');
    return false;
  }
  
  // For pre-upload chats (no document context), only trigger for specific patterns
  if (!hasDocumentContext) {
    // Trigger for questions that clearly need web search
    if (isGeneralKnowledgeQuestion || hasTimeTrigger || hasCurrentInfoTrigger) {
      console.log('[Web Search] ✅ No document context - triggering for general knowledge/time-based question');
      return true;
    }
  }
  
  // Default: don't trigger web search
  console.log('[Web Search] No trigger conditions met - skipping web search');
  return false;
}

// ---------------------------
// Token Estimation Helper
// ---------------------------
function estimateTokenCount(text = '') {
  return Math.ceil(text.length / 4); // ~4 characters per token
}

// ---------------------------
// Smart Context Trimmer (adaptive)
// ---------------------------
function trimContext(context = '', maxTokens = 20000) {
  if (!context) return '';
  const tokens = estimateTokenCount(context);
  if (tokens <= maxTokens) return context;
  const ratio = maxTokens / tokens;
  const trimmedLength = Math.floor(context.length * ratio);
  return (
    context.substring(0, trimmedLength) +
    '\n\n[...context truncated due to model limits...]'
  );
}

// ---------------------------
// Chunk Relevance Filter
// ---------------------------
function filterRelevantChunks(chunks, userMessage, maxChunks = 12) {
  if (!chunks) return '';
  const chunkArray = chunks.split('\n\n').filter(Boolean);
  if (chunkArray.length <= maxChunks) return chunks;

  const keywords = userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 10);

  const scored = chunkArray.map(chunk => {
    const text = chunk.toLowerCase();
    const score = keywords.reduce(
      (sum, kw) => sum + (text.includes(kw) ? 1 : 0),
      0
    );
    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(s => s.chunk)
    .join('\n\n');
}

// ---------------------------
// Retry Helper (resilient)
// ---------------------------
async function retryWithBackoff(fn, retries = 3, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`⚠️ Attempt ${i} failed: ${err.message}`);
      const transient =
        err.message.includes('overloaded') ||
        err.message.includes('temporarily unavailable') ||
        err.message.includes('quota') ||
        err.message.includes('rate limit') ||
        err.message.includes('503');
      if (transient && i < retries) {
        await new Promise(res => setTimeout(res, delay * i));
      } else if (i === retries) {
        return '⚠️ The AI service is temporarily overloaded. Please try again.';
      }
    }
  }
}

// ---------------------------
// Model Configuration
// ---------------------------
const GEMINI_MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-1.5-flash-latest'],
  'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.5-flash'],
  'gemini-3-pro': ['gemini-3-pro-preview'], // Uses new SDK
};

const LLM_CONFIGS = {
  'gpt-4o': {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
  'claude-opus-4-1': {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-opus-4-1-20250805',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  'claude-sonnet-4-5': {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-5-20250929',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  },
  'claude-haiku-4-5': {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5-20251001',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
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
  deepseek: {
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  },
  gemini: { model: 'gemini-2.5-flash' },
  'gemini-pro-2.5': { model: 'gemini-2.5-pro' },
  'gemini-3-pro': { model: 'gemini-3-pro-preview' }, // Uses new SDK
};

const llmTokenCache = new Map();

function normalizeProviderForDb(provider = '') {
  const key = provider.toLowerCase();
  if (key.includes('claude') || key === 'anthropic') return 'anthropic';
  if (key.startsWith('gemini')) return 'gemini';
  if (key.startsWith('gpt-') || key.includes('openai')) return 'openai';
  if (key.includes('deepseek')) return 'deepseek';
  return provider;
}

async function queryMaxTokensByProvider(provider, modelName) {
  const query = `
    SELECT max_output_tokens
    FROM llm_max_tokens
    WHERE LOWER(provider) = LOWER($1)
      AND LOWER(model_name) = LOWER($2)
    ORDER BY updated_at DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [provider, modelName]);
  return rows[0]?.max_output_tokens ?? null;
}

async function queryMaxTokensByModel(modelName) {
  const query = `
    SELECT max_output_tokens
    FROM llm_max_tokens
    WHERE LOWER(model_name) = LOWER($1)
    ORDER BY updated_at DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [modelName]);
  return rows[0]?.max_output_tokens ?? null;
}

async function getModelMaxTokens(provider, modelName) {
  if (!modelName) {
    throw new Error('LLM configuration missing model name when resolving max tokens.');
  }

  const cacheKey = `${provider.toLowerCase()}::${modelName.toLowerCase()}`;
  if (llmTokenCache.has(cacheKey)) return llmTokenCache.get(cacheKey);

  const providerCandidates = [provider];
  const normalized = normalizeProviderForDb(provider);
  if (normalized && normalized !== provider) providerCandidates.push(normalized);
  providerCandidates.push(null); // final fallback: model-name only

  for (const candidate of providerCandidates) {
    let value = null;
    try {
      value =
        candidate === null
          ? await queryMaxTokensByModel(modelName)
          : await queryMaxTokensByProvider(candidate, modelName);
    } catch (err) {
      console.error(`[LLM Max Tokens] Error querying max tokens for provider="${candidate}" model="${modelName}": ${err.message}`);
      continue;
    }

    if (value != null) {
      llmTokenCache.set(cacheKey, value);
      console.log(
        `[LLM Max Tokens] Using max_output_tokens=${value} for provider="${candidate || 'model-only'}" model="${modelName}"`
      );
      return value;
    }
  }

  // Fallback defaults for models not in database
  const defaultMaxTokens = {
    'gemini-3-pro-preview': 8192, // Gemini 3.0 Pro default
    'gemini-2.5-pro': 8192,
    'gemini-2.5-flash': 8192,
    'gemini-1.5-flash-latest': 8192,
    'gemini-1.5-flash': 8192,
  };

  const modelLower = modelName.toLowerCase();
  if (defaultMaxTokens[modelLower]) {
    const defaultValue = defaultMaxTokens[modelLower];
    llmTokenCache.set(cacheKey, defaultValue);
    console.log(
      `[LLM Max Tokens] Using default max_output_tokens=${defaultValue} for model="${modelName}" (not found in database)`
    );
    return defaultValue;
  }

  throw new Error(
    `Max token configuration not found for provider="${provider}", model="${modelName}". Please insert a row into llm_max_tokens.`
  );
}

// ---------------------------
// Provider Resolver
// ---------------------------
const PROVIDER_ALIASES = {
  openai: 'openai',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'openai',
  gemini: 'gemini',
  'gemini-pro-2.5': 'gemini-pro-2.5',
  'gemini-3-pro': 'gemini-3-pro',
  'gemini-3.0-pro': 'gemini-3-pro',
  claude: 'anthropic',
  anthropic: 'anthropic',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-opus-4-1': 'claude-opus-4-1',
  'claude-opus-4.1': 'claude-opus-4-1',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-sonnet-4.5': 'claude-sonnet-4-5',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  'claude-haiku-4.5': 'claude-haiku-4-5',
  deepseek: 'deepseek',
  'deepseek-chat': 'deepseek',
};

function resolveProviderName(name = '') {
  const key = name.trim().toLowerCase();
  const resolved = PROVIDER_ALIASES[key] || 'gemini';
  console.log(`[resolveProviderName] "${name}" → "${resolved}"`);
  return resolved;
}

// ---------------------------
// Get Available Providers
// ---------------------------
function getAvailableProviders() {
  return Object.fromEntries(
    Object.entries(LLM_CONFIGS).map(([provider, cfg]) => {
      let key;
      if (provider.startsWith('gemini'))
        key = process.env.GEMINI_API_KEY;
      else if (provider.includes('claude') || provider === 'anthropic')
        key = process.env.ANTHROPIC_API_KEY;
      else if (provider === 'deepseek')
        key = process.env.DEEPSEEK_API_KEY;
      else key = process.env.OPENAI_API_KEY;
      return [
        provider,
        {
          available: !!key,
          model: cfg.model,
          reason: key ? 'Available' : 'Missing API key',
        },
      ];
    })
  );
}

// ---------------------------
// Main Ask Function
// ---------------------------
async function askLLM(providerName, userMessage, context = '', relevant_chunks = '', originalQuestion = null) {
  const provider = resolveProviderName(providerName);
  const config = LLM_CONFIGS[provider];
  if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

  const safeContext = typeof context === 'string' ? context : '';

  // Extract original user question for web search (before context is added)
  let userQuestionForSearch = originalQuestion || userMessage;
  
  // Try to extract the actual question if userMessage contains context markers
  if (!originalQuestion && userMessage) {
    const userQuestionMatch = userMessage.match(/USER QUESTION:\s*(.+?)(?:\n\n===|$)/s);
    if (userQuestionMatch) {
      userQuestionForSearch = userQuestionMatch[1].trim();
    } else {
      // If no marker, try to extract the first meaningful line
      const lines = userMessage.split('\n');
      const contextMarkers = ['===', '---', 'Relevant Context', 'DOCUMENT', 'PROFILE'];
      for (let i = 0; i < lines.length; i++) {
        if (contextMarkers.some(marker => lines[i].includes(marker))) {
          userQuestionForSearch = lines.slice(0, i).join(' ').trim();
          break;
        }
      }
      // If still no good extraction, use first 200 chars as fallback
      if (!userQuestionForSearch || userQuestionForSearch.length > 500) {
        userQuestionForSearch = userMessage.substring(0, 200).trim();
      }
    }
  }

  // Large input handling
  const trimmedContext = trimContext(safeContext, 20000);
  const filteredChunks = filterRelevantChunks(relevant_chunks, userQuestionForSearch, 12);
  const trimmedChunks = trimContext(filteredChunks, 20000);

  // Check if web search is needed
  let webSearchData = null;
  let citations = [];
  let sourceInfo = [];
  
  // Determine what sources are available
  if (trimmedChunks) {
    sourceInfo.push('📄 Uploaded Documents');
  }
  if (trimmedContext) {
    sourceInfo.push('📋 User Profile/Context');
  }
  
  // Check if web search is needed based on question and available document context
  if (shouldTriggerWebSearch(userQuestionForSearch, trimmedContext, trimmedChunks)) {
    console.log('[Web Search] 🔍 Auto-triggering web search for user question:', userQuestionForSearch.substring(0, 100));
    webSearchData = await performWebSearch(userQuestionForSearch, 5);
    
    if (webSearchData && webSearchData.results) {
      citations = webSearchData.citations;
      sourceInfo.push('🌐 Web Search');
      console.log(`[Web Search] ✅ Found ${citations.length} search results with citations`);
    } else {
      console.log('[Web Search] ⚠️ No search results found');
    }
  }

  // Build prompt with clear source attribution
  let prompt = userMessage.trim();
  
  // Add document chunks if available
  if (trimmedChunks) {
    prompt += `\n\n=== UPLOADED DOCUMENTS CONTEXT ===\n${trimmedChunks}`;
  }
  
  // Add web search results if available
  if (webSearchData && webSearchData.results) {
    prompt += `\n\n=== WEB SEARCH RESULTS ===\n${webSearchData.results}\n\n⚠️ IMPORTANT: When using information from web sources above, cite them as [Source 1], [Source 2], etc.`;
  }
  
  // Add instruction about source attribution
  if (sourceInfo.length > 0) {
    prompt += `\n\n📌 Available Information Sources: ${sourceInfo.join(', ')}`;
    prompt += `\n\n🎯 Instructions: 
- Answer the question using the most relevant sources available.
- Clearly indicate which source(s) you're using (e.g., "Based on your uploaded documents..." or "According to web search results..." or "From your profile...").
- If using web search, cite sources as [Source 1], [Source 2], etc.
- If information is not available in any source, clearly state that.`;
  }

  const totalTokens = estimateTokenCount(prompt + trimmedContext);
  console.log(`[askLLM] Total tokens estimated: ${totalTokens} | Sources: ${sourceInfo.join(', ')}`);

  const response = await retryWithBackoff(() =>
    callSinglePrompt(provider, prompt, trimmedContext)
  );

  // Append citations if web search was performed
  if (citations.length > 0) {
    const citationsText = '\n\n---\n**📚 Web Sources Referenced:**\n' + 
      citations.map(c => `[Source ${c.index}] [${c.title}](${c.link})`).join('\n');
    return response + citationsText;
  }

  return response;
}

// ---------------------------
// Get System Prompt from Database
// ---------------------------
async function getSystemPrompt(context = '') {
  try {
    const dbSystemPrompt = await SystemPrompt.getLatestSystemPrompt();
    
    // Combine database system prompt with context if both exist
    if (dbSystemPrompt && context) {
      console.log('[SystemPrompt] 🔄 Using database system prompt + context for system instruction');
      return `${dbSystemPrompt}\n\n${context}`;
    }
    
    // Use database system prompt if available
    if (dbSystemPrompt) {
      console.log('[SystemPrompt] ✅ Using system prompt from database for system instruction');
      return dbSystemPrompt;
    }
    
    // Fallback to context or default
    console.log('[SystemPrompt] ⚠️ No database prompt found, using fallback system instruction');
    return context || 'You are a helpful legal AI assistant.';
  } catch (err) {
    console.error('[SystemPrompt] ❌ Error getting system prompt, using fallback:', err.message);
    return context || 'You are a helpful legal AI assistant.';
  }
}

// ---------------------------
// Core API Caller
// ---------------------------
async function callSinglePrompt(provider, prompt, context = '') {
  const config = LLM_CONFIGS[provider];
  const isGemini = provider.startsWith('gemini');
  const isClaude = provider.startsWith('claude') || provider === 'anthropic';

  // Get system prompt from database
  const systemPrompt = await getSystemPrompt(context);
  console.log(`[SystemPrompt] 📝 Applying system instruction for ${provider} (length: ${systemPrompt.length} chars)`);

  // ---- Gemini ----
  if (isGemini) {
    const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
    for (const modelName of models) {
      try {
        const maxOutputTokens = await getModelMaxTokens(provider, modelName);
        console.log(`[LLM Max Tokens] Gemini model ${modelName} using maxOutputTokens=${maxOutputTokens}`);
        
        // Check if this is Gemini 3.0 Pro (uses new SDK)
        const isGemini3Pro = modelName === 'gemini-3-pro-preview';
        
        if (isGemini3Pro) {
          // Use new SDK for Gemini 3.0 Pro
          console.log(`[SystemPrompt] 🎯 Gemini 3.0 Pro ${modelName} using new SDK`);
          
          // Build request for new SDK
          const requestPayload = {
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ],
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            generationConfig: {
              maxOutputTokens,
              temperature: 0.7,
            }
          };
          
          const response = await genAI3.models.generateContent(requestPayload);
          
          // Extract text from response
          const text = response.text || 
                      response.candidates?.[0]?.content?.parts?.[0]?.text || 
                      response.response?.text() || '';
          
          if (!text) {
            throw new Error('No text returned from Gemini 3.0 Pro');
          }
          
          const usage = response.usageMetadata || {};
          console.log(
            `✅ Gemini 3.0 Pro (${modelName}) - Tokens used: ${usage.promptTokenCount || 0} + ${usage.candidatesTokenCount || 0} | max=${maxOutputTokens}`
          );
          return text;
        } else {
          // Use old SDK for legacy Gemini models
          console.log(`[SystemPrompt] 🎯 Gemini ${modelName} using legacy SDK with systemInstruction from database`);
          const model = genAI.getGenerativeModel(
            systemPrompt
              ? { model: modelName, systemInstruction: systemPrompt }
              : { model: modelName }
          );
          const result = await model.generateContent(prompt, {
            generationConfig: {
              maxOutputTokens,
            },
          });
          const text = await result.response.text();
          const usage = result.response.usageMetadata || {};
          console.log(
            `✅ Gemini (${modelName}) - Tokens used: ${usage.promptTokenCount || 0} + ${usage.candidatesTokenCount || 0} | max=${maxOutputTokens}`
          );
          return text;
        }
      } catch (err) {
        console.warn(`⚠️ Gemini model ${modelName} failed: ${err.message}`);
        console.error('[Gemini Error Details]', err.response?.data || err);
      }
    }
    return '⚠️ Gemini could not process this input (auto-trimmed).';
  }

  // ---- Claude / OpenAI / DeepSeek ----
  const messages = isClaude
    ? [{ role: 'user', content: prompt }]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

  const resolvedModelName = config.model;
  const maxTokens = await getModelMaxTokens(provider, resolvedModelName);

  if (isClaude) {
    console.log(`[SystemPrompt] 🎯 Claude ${resolvedModelName} using system field from database`);
  } else {
    console.log(`[SystemPrompt] 🎯 ${provider} ${resolvedModelName} using system role in messages from database`);
  }

  const payload = isClaude
    ? {
        model: config.model,
        max_tokens: maxTokens,
        messages,
        system: systemPrompt,
      }
    : {
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.5,
      };
  console.log(`[LLM Max Tokens] ${provider} model ${resolvedModelName} using max_tokens=${maxTokens}`);

  const response = await axios.post(config.apiUrl, payload, {
    headers: config.headers,
    timeout: 240000, // 4 minutes for long responses
  });

  const usage = response.data?.usage || {};
  console.log(
    `✅ ${provider} - Tokens: ${usage.prompt_tokens || usage.input_tokens || 0} + ${usage.completion_tokens || usage.output_tokens || 0}`
  );

  return (
    response.data?.choices?.[0]?.message?.content ||
    response.data?.content?.[0]?.text ||
    '⚠️ AI returned no text.'
  );
}

// ---------------------------
// Exports
// ---------------------------
async function getSummaryFromChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    return null;
  }
  const combinedText = chunks.join('\n\n');
  const prompt = `Provide a concise summary of the following text:\n\n${combinedText}`;
  
  // Use the existing askLLM function to get the summary
  const summary = await askLLM('gemini', prompt);
  return summary;
}

module.exports = {
  askLLM,
  resolveProviderName,
  getAvailableProviders,
  getSummaryFromChunks,
};