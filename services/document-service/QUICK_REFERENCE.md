# Quick Reference - Gateway Endpoints

## 🌐 Gateway Base URL
```
http://localhost:5000
```

---

## ⚡ Streaming Endpoints (Unlimited Responses)

### Document Chat Streaming
```
POST http://localhost:5000/files/chat/stream
```

**Request:**
```json
{
  "file_id": "uuid (optional)",
  "question": "Your question",
  "llm_name": "gemini",
  "session_id": "uuid (optional)"
}
```

### Folder Query Streaming
```
POST http://localhost:5000/docs/{folderName}/query/stream
```

**Example:**
```
POST http://localhost:5000/docs/my-case/query/stream
```

**Request:**
```json
{
  "question": "Your question",
  "llm_name": "claude-sonnet-4",
  "session_id": "uuid (optional)"
}
```

---

## 📋 Standard Endpoints

### Document Chat
```
POST http://localhost:5000/files/chat
```

### Folder Query
```
POST http://localhost:5000/docs/{folderName}/query
```

---

## 🔑 Required Headers

```
Content-Type: application/json
Authorization: Bearer {your_jwt_token}
Accept: text/event-stream  (for streaming endpoints only)
```

---

## 📝 Endpoint Mapping

| Gateway Path | Service Path | Purpose |
|-------------|--------------|---------|
| `/files/*` | `/api/doc/*` | Document Service |
| `/docs/*` | `/api/files/*` | Folder Service |

---

## 💡 Key Points

1. **Gateway URL**: `http://localhost:5000`
2. **Document Service**: Use `/files/*` prefix
3. **Folder Service**: Use `/docs/*` prefix
4. **Streaming**: Add `/stream` suffix
5. **Auth**: Always include `Authorization: Bearer {token}` header

---

## 📚 Full Documentation

- See `GATEWAY_ENDPOINTS.md` for complete endpoint list
- See `FRONTEND_INSTRUCTIONS.md` for React implementation
- See `API_ENDPOINTS_COMPLETE.md` for backend API details

