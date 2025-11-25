# Troubleshooting Visual Service

## Common Errors and Solutions

### 500 Error: "Failed to fetch document from document service"

This error occurs when the Visual Service cannot connect to or fetch data from the Document Service.

#### Check 1: Document Service is Running
```bash
# Check if Document Service is running
curl http://localhost:8080/health

# Should return: {"status": "healthy", ...}
```

#### Check 2: DOCUMENT_SERVICE_URL Configuration
```bash
# Check your .env file
cd Visual-Service
cat .env | grep DOCUMENT_SERVICE_URL

# Should be: DOCUMENT_SERVICE_URL=http://localhost:8080
# Or your production URL
```

#### Check 3: Network Connectivity
```bash
# Test connection from Visual Service to Document Service
curl -v http://localhost:8080/api/files/file/TEST_FILE_ID/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Check 4: Visual Service Logs
Check the Visual Service console output for detailed error messages:
- Connection errors
- Timeout errors
- Authentication errors
- Invalid file_id errors

### Common Issues

#### Issue 1: Document Service Not Running
**Solution:**
```bash
cd document-service
npm start
# or
node index.js
```

#### Issue 2: Wrong DOCUMENT_SERVICE_URL
**Solution:**
Update `.env` file:
```env
DOCUMENT_SERVICE_URL=http://localhost:8080
# Or if running on different port:
DOCUMENT_SERVICE_URL=http://localhost:YOUR_PORT
```

#### Issue 3: Invalid JWT Token
**Error:** "Access denied to document" or 403

**Solution:**
- Ensure JWT token is valid and not expired
- Token must match the JWT_SECRET in Document Service
- Token must include user_id in payload

#### Issue 4: File ID Not Found
**Error:** "Document not found" or 404

**Solution:**
- Verify the file_id exists in Document Service
- Ensure the file belongs to the authenticated user
- Check file processing status (must be "processed")

#### Issue 5: Connection Timeout
**Error:** "Request to document service timed out"

**Solution:**
- Check Document Service is responsive
- Increase timeout in document_service.py if needed
- Check network/firewall settings

### Debug Steps

1. **Check Visual Service Logs:**
   ```bash
   # Look for [DocumentService] and [VisualController] log messages
   ```

2. **Test Document Service Directly:**
   ```bash
   curl -X GET http://localhost:8080/api/files/file/YOUR_FILE_ID/complete \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Check Environment Variables:**
   ```bash
   cd Visual-Service
   source venv/bin/activate
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('DOCUMENT_SERVICE_URL:', os.getenv('DOCUMENT_SERVICE_URL'))"
   ```

4. **Verify Services are Running:**
   ```bash
   # Document Service
   curl http://localhost:8080/health
   
   # Visual Service
   curl http://localhost:8081/health
   
   # Gateway Service
   curl http://localhost:5000/health
   ```

### Error Response Codes

- **400**: Bad Request - Missing file_id or invalid request body
- **401**: Unauthorized - Missing or invalid JWT token
- **403**: Forbidden - User doesn't have access to the document
- **404**: Not Found - Document doesn't exist
- **500**: Internal Server Error - Service error (check logs)
- **503**: Service Unavailable - Cannot connect to Document Service
- **504**: Gateway Timeout - Request to Document Service timed out

