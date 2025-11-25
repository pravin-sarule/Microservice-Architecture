# Visual Service - Run Commands

## Quick Start Commands

### 1. Navigate to Visual Service Directory
```bash
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"
```

### 2. Create Virtual Environment (First Time Only)
```bash
python3 -m venv venv
```

### 3. Activate Virtual Environment
```bash
source venv/bin/activate
```

### 4. Install Dependencies (First Time Only)
```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables
Edit the `.env` file and add your actual values:
```bash
nano .env
# or
vim .env
```

Required values:
- `GEMINI_API_KEY=your_actual_api_key`
- `JWT_SECRET=your_jwt_secret` (must match Gateway Service)
- `DOCUMENT_SERVICE_URL=http://localhost:8080`

### 6. Run the Service
```bash
python app.py
```

## Complete Setup Script (One-Time)

```bash
# Navigate to directory
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Edit .env file with your credentials
nano .env

# Run the service
python app.py
```

## Daily Usage (After Initial Setup)

```bash
# Navigate to directory
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"

# Activate virtual environment
source venv/bin/activate

# Run the service
python app.py
```

## Run in Background

```bash
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"
source venv/bin/activate
nohup python app.py > visual-service.log 2>&1 &
```

## Check if Service is Running

```bash
# Check health endpoint
curl http://localhost:8081/health

# Check test route
curl http://localhost:8081/api/test-route

# Check process
ps aux | grep "python.*app.py"
```

## Stop the Service

```bash
# Find the process
ps aux | grep "python.*app.py"

# Kill the process (replace PID with actual process ID)
kill <PID>

# Or kill all Python app.py processes
pkill -f "python.*app.py"
```

## Restart the Service

```bash
# Stop
pkill -f "python.*app.py"

# Start
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"
source venv/bin/activate
python app.py
```

## Troubleshooting Commands

### Check if dependencies are installed
```bash
source venv/bin/activate
python -c "import flask, google.generativeai, requests, jwt, dotenv; print('All dependencies OK')"
```

### Check environment variables
```bash
source venv/bin/activate
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('GEMINI_API_KEY:', 'SET' if os.getenv('GEMINI_API_KEY') else 'NOT SET'); print('DOCUMENT_SERVICE_URL:', os.getenv('DOCUMENT_SERVICE_URL')); print('JWT_SECRET:', 'SET' if os.getenv('JWT_SECRET') else 'NOT SET')"
```

### Check port availability
```bash
netstat -tuln | grep 8081
# or
lsof -i :8081
```

### View logs (if running in background)
```bash
tail -f visual-service.log
```

## Production Deployment

For production, use a WSGI server like Gunicorn:

```bash
# Install Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:8081 app:app
```

## Environment Variables Quick Reference

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
DOCUMENT_SERVICE_URL=http://localhost:8080
JWT_SECRET=your_jwt_secret

# Optional
PORT=8081
FLASK_DEBUG=False
```

