# Quick Reference Guide - Document Viewing

## 🚀 Quick Start

### Scenario: User clicks on a document in folder

**Option 1: Use pre-generated URL (Fastest)**
```javascript
// Documents already have viewUrl when you fetch the folder
const { files } = await fetch('/api/files/MyCase/files').then(r => r.json());
window.open(files[0].viewUrl, '_blank'); // Opens document immediately
```

**Option 2: Get fresh URL with custom expiry**
```javascript
const { viewUrl } = await fetch(`/api/files/document/${fileId}/view?expiryMinutes=180`)
  .then(r => r.json());
window.open(viewUrl, '_blank');
```

---

## 📋 Common Use Cases

### 1. Display Folder Contents
```javascript
GET /api/files/:folderName/files

Response includes:
- previewUrl (15 min expiry)
- viewUrl (60 min expiry)
```

### 2. Open Document in New Tab
```javascript
// Click handler
const openDocument = (doc) => {
  window.open(doc.viewUrl, '_blank');
};
```

### 3. View Document in Modal/Dialog
```javascript
// React example
const [viewUrl, setViewUrl] = useState(null);

const viewDocument = async (fileId) => {
  const res = await fetch(`/api/files/document/${fileId}/view`);
  const { viewUrl } = await res.json();
  setViewUrl(viewUrl);
  setModalOpen(true);
};

return (
  <Modal open={modalOpen}>
    <iframe src={viewUrl} width="100%" height="800px" />
  </Modal>
);
```

### 4. Download Document
```javascript
const downloadDocument = (fileId, filename) => {
  const link = document.createElement('a');
  link.href = `/api/files/document/${fileId}/stream?download=true`;
  link.download = filename;
  link.click();
};
```

### 5. Share Document (Temporary Link)
```javascript
// Generate 24-hour link for sharing
const shareDocument = async (fileId) => {
  const res = await fetch(`/api/files/document/${fileId}/view?expiryMinutes=1440`);
  const { viewUrl, expiresIn } = await res.json();
  
  // Copy to clipboard
  navigator.clipboard.writeText(viewUrl);
  alert(`Link copied! Valid for ${expiresIn}`);
};
```

---

## 🎯 Which Endpoint to Use?

### Use `GET /:folderName/files` when:
- ✅ Loading folder contents
- ✅ Need to list all documents
- ✅ Want URLs included automatically
- ✅ Building document list UI

### Use `GET /document/:fileId/view` when:
- ✅ Need custom expiry time
- ✅ Want fresh URL for specific document
- ✅ Sharing document with others
- ✅ Need document metadata

### Use `GET /document/:fileId/stream` when:
- ✅ Embedding in iframe with auth
- ✅ Implementing download functionality
- ✅ Need server-side streaming
- ✅ Want inline display in browser

---

## 🔐 Authentication

All endpoints require JWT token in header:
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

## ⚡ Performance Tips

1. **Use pre-generated URLs**: `viewUrl` is already included in folder listing
2. **Cache wisely**: Signed URLs are valid for their expiry period
3. **Lazy load**: Only fetch documents when folder is opened
4. **Stream large files**: Use `/stream` endpoint for files >10MB

---

## 🐛 Common Issues & Solutions

### Issue: "Document not found"
**Solution:** Check if file exists in database and user has access
```javascript
// Verify document ownership
SELECT * FROM user_files WHERE id = ? AND user_id = ?
```

### Issue: "Signed URL expired"
**Solution:** Generate fresh URL
```javascript
// Get new URL
fetch(`/api/files/document/${fileId}/view?expiryMinutes=60`)
```

### Issue: "Cannot open document in iframe"
**Solution:** Some document types may be blocked by browser. Use `window.open()` instead
```javascript
// Instead of iframe, open in new tab
window.open(doc.viewUrl, '_blank');
```

---

## 📱 Frontend Component Examples

### React Document List Component
```jsx
function DocumentList({ folderName }) {
  const [documents, setDocuments] = useState([]);
  
  useEffect(() => {
    fetch(`/api/files/${folderName}/files`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setDocuments(data.files));
  }, [folderName]);
  
  return (
    <div>
      {documents.map(doc => (
        <div key={doc.id} onClick={() => window.open(doc.viewUrl, '_blank')}>
          <span>{doc.originalname}</span>
          <button>View</button>
        </div>
      ))}
    </div>
  );
}
```

### Vue Document Viewer
```vue
<template>
  <div>
    <div v-for="doc in documents" :key="doc.id" @click="openDocument(doc)">
      {{ doc.originalname }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return { documents: [] };
  },
  mounted() {
    this.fetchDocuments();
  },
  methods: {
    async fetchDocuments() {
      const res = await fetch(`/api/files/${this.folderName}/files`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      this.documents = data.files;
    },
    openDocument(doc) {
      window.open(doc.viewUrl, '_blank');
    }
  }
}
</script>
```

### Angular Document Service
```typescript
@Injectable()
export class DocumentService {
  constructor(private http: HttpClient) {}
  
  getDocuments(folderName: string) {
    return this.http.get(`/api/files/${folderName}/files`);
  }
  
  viewDocument(fileId: number, expiryMinutes: number = 60) {
    return this.http.get(`/api/files/document/${fileId}/view`, {
      params: { expiryMinutes }
    });
  }
  
  downloadDocument(fileId: number) {
    return this.http.get(`/api/files/document/${fileId}/stream`, {
      params: { download: true },
      responseType: 'blob'
    });
  }
}
```

---

## 🧪 Testing Checklist

- [ ] List folder documents - verify viewUrl and previewUrl present
- [ ] Click viewUrl - document opens in browser
- [ ] Get custom expiry URL - generates correctly
- [ ] Stream document - displays inline
- [ ] Download document - file downloads
- [ ] Expired URL - returns appropriate error
- [ ] Unauthorized access - returns 401/403
- [ ] Non-existent document - returns 404

---

## 📊 URL Expiry Guidelines

| Use Case | Recommended Expiry |
|----------|-------------------|
| Quick preview | 15 minutes |
| Active viewing session | 60 minutes |
| Sharing with team | 3-6 hours |
| Temporary public access | 24 hours |
| Long-term sharing | 7 days (max) |

---

## 🎨 UI/UX Best Practices

1. **Show loading state** while fetching documents
2. **Display file size** to set user expectations
3. **Show file type icon** for better recognition
4. **Add preview on hover** for quick viewing
5. **Provide both view and download options**
6. **Show expiry warning** for shared links
7. **Handle errors gracefully** with user-friendly messages

---

## 🔗 API Endpoints at a Glance

```
GET  /api/files/:folderName/files          → List documents with URLs
GET  /api/files/document/:fileId/view      → Get signed URL
GET  /api/files/document/:fileId/stream    → Stream document
```

All require: `Authorization: Bearer <token>`

---

## 💡 Pro Tips

1. **Pre-fetch URLs**: Load viewUrls when loading folder contents
2. **Open in new tab**: Better UX than embedding for most document types
3. **Use streaming for downloads**: Provides better control over download process
4. **Cache folder contents**: Reduce API calls for frequently accessed folders
5. **Handle mobile**: Consider responsive document viewer for mobile devices

---

**Need more help?** Check `DOCUMENT_VIEWING_API.md` for full documentation.



