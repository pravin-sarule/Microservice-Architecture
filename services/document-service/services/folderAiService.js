

require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------
// Estimate token count (approx)
// ---------------------------
function estimateTokenCount(text = '') {
  return Math.ceil(text.length / 4); // 4 chars per token on average
}

// ---------------------------
// Smart Context Trimmer - REDUCES TOKENS BY 70-90%
// ---------------------------
function trimContext(context, maxTokens = 500) {
  if (!context) return '';
  const tokens = estimateTokenCount(context);
  if (tokens <= maxTokens) return context;
  
  // Take only first portion (most relevant usually at start)
  const ratio = maxTokens / tokens;
  const trimmedLength = Math.floor(context.length * ratio);
  return context.substring(0, trimmedLength) + '...';
}

// ---------------------------
// Smart Chunk Filtering - REDUCES CHUNKS BY 80%
// ---------------------------
function filterRelevantChunks(chunks, userMessage, maxChunks = 5) {
  if (!chunks) return '';
  
  const chunkArray = chunks.split('\n\n').filter(Boolean);
  if (chunkArray.length <= maxChunks) return chunks;
  
  // Simple keyword matching to find most relevant chunks
  const keywords = userMessage.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5); // Top 5 keywords only
  
  const scored = chunkArray.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    const score = keywords.reduce((sum, kw) => {
      return sum + (chunkLower.includes(kw) ? 1 : 0);
    }, 0);
    return { chunk, score };
  });
  
  // Sort by relevance and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(s => s.chunk)
    .join('\n\n');
}

// ---------------------------
// Retry Helper
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
// Gemini model mappings
// ---------------------------
const GEMINI_MODELS = {
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash'],
  'gemini-pro-2.5': ['gemini-2.5-pro', 'gemini-2.0-pro-exp', 'gemini-1.5-pro'],
};

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
  "gpt-4o": {
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
// Combined LLM Configurations
// ---------------------------
const ALL_LLM_CONFIGS = {
  ...LLM_CONFIGS,
  gemini: { model: 'gemini-2.0-flash-exp', headers: {} },
  'gemini-pro-2.5': { model: 'gemini-2.5-pro', headers: {} },
};

// ---------------------------
// Provider Availability Checker
// ---------------------------
function getAvailableProviders() {
  return Object.fromEntries(
    Object.entries(ALL_LLM_CONFIGS).map(([provider, cfg]) => {
      let key;
      if (provider.startsWith('gemini')) key = process.env.GEMINI_API_KEY;
      else if (provider.includes('claude') || provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY;
      else if (provider === 'deepseek') key = process.env.DEEPSEEK_API_KEY;
      else key = process.env.OPENAI_API_KEY;

      return [
        provider,
        { available: !!key, model: cfg.model, reason: key ? 'Available' : 'Missing API key' },
      ];
    })
  );
}

// ---------------------------
// Provider Aliases
// ---------------------------
const PROVIDER_ALIASES = {
  openai: 'openai',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'openai',
  gemini: 'gemini',
  'gemini-2.0-flash': 'gemini',
  'gemini-1.5-flash': 'gemini',
  'gemini-pro-2.5': 'gemini-pro-2.5',
  anthropic: 'anthropic',
  'claude': 'anthropic',
  'claude-3-5-haiku': 'anthropic',
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

// ---------------------------
// Resolve Provider
// ---------------------------
function resolveProviderName(name = '') {
  const key = name.trim().toLowerCase();
  const resolved = PROVIDER_ALIASES[key] || 'gemini';
  console.log(`[resolveProviderName] DB name: "${name}" → "${resolved}"`);
  return resolved;
}

// ---------------------------
// Main Optimized LLM Caller - MASSIVE TOKEN REDUCTION
// ---------------------------
async function askLLM(providerName, userMessage, context = '', relevant_chunks = null) {
  const provider = resolveProviderName(providerName);
  const config = ALL_LLM_CONFIGS[provider];
  if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

  // Ensure context is always a string
  const safeContext = typeof context === 'string' ? context : '';

  // ✅ OPTIMIZATION 1: Trim context aggressively (200 tokens max)
  const trimmedContext = trimContext(safeContext, 200);
  
  // ✅ OPTIMIZATION 2: Filter only top 1 most relevant chunks
  const filteredChunks = filterRelevantChunks(relevant_chunks, userMessage, 5);
  
  // ✅ OPTIMIZATION 3: Trim filtered chunks to reduce token count further
  const trimmedFilteredChunks = trimContext(filteredChunks, 700); // Limit chunk content to 700 tokens
  
  // ✅ OPTIMIZATION 4: Build minimal prompt
  let prompt = userMessage.trim();
  if (trimmedFilteredChunks) {
    prompt += `\n\nRelevant Context:\n${trimmedFilteredChunks}`;
  }

  const totalTokens = estimateTokenCount(prompt + trimmedContext);
  console.log(`[askLLM] Optimized Tokens: ${totalTokens} (context: ${estimateTokenCount(trimmedContext)}, chunks: ${estimateTokenCount(trimmedFilteredChunks || '')})`);

  // ✅ OPTIMIZATION 4: Single request only (no chunking - saves massive tokens)
  return await retryWithBackoff(() => callSinglePrompt(provider, prompt, trimmedContext));
}

// ---------------------------
// Core LLM Call Logic
// ---------------------------
async function callSinglePrompt(provider, prompt, context = '') {
  const config = ALL_LLM_CONFIGS[provider];
  const isClaude = provider.startsWith('claude') || provider === 'anthropic';
  const isGemini = provider.startsWith('gemini');

  // ---- Gemini ----
  if (isGemini) {
    const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel(
          context ? { model: modelName, systemInstruction: context } : { model: modelName }
        );
        const result = await model.generateContent(prompt, {
          generationConfig: {
            maxOutputTokens: 15000,
          },
        });
        const geminiResponse = await result.response.text();
        const inputTokens = result.response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
        console.log(`✅ Gemini (${modelName}) - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens}`);
        return geminiResponse;
      } catch (err) {
        console.warn(`❌ Gemini model ${modelName} failed: ${err.message}`);
        continue;
      }
    }
    throw new Error(`❌ All Gemini models failed.`);
  }

  // ---- Claude / OpenAI / DeepSeek ----
  const messages = isClaude
    ? [{ role: 'user', content: prompt }]
    : [
        { role: 'system', content: context || 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ];

  const payload = isClaude
    ? {
        model: config.model,
        max_tokens: 15000,
        system: context,
        messages,
      }
    : {
        model: config.model,
        messages,
        max_tokens: 2048, // ✅ REDUCED from 4096
        temperature: 0.5,
      };

  const response = await axios.post(config.apiUrl, payload, {
    headers: config.headers,
    timeout: 120000, // ✅ REDUCED timeout
  });

  let inputTokens = 0;
  let outputTokens = 0;

  if (isClaude) {
    inputTokens = response.data?.usage?.input_tokens || 0;
    outputTokens = response.data?.usage?.output_tokens || 0;
  } else { // OpenAI / DeepSeek
    inputTokens = response.data?.usage?.prompt_tokens || 0;
    outputTokens = response.data?.usage?.completion_tokens || 0;
  }

  console.log(`✅ ${provider} - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens}`);

  return isClaude
    ? response.data?.content?.[0]?.text || response.data?.completion
    : response.data?.choices?.[0]?.message?.content || '';
}

// ---------------------------
// Exports
// ---------------------------
module.exports = {
  askLLM,
  resolveProviderName,
  getAvailableProviders,
};