# Visual Graphic Service

Service for generating NotebookLM-style infographics from legal documents using AI.

## Overview

This service implements a two-step AI process to generate professional infographics:

1. **Architect (Gemini 1.5 Pro)**: Analyzes legal documents and generates detailed image prompts
2. **Artist (Vertex AI Imagen 3)**: Generates high-quality infographic images with superior text rendering

## Features

- ✅ Two-step AI generation (Architect → Artist)
- ✅ Async job processing with status polling
- ✅ Integration with Document Service
- ✅ NotebookLM-style infographic format
- ✅ Professional legal color palette
- ✅ High-quality text rendering

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Google Cloud Project** with:
   - Vertex AI API enabled
   - Imagen 3 access
   - Service account with proper permissions
3. **Gemini API Key**
4. **Document Service** running (for fetching document data)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Configure environment variables (see `.env.example`)

4. Set up Google Cloud authentication:
```bash
# Option 1: Application Default Credentials (recommended)
gcloud auth application-default login

# Option 2: Service account key file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The service will run on port `8082` by default (configurable via `PORT` env var).

## API Endpoints

### 1. Generate Infographic (Async - Recommended)

**POST** `/api/infographic/generate`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "file_id": "uuid-of-document",
  "prompt": "optional-custom-prompt"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "job_id": "uuid",
  "status": "pending",
  "message": "Infographic generation started"
}
```

### 2. Get Job Status

**GET** `/api/infographic/status/:job_id`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "job_id": "uuid",
  "status": "completed", // pending, processing, analyzing, designing, completed, failed
  "step": "Infographic generated successfully!",
  "progress": 100,
  "image_url": "data:image/png;base64,...",
  "image_base64": "...",
  "prompt": "generated prompt...",
  "created_at": "2024-01-01T12:00:00.000Z",
  "updated_at": "2024-01-01T12:05:00.000Z"
}
```

### 3. Generate Infographic (Sync - Testing Only)

**POST** `/api/infographic/generate-sync`

⚠️ **Warning**: This endpoint waits for completion (15-30 seconds). Use async endpoint for production.

## Frontend Integration

See `FRONTEND_INTEGRATION.md` for detailed frontend integration guide.

## Architecture

```
Client Request
    ↓
[Controller] → Creates async job
    ↓
[Document Service] → Fetches document data
    ↓
[Content Processor] → Extracts document content
    ↓
[Gemini Service] → Generates image prompt (Architect)
    ↓
[Imagen Service] → Generates image (Artist)
    ↓
[Job Manager] → Updates job status
    ↓
Client polls status endpoint → Gets final image
```

## Environment Variables

See `.env.example` for all required environment variables.

### Required:
- `GEMINI_API_KEY` - For prompt generation
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key OR use Application Default Credentials
- `DOCUMENT_SERVICE_URL` - URL of Document Service
- `JWT_SECRET` - Must match other services

## Troubleshooting

### Image generation fails
- Check GCP credentials are configured correctly
- Verify Vertex AI API is enabled in your GCP project
- Ensure you have access to Imagen 3 model

### Prompt generation fails
- Verify `GEMINI_API_KEY` is set correctly
- Check API quota limits

### Document not found
- Verify `DOCUMENT_SERVICE_URL` is correct
- Ensure Document Service is running
- Check JWT token is valid

## License

ISC



