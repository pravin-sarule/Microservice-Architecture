# Web Search API Testing Guide

This guide explains how to test the web search functionality integrated with your AI services using Postman.

## 📋 Prerequisites

1. **Postman** installed on your machine
2. **JWT Authentication Token** - Get this from your auth service
3. **File ID** - A valid file_id from an uploaded document (optional for some tests)
4. **Server Running** - Your document service should be running on the configured port

## 🚀 Quick Start

### Step 1: Import Postman Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file: `postman_web_search_tests.json`
4. The collection will be imported with all test requests

### Step 2: Configure Environment Variables

1. In Postman, click on **Environments** (left sidebar)
2. Create a new environment or use the default
3. Set these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `BASE_URL` | `http://localhost:8080` | Your document service URL |
| `AUTH_TOKEN` | `your_jwt_token_here` | JWT token from auth service |
| `FILE_ID` | `your_file_uuid_here` | Optional: UUID of an uploaded document |

### Step 3: Run Tests

Select any request from the collection and click **Send**. The requests are organized to test different web search scenarios.

## 📝 Test Cases

### 1. **Current Events Test**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "What are the latest developments in AI technology in 2025?"
- **Expected**: Web search triggered (keywords: "latest", "2025")
- **Response**: Should include citations at the end

### 2. **Who/What Questions Test**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "Who is the current CEO of OpenAI?"
- **Expected**: Web search triggered (question pattern: "who is")
- **Response**: Should include current information with citations

### 3. **Recent News Test**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "What happened in the tech industry today?"
- **Expected**: Web search triggered (keywords: "today", "what happened")
- **Response**: Should include recent news with citations

### 4. **How To Questions Test**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "How to implement web search in a Node.js application?"
- **Expected**: Web search triggered (question pattern: "how to")
- **Response**: Should include instructional content with citations

### 5. **Current Information Test**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "What is the current status of climate change policies in 2025?"
- **Expected**: Web search triggered (keywords: "current", "2025")
- **Response**: Should include up-to-date information with citations

### 6. **Document Only Test (No Web Search)**
- **Endpoint**: `POST /api/doc/chat`
- **Query**: "Summarize the main points in this document"
- **Expected**: Web search NOT triggered
- **Response**: Should only use document context, no citations

### 7. **Folder Chat with Web Search**
- **Endpoint**: `POST /api/doc/secret/ask-llm-for-folder`
- **Query**: "What are the latest legal precedents in contract law?"
- **Expected**: Web search triggered for folder AI service
- **Response**: Should include citations

## 🔍 How to Verify Web Search is Working

### Check Server Logs

When web search is triggered, you should see these log messages:

```
[Web Search] 🔍 Auto-triggering web search for query: ...
[Web Search] ✅ Found X search results with citations
[askLLM] Total tokens estimated: ... (with web search)
```

### Check Response Format

A successful web search response should include:

1. **AI-generated answer** based on web search results
2. **Citations section** at the end formatted as:
   ```
   ---
   **Sources:**
   1. [Title](URL)
   2. [Title](URL)
   ```

## 📊 Request Body Format

### Standard Chat Request

```json
{
  "question": "Your question here",
  "file_id": "optional-file-uuid",
  "llm_name": "gpt-4o",
  "session_id": "optional-session-uuid",
  "additional_input": "optional additional instructions"
}
```

### Available LLM Models

- `gpt-4o` - OpenAI GPT-4o
- `openai` - OpenAI GPT-4o-mini
- `claude-sonnet-4` - Claude Sonnet 4
- `claude-opus-4-1` - Claude Opus 4.1
- `claude-haiku-4-5` - Claude Haiku 4.5
- `anthropic` - Claude 3.5 Haiku
- `gemini` - Google Gemini 2.5 Flash
- `gemini-pro-2.5` - Google Gemini 2.5 Pro
- `deepseek` - DeepSeek Chat

## 🎯 Web Search Auto-Trigger Keywords

Web search automatically triggers when queries contain:

- **Time-based**: `current`, `latest`, `recent`, `today`, `now`, `2024`, `2025`
- **Question patterns**: `what is`, `who is`, `when did`, `where is`, `how to`
- **News-related**: `latest news`, `current events`, `recent updates`, `what happened`, `news about`
- **Search requests**: `search for`, `find information about`, `look up`

## 🔧 Troubleshooting

### Web Search Not Triggering?

1. **Check API Key**: Verify `SERPER_API_KEY` is set in `.env` file
2. **Check Logs**: Look for `[Web Search]` messages in server logs
3. **Query Format**: Ensure your query contains trigger keywords
4. **Context Check**: If document context is very large (>100 chars), web search might not trigger

### No Citations in Response?

1. **Check Serper API**: Verify API key is valid and has quota
2. **Check Logs**: Look for `[Web Search] ✅ Found X search results`
3. **Response Format**: Citations are appended at the end of the response

### Authentication Errors?

1. **Token Expired**: Get a new JWT token from auth service
2. **Token Format**: Ensure token is in format: `Bearer <token>`
3. **User Permissions**: Verify user has access to the document/file

## 📞 Example cURL Commands

### Test Web Search with cURL

```bash
curl -X POST http://localhost:8080/api/doc/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the latest developments in AI technology in 2025?",
    "file_id": "your-file-uuid",
    "llm_name": "gpt-4o"
  }'
```

### Test Folder Chat with Web Search

```bash
curl -X POST http://localhost:8080/api/doc/secret/ask-llm-for-folder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "folderName": "legal-documents",
    "question": "What are the latest legal precedents in contract law?",
    "llm_name": "claude-sonnet-4"
  }'
```

## ✅ Success Indicators

- ✅ Server logs show `[Web Search] 🔍 Auto-triggering web search`
- ✅ Response includes `---\n**Sources:**` section
- ✅ Citations are clickable links
- ✅ Response contains current/up-to-date information
- ✅ No errors in server logs related to Serper API

## 🎉 You're All Set!

Import the Postman collection and start testing your web search integration. All LLM models now have access to real-time web search capabilities!



