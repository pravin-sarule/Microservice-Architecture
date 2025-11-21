# Complete API Endpoints with Gateway Base URL

## 🌐 Gateway Base URL Configuration

Replace `{GATEWAY_BASE_URL}` with your actual gateway URL:

**Examples:**
- **Production**: `https://api.yourdomain.com`
- **Development**: `http://localhost:8080`
- **Staging**: `https://staging-api.yourdomain.com`
- **With Proxy**: `https://gateway.yourdomain.com/document-service`

---

## 📄 Document Service Endpoints

### Standard Endpoints

#### 1. Chat with Document (Non-Streaming)
```
POST {GATEWAY_BASE_URL}/api/doc/chat
```

**Example:**
- Production: `POST https://api.yourdomain.com/api/doc/chat`
- Development: `POST http://localhost:8080/api/doc/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "file_id": "uuid (optional for pre-upload chat)",
  "question": "Your question here",
  "llm_name": "gemini" | "claude-sonnet-4" | "gpt-4o" | "deepseek",
  "session_id": "uuid (optional)",
  "secret_id": "uuid (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)"
}
```

---

#### 2. Chat with Document (SSE Streaming) ⭐ NEW
```
POST {GATEWAY_BASE_URL}/api/doc/chat/stream
```

**Example:**
- Production: `POST https://api.yourdomain.com/api/doc/chat/stream`
- Development: `POST http://localhost:8080/api/doc/chat/stream`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:** Same as `/api/doc/chat`

**SSE Response:**
```
data: {"type":"metadata","session_id":"uuid"}

data: {"type":"chunk","text":"This"}
data: {"type":"chunk","text":" is"}
data: {"type":"chunk","text":" streaming"}
data: [PING]
data: {"type":"chunk","text":" response"}
...
data: {"type":"done","session_id":"uuid","message_id":"uuid","answer":"Full response"}
data: [DONE]
```

**Features:**
- ✅ Heartbeat every 15 seconds (`[PING]`)
- ✅ Unlimited response length
- ✅ Real-time chunk delivery
- ✅ Works with all LLM providers

---

#### 3. Upload Document
```
POST {GATEWAY_BASE_URL}/api/doc/upload
```

#### 4. Batch Upload Documents
```
POST {GATEWAY_BASE_URL}/api/doc/batch-upload
```

#### 5. Analyze Document
```
POST {GATEWAY_BASE_URL}/api/doc/analyze
```

#### 6. Get Document Summary
```
POST {GATEWAY_BASE_URL}/api/doc/summary
```

#### 7. Get Chat History
```
GET {GATEWAY_BASE_URL}/api/doc/chat-history/{file_id}
```

#### 8. Get Processing Status
```
GET {GATEWAY_BASE_URL}/api/doc/status/{file_id}
```

---

## 📁 Folder Service Endpoints

### Standard Endpoints

#### 1. Query Folder Documents (Non-Streaming)
```
POST {GATEWAY_BASE_URL}/api/files/{folderName}/query
```

**Example:**
- Production: `POST https://api.yourdomain.com/api/files/my-case/query`
- Development: `POST http://localhost:8080/api/files/my-case/query`

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
  "session_id": "uuid (optional)",
  "secret_id": "uuid (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)",
  "maxResults": 10
}
```

---

#### 2. Query Folder Documents (SSE Streaming) ⭐ NEW
```
POST {GATEWAY_BASE_URL}/api/files/{folderName}/query/stream
```

**Example:**
- Production: `POST https://api.yourdomain.com/api/files/my-case/query/stream`
- Development: `POST http://localhost:8080/api/files/my-case/query/stream`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:** Same as `/api/files/{folderName}/query`

**SSE Response:**
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

**Features:**
- ✅ Heartbeat every 15 seconds (`[PING]`)
- ✅ Unlimited response length
- ✅ Handles multiple files in folder
- ✅ Works with all LLM providers

---

#### 3. Upload Files to Folder
```
POST {GATEWAY_BASE_URL}/api/files/{folderName}/upload
```

#### 4. Get Folder Summary
```
GET {GATEWAY_BASE_URL}/api/files/{folderName}/summary
```

#### 5. Get Folder Chat Sessions
```
GET {GATEWAY_BASE_URL}/api/files/{folderName}/sessions
```

#### 6. Get Specific Chat Session
```
GET {GATEWAY_BASE_URL}/api/files/{folderName}/sessions/{sessionId}
```

#### 7. Continue Chat Session
```
POST {GATEWAY_BASE_URL}/api/files/{folderName}/sessions/{sessionId}/continue
```

#### 8. Get Folder Processing Status
```
GET {GATEWAY_BASE_URL}/api/files/{folderName}/status
```

---

## 🔑 Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer {your_jwt_token}
```

---

## 📊 Complete Endpoint Summary Table

### Document Service

| Method | Endpoint | Streaming | Description |
|--------|----------|-----------|-------------|
| `POST` | `/api/doc/chat` | ❌ | Standard chat |
| `POST` | `/api/doc/chat/stream` | ✅ | **Streaming chat** |
| `POST` | `/api/doc/upload` | ❌ | Upload document |
| `POST` | `/api/doc/batch-upload` | ❌ | Batch upload |
| `POST` | `/api/doc/analyze` | ❌ | Analyze document |
| `POST` | `/api/doc/summary` | ❌ | Get summary |
| `GET` | `/api/doc/chat-history/:file_id` | ❌ | Get chat history |
| `GET` | `/api/doc/status/:file_id` | ❌ | Get status |

### Folder Service

| Method | Endpoint | Streaming | Description |
|--------|----------|-----------|-------------|
| `POST` | `/api/files/{folderName}/query` | ❌ | Standard query |
| `POST` | `/api/files/{folderName}/query/stream` | ✅ | **Streaming query** |
| `POST` | `/api/files/{folderName}/upload` | ❌ | Upload files |
| `GET` | `/api/files/{folderName}/sessions` | ❌ | Get sessions |
| `GET` | `/api/files/{folderName}/sessions/:sessionId` | ❌ | Get session |
| `POST` | `/api/files/{folderName}/sessions/:sessionId/continue` | ❌ | Continue session |
| `GET` | `/api/files/{folderName}/status` | ❌ | Get status |

---

## 🚀 Quick Start Examples

### Frontend Usage (React)

```javascript
// Set your gateway base URL
const GATEWAY_BASE_URL = process.env.REACT_APP_GATEWAY_URL || 'http://localhost:8080';

// Document Chat Streaming
const documentChatEndpoint = `${GATEWAY_BASE_URL}/api/doc/chat/stream`;

// Folder Query Streaming
const folderQueryEndpoint = `${GATEWAY_BASE_URL}/api/files/${folderName}/query/stream`;
```

### cURL Examples

```bash
# Document Chat Streaming
curl -X POST https://api.yourdomain.com/api/doc/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "file_id": "uuid",
    "question": "Summarize this document",
    "llm_name": "gemini"
  }' \
  --no-buffer

# Folder Query Streaming
curl -X POST https://api.yourdomain.com/api/files/my-case/query/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "question": "Summarize all documents",
    "llm_name": "claude-sonnet-4"
  }' \
  --no-buffer
```

---

## ✅ Features Summary

### Streaming Endpoints (`/stream`)
- ✅ Heartbeat every 15 seconds
- ✅ Unlimited response length
- ✅ Real-time chunk delivery
- ✅ Automatic timeout prevention
- ✅ Works with all LLM providers

### Standard Endpoints
- ✅ Complete response in one request
- ✅ Faster for short responses
- ✅ Same functionality
- ⚠️ Limited by timeout for very long responses

---

## 📝 Notes

1. **Replace `{GATEWAY_BASE_URL}`** with your actual gateway URL
2. **Replace `{folderName}`** with actual folder name (e.g., `my-case`)
3. **Replace `{token}`** with your JWT authentication token
4. **Replace `{file_id}`**, `{sessionId}`, etc. with actual UUIDs

---

## 🔗 Related Documentation

- **Frontend Implementation**: See `FRONTEND_INSTRUCTIONS.md`
- **Streaming Details**: See `STREAMING_ENDPOINTS.md`
- **Route Definitions**: See `routes/documentRoutes.js` and `routes/fileRoutes.js`

