# Environment Variables Setup Guide

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your values:**
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Required variables to configure:**
   - `GEMINI_API_KEY` - Your Google Gemini API key
   - `JWT_SECRET` - Must match Gateway Service JWT secret
   - `DOCUMENT_SERVICE_URL` - URL of your Document Service

## Required Environment Variables

### 1. GEMINI_API_KEY (Required)
**Purpose:** API key for Google Gemini 1.5 Flash model

**How to get:**
1. Visit https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and paste it in `.env`

**Example:**
```env
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Security:** Keep this key secret! Never commit it to version control.

---

### 2. JWT_SECRET (Required)
**Purpose:** Secret key for JWT token verification

**Important:** This must match the `JWT_SECRET` in:
- Gateway Service
- Auth Service

**How to generate a secure secret:**
```bash
# Using OpenSSL
openssl rand -base64 32

# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Example:**
```env
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
```

**Security:** Use a strong, random string (at least 32 characters) in production.

---

### 3. DOCUMENT_SERVICE_URL (Required)
**Purpose:** URL of the Document Service API

**Local Development:**
```env
DOCUMENT_SERVICE_URL=http://localhost:8080
```

**Production:**
```env
DOCUMENT_SERVICE_URL=https://your-document-service-domain.com
```

**Note:** This is the base URL where your Document Service is running.

---

## Optional Environment Variables

### 4. PORT (Optional)
**Default:** `8081`

**Purpose:** Port number for the Visual Service

**When to change:**
- If port 8081 is already in use
- If deploying to a platform that requires a specific port

**Example:**
```env
PORT=8081
```

---

### 5. FLASK_DEBUG (Optional)
**Default:** `False`

**Purpose:** Enable Flask debug mode

**Development:**
```env
FLASK_DEBUG=True
```
- Enables auto-reload on code changes
- Shows detailed error messages
- **Never use in production!**

**Production:**
```env
FLASK_DEBUG=False
```
- More secure
- Better performance
- Generic error messages

---

## Environment-Specific Configuration

### Local Development
```env
GEMINI_API_KEY=your_gemini_api_key
DOCUMENT_SERVICE_URL=http://localhost:8080
JWT_SECRET=your_jwt_secret
PORT=8081
FLASK_DEBUG=True
```

### Production
```env
GEMINI_API_KEY=your_gemini_api_key
DOCUMENT_SERVICE_URL=https://document-service.yourdomain.com
JWT_SECRET=your_strong_production_jwt_secret
PORT=8081
FLASK_DEBUG=False
```

---

## Verification

### Check if environment variables are loaded:
```bash
# Start Python shell
python

# Check variables
import os
from dotenv import load_dotenv
load_dotenv()

print("GEMINI_API_KEY:", "SET" if os.getenv("GEMINI_API_KEY") else "NOT SET")
print("DOCUMENT_SERVICE_URL:", os.getenv("DOCUMENT_SERVICE_URL"))
print("JWT_SECRET:", "SET" if os.getenv("JWT_SECRET") else "NOT SET")
print("PORT:", os.getenv("PORT", "8081"))
```

### Test the service:
```bash
# Start the service
python app.py

# In another terminal, test health endpoint
curl http://localhost:8081/health
```

---

## Security Best Practices

1. **Never commit `.env` to version control**
   - `.env` is already in `.gitignore`
   - Use `.env.example` as a template

2. **Use strong secrets in production**
   - JWT_SECRET should be at least 32 characters
   - Use random, unpredictable strings

3. **Rotate secrets regularly**
   - Change JWT_SECRET periodically
   - Rotate API keys if compromised

4. **Use environment-specific values**
   - Different values for dev/staging/production
   - Never use production secrets in development

5. **Restrict API key permissions**
   - Limit Gemini API key to necessary operations only
   - Monitor API usage

---

## Troubleshooting

### Error: "GEMINI_API_KEY not found"
**Solution:** Make sure `.env` file exists and contains `GEMINI_API_KEY`

### Error: "JWT verification failed"
**Solution:** Ensure `JWT_SECRET` matches the one in Gateway Service

### Error: "Failed to connect to document service"
**Solution:** 
- Check `DOCUMENT_SERVICE_URL` is correct
- Verify Document Service is running
- Check network connectivity

### Error: "Port already in use"
**Solution:** Change `PORT` in `.env` to an available port

---

## Docker/Cloud Deployment

For Docker or cloud platforms (Heroku, AWS, GCP, etc.):

1. Set environment variables in your platform's dashboard
2. Don't use `.env` file in production
3. Use platform's secret management:
   - AWS: Secrets Manager
   - GCP: Secret Manager
   - Heroku: Config Vars
   - Docker: Environment variables in docker-compose.yml

**Example for docker-compose.yml:**
```yaml
services:
  visual-service:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DOCUMENT_SERVICE_URL=${DOCUMENT_SERVICE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=8081
      - FLASK_DEBUG=False
```

---

## Support

If you encounter issues:
1. Check all required variables are set
2. Verify values are correct (no extra spaces, quotes, etc.)
3. Ensure Document Service is accessible
4. Check service logs for detailed error messages

