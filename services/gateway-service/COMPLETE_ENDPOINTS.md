# Complete API Gateway Endpoints

## Base URLs

### Local Development
```
Gateway: http://localhost:5000
Visual Service: http://localhost:8081
Document Service: http://localhost:8080
```

### Production
```
Gateway: https://your-gateway-domain.com
Visual Service: https://your-visual-service-domain.com
Document Service: https://your-document-service-domain.com
```

---

## Visual Service Endpoints (via Gateway)

### 1. Generate Flowchart from Single Document

**Complete Endpoint URL:**
- Local: `http://localhost:5000/visual/generate-flowchart`
- Production: `https://your-gateway-domain.com/visual/generate-flowchart`

**Method:** `POST`

**Authentication:** Required (JWT Bearer Token)

**Request:**
```bash
curl -X POST http://localhost:5000/visual/generate-flowchart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "your-file-uuid",
    "prompt": "Create a process flowchart",
    "flowchart_type": "process"
  }'
```

**Response:**
```json
{
  "success": true,
  "file_id": "uuid",
  "document_name": "document.pdf",
  "flowchart_type": "process",
  "flowchart_description": "AI-generated description...",
  "mermaid_syntax": "graph TD\nA[Start] --> B[Process]",
  "generated_at": "2024-01-01T12:00:00",
  "user_id": "user_id"
}
```

---

### 2. Generate Flowchart from Multiple Documents

**Complete Endpoint URL:**
- Local: `http://localhost:5000/visual/generate-flowchart-multi`
- Production: `https://your-gateway-domain.com/visual/generate-flowchart-multi`

**Method:** `POST`

**Authentication:** Required (JWT Bearer Token)

**Request:**
```bash
curl -X POST http://localhost:5000/visual/generate-flowchart-multi \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["uuid1", "uuid2"],
    "prompt": "Create unified flowchart",
    "flowchart_type": "process"
  }'
```

**Response:**
```json
{
  "success": true,
  "file_ids": ["uuid1", "uuid2"],
  "documents": [
    {"id": "uuid1", "name": "doc1.pdf"},
    {"id": "uuid2", "name": "doc2.pdf"}
  ],
  "flowchart_type": "process",
  "flowchart_description": "AI-generated description...",
  "mermaid_syntax": "graph TD\nA[Doc1] --> B[Doc2]",
  "generated_at": "2024-01-01T12:00:00",
  "user_id": "user_id"
}
```

---

## Document Service Endpoints (via Gateway)

### Get Complete Document Data

**Complete Endpoint URL:**
- Local: `http://localhost:5000/docs/file/{file_id}/complete`
- Production: `https://your-gateway-domain.com/docs/file/{file_id}/complete`

**Method:** `GET`

**Authentication:** Required (JWT Bearer Token)

**Example:**
```bash
curl -X GET http://localhost:5000/docs/file/your-file-uuid/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Request Flow

```
Client Request
    ↓
API Gateway (port 5000)
    ↓
Visual Proxy Middleware
    ↓
JWT Authentication
    ↓
Visual Service (port 8081)
    ↓
Document Service API Call (port 8080)
    ↓
Gemini 1.5 Flash AI
    ↓
Response back through Gateway
```

---

## Environment Variables Setup

### Gateway Service (.env)
```env
PORT=5000
JWT_SECRET=your_jwt_secret
VISUAL_SERVICE_URL=http://localhost:8081
FILE_SERVICE_URL=http://localhost:8080
```

### Visual Service (.env)
```env
PORT=8081
GEMINI_API_KEY=your_gemini_api_key
DOCUMENT_SERVICE_URL=http://localhost:8080
JWT_SECRET=your_jwt_secret
```

---

## Quick Reference Table

| Service | Gateway Endpoint | Direct Service Endpoint | Method |
|---------|-----------------|------------------------|--------|
| Visual | `/visual/generate-flowchart` | `/api/visual/generate-flowchart` | POST |
| Visual | `/visual/generate-flowchart-multi` | `/api/visual/generate-flowchart-multi` | POST |
| Document | `/docs/file/:file_id/complete` | `/api/files/file/:file_id/complete` | GET |
| Document | `/files/*` | `/api/doc/*` | Various |

---

## Testing

### Test Gateway Health
```bash
curl http://localhost:5000/health
```

### Test Visual Service Health
```bash
curl http://localhost:8081/health
```

### Test with Postman

1. **Set Authorization:**
   - Type: Bearer Token
   - Token: Your JWT token

2. **Single Document Flowchart:**
   - Method: POST
   - URL: `http://localhost:5000/visual/generate-flowchart`
   - Body (JSON):
     ```json
     {
       "file_id": "your-file-uuid",
       "prompt": "Create a detailed flowchart",
       "flowchart_type": "process"
     }
     ```

3. **Multiple Documents Flowchart:**
   - Method: POST
   - URL: `http://localhost:5000/visual/generate-flowchart-multi`
   - Body (JSON):
     ```json
     {
       "file_ids": ["uuid1", "uuid2"],
       "prompt": "Create unified flowchart",
       "flowchart_type": "process"
     }
     ```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "error": "Document not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Visual Service is unavailable",
  "message": "The flowchart generation service is currently unavailable. Please try again later."
}
```

---

## Notes

1. All Visual Service endpoints require JWT authentication
2. Flowchart generation can take 30-120 seconds depending on document size
3. The `mermaid_syntax` field contains ready-to-use Mermaid diagram code
4. Documents are validated for user ownership before processing
5. Gateway timeout is set to 120 seconds for flowchart generation

