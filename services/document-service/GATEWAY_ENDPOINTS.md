# Complete Gateway Endpoints

## 🌐 Gateway Base URL
```
http://localhost:5000
```

## 📋 Proxy Configuration
- **Gateway URL**: `http://localhost:5000`
- **File Service URL**: `http://localhost:5002` (or `process.env.FILE_SERVICE_URL`)
- **Document Service**: `/files/*` → `/api/doc/*`
- **Folder Service**: `/docs/*` → `/api/files/*`

---

## 📄 Document Service Endpoints

### Standard Endpoints

#### 1. Chat with Document (Non-Streaming)
```
POST http://localhost:5000/files/chat
```

#### 2. Chat with Document (SSE Streaming) ⭐
```
POST http://localhost:5000/files/chat/stream
```

#### 3. Upload Document
```
POST http://localhost:5000/files/upload
```

#### 4. Batch Upload Documents
```
POST http://localhost:5000/files/batch-upload
```

#### 5. Analyze Document
```
POST http://localhost:5000/files/analyze
```

#### 6. Get Document Summary
```
POST http://localhost:5000/files/summary
```

#### 7. Get Chat History
```
GET http://localhost:5000/files/chat-history/{file_id}
```

#### 8. Get Processing Status
```
GET http://localhost:5000/files/status/{file_id}
```

#### 9. Generate Upload URL
```
POST http://localhost:5000/files/generate-upload-url
```

#### 10. Complete Upload
```
POST http://localhost:5000/files/complete-upload
```

---

## 📁 Folder Service Endpoints

### Standard Endpoints

#### 1. Query Folder Documents (Non-Streaming)
```
POST http://localhost:5000/docs/{folderName}/query
```

**Example:**
```
POST http://localhost:5000/docs/my-case/query
```

#### 2. Query Folder Documents (SSE Streaming) ⭐
```
POST http://localhost:5000/docs/{folderName}/query/stream
```

**Example:**
```
POST http://localhost:5000/docs/my-case/query/stream
```

#### 3. Upload Files to Folder
```
POST http://localhost:5000/docs/{folderName}/upload
```

#### 4. Get Folder Summary
```
GET http://localhost:5000/docs/{folderName}/summary
```

#### 5. Get Folder Chat Sessions
```
GET http://localhost:5000/docs/{folderName}/sessions
```

#### 6. Get Specific Chat Session
```
GET http://localhost:5000/docs/{folderName}/sessions/{sessionId}
```

#### 7. Continue Chat Session
```
POST http://localhost:5000/docs/{folderName}/sessions/{sessionId}/continue
```

#### 8. Get Folder Processing Status
```
GET http://localhost:5000/docs/{folderName}/status
```

#### 9. Get Documents in Folder
```
GET http://localhost:5000/docs/{folderName}/documents
```

#### 10. Get Case Files by Folder Name
```
GET http://localhost:5000/docs/{folderName}/files
```

#### 11. Generate Upload URL (Folder)
```
POST http://localhost:5000/docs/{folderName}/generate-upload-url
```

#### 12. Complete Upload (Folder)
```
POST http://localhost:5000/docs/{folderName}/complete-upload
```

---

## 🔑 Authentication

All endpoints require JWT authentication via the gateway:

```
Authorization: Bearer {your_jwt_token}
```

The gateway's `authMiddleware` will:
1. Verify JWT token
2. Attach `req.user` with user information
3. Inject `x-user-id` header to the proxied service

---

## 📊 Complete Endpoint Mapping

### Document Service Routes

| Gateway Endpoint | Proxies To | Method | Streaming |
|-----------------|------------|--------|-----------|
| `/files/chat` | `/api/doc/chat` | POST | ❌ |
| `/files/chat/stream` | `/api/doc/chat/stream` | POST | ✅ |
| `/files/upload` | `/api/doc/upload` | POST | ❌ |
| `/files/batch-upload` | `/api/doc/batch-upload` | POST | ❌ |
| `/files/analyze` | `/api/doc/analyze` | POST | ❌ |
| `/files/summary` | `/api/doc/summary` | POST | ❌ |
| `/files/chat-history/{file_id}` | `/api/doc/chat-history/{file_id}` | GET | ❌ |
| `/files/status/{file_id}` | `/api/doc/status/{file_id}` | GET | ❌ |
| `/files/generate-upload-url` | `/api/doc/generate-upload-url` | POST | ❌ |
| `/files/complete-upload` | `/api/doc/complete-upload` | POST | ❌ |

### Folder Service Routes

| Gateway Endpoint | Proxies To | Method | Streaming |
|-----------------|------------|--------|-----------|
| `/docs/{folderName}/query` | `/api/files/{folderName}/query` | POST | ❌ |
| `/docs/{folderName}/query/stream` | `/api/files/{folderName}/query/stream` | POST | ✅ |
| `/docs/{folderName}/upload` | `/api/files/{folderName}/upload` | POST | ❌ |
| `/docs/{folderName}/summary` | `/api/files/{folderName}/summary` | GET | ❌ |
| `/docs/{folderName}/sessions` | `/api/files/{folderName}/sessions` | GET | ❌ |
| `/docs/{folderName}/sessions/{sessionId}` | `/api/files/{folderName}/sessions/{sessionId}` | GET | ❌ |
| `/docs/{folderName}/sessions/{sessionId}/continue` | `/api/files/{folderName}/sessions/{sessionId}/continue` | POST | ❌ |
| `/docs/{folderName}/status` | `/api/files/{folderName}/status` | GET | ❌ |
| `/docs/{folderName}/documents` | `/api/files/{folderName}/documents` | GET | ❌ |
| `/docs/{folderName}/files` | `/api/files/{folderName}/files` | GET | ❌ |

---

## 🚀 Streaming Endpoints (Unlimited Responses)

### Document Chat Streaming
```bash
POST http://localhost:5000/files/chat/stream
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:**
```json
{
  "file_id": "uuid (optional)",
  "question": "Your question",
  "llm_name": "gemini",
  "session_id": "uuid (optional)",
  "secret_id": "uuid (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)"
}
```

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

---

### Folder Query Streaming
```bash
POST http://localhost:5000/docs/{folderName}/query/stream
```

**Example:**
```bash
POST http://localhost:5000/docs/my-case/query/stream
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Request Body:**
```json
{
  "question": "Your question",
  "llm_name": "claude-sonnet-4",
  "session_id": "uuid (optional)",
  "secret_id": "uuid (optional)",
  "prompt_label": "string (optional)",
  "additional_input": "string (optional)",
  "maxResults": 10
}
```

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

---

## 💻 Frontend Usage Examples

### React Example - Document Chat Streaming
```javascript
const GATEWAY_BASE_URL = 'http://localhost:5000';

// Document Chat Streaming
const endpoint = `${GATEWAY_BASE_URL}/files/chat/stream`;

fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({
    file_id: 'uuid',
    question: 'Summarize this document',
    llm_name: 'gemini'
  })
})
.then(response => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) return;
      
      const chunk = decoder.decode(value);
      // Process SSE chunks
      console.log(chunk);
      
      readStream();
    });
  };
  
  readStream();
});
```

### React Example - Folder Query Streaming
```javascript
const GATEWAY_BASE_URL = 'http://localhost:5000';
const folderName = 'my-case';

// Folder Query Streaming
const endpoint = `${GATEWAY_BASE_URL}/docs/${folderName}/query/stream`;

fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({
    question: 'Summarize all documents',
    llm_name: 'claude-sonnet-4'
  })
})
.then(response => {
  // Handle SSE stream
});
```

---

## 🔧 cURL Examples

### Document Chat Streaming
```bash
curl -X POST http://localhost:5000/files/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "file_id": "uuid",
    "question": "Summarize this document",
    "llm_name": "gemini"
  }' \
  --no-buffer
```

### Folder Query Streaming
```bash
curl -X POST http://localhost:5000/docs/my-case/query/stream \
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

## 📝 Quick Reference

### Production Gateway URL
Replace `http://localhost:5000` with your production gateway URL:
```
https://your-gateway-domain.com
```

### Environment Variables
- `GATEWAY_URL`: `http://localhost:5000` (or production URL)
- `FILE_SERVICE_URL`: `http://localhost:5002` (or production file service URL)

### Important Notes
1. **Gateway URL**: Always use `http://localhost:5000` for local development
2. **Document Service**: Use `/files/*` prefix
3. **Folder Service**: Use `/docs/*` prefix
4. **Authentication**: Required via `Authorization: Bearer {token}` header
5. **Streaming**: Use `/stream` suffix for SSE endpoints
6. **Folder Name**: Replace `{folderName}` with actual folder name (e.g., `my-case`)

---

## ✅ Summary

### Streaming Endpoints (Use These for Unlimited Responses)

1. **Document Chat Streaming:**
   ```
   POST http://localhost:5000/files/chat/stream
   ```

2. **Folder Query Streaming:**
   ```
   POST http://localhost:5000/docs/{folderName}/query/stream
   ```

### Standard Endpoints (Use for Quick Responses)

1. **Document Chat:**
   ```
   POST http://localhost:5000/files/chat
   ```

2. **Folder Query:**
   ```
   POST http://localhost:5000/docs/{folderName}/query
   ```

---

## 🔗 Related Documentation

- **Backend Routes**: See `routes/documentRoutes.js` and `routes/fileRoutes.js`
- **Frontend Implementation**: See `FRONTEND_INSTRUCTIONS.md`
- **Complete API Reference**: See `API_ENDPOINTS_COMPLETE.md`

