

require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
const SystemPrompt = require('../models/SystemPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Format search results for LLM context
    const formattedResults = results
      .map((result, index) => {
        return `[${index + 1}] ${result.title || 'No title'}\nURL: ${result.link || 'No URL'}\n${result.snippet || 'No snippet'}`;
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
    console.log('[Web Search] Personal data/profile question detected - skipping web search (like Claude/ChatGPT) (FolderAI)');
    return false;
  }
  
  // Check if there's substantial document context provided
  const hasDocumentContext = (contextLower.length > 500) || (chunksLower.length > 500);
  
  // Keywords that explicitly request web search
  const explicitWebSearchTriggers = [
    'search for',
    'find information about',
    'look up',
    'search the web',
    'google',
    'web search',
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
  ];
  
  // Check for explicit web search requests
  const hasExplicitTrigger = explicitWebSearchTriggers.some(trigger => message.includes(trigger));
  if (hasExplicitTrigger) {
    console.log('[Web Search] Explicit web search request detected (FolderAI)');
    return true;
  }
  
  // Check for current/real-time information requests
  const hasCurrentInfoTrigger = currentInfoTriggers.some(trigger => message.includes(trigger));
  if (hasCurrentInfoTrigger) {
    console.log('[Web Search] Current/real-time information request detected (FolderAI)');
    return true;
  }
  
  // Check for time-based triggers combined with information requests
  const hasTimeTrigger = timeBasedTriggers.some(trigger => message.includes(trigger));
  const isInfoRequest = message.includes('what') || message.includes('who') || message.includes('when') || 
                       message.includes('where') || message.includes('how') || message.includes('why');
  
  if (hasTimeTrigger && isInfoRequest && !hasDocumentContext) {
    console.log('[Web Search] Time-based information request without document context (FolderAI)');
    return true;
  }
  
  // Check for general knowledge questions that are clearly NOT about documents
  const generalKnowledgePatterns = [
    /^what is (.+)\?/i,
    /^who is (.+)\?/i,
    /^when did (.+) happen\?/i,
    /^where is (.+)\?/i,
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
    console.log('[Web Search] Question is about documents and context is available - skipping web search (FolderAI)');
    return false;
  }
  
  // If it's a general knowledge question and NO document context, trigger web search
  if (isGeneralKnowledgeQuestion && !hasDocumentContext) {
    console.log('[Web Search] General knowledge question without document context (FolderAI)');
    return true;
  }
  
  // If there's substantial document context, be conservative - only search if explicitly needed
  if (hasDocumentContext) {
    // Only trigger if explicitly asking for current/recent info or web search
    const needsCurrentInfo = hasCurrentInfoTrigger || hasTimeTrigger;
    if (needsCurrentInfo) {
      console.log('[Web Search] Current information needed despite document context (FolderAI)');
      return true;
    }
    // Otherwise, assume answer is in documents
    console.log('[Web Search] Document context available - assuming answer is in documents (FolderAI)');
    return false;
  }
  
  // For pre-upload chats (no document context), only trigger for specific patterns
  if (!hasDocumentContext) {
    // Trigger for questions that clearly need web search
    if (isGeneralKnowledgeQuestion || hasTimeTrigger || hasCurrentInfoTrigger) {
      console.log('[Web Search] No document context - triggering for general knowledge/time-based question (FolderAI)');
      return true;
    }
  }
  
  // Default: don't trigger web search
  return false;
}

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
    throw new Error('Folder LLM configuration missing model name when resolving max tokens.');
  }

  const cacheKey = `${provider.toLowerCase()}::${modelName.toLowerCase()}`;
  if (llmTokenCache.has(cacheKey)) return llmTokenCache.get(cacheKey);

  const providerCandidates = [provider];
  const normalized = normalizeProviderForDb(provider);
  if (normalized && normalized !== provider) providerCandidates.push(normalized);
  providerCandidates.push(null); // fallback: model-only

  for (const candidate of providerCandidates) {
    let value = null;
    try {
      value =
        candidate === null
          ? await queryMaxTokensByModel(modelName)
          : await queryMaxTokensByProvider(candidate, modelName);
    } catch (err) {
      console.error(
        `[FolderLLM Max Tokens] Error querying max tokens for provider="${candidate}" model="${modelName}": ${err.message}`
      );
      continue;
    }

    if (value != null) {
      llmTokenCache.set(cacheKey, value);
      console.log(
        `[FolderLLM Max Tokens] Using max_output_tokens=${value} for provider="${candidate || 'model-only'}" model="${modelName}"`
      );
      return value;
    }
  }

  throw new Error(
    `Max token configuration not found for provider="${provider}", model="${modelName}". Please insert a row into llm_max_tokens.`
  );
}

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
async function askLLM(providerName, userMessage, context = '', relevant_chunks = null, originalQuestion = null) {
  const provider = resolveProviderName(providerName);
  const config = ALL_LLM_CONFIGS[provider];
  if (!config) throw new Error(`❌ Unsupported LLM provider: ${provider}`);

  // Ensure context is always a string
  const safeContext = typeof context === 'string' ? context : '';

  // Extract original user question for web search (before context is added)
  let userQuestionForSearch = originalQuestion || userMessage;
  
  // Try to extract the actual question if userMessage contains context markers
  if (!originalQuestion && userMessage) {
    const userQuestionMatch = userMessage.match(/USER QUESTION:\s*(.+?)(?:\n\n===|$)/s);
    if (userQuestionMatch) {
      userQuestionForSearch = userQuestionMatch[1].trim();
    } else {
      // Extract first meaningful line before context sections
      const lines = userMessage.split('\n');
      const contextMarkers = ['===', '---', 'Relevant Context', 'DOCUMENT', 'PROFILE'];
      for (let i = 0; i < lines.length; i++) {
        if (contextMarkers.some(marker => lines[i].includes(marker))) {
          userQuestionForSearch = lines.slice(0, i).join(' ').trim();
          break;
        }
      }
      // Fallback to first 200 chars
      if (!userQuestionForSearch || userQuestionForSearch.length > 500) {
        userQuestionForSearch = userMessage.substring(0, 200).trim();
      }
    }
  }

  // ✅ OPTIMIZATION 1: Trim context aggressively (200 tokens max)
  const trimmedContext = trimContext(safeContext, 200);
  
  // ✅ OPTIMIZATION 2: Filter only top 1 most relevant chunks
  const filteredChunks = filterRelevantChunks(relevant_chunks, userQuestionForSearch, 5);
  
  // ✅ OPTIMIZATION 3: Trim filtered chunks to reduce token count further
  const trimmedFilteredChunks = trimContext(filteredChunks, 700); // Limit chunk content to 700 tokens

  // Check if web search is needed - ONLY use the original user question, not the full prompt
  // Pass document context and chunks to determine if web search is actually needed
  let webSearchData = null;
  let citations = [];
  
  // Check if web search is needed based on question and available document context
  if (shouldTriggerWebSearch(userQuestionForSearch, trimmedContext, trimmedFilteredChunks)) {
    console.log('[Web Search] 🔍 Auto-triggering web search for user question (FolderAI):', userQuestionForSearch.substring(0, 100));
    webSearchData = await performWebSearch(userQuestionForSearch, 5);
    
    if (webSearchData && webSearchData.results) {
      citations = webSearchData.citations;
      console.log(`[Web Search] ✅ Found ${citations.length} search results with citations (FolderAI)`);
    } else {
      console.log('[Web Search] ⚠️ No search results found (FolderAI)');
    }
  }
  
  // ✅ OPTIMIZATION 4: Build minimal prompt
  let prompt = userMessage.trim();
  if (trimmedFilteredChunks) {
    prompt += `\n\nRelevant Context:\n${trimmedFilteredChunks}`;
  }
  
  // Add web search results to prompt if available
  if (webSearchData && webSearchData.results) {
    prompt += `\n\n[Web Search Results - Use this information to provide accurate, up-to-date answers. Include citations when referencing these sources:]\n${webSearchData.results}`;
  }

  const totalTokens = estimateTokenCount(prompt + trimmedContext);
  console.log(`[askLLM] Optimized Tokens: ${totalTokens} (context: ${estimateTokenCount(trimmedContext)}, chunks: ${estimateTokenCount(trimmedFilteredChunks || '')})${webSearchData ? ' (with web search)' : ''}`);

  // ✅ OPTIMIZATION 4: Single request only (no chunking - saves massive tokens)
  const response = await retryWithBackoff(() => callSinglePrompt(provider, prompt, trimmedContext));

  // Append citations to response if web search was performed
  if (citations.length > 0) {
    const citationsText = '\n\n---\n**Sources:**\n' + citations.map(c => `${c.index}. [${c.title}](${c.link})`).join('\n');
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
      console.log('[SystemPrompt] 🔄 Using database system prompt + context for system instruction (FolderAI)');
      return `${dbSystemPrompt}\n\n${context}`;
    }
    
    // Use database system prompt if available
    if (dbSystemPrompt) {
      console.log('[SystemPrompt] ✅ Using system prompt from database for system instruction (FolderAI)');
      return dbSystemPrompt;
    }
    
    // Fallback to context or default
    console.log('[SystemPrompt] ⚠️ No database prompt found, using fallback system instruction (FolderAI)');
    return context || 'You are a helpful assistant.';
  } catch (err) {
    console.error('[SystemPrompt] ❌ Error getting system prompt, using fallback (FolderAI):', err.message);
    return context || 'You are a helpful assistant.';
  }
}

// ---------------------------
// Core LLM Call Logic
// ---------------------------
async function callSinglePrompt(provider, prompt, context = '') {
  const config = ALL_LLM_CONFIGS[provider];
  const isClaude = provider.startsWith('claude') || provider === 'anthropic';
  const isGemini = provider.startsWith('gemini');

  // Get system prompt from database
  const systemPrompt = await getSystemPrompt(context);
  console.log(`[SystemPrompt] 📝 Applying system instruction for ${provider} (FolderAI) (length: ${systemPrompt.length} chars)`);

  // ---- Gemini ----
  if (isGemini) {
    const models = GEMINI_MODELS[provider] || GEMINI_MODELS['gemini'];
    for (const modelName of models) {
      try {
        const maxOutputTokens = await getModelMaxTokens(provider, modelName);
        console.log(`[FolderLLM Max Tokens] Gemini model ${modelName} using maxOutputTokens=${maxOutputTokens}`);
        console.log(`[SystemPrompt] 🎯 Gemini ${modelName} using systemInstruction from database (FolderAI)`);
        const model = genAI.getGenerativeModel(
          systemPrompt ? { model: modelName, systemInstruction: systemPrompt } : { model: modelName }
        );
        const result = await model.generateContent(prompt, {
          generationConfig: {
            maxOutputTokens,
          },
        });
        const geminiResponse = await result.response.text();
        const inputTokens = result.response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
        console.log(`✅ Gemini (${modelName}) - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens} | max=${maxOutputTokens}`);
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

  const resolvedModel = config.model;
  const maxTokens = await getModelMaxTokens(provider, resolvedModel);

  if (isClaude) {
    console.log(`[SystemPrompt] 🎯 Claude ${resolvedModel} using system field from database (FolderAI)`);
  } else {
    console.log(`[SystemPrompt] 🎯 ${provider} ${resolvedModel} using system role in messages from database (FolderAI)`);
  }

  const payload = isClaude
    ? {
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }
    : {
        model: config.model,
        messages,
        max_tokens: maxTokens, // admin-defined or fallback
        temperature: 0.5,
      };
  console.log(`[FolderLLM Max Tokens] ${provider} model ${resolvedModel} using max_tokens=${maxTokens}`);

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