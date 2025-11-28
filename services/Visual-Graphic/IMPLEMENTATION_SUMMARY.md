# Implementation Summary

## Overview

The Visual Graphic Service generates NotebookLM-style infographics from legal documents using a two-step AI process.

## Architecture

### Two-Step Process

```
┌─────────────────┐
│  Legal Document │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Step 1: Architect      │
│  (Gemini 1.5 Pro)       │
│  - Analyzes text        │
│  - Generates structured │
│    image prompt         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Step 2: Artist         │
│  (Vertex AI Imagen 3)   │
│  - Generates image      │
│  - Superior text        │
│    rendering            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│  Infographic    │
│  Image          │
└─────────────────┘
```

## Key Components

### 1. Services

#### `documentService.js`
- Fetches document data from Document Service
- Handles authentication and error handling
- Supports single and multiple file fetching

#### `contentProcessor.js`
- Extracts document content from API responses
- Combines chunks and chat history
- Prepares content for AI analysis

#### `geminiService.js` (Architect)
- Uses Gemini 1.5 Pro to analyze legal documents
- Generates structured image prompts
- Follows NotebookLM-style template format

#### `imagenService.js` (Artist)
- Uses Vertex AI Imagen 3 (`imagegeneration@006`)
- Generates high-quality infographic images
- Superior text rendering capabilities
- 16:9 aspect ratio for infographics

### 2. Controllers

#### `infographicController.js`
- Handles HTTP requests
- Creates async jobs for generation
- Orchestrates the two-step process
- Provides status polling endpoints

### 3. Utilities

#### `jobManager.js`
- In-memory job tracking (can be replaced with Redis)
- Tracks job status and progress
- Auto-cleanup of old jobs

#### `jwt.js`
- JWT token verification
- Authentication utilities

### 4. Routes

#### `/api/infographic/generate`
- POST: Start async generation
- Returns `job_id` immediately

#### `/api/infographic/status/:job_id`
- GET: Poll for job status
- Returns progress and final image

#### `/api/infographic/generate-sync`
- POST: Synchronous generation (testing)
- Waits for completion

## Data Flow

### Async Generation Flow

```
1. Client → POST /generate
   └─> Controller creates job
   └─> Returns job_id (202 Accepted)

2. Background Process:
   ├─> Fetch document from Document Service
   ├─> Extract content
   ├─> Generate prompt (Gemini)
   ├─> Generate image (Imagen)
   └─> Update job status

3. Client → GET /status/:job_id (polls every 2-3s)
   └─> Returns status, progress, image URL
```

### Status States

- `pending`: Job created, waiting to start
- `processing`: Fetching document
- `analyzing`: Generating prompt with Gemini
- `designing`: Generating image with Imagen
- `completed`: Image ready
- `failed`: Error occurred

## Prompt Template Structure

The Gemini service generates prompts using this NotebookLM-style template:

```
"A professional vector infographic on a white background. 
The subject is [TOPIC]. The central visual is [METAPHOR].

Left Column:
Icon: [ICON NAME] | Text: "[HEADER 1]" | Subtext: "[SUMMARY 1]"
Icon: [ICON NAME] | Text: "[HEADER 2]" | Subtext: "[SUMMARY 2]"

Right Column:
Icon: [ICON NAME] | Text: "[HEADER 3]" | Subtext: "[SUMMARY 3]"

Style: Flat design, clean lines, corporate color palette 
(Teal #008080, Muted Gold #C5A059, Dark Grey). 
No photorealism. High legibility text."
```

## Environment Variables

### Required

- `GEMINI_API_KEY` - For prompt generation
- `GCP_PROJECT_ID` - Google Cloud project
- `GOOGLE_APPLICATION_CREDENTIALS` - Service account key path
- `DOCUMENT_SERVICE_URL` - Document Service endpoint
- `JWT_SECRET` - Must match other services

### Optional

- `PORT` - Service port (default: 8082)
- `GCP_LOCATION` - GCP region (default: us-central1)

## Integration Points

### Document Service
- Fetches file metadata and chunks
- Uses same authentication (JWT)
- Handles errors gracefully

### Frontend
- Polls status endpoint
- Displays progress updates
- Shows final infographic image

## Error Handling

### Document Service Errors
- 404: Document not found
- 403: Access denied
- 500: Service unavailable
- Timeout: Request timeout

### AI Service Errors
- Gemini: API quota, invalid key
- Imagen: GCP permissions, model access
- Network: Connection issues

### Job Errors
- Stored in job status
- Returned to client on status check
- Jobs auto-cleanup after 24 hours

## Performance Considerations

### Generation Time
- Document fetch: ~1-2 seconds
- Prompt generation: ~3-5 seconds
- Image generation: ~8-15 seconds
- **Total: ~15-25 seconds**

### Optimization
- Async processing (non-blocking)
- Status polling (2-3 second intervals)
- Job cleanup (24-hour retention)
- Can add Redis for distributed jobs

## Security

- JWT authentication required
- User-scoped jobs (access control)
- Service account for GCP access
- Environment variables for secrets

## Future Enhancements

1. **Redis Job Queue** - Distributed job tracking
2. **Image Storage** - Store generated images in GCS
3. **Caching** - Cache generated infographics
4. **Webhooks** - Push notifications on completion
5. **Batch Processing** - Generate multiple infographics

## Testing

### Manual Testing

```bash
# 1. Start service
npm start

# 2. Generate infographic
curl -X POST http://localhost:8082/api/infographic/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "FILE_ID"}'

# 3. Check status
curl http://localhost:8082/api/infographic/status/JOB_ID \
  -H "Authorization: Bearer TOKEN"
```

### Frontend Testing

Use the React component from `FRONTEND_INTEGRATION.md` to test the complete flow.

## Monitoring

### Key Metrics to Track

- Job success rate
- Average generation time
- API quota usage
- Error rates by type
- Job queue length

### Logging

- Job creation/completion
- Document fetch status
- AI API calls
- Errors with stack traces

## Support

For issues:
1. Check logs for error messages
2. Verify environment variables
3. Test Document Service connection
4. Verify GCP credentials
5. Check API quotas

See `SETUP.md` for detailed troubleshooting.



