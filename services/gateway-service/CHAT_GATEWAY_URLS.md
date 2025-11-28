# Chat Service Gateway URLs

## Quick Reference

All Chat Service endpoints are accessible through the API Gateway at:

**Base Gateway URL:** `http://localhost:5000` (or your production gateway URL)

## Complete Gateway URLs

### 1. Upload Document
```
POST http://localhost:5000/chat/upload-document
```
- **Description:** Upload a document (PDF, DOCX, TXT, etc.) to GCS
- **Auth:** Required (Bearer token)
- **Content-Type:** `multipart/form-data`
- **Body:** Form data with `document` field

### 2. Ask Question
```
POST http://localhost:5000/chat/ask
```
- **Description:** Ask a question about an uploaded document
- **Auth:** Required (Bearer token)
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "question": "What is this document about?",
  "file_id": "your-file-id-here"
}
```

### 3. Get User Files
```
GET http://localhost:5000/chat/files
```
- **Description:** Get list of all files uploaded by the authenticated user
- **Auth:** Required (Bearer token)
- **Response:** Array of file objects with metadata

## Environment Setup

Add to your `.env` file in `gateway-service`:
```env
CHAT_SERVICE_URL=http://localhost:5003
```

For production:
```env
CHAT_SERVICE_URL=https://your-chat-service-url.com
```

## Example Usage

### Using cURL

**Upload Document:**
```bash
curl -X POST http://localhost:5000/chat/upload-document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "document=@/path/to/document.pdf"
```

**Ask Question:**
```bash
curl -X POST http://localhost:5000/chat/ask \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is this document about?",
    "file_id": "63adde99-831e-4c4c-afd2-12dfeec7e35f"
  }'
```

**Get Files:**
```bash
curl -X GET http://localhost:5000/chat/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using JavaScript/Fetch

```javascript
// Upload Document
const formData = new FormData();
formData.append('document', fileInput.files[0]);

const uploadResponse = await fetch('http://localhost:5000/chat/upload-document', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const uploadData = await uploadResponse.json();
const fileId = uploadData.data.file_id;

// Ask Question
const askResponse = await fetch('http://localhost:5000/chat/ask', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    question: 'What is this document about?',
    file_id: fileId
  })
});

const answer = await askResponse.json();
console.log(answer.data.answer);
```

## Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Notes

- All endpoints require JWT authentication
- File uploads support up to 50MB
- Supported file types: PDF, DOCX, TXT, MD, images (JPG, PNG, etc.)
- Uses Vertex AI with Gemini 2.5 models for best performance
- Files are stored in Google Cloud Storage and processed directly via `gs://` URIs

