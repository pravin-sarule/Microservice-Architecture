# Streaming Endpoints - Complete API Reference

## 🌐 Gateway Base URL Format

All endpoints use the following base URL structure:

```
{GATEWAY_BASE_URL}/api/{service}/{endpoint}
```

**Example Gateway URLs:**
- Production: `https://api.yourdomain.com`
- Development: `http://localhost:8080`
- Staging: `https://staging-api.yourdomain.com`

---

## 📄 Document Chat Endpoints

### 1️⃣ **Standard Chat (Non-Streaming)**
**Endpoint:** `POST {GATEWAY_BASE_URL}/api/doc/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "file_id": "uuid-string (optional for pre-upload chat)",
  "question": "Your question here",
  "llm_name": "gemini" | "claude-sonnet-4" | "gpt-4o" | "deepseek",
  "session_id": "uuid-string (optional)",
  "secret_id": "uuid-string (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "message_id": "uuid",
  "answer": "Full AI response",
  "response": "Full AI response",
  "history": [...],
  "used_chunk_ids": [...],
  "chunks_used": 10,
  "llm_provider": "gemini",
  "used_secret_prompt": false,
  "mode": "post_document" | "pre_document"
}
```

---

### 2️⃣ **Streaming Chat (SSE)**
**Endpoint:** `POST {GATEWAY_BASE_URL}/api/doc/chat/stream`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:**
```json
{
  "file_id": "uuid-string (optional for pre-upload chat)",
  "question": "Your question here",
  "llm_name": "gemini" | "claude-sonnet-4" | "gpt-4o" | "deepseek",
  "session_id": "uuid-string (optional)",
  "secret_id": "uuid-string (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)"
}
```

**SSE Response Format:**
```
data: {"type":"metadata","session_id":"uuid"}

data: {"type":"chunk","text":"This"}
data: {"type":"chunk","text":" is"}
data: {"type":"chunk","text":" the"}
data: [PING]
data: {"type":"chunk","text":" response"}
...
data: {"type":"done","session_id":"uuid","message_id":"uuid","answer":"Full response","llm_provider":"gemini"}
data: [DONE]
```

**Notes:**
- `[PING]` = Heartbeat (every 15 seconds) - ignore in UI
- `[DONE]` = Stream complete
- Supports **unlimited response length**
- Automatic reconnection on timeout

---

## 📁 Folder Chat Endpoints

### 3️⃣ **Standard Folder Query (Non-Streaming)**
**Endpoint:** `POST {GATEWAY_BASE_URL}/api/files/{folderName}/query`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "question": "Your question here",
  "llm_name": "gemini" | "claude-sonnet-4" | "gpt-4o" | "deepseek",
  "session_id": "uuid-string (optional)",
  "secret_id": "uuid-string (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)",
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "answer": "Full AI response",
  "response": "Full AI response",
  "llm_provider": "gemini",
  "used_secret_prompt": false,
  "used_chunk_ids": [...],
  "files_queried": ["file1.pdf", "file2.pdf"],
  "total_files": 5,
  "chunks_used": 25,
  "chat_history": [...]
}
```

---

### 4️⃣ **Streaming Folder Query (SSE)**
**Endpoint:** `POST {GATEWAY_BASE_URL}/api/files/{folderName}/query/stream`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:**
```json
{
  "question": "Your question here",
  "llm_name": "gemini" | "claude-sonnet-4" | "gpt-4o" | "deepseek",
  "session_id": "uuid-string (optional)",
  "secret_id": "uuid-string (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)",
  "maxResults": 10
}
```

**SSE Response Format:**
```
data: {"type":"metadata","session_id":"uuid"}

data: {"type":"chunk","text":"Based"}
data: {"type":"chunk","text":" on"}
data: {"type":"chunk","text":" the"}
data: [PING]
data: {"type":"chunk","text":" documents"}
...
data: {"type":"done","session_id":"uuid","answer":"Full response","llm_provider":"gemini"}
data: [DONE]
```

**Notes:**
- `[PING]` = Heartbeat (every 15 seconds) - ignore in UI
- `[DONE]` = Stream complete
- Supports **unlimited response length**
- Works with **all files in folder**

---

## 🔧 Complete Endpoint List

### Document Service Endpoints

| Method | Endpoint | Description | Streaming |
|--------|----------|-------------|-----------|
| `POST` | `/api/doc/chat` | Chat with document (standard) | ❌ |
| `POST` | `/api/doc/chat/stream` | Chat with document (SSE streaming) | ✅ |
| `POST` | `/api/doc/upload` | Upload document | ❌ |
| `POST` | `/api/doc/batch-upload` | Upload multiple documents | ❌ |
| `POST` | `/api/doc/analyze` | Analyze document | ❌ |
| `POST` | `/api/doc/summary` | Get document summary | ❌ |
| `GET` | `/api/doc/chat-history/:file_id` | Get chat history | ❌ |
| `GET` | `/api/doc/status/:file_id` | Get processing status | ❌ |

### Folder Service Endpoints

| Method | Endpoint | Description | Streaming |
|--------|----------|-------------|-----------|
| `POST` | `/api/files/{folderName}/query` | Query folder documents (standard) | ❌ |
| `POST` | `/api/files/{folderName}/query/stream` | Query folder documents (SSE streaming) | ✅ |
| `POST` | `/api/files/{folderName}/upload` | Upload files to folder | ❌ |
| `GET` | `/api/files/{folderName}/sessions` | Get chat sessions | ❌ |
| `GET` | `/api/files/{folderName}/sessions/:sessionId` | Get specific session | ❌ |
| `POST` | `/api/files/{folderName}/sessions/:sessionId/continue` | Continue session | ❌ |

---

## 🚀 Example Gateway URLs

### Production
```
https://api.yourdomain.com/api/doc/chat/stream
https://api.yourdomain.com/api/files/my-case/query/stream
```

### Development
```
http://localhost:8080/api/doc/chat/stream
http://localhost:8080/api/files/my-case/query/stream
```

### With Gateway/Proxy
```
https://gateway.yourdomain.com/document-service/api/doc/chat/stream
https://gateway.yourdomain.com/document-service/api/files/my-case/query/stream
```

---

## 📋 Quick Reference

### Streaming Endpoints (Use These for Unlimited Responses)

1. **Document Chat Streaming:**
   ```
   POST {GATEWAY_BASE_URL}/api/doc/chat/stream
   ```

2. **Folder Query Streaming:**
   ```
   POST {GATEWAY_BASE_URL}/api/files/{folderName}/query/stream
   ```

### Standard Endpoints (Use for Quick Responses)

1. **Document Chat:**
   ```
   POST {GATEWAY_BASE_URL}/api/doc/chat
   ```

2. **Folder Query:**
   ```
   POST {GATEWAY_BASE_URL}/api/files/{folderName}/query
   ```

---

## ✅ Features

### Streaming Endpoints Include:
- ✅ Heartbeat every 15 seconds (prevents timeout)
- ✅ Unlimited response length
- ✅ Real-time chunk delivery
- ✅ Automatic reconnection support
- ✅ Works with all LLM providers (Gemini, Claude, OpenAI, DeepSeek)
- ✅ Web search integration when needed

### Standard Endpoints Include:
- ✅ Complete response in single request
- ✅ Faster for short responses
- ✅ Same functionality as streaming
- ⚠️ Limited by request timeout for very long responses

---

## 🔑 Authentication

All endpoints require authentication:
```
Authorization: Bearer {your_jwt_token}
```

---

## 📝 Notes

1. **Gateway Base URL**: Replace `{GATEWAY_BASE_URL}` with your actual gateway URL
2. **Folder Name**: Replace `{folderName}` with actual folder name (e.g., `my-case`, `contracts-2024`)
3. **SSE Streaming**: Use streaming endpoints for responses longer than 5,000 characters
4. **Heartbeat**: Ignore `[PING]` messages in frontend - they're keep-alive signals
5. **Error Handling**: Stream endpoints send `{"type":"error","error":"message"}` on failure

---

## 🔗 Related Documentation

- See `FRONTEND_INSTRUCTIONS.md` for React implementation
- See route files for full parameter details

