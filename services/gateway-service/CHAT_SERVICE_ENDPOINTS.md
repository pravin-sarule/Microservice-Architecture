# Chat Service Endpoints (via Gateway)

This document outlines the Chat Service API Gateway endpoints for document-based Q&A with LLM.

## Base URL
All Chat Service endpoints are prefixed with the Gateway's base URL (e.g., `http://localhost:5000`).

## Chat Service Endpoints (`/chat`)

Proxied to `CHAT_SERVICE_URL` (e.g., `http://localhost:5003`) with path rewrite `/chat` to `/api/chat`.

All routes under `/chat` are protected by JWT authentication.

| Gateway Endpoint | Method | Description | Backend Service Route | Auth Required |
|------------------|--------|-------------|----------------------|---------------|
| `/chat/upload-document` | POST | Upload document to GCS and get file_id | `/api/chat/upload-document` | ✅ Yes |
| `/chat/ask` | POST | Ask question about uploaded document | `/api/chat/ask` | ✅ Yes |
| `/chat/files` | GET | Get user's uploaded files list | `/api/chat/files` | ✅ Yes |

## Environment Variables

Set in `.env` file:
```env
CHAT_SERVICE_URL=http://localhost:5003
```

For production, update to your deployed ChatModel service URL.

## Request Examples

### 1. Upload Document

**Endpoint:** `POST http://localhost:5000/chat/upload-document`

**Headers:**
```
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `document`: File (PDF, DOCX, TXT, etc.)

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_id": "63adde99-831e-4c4c-afd2-12dfeec7e35f",
    "filename": "document.pdf",
    "gcs_uri": "gs://bucket-name/chat-uploads/21/1234567890_document.pdf",
    "size": 107643,
    "mimetype": "application/pdf"
  }
}
```

### 2. Ask Question

**Endpoint:** `POST http://localhost:5000/chat/ask`

**Headers:**
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "question": "What is this document about?",
  "file_id": "63adde99-831e-4c4c-afd2-12dfeec7e35f"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "question": "What is this document about?",
    "answer": "This document discusses...",
    "file_id": "63adde99-831e-4c4c-afd2-12dfeec7e35f",
    "filename": "document.pdf"
  }
}
```

### 3. Get User Files

**Endpoint:** `GET http://localhost:5000/chat/files`

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "63adde99-831e-4c4c-afd2-12dfeec7e35f",
        "filename": "document.pdf",
        "size": 107643,
        "mimetype": "application/pdf",
        "status": "uploaded",
        "created_at": "2025-01-27T22:39:47.782Z"
      }
    ]
  }
}
```

## Features

- **Multimodal Support**: Uses Vertex AI with Gemini models to process PDFs, images, and documents
- **Direct GCS Integration**: Files are stored in Google Cloud Storage and processed directly via `gs://` URIs
- **Latest Models**: Uses `gemini-2.5-pro` and `gemini-2.5-flash` for best performance
- **Large File Support**: Supports files up to 2M tokens via GCS URI method
- **Visual Understanding**: Can "see" documents (signatures, diagrams, etc.) not just extract text

## Error Responses

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Question is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "File not found"
}
```

### 502 Bad Gateway
```json
{
  "success": false,
  "error": "Chat Service is unavailable"
}
```

