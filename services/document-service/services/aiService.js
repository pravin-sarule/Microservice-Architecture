

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




require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
const SystemPrompt = require('../models/SystemPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
async function askLLM(providerName, userMessage, context = '', relevant_chunks = '') {
  const provider = resolveProviderName(providerName);
  const config = LLM_CONFIGS[provider];
  if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

  const safeContext = typeof context === 'string' ? context : '';

  // Large input handling
  const trimmedContext = trimContext(safeContext, 20000);
  const filteredChunks = filterRelevantChunks(relevant_chunks, userMessage, 12);
  const trimmedChunks = trimContext(filteredChunks, 20000);

  let prompt = userMessage.trim();
  if (trimmedChunks) prompt += `\n\nRelevant Context:\n${trimmedChunks}`;

  const totalTokens = estimateTokenCount(prompt + trimmedContext);
  console.log(`[askLLM] Total tokens estimated: ${totalTokens}`);

  return await retryWithBackoff(() =>
    callSinglePrompt(provider, prompt, trimmedContext)
  );
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
        console.log(`[SystemPrompt] 🎯 Gemini ${modelName} using systemInstruction from database`);
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
      } catch (err) {
        console.warn(`⚠️ Gemini model ${modelName} failed: ${err.message}`);
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

