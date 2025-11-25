# Mind Map Feature Setup Guide

## Overview

The Visual Service now supports generating and storing mind maps with user-specific expand/collapse state, similar to NotebookLM.

## Setup Steps

### 1. Install Database Dependencies

```bash
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"
source venv/bin/activate
pip install psycopg2-binary==2.9.9
```

### 2. Run Database Migration

Create the required tables in your PostgreSQL database:

```bash
psql -d your_database_name -f database/migrations/create_mindmap_tables.sql
```

Or manually run the SQL from `database/migrations/create_mindmap_tables.sql`

### 3. Configure Environment Variables

Add to your `.env` file:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### 4. Restart Visual Service

```bash
# Stop current service (Ctrl+C)
# Then restart:
cd "/home/admin3620/Desktop/Microservice Architecture Backend/services/Visual-Service"
source venv/bin/activate
python app.py
```

## Database Schema

The system uses three tables:

1. **mindmaps** - Stores mind map metadata
2. **mindmap_nodes** - Stores nodes in adjacency list format
3. **user_node_state** - Stores user-specific collapse preferences

## API Endpoints

### Generate Mind Map
```
POST /api/visual/generate-mindmap
```

### Get Mind Map
```
GET /api/visual/mindmap?mindmap_id=uuid
```

### Get All Mind Maps for File
```
GET /api/visual/mindmaps?file_id=uuid
```

### Update Node State
```
PUT /api/visual/mindmap/node/state
```

### Delete Mind Map
```
DELETE /api/visual/mindmap/{mindmap_id}
```

## Response Format

All responses follow NotebookLM format:

```json
{
  "id": "node-id",
  "label": "Node Text",
  "isCollapsed": false,
  "children": [...]
}
```

See `MINDMAP_API.md` for complete API documentation.

## Testing

After setup, test the endpoint:

```bash
curl -X POST http://localhost:8081/api/visual/generate-mindmap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "your-file-uuid"}'
```

## Troubleshooting

### Database Connection Error
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running
- Check database credentials

### Tables Not Found
- Run the migration SQL script
- Verify table creation: `\dt` in psql

### Import Errors
- Ensure `psycopg2-binary` is installed
- Activate virtual environment before running

