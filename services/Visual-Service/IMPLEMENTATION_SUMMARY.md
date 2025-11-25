# Visual Service Implementation Summary

## Overview
The Visual Service is a Python-based microservice that generates flowcharts from documents using Gemini 1.5 Flash. It integrates with the Document Service to fetch user-specific document data and creates visual flowcharts.

## Architecture

### Document Service Endpoints (Node.js)
1. **GET /api/doc/document/:file_id/complete**
   - Returns complete document data including:
     - File metadata
     - All chunks
     - Chat history
     - Processing job status
   - User-specific (validates ownership)

2. **GET /api/files/file/:file_id/complete**
   - Returns complete file data including:
     - File metadata
     - All chunks
     - Chat history (file-level)
     - Folder chat history (if applicable)
     - Processing job status
   - User-specific (validates ownership)

### Visual Service Endpoints (Python)
1. **POST /api/visual/generate-flowchart**
   - Generates flowchart from a single document
   - Uses Gemini 1.5 Flash for AI generation
   - Returns Mermaid syntax for visualization

2. **POST /api/visual/generate-flowchart-multi**
   - Generates flowchart from multiple documents
   - Combines information from all documents
   - Returns unified flowchart

## Flow

1. User requests flowchart generation with `file_id`
2. Visual Service calls Document Service API with JWT token
3. Document Service validates user ownership and returns complete document data
4. Visual Service extracts document content (chunks, summary)
5. Visual Service sends prompt to Gemini 1.5 Flash
6. Gemini generates flowchart description in Mermaid syntax
7. Visual Service returns flowchart data to user

## Security

- JWT authentication required for all endpoints
- User-specific document access (validates ownership)
- Token passed from Visual Service to Document Service

## Environment Variables

### Visual Service (.env)
```
GEMINI_API_KEY=your_gemini_api_key
DOCUMENT_SERVICE_URL=http://localhost:8080
JWT_SECRET=your_jwt_secret
PORT=8081
```

## Usage Example

```python
# Request to Visual Service
POST /api/visual/generate-flowchart
Headers:
  Authorization: Bearer <jwt_token>
Body:
{
  "file_id": "uuid-of-document",
  "prompt": "Create a process flowchart",
  "flowchart_type": "process"
}

# Response
{
  "success": true,
  "file_id": "uuid",
  "document_name": "document.pdf",
  "flowchart_type": "process",
  "flowchart_description": "...",
  "mermaid_syntax": "graph TD\nA[Start] --> B[Process]",
  "generated_at": "2024-01-01T00:00:00",
  "user_id": "user_id"
}
```

## Files Created

### Document Service
- `controllers/documentController.js` - Added `getDocumentComplete` endpoint
- `controllers/FileController.js` - Added `getFileComplete` endpoint
- `routes/documentRoutes.js` - Added route for document complete endpoint
- `routes/fileRoutes.js` - Added route for file complete endpoint

### Visual Service
- `app.py` - Main Flask application
- `requirements.txt` - Python dependencies
- `README.md` - Service documentation

## Next Steps

1. Install Python dependencies: `pip install -r requirements.txt`
2. Set environment variables in `.env` file
3. Run Visual Service: `python app.py`
4. Test endpoints using Postman or curl
5. Integrate with frontend to display generated flowcharts

