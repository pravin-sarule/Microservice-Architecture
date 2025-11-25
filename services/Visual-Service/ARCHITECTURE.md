# Visual Service Architecture

## Project Structure

```
Visual-Service/
├── app.py                          # Main application entry point
├── requirements.txt                # Python dependencies
├── README.md                       # Service documentation
├── ARCHITECTURE.md                 # This file - architecture documentation
└── app/                            # Application package
    ├── __init__.py                 # Package initialization
    ├── controllers/                # Request/Response handlers
    │   ├── __init__.py
    │   └── visual_controller.py   # Flowchart generation controllers
    ├── routes/                     # API route definitions
    │   ├── __init__.py
    │   └── visual_routes.py        # Visual service routes
    ├── services/                   # Business logic services
    │   ├── __init__.py
    │   ├── document_service.py    # Document Service API integration
    │   ├── gemini_service.py       # Gemini AI integration
    │   └── content_processor.py    # Document content processing
    └── middleware/                 # Request processing middleware
        ├── __init__.py
        └── auth.py                 # JWT authentication middleware
```

## Architecture Layers

### 1. Routes Layer (`app/routes/`)
**Purpose**: Define API endpoints and HTTP methods

**Responsibilities**:
- Map URLs to controller methods
- Apply middleware (authentication, validation)
- Handle HTTP-specific concerns

**Files**:
- `visual_routes.py`: Defines `/api/visual/*` endpoints

### 2. Controllers Layer (`app/controllers/`)
**Purpose**: Handle HTTP requests and format responses

**Responsibilities**:
- Validate request data
- Orchestrate service calls
- Format JSON responses
- Handle errors and status codes

**Files**:
- `visual_controller.py`: 
  - `generate_flowchart()`: Single document flowchart generation
  - `generate_flowchart_multi()`: Multiple documents flowchart generation

### 3. Services Layer (`app/services/`)
**Purpose**: Business logic and external integrations

**Responsibilities**:
- Communicate with external APIs (Document Service)
- Interact with AI services (Gemini)
- Process and transform data
- Handle business rules

**Files**:
- `document_service.py`: 
  - `get_file_complete()`: Fetch document data from Document Service
  - `get_multiple_files_complete()`: Fetch multiple documents
  
- `gemini_service.py`: 
  - `generate_flowchart()`: Generate flowchart using Gemini 1.5 Flash
  - `_extract_mermaid_syntax()`: Extract Mermaid syntax from AI response
  
- `content_processor.py`: 
  - `extract_document_content()`: Format single document content
  - `combine_multiple_documents()`: Combine multiple document contents

### 4. Middleware Layer (`app/middleware/`)
**Purpose**: Request processing and cross-cutting concerns

**Responsibilities**:
- Authentication and authorization
- Request validation
- Logging
- Error handling

**Files**:
- `auth.py`: 
  - `token_required`: JWT authentication decorator

## Data Flow

### Single Document Flowchart Generation

```
1. Client Request
   POST /api/visual/generate-flowchart
   Headers: Authorization: Bearer <token>
   Body: { "file_id": "uuid", "prompt": "...", "flowchart_type": "process" }

2. Route Handler (visual_routes.py)
   - Applies @token_required middleware
   - Routes to VisualController.generate_flowchart()

3. Controller (visual_controller.py)
   - Validates request data
   - Calls DocumentService.get_file_complete()
   - Calls ContentProcessor.extract_document_content()
   - Calls GeminiService.generate_flowchart()
   - Formats and returns JSON response

4. Services
   - DocumentService: Fetches document from Document Service API
   - ContentProcessor: Formats document content
   - GeminiService: Generates flowchart using AI

5. Response
   JSON with flowchart_description and mermaid_syntax
```

### Multiple Documents Flowchart Generation

```
1. Client Request
   POST /api/visual/generate-flowchart-multi
   Body: { "file_ids": ["uuid1", "uuid2"], ... }

2. Route Handler
   - Routes to VisualController.generate_flowchart_multi()

3. Controller
   - Calls DocumentService.get_multiple_files_complete()
   - Calls ContentProcessor.combine_multiple_documents()
   - Calls GeminiService.generate_flowchart()
   - Returns unified flowchart

4. Services
   - Fetches multiple documents in parallel
   - Combines content from all documents
   - Generates unified flowchart
```

## Key Design Principles

### 1. Separation of Concerns
- Each layer has a single, well-defined responsibility
- Controllers don't contain business logic
- Services don't handle HTTP concerns

### 2. Dependency Injection
- Services are statically accessible
- Easy to mock for testing
- Loose coupling between components

### 3. Error Handling
- Services raise exceptions with clear messages
- Controllers catch and format errors appropriately
- HTTP status codes reflect error types

### 4. Code Reusability
- Services can be used by multiple controllers
- Common functionality extracted to services
- Middleware reusable across routes

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key          # Gemini AI API key
DOCUMENT_SERVICE_URL=http://localhost:8080  # Document Service URL
JWT_SECRET=your_jwt_secret                  # JWT secret for token verification

# Optional
PORT=8081                                   # Server port (default: 8081)
FLASK_DEBUG=False                           # Debug mode (default: False)
```

## API Endpoints

### POST /api/visual/generate-flowchart
Generate flowchart from a single document

**Request**:
```json
{
  "file_id": "uuid",
  "prompt": "Create a process flowchart",
  "flowchart_type": "process"
}
```

**Response**:
```json
{
  "success": true,
  "file_id": "uuid",
  "document_name": "document.pdf",
  "flowchart_type": "process",
  "flowchart_description": "AI-generated description...",
  "mermaid_syntax": "graph TD\nA[Start] --> B[Process]",
  "generated_at": "2024-01-01T00:00:00",
  "user_id": "user_id"
}
```

### POST /api/visual/generate-flowchart-multi
Generate flowchart from multiple documents

**Request**:
```json
{
  "file_ids": ["uuid1", "uuid2"],
  "prompt": "Create unified flowchart",
  "flowchart_type": "process"
}
```

## Testing

Each layer can be tested independently:

- **Routes**: Test endpoint registration and middleware application
- **Controllers**: Test request validation and response formatting
- **Services**: Test business logic with mocked dependencies
- **Middleware**: Test authentication and authorization

## Future Enhancements

1. **Caching**: Add Redis caching for frequently accessed documents
2. **Queue System**: Use Celery for async flowchart generation
3. **Image Generation**: Direct image generation from Mermaid syntax
4. **Rate Limiting**: Add rate limiting middleware
5. **Logging**: Structured logging with correlation IDs
6. **Metrics**: Add Prometheus metrics for monitoring

