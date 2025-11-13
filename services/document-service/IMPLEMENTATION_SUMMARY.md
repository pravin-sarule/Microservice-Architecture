# Document Viewing Implementation Summary

## What Was Implemented

### 1. Enhanced `getCaseFilesByFolderName` Function
**Location:** `FileController.js` (lines 4102-4112)

**Changes:**
- Added `viewUrl` to each document in the folder
- `previewUrl`: 15-minute expiry (for quick previews)
- `viewUrl`: 60-minute expiry (for document viewing/opening)

**Impact:** When users fetch documents from a case folder, they now receive both preview and view URLs without making additional API calls.

---

### 2. New `viewDocument` Endpoint
**Location:** `FileController.js` (lines 4137-4219)

**Route:** `GET /api/files/document/:fileId/view`

**Features:**
- Get signed URL for a specific document
- Configurable expiry time (default: 60 minutes)
- Security: Validates user ownership
- Returns document metadata along with viewUrl

**Use Case:** When you need a fresh URL with custom expiry or want to view a specific document by ID.

---

### 3. New `streamDocument` Endpoint
**Location:** `FileController.js` (lines 4221-4310)

**Route:** `GET /api/files/document/:fileId/stream`

**Features:**
- Stream document directly from server
- Support for inline viewing or download
- Proper Content-Disposition headers
- Efficient streaming (doesn't load entire file in memory)

**Use Case:** When you need to embed documents in iframes or provide direct download with authentication.

---

### 4. Updated Routes
**Location:** `fileRoutes.js` (lines 69-70)

Added two new routes:
```javascript
router.get("/document/:fileId/view", authMiddleware.protect, fileController.viewDocument);
router.get("/document/:fileId/stream", authMiddleware.protect, fileController.streamDocument);
```

---

## How It Works

### Workflow 1: View Documents in a Case Folder
```
1. User requests folder contents: GET /api/files/MyCase/files
2. Backend returns list of documents with viewUrl and previewUrl
3. User clicks on document
4. Frontend opens the viewUrl in browser
5. Document displays as-is (PDF viewer, image viewer, etc.)
```

### Workflow 2: Get Custom View URL
```
1. User wants to share a document with custom expiry
2. Frontend calls: GET /api/files/document/123/view?expiryMinutes=1440
3. Backend generates signed URL valid for 24 hours
4. Frontend receives viewUrl and can share it
```

### Workflow 3: Stream Document with Auth
```
1. User wants to embed document in iframe
2. Frontend sets iframe src: /api/files/document/123/stream
3. Backend streams document with auth check on every request
4. Document displays inline in iframe
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/files/:folderName/files` | GET | Get all documents in folder with URLs | ✅ |
| `/api/files/document/:fileId/view` | GET | Get signed URL for specific document | ✅ |
| `/api/files/document/:fileId/stream` | GET | Stream document directly | ✅ |

---

## Example Frontend Usage

### Simple Implementation
```javascript
// 1. Fetch folder documents
const response = await fetch('/api/files/MyCase/files', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { files } = await response.json();

// 2. User clicks on document - open in new tab
const document = files[0];
window.open(document.viewUrl, '_blank');
```

### Advanced Implementation with Custom Expiry
```javascript
// Get fresh URL with 3-hour expiry
const response = await fetch(`/api/files/document/${fileId}/view?expiryMinutes=180`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { viewUrl } = await response.json();
window.open(viewUrl, '_blank');
```

### Download Implementation
```javascript
// Download document
const downloadUrl = `/api/files/document/${fileId}/stream?download=true`;
const link = document.createElement('a');
link.href = downloadUrl;
link.download = filename;
link.click();
```

---

## Security Features

1. ✅ **Authentication Required**: All endpoints require JWT token
2. ✅ **User Authorization**: Users can only access their own documents
3. ✅ **Signed URLs**: Temporary access with configurable expiry
4. ✅ **Database Validation**: Checks document exists in database
5. ✅ **Storage Validation**: Verifies file exists in Google Cloud Storage
6. ✅ **Folder Association**: Ensures document belongs to correct folder

---

## Testing the Implementation

### Test 1: Get Folder Documents
```bash
curl -X GET "http://localhost:3000/api/files/MyCase/files" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** List of documents with `viewUrl` and `previewUrl` fields

### Test 2: Get Document View URL
```bash
curl -X GET "http://localhost:3000/api/files/document/123/view?expiryMinutes=120" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Document metadata with `viewUrl` and `expiresIn` fields

### Test 3: Stream Document
```bash
curl -X GET "http://localhost:3000/api/files/document/123/stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_document.pdf
```

**Expected:** Document file streamed and saved

### Test 4: Open in Browser
1. Get a viewUrl from any of the above endpoints
2. Copy the URL
3. Paste in browser
4. Document should open and display correctly

---

## Key Benefits

1. **Easy Integration**: Documents have viewUrl included by default
2. **Flexible Access**: Multiple ways to access documents (signed URLs, streaming)
3. **Secure**: Proper authentication and authorization
4. **Efficient**: Streaming for large files, caching for signed URLs
5. **User-Friendly**: Documents open as-is in browser
6. **Configurable**: Custom expiry times for different use cases

---

## File Changes Summary

### Modified Files:
1. **FileController.js**
   - Updated `getCaseFilesByFolderName` (lines 4102-4112)
   - Added `viewDocument` function (lines 4137-4219)
   - Added `streamDocument` function (lines 4221-4310)

2. **fileRoutes.js**
   - Added route for `viewDocument` (line 69)
   - Added route for `streamDocument` (line 70)

### New Files:
1. **DOCUMENT_VIEWING_API.md** - Complete API documentation
2. **IMPLEMENTATION_SUMMARY.md** - This file

---

## Next Steps (Optional Enhancements)

1. **Add Pagination**: If folders contain many documents
2. **Add Thumbnails**: Generate preview thumbnails for documents
3. **Add Viewer UI**: Create a built-in document viewer component
4. **Add Analytics**: Track document views and downloads
5. **Add Watermarking**: Add watermarks to sensitive documents
6. **Add Version Control**: Support multiple versions of same document

---

## Support

For any issues or questions:
1. Check the API documentation in `DOCUMENT_VIEWING_API.md`
2. Review error messages (all endpoints provide detailed error responses)
3. Check server logs for detailed debug information
4. Verify JWT token is valid and user has access to the document

---

**Implementation Date:** November 12, 2025
**Status:** ✅ Complete and Ready for Use



