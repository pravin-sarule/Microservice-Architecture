# Quick Start Guide

Get the Visual Graphic Service running in 5 minutes.

## 1. Install Dependencies

```bash
cd Visual-Graphic
npm install
```

## 2. Configure Environment

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

**Minimum required configuration:**
```env
GEMINI_API_KEY=your_key_here
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
DOCUMENT_SERVICE_URL=http://localhost:8080
JWT_SECRET=your_jwt_secret
```

## 3. Start Service

```bash
npm start
```

Service will run on `http://localhost:8082`

## 4. Test Generation

```bash
# Replace YOUR_TOKEN and FILE_ID
curl -X POST http://localhost:8082/api/infographic/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "FILE_ID"}'
```

Get the `job_id` from response, then check status:

```bash
curl http://localhost:8082/api/infographic/status/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 5. Frontend Integration

See `FRONTEND_INTEGRATION.md` for React component example.

## What's Next?

- ✅ Read `README.md` for full documentation
- ✅ Check `SETUP.md` for detailed GCP setup
- ✅ Review `IMPLEMENTATION_SUMMARY.md` for architecture details
- ✅ See `FRONTEND_INTEGRATION.md` for React integration

## Troubleshooting

**Service won't start?**
- Check all environment variables are set
- Verify Node.js version (v18+)
- Check port 8082 is available

**Generation fails?**
- Verify GCP credentials are correct
- Check Imagen 3 access is approved
- Ensure Document Service is running

**Need help?**
- Check logs for error messages
- Review `SETUP.md` troubleshooting section
- Verify API keys and permissions

## Key Files

- `index.js` - Main entry point
- `controllers/infographicController.js` - Request handling
- `services/geminiService.js` - Prompt generation (Architect)
- `services/imagenService.js` - Image generation (Artist)
- `services/documentService.js` - Document fetching
- `routes/infographicRoutes.js` - API endpoints

## API Endpoints

- `POST /api/infographic/generate` - Start generation (async)
- `GET /api/infographic/status/:job_id` - Check status
- `POST /api/infographic/generate-sync` - Generate synchronously
- `GET /health` - Health check

That's it! You're ready to generate infographics! 🎨



