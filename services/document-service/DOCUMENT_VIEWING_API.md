# Document Viewing API Documentation

## Overview
This API provides comprehensive document viewing and streaming capabilities for documents uploaded to case folders. Users can view documents directly in the browser, download them, or get signed URLs for temporary access.

## Features Implemented

### 1. Enhanced Folder Content Retrieval
**Endpoint:** `GET /api/files/:folderName/files`

Now includes both `previewUrl` and `viewUrl` for each document:
- `previewUrl`: Short-lived URL (15 minutes) for quick previews
- `viewUrl`: Longer-lived URL (60 minutes) for viewing/opening documents

**Example Response:**
```json
{
  "message": "Folder files fetched successfully.",
  "folder": {
    "id": 123,
    "name": "My Case Folder",
    "folder_path": "user_123/My Case Folder",
    "gcs_path": "user_123/My Case Folder/"
  },
  "files": [
    {
      "id": 456,
      "originalname": "contract.pdf",
      "mimetype": "application/pdf",
      "size": 1024000,
      "status": "completed",
      "previewUrl": "https://storage.googleapis.com/...",
      "viewUrl": "https://storage.googleapis.com/...",
      "created_at": "2025-11-12T10:30:00Z"
    }
  ]
}
```

### 2. View Document Endpoint
**Endpoint:** `GET /api/files/document/:fileId/view`

Get a signed URL to view a specific document.

**Parameters:**
- `fileId` (path parameter): The ID of the document
- `expiryMinutes` (query parameter, optional): URL expiry time in minutes (default: 60)

**Example Request:**
```bash
GET /api/files/document/456/view?expiryMinutes=120
Authorization: Bearer <your_token>
```

**Example Response:**
```json
{
  "message": "Document view URL generated successfully.",
  "document": {
    "id": 456,
    "name": "contract.pdf",
    "mimetype": "application/pdf",
    "size": 1024000,
    "status": "completed",
    "folder_path": "user_123/My Case Folder",
    "created_at": "2025-11-12T10:30:00Z"
  },
  "viewUrl": "https://storage.googleapis.com/...",
  "expiresIn": "120 minutes"
}
```

**Usage:**
1. Call this endpoint to get a signed URL
2. Open the `viewUrl` in a browser tab or iframe
3. The document will be displayed as-is (PDF viewer, image viewer, etc.)

### 3. Stream Document Endpoint
**Endpoint:** `GET /api/files/document/:fileId/stream`

Stream a document directly to the browser for inline viewing or downloading.

**Parameters:**
- `fileId` (path parameter): The ID of the document
- `download` (query parameter, optional): Set to `true` for download, `false` for inline viewing (default: false)

**Example Requests:**

**View inline:**
```bash
GET /api/files/document/456/stream
Authorization: Bearer <your_token>
```

**Download:**
```bash
GET /api/files/document/456/stream?download=true
Authorization: Bearer <your_token>
```

**Response:**
- Returns the document file stream with appropriate headers
- For inline viewing: `Content-Disposition: inline; filename="contract.pdf"`
- For download: `Content-Disposition: attachment; filename="contract.pdf"`

**Usage:**
1. Use this endpoint when you want to stream the document directly without a signed URL
2. Perfect for embedding documents in iframes or downloading files
3. Requires authentication on every request

## Use Cases

### Use Case 1: Display Document in Modal/Dialog
```javascript
// Fetch folder contents
const response = await fetch('/api/files/MyCase/files', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// User clicks on a document
const document = data.files[0];

// Option A: Use pre-generated viewUrl
window.open(document.viewUrl, '_blank');

// Option B: Get a fresh URL with custom expiry
const viewResponse = await fetch(`/api/files/document/${document.id}/view?expiryMinutes=180`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const viewData = await viewResponse.json();
window.open(viewData.viewUrl, '_blank');
```

### Use Case 2: Embed Document in iframe
```javascript
// Stream the document directly
const streamUrl = `/api/files/document/${fileId}/stream`;

// Set iframe source (auth token must be in cookie or use signed URL method)
document.getElementById('docViewer').src = streamUrl;
```

### Use Case 3: Download Document
```javascript
// Download the document
const downloadUrl = `/api/files/document/${fileId}/stream?download=true`;

// Create download link
const link = document.createElement('a');
link.href = downloadUrl;
link.download = document.originalname;
link.click();
```

### Use Case 4: Share Document (Temporary Access)
```javascript
// Generate a signed URL with long expiry for sharing
const shareResponse = await fetch(`/api/files/document/${fileId}/view?expiryMinutes=1440`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const shareData = await shareResponse.json();

// Share this URL - it will work for 24 hours without authentication
console.log('Share this URL:', shareData.viewUrl);
```

## Security Features

1. **Authentication Required**: All endpoints require valid JWT authentication
2. **User Authorization**: Users can only access their own documents
3. **Signed URLs**: Temporary URLs with configurable expiry times
4. **File Validation**: Checks if files exist in both database and cloud storage
5. **Folder Validation**: Ensures documents belong to the specified folder

## Error Handling

### Common Error Responses

**404 - Document Not Found:**
```json
{
  "error": "Document not found or you don't have permission to access it."
}
```

**404 - File Not in Storage:**
```json
{
  "error": "Document file not found in storage."
}
```

**400 - Missing Parameters:**
```json
{
  "error": "File ID is required"
}
```

**500 - Internal Server Error:**
```json
{
  "error": "Internal server error",
  "details": "Error message details"
}
```

## Frontend Integration Example

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const DocumentViewer = ({ folderName }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [folderName]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/files/${folderName}/files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setDocuments(data.files);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDocument = (doc) => {
    // Open document in new tab using pre-generated viewUrl
    window.open(doc.viewUrl, '_blank');
  };

  const downloadDocument = async (doc) => {
    const link = document.createElement('a');
    link.href = `/api/files/document/${doc.id}/stream?download=true`;
    link.download = doc.originalname;
    link.click();
  };

  if (loading) return <div>Loading documents...</div>;

  return (
    <div className="document-list">
      <h2>Documents in {folderName}</h2>
      {documents.map(doc => (
        <div key={doc.id} className="document-item">
          <span>{doc.originalname}</span>
          <span>{(doc.size / 1024).toFixed(2)} KB</span>
          <button onClick={() => openDocument(doc)}>View</button>
          <button onClick={() => downloadDocument(doc)}>Download</button>
        </div>
      ))}
    </div>
  );
};

export default DocumentViewer;
```

## Performance Considerations

1. **Signed URLs**: Cached for the duration of their expiry, reducing server load
2. **Streaming**: Large files are streamed rather than loaded into memory
3. **Lazy Loading**: Document lists can be paginated if needed
4. **CDN**: GCS automatically provides CDN benefits for frequently accessed files

## Best Practices

1. **Use `viewUrl` from folder listing** when possible (already generated, saves an API call)
2. **Use `/view` endpoint** when you need custom expiry times or fresh URLs
3. **Use `/stream` endpoint** when you need server-side download or inline display with authentication
4. **Set appropriate expiry times**:
   - Short-lived (15-30 min) for quick previews
   - Medium-lived (1-2 hours) for active viewing sessions
   - Long-lived (24+ hours) for sharing purposes
5. **Handle errors gracefully** with user-friendly messages
6. **Show loading states** while fetching documents or generating URLs

## Supported Document Types

The API supports all document types stored in your GCS bucket, including:
- PDF documents (`.pdf`)
- Word documents (`.doc`, `.docx`)
- Images (`.jpg`, `.png`, `.gif`, `.webp`)
- Text files (`.txt`)
- And any other file types uploaded to your system

The document will be rendered according to the browser's capabilities and the file's MIME type.




