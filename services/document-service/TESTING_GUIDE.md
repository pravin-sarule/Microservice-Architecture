# Testing Guide - Document Viewing Features

## Prerequisites
- Server running on port 8080 (or your configured PORT)
- Valid JWT authentication token
- At least one case folder with uploaded documents

## Getting Your Auth Token
```bash
# Login to get token (adjust endpoint as needed)
curl -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Save the token from response
export TOKEN="your_jwt_token_here"
```

---

## Test 1: Get Folder Contents with View URLs

### Request
```bash
curl -X GET "http://localhost:8080/api/files/MyCase/files" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

### Expected Response
```json
{
  "message": "Folder files fetched successfully.",
  "folder": {
    "id": 123,
    "name": "MyCase",
    "folder_path": "user_123/MyCase",
    "gcs_path": "user_123/MyCase/"
  },
  "files": [
    {
      "id": 456,
      "originalname": "document.pdf",
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

### Validation Checklist
- [ ] Response status is 200
- [ ] `files` array is present
- [ ] Each file has `previewUrl` property
- [ ] Each file has `viewUrl` property
- [ ] URLs start with `https://storage.googleapis.com/`
- [ ] Folder metadata is correct

---

## Test 2: View Specific Document

### Request (Default 60 min expiry)
```bash
curl -X GET "http://localhost:8080/api/files/document/456/view" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

### Request (Custom expiry - 2 hours)
```bash
curl -X GET "http://localhost:8080/api/files/document/456/view?expiryMinutes=120" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

### Expected Response
```json
{
  "message": "Document view URL generated successfully.",
  "document": {
    "id": 456,
    "name": "document.pdf",
    "mimetype": "application/pdf",
    "size": 1024000,
    "status": "completed",
    "folder_path": "user_123/MyCase",
    "created_at": "2025-11-12T10:30:00Z"
  },
  "viewUrl": "https://storage.googleapis.com/...",
  "expiresIn": "120 minutes"
}
```

### Validation Checklist
- [ ] Response status is 200
- [ ] `viewUrl` is present and valid
- [ ] `expiresIn` matches requested minutes
- [ ] Document metadata is correct

### Test in Browser
```bash
# Copy the viewUrl from response and open in browser
# Should display the document directly
```

---

## Test 3: Stream Document (Inline View)

### Request
```bash
curl -X GET "http://localhost:8080/api/files/document/456/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -o test_inline.pdf
```

### Expected Result
- File downloads to `test_inline.pdf`
- File size matches original document
- File opens correctly when double-clicked

### Validation Checklist
- [ ] Response status is 200
- [ ] File is downloaded successfully
- [ ] File size is correct
- [ ] File content is intact and viewable

### Test in Browser
```html
<!-- Create test HTML file -->
<!DOCTYPE html>
<html>
<body>
  <iframe 
    src="http://localhost:8080/api/files/document/456/stream" 
    width="100%" 
    height="600px">
  </iframe>
</body>
</html>
```

**Note:** Browser will need to send auth token via cookie or you'll need to use signed URL method.

---

## Test 4: Download Document

### Request
```bash
curl -X GET "http://localhost:8080/api/files/document/456/stream?download=true" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_document.pdf
```

### Expected Result
- File downloads with correct filename
- Content-Disposition header indicates attachment
- File is complete and valid

### Validation Checklist
- [ ] Response status is 200
- [ ] File downloads successfully
- [ ] File has correct extension
- [ ] File opens without errors

---

## Test 5: Error Handling

### Test 5a: Invalid Document ID
```bash
curl -X GET "http://localhost:8080/api/files/document/99999/view" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 404 with message "Document not found or you don't have permission to access it."

### Test 5b: No Authentication
```bash
curl -X GET "http://localhost:8080/api/files/document/456/view"
```

**Expected:** 401 Unauthorized

### Test 5c: Invalid Folder Name
```bash
curl -X GET "http://localhost:8080/api/files/NonExistentFolder/files" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 404 with message "Folder 'NonExistentFolder' not found for this user."

### Test 5d: Missing File ID
```bash
curl -X GET "http://localhost:8080/api/files/document//view" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 400 Bad Request

---

## Test 6: Integration Test (Complete Flow)

### Step 1: Create a Case
```bash
curl -X POST "http://localhost:8080/api/files/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_name": "Test Case",
    "case_number": "TC001",
    "party_name": "Test Party",
    "case_type": "Civil"
  }'
```

### Step 2: Upload Documents to Case
```bash
curl -X POST "http://localhost:8080/api/files/TestCase/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/path/to/document1.pdf" \
  -F "files=@/path/to/document2.pdf"
```

### Step 3: Get Folder Contents
```bash
curl -X GET "http://localhost:8080/api/files/TestCase/files" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.files[] | {id, name: .originalname, viewUrl}'
```

### Step 4: View First Document
```bash
# Extract first file ID from previous response
FILE_ID=$(curl -s -X GET "http://localhost:8080/api/files/TestCase/files" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.files[0].id')

# Get view URL
curl -X GET "http://localhost:8080/api/files/document/$FILE_ID/view" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.viewUrl'
```

### Step 5: Open in Browser
```bash
# Copy the viewUrl from previous step and open in browser
# Document should display correctly
```

---

## Performance Testing

### Test 7: Multiple Concurrent Requests
```bash
# Test concurrent document views
for i in {1..10}; do
  curl -X GET "http://localhost:8080/api/files/document/456/view" \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```

**Expected:** All requests complete successfully

### Test 8: Large File Streaming
```bash
# Upload a large file (>50MB)
curl -X POST "http://localhost:8080/api/files/TestCase/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/path/to/large_document.pdf"

# Stream it back
time curl -X GET "http://localhost:8080/api/files/document/<FILE_ID>/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -o large_test.pdf
```

**Expected:** File streams efficiently without timeouts

---

## Postman Testing

### Collection Setup
1. Create new collection "Document Viewing API"
2. Add collection variable: `baseUrl` = `http://localhost:8080`
3. Add collection variable: `token` = your JWT token
4. Add collection variable: `fileId` = test file ID
5. Add collection variable: `folderName` = test folder name

### Test Cases

#### 1. Get Folder Files
- **Method:** GET
- **URL:** `{{baseUrl}}/api/files/{{folderName}}/files`
- **Headers:** `Authorization: Bearer {{token}}`
- **Tests:**
```javascript
pm.test("Status is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Files have viewUrl", () => {
  const json = pm.response.json();
  pm.expect(json.files[0]).to.have.property('viewUrl');
});

pm.test("Files have previewUrl", () => {
  const json = pm.response.json();
  pm.expect(json.files[0]).to.have.property('previewUrl');
});
```

#### 2. View Document
- **Method:** GET
- **URL:** `{{baseUrl}}/api/files/document/{{fileId}}/view`
- **Headers:** `Authorization: Bearer {{token}}`
- **Tests:**
```javascript
pm.test("Status is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Response has viewUrl", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property('viewUrl');
});

pm.test("Response has document metadata", () => {
  const json = pm.response.json();
  pm.expect(json.document).to.have.property('id');
  pm.expect(json.document).to.have.property('name');
});
```

#### 3. Stream Document
- **Method:** GET
- **URL:** `{{baseUrl}}/api/files/document/{{fileId}}/stream`
- **Headers:** `Authorization: Bearer {{token}}`
- **Tests:**
```javascript
pm.test("Status is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Content-Type header exists", () => {
  pm.response.to.have.header('Content-Type');
});

pm.test("Content-Disposition header exists", () => {
  pm.response.to.have.header('Content-Disposition');
});
```

---

## Automated Testing Script

### Bash Script: `test_document_viewing.sh`
```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:8080"
TOKEN="your_jwt_token_here"
FOLDER_NAME="TestCase"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=$3
  
  echo -n "Testing: $name... "
  
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$url")
  
  if [ "$status" -eq "$expected_status" ]; then
    echo -e "${GREEN}PASSED${NC} (Status: $status)"
    ((PASSED++))
  else
    echo -e "${RED}FAILED${NC} (Expected: $expected_status, Got: $status)"
    ((FAILED++))
  fi
}

echo "Starting Document Viewing API Tests..."
echo "======================================="

# Test 1: Get folder files
test_endpoint \
  "Get Folder Files" \
  "$BASE_URL/api/files/$FOLDER_NAME/files" \
  200

# Test 2: View document (use actual file ID)
test_endpoint \
  "View Document" \
  "$BASE_URL/api/files/document/456/view" \
  200

# Test 3: Stream document
test_endpoint \
  "Stream Document" \
  "$BASE_URL/api/files/document/456/stream" \
  200

# Test 4: Invalid document (should fail)
test_endpoint \
  "Invalid Document ID" \
  "$BASE_URL/api/files/document/99999/view" \
  404

# Test 5: Invalid folder (should fail)
test_endpoint \
  "Invalid Folder" \
  "$BASE_URL/api/files/InvalidFolder/files" \
  404

echo "======================================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
```

**Run with:** `chmod +x test_document_viewing.sh && ./test_document_viewing.sh`

---

## Troubleshooting

### Issue: "Document not found"
**Check:**
1. File ID is correct
2. User has access to the document
3. Document exists in database: `SELECT * FROM user_files WHERE id = <fileId>`

### Issue: "Folder not found"
**Check:**
1. Folder name matches exactly (case-sensitive)
2. Folder exists for user
3. Check database: `SELECT * FROM user_files WHERE is_folder = true AND originalname = '<folderName>'`

### Issue: URLs don't work
**Check:**
1. GCS credentials are configured
2. Bucket name is correct
3. Files exist in GCS bucket
4. URL hasn't expired

### Issue: Streaming fails
**Check:**
1. File size isn't too large for single request
2. Network timeout settings
3. File exists in GCS
4. Content-Type header is set correctly

---

## Success Criteria

All tests should pass with:
- ✅ Folder contents return with viewUrl and previewUrl
- ✅ View endpoint generates valid signed URLs
- ✅ Signed URLs open documents in browser
- ✅ Stream endpoint delivers files correctly
- ✅ Download functionality works
- ✅ Error handling returns appropriate status codes
- ✅ Authentication is enforced on all endpoints
- ✅ User can only access their own documents

---

## Next Steps After Testing

1. **Update Frontend:** Integrate new endpoints in your UI
2. **Monitor Performance:** Track response times and error rates
3. **User Testing:** Get feedback from actual users
4. **Security Audit:** Review access controls and authentication
5. **Documentation:** Share with frontend team

---

**Testing Date:** November 12, 2025
**Status:** Ready for Testing ✅



