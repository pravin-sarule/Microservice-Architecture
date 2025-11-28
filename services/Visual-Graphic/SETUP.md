# Setup Guide - Visual Graphic Service

Complete setup instructions for the Visual Graphic Service.

## Prerequisites

### 1. Google Cloud Platform Setup

1. **Create or select a GCP Project**
   ```bash
   gcloud projects create your-project-id --name="Visual Graphic Service"
   ```

2. **Enable Required APIs**
   ```bash
   gcloud services enable aiplatform.googleapis.com --project=your-project-id
   gcloud services enable generativelanguage.googleapis.com --project=your-project-id
   ```

3. **Create Service Account**
   ```bash
   gcloud iam service-accounts create visual-graphic-sa \
     --display-name="Visual Graphic Service Account" \
     --project=your-project-id
   ```

4. **Grant Permissions**
   ```bash
   # Grant Vertex AI permissions
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:visual-graphic-sa@your-project-id.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   # Grant Service Account Token Creator (for authentication)
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:visual-graphic-sa@your-project-id.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```

5. **Create and Download Key**
   ```bash
   gcloud iam service-accounts keys create ~/visual-graphic-key.json \
     --iam-account=visual-graphic-sa@your-project-id.iam.gserviceaccount.com \
     --project=your-project-id
   ```

### 2. Gemini API Setup

1. **Get Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

### 3. Request Imagen 3 Access

Imagen 3 access may need to be requested:
- Go to [Vertex AI Workbench](https://console.cloud.google.com/vertex-ai)
- Request access to Imagen 3 model
- Wait for approval (usually 24-48 hours)

## Installation Steps

### 1. Clone and Install

```bash
cd Visual-Graphic
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Server
PORT=8082
NODE_ENV=development

# JWT (must match other services)
JWT_SECRET=your_jwt_secret_here

# Document Service
DOCUMENT_SERVICE_URL=http://localhost:8080

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud Platform
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Google Cloud Credentials
GOOGLE_APPLICATION_CREDENTIALS=/path/to/visual-graphic-key.json
```

### 3. Set Up Authentication

**Option A: Service Account Key File (Recommended for Local)**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/visual-graphic-key.json"
```

**Option B: Application Default Credentials (Recommended for Cloud)**
```bash
gcloud auth application-default login
```

### 4. Verify Setup

```bash
# Test the service starts
npm start

# In another terminal, test the health endpoint
curl http://localhost:8082/health
```

## Testing

### Test Document Service Connection

```bash
# Replace with your JWT token and file ID
curl -X GET \
  http://localhost:8082/api/infographic/test-document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "your-file-id"}'
```

### Test Infographic Generation

1. **Start Generation (Async)**
```bash
curl -X POST \
  http://localhost:8082/api/infographic/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "your-file-id"}'
```

Response:
```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "pending"
}
```

2. **Check Status**
```bash
curl -X GET \
  http://localhost:8082/api/infographic/status/JOB_ID_HERE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Troubleshooting

### "Vertex AI not configured"
- Check `GCP_PROJECT_ID` is set correctly
- Verify `GOOGLE_APPLICATION_CREDENTIALS` points to valid key file
- Ensure service account has proper permissions

### "Gemini API not configured"
- Verify `GEMINI_API_KEY` is set in `.env`
- Check API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

### "Document not found"
- Verify `DOCUMENT_SERVICE_URL` is correct
- Ensure Document Service is running
- Check JWT token is valid

### Image generation fails
- Verify Vertex AI API is enabled in GCP project
- Check Imagen 3 access is approved
- Review GCP service account permissions

### Text rendering issues in images
- Ensure using Imagen 3 (`imagegeneration@006`)
- Check prompt includes text rendering instructions
- Verify prompt is clear and structured

## Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=8082

# Use environment variables or secret management service
GEMINI_API_KEY=${GEMINI_API_KEY}
GCP_PROJECT_ID=${GCP_PROJECT_ID}
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Or use Workload Identity in GKE/Cloud Run
```

### Cloud Run Deployment

```bash
# Build Docker image
docker build -t gcr.io/your-project-id/visual-graphic:latest .

# Push to GCR
docker push gcr.io/your-project-id/visual-graphic:latest

# Deploy to Cloud Run
gcloud run deploy visual-graphic \
  --image gcr.io/your-project-id/visual-graphic:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars GCP_PROJECT_ID=your-project-id \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --service-account visual-graphic-sa@your-project-id.iam.gserviceaccount.com
```

## Next Steps

1. ✅ Complete setup
2. ✅ Test with a sample document
3. ✅ Integrate with frontend (see `FRONTEND_INTEGRATION.md`)
4. ✅ Set up monitoring and logging
5. ✅ Configure auto-scaling for production



