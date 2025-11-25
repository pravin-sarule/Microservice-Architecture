# Visual Service Endpoints via API Gateway

## Overview
The Visual Service is integrated with the API Gateway and accessible through the `/visual` prefix. All endpoints require JWT authentication.

## Base URL
```
http://localhost:5000/visual
```
or in production:
```
https://your-gateway-domain.com/visual
```

## Environment Variables
Make sure to set the following in your gateway-service `.env` file:
```env
VISUAL_SERVICE_URL=http://localhost:8081
```

## Complete Endpoint URLs

### 1. Generate Flowchart from Single Document

**Endpoint**: `POST /visual/generate-flowchart`

**Full URL**: 
- Local: `http://localhost:5000/visual/generate-flowchart`
- Production: `https://your-gateway-domain.com/visual/generate-flowchart`

**Description**: Generates a flowchart from a single document using Gemini 1.5 Flash

**Authentication**: Required (JWT Bearer Token)

**Request Headers**:
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "file_id": "uuid-of-document",
  "prompt": "Create a process flowchart showing the workflow",  // Optional
  "flowchart_type": "process"  // Optional, default: "process"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "file_id": "uuid-of-document",
  "document_name": "document.pdf",
  "flowchart_type": "process",
  "flowchart_description": "AI-generated flowchart description...",
  "mermaid_syntax": "graph TD\n    A[Start] --> B[Process Step 1]\n    B --> C[Decision]\n    C -->|Yes| D[Action 1]\n    C -->|No| E[Action 2]",
  "image_url": null,
  "generated_at": "2024-01-01T12:00:00.000000",
  "user_id": "user_id"
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid file_id
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Access denied to document
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Service unavailable or generation failed

---

### 2. Generate Flowchart from Multiple Documents

**Endpoint**: `POST /visual/generate-flowchart-multi`

**Full URL**: 
- Local: `http://localhost:5000/visual/generate-flowchart-multi`
- Production: `https://your-gateway-domain.com/visual/generate-flowchart-multi`

**Description**: Generates a unified flowchart combining information from multiple documents

**Authentication**: Required (JWT Bearer Token)

**Request Headers**:
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "file_ids": ["uuid1", "uuid2", "uuid3"],
  "prompt": "Create a unified flowchart combining all documents",  // Optional
  "flowchart_type": "process"  // Optional, default: "process"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "file_ids": ["uuid1", "uuid2", "uuid3"],
  "documents": [
    {
      "id": "uuid1",
      "name": "document1.pdf"
    },
    {
      "id": "uuid2",
      "name": "document2.pdf"
    }
  ],
  "flowchart_type": "process",
  "flowchart_description": "AI-generated unified flowchart description...",
  "mermaid_syntax": "graph TD\n    A[Document 1 Start] --> B[Document 2 Process]\n    B --> C[Document 3 Decision]",
  "generated_at": "2024-01-01T12:00:00.000000",
  "user_id": "user_id"
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid file_ids array
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: No valid documents found
- `500 Internal Server Error`: Service unavailable or generation failed

---

## Example Usage

### Using cURL

#### Single Document Flowchart
```bash
curl -X POST http://localhost:5000/visual/generate-flowchart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "your-file-uuid",
    "prompt": "Create a detailed process flowchart",
    "flowchart_type": "process"
  }'
```

#### Multiple Documents Flowchart
```bash
curl -X POST http://localhost:5000/visual/generate-flowchart-multi \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["uuid1", "uuid2"],
    "prompt": "Create a unified workflow flowchart",
    "flowchart_type": "process"
  }'
```

### Using JavaScript/Fetch

```javascript
// Single Document Flowchart
const response = await fetch('http://localhost:5000/visual/generate-flowchart', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_id: 'your-file-uuid',
    prompt: 'Create a process flowchart',
    flowchart_type: 'process'
  })
});

const data = await response.json();
console.log(data.mermaid_syntax); // Use this with Mermaid.js to render
```

### Using Axios

```javascript
import axios from 'axios';

// Single Document Flowchart
const response = await axios.post(
  'http://localhost:5000/visual/generate-flowchart',
  {
    file_id: 'your-file-uuid',
    prompt: 'Create a detailed flowchart',
    flowchart_type: 'process'
  },
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data.mermaid_syntax);
```

## Rendering Mermaid Syntax

The response includes `mermaid_syntax` which can be rendered using Mermaid.js:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
</head>
<body>
  <div class="mermaid">
    graph TD
        A[Start] --> B[Process]
        B --> C[End]
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>
```

Or with React:
```jsx
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

function Flowchart({ mermaidSyntax }) {
  const ref = useRef(null);

  useEffect(() => {
    if (mermaidSyntax && ref.current) {
      mermaid.initialize({ startOnLoad: true });
      mermaid.contentLoaded();
      ref.current.innerHTML = mermaidSyntax;
    }
  }, [mermaidSyntax]);

  return <div ref={ref} className="mermaid"></div>;
}
```

## Gateway Routing

The gateway routes requests as follows:

```
Client Request: POST /visual/generate-flowchart
    ↓
API Gateway (port 5000)
    ↓
Visual Service Proxy
    ↓
Visual Service (port 8081): POST /api/visual/generate-flowchart
```

## Notes

1. **Authentication**: All endpoints require a valid JWT token in the Authorization header
2. **Timeout**: Flowchart generation can take 30-120 seconds depending on document size
3. **User-Specific**: Documents are validated for user ownership before processing
4. **Mermaid Syntax**: The `mermaid_syntax` field contains ready-to-use Mermaid diagram code
5. **Error Handling**: Always check the `success` field in the response

## Service Health Check

Check if Visual Service is accessible:
```bash
curl http://localhost:8081/health
```

Check if Gateway is running:
```bash
curl http://localhost:5000/health
```

