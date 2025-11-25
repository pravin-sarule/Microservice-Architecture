# Mind Map API Documentation

## Overview

The Mind Map API provides endpoints for generating, storing, and managing mind maps with user-specific expand/collapse state, similar to NotebookLM.

## Database Schema

### Tables

1. **mindmaps** - Stores mind map metadata
2. **mindmap_nodes** - Stores nodes in adjacency list format
3. **user_node_state** - Stores user-specific collapse state

See `database/migrations/create_mindmap_tables.sql` for schema details.

## API Endpoints

### 1. Generate Mind Map

**POST** `/api/visual/generate-mindmap`

Generates a mind map from a document and saves it to the database.

**Request Body:**
```json
{
  "file_id": "uuid",
  "prompt": "optional custom prompt",
  "session_id": "uuid (optional - links mindmap to a chat session)"
}
```

**Response (NotebookLM Format):**
```json
{
  "success": true,
  "mindmap_id": "uuid",
  "file_id": "uuid",
  "session_id": "uuid (if provided)",
  "document_name": "document.pdf",
  "data": {
    "id": "node-uuid",
    "label": "Central Theme",
    "isCollapsed": false,
    "children": [
      {
        "id": "child-uuid",
        "label": "Main Branch 1",
        "isCollapsed": false,
        "children": [
          {
            "id": "sub-uuid",
            "label": "Sub-branch",
            "isCollapsed": false,
            "children": []
          }
        ]
      }
    ]
  },
  "model_used": "gemini-1.5-flash",
  "generated_at": "2024-11-24T16:00:00",
  "user_id": 21
}
```

### 2. Get Mind Map

**GET** `/api/visual/mindmap?mindmap_id=uuid`  
**GET** `/api/visual/mindmap?session_id=uuid`

Retrieves a mind map with user's collapse state. Supports two query methods:

**Query Parameters:**
- `mindmap_id` (optional): Mind map ID
- `session_id` (optional): Chat session ID - **Use this when loading previous chats**

**Note:** When using `session_id`, this endpoint automatically fetches the complete mindmap structure for that session, making it perfect for displaying mindmaps when users open previous chat sessions.

**Response:**
```json
{
  "success": true,
  "mindmap_id": "uuid",
  "session_id": "uuid (if queried by session)",
  "data": {
    "id": "node-uuid",
    "label": "Central Theme",
    "isCollapsed": false,
    "children": [...]
  },
  "metadata": {
    "title": "Mind Map Title",
    "file_id": "uuid",
    "session_id": "uuid (if linked to session)",
    "created_at": "2024-11-24T16:00:00",
    "updated_at": "2024-11-24T16:00:00"
  }
}
```

**Response when no mindmap found for session:**
```json
{
  "success": true,
  "session_id": "uuid",
  "data": null,
  "message": "No mindmap found for this session"
}
```

### 3. Get All Mind Maps for File

**GET** `/api/visual/mindmaps?file_id=uuid&session_id=uuid`

Returns all mind maps associated with a file. Optionally filter by `session_id`.

**Query Parameters:**
- `file_id` (required): Document file ID
- `session_id` (optional): Filter mindmaps by specific chat session

**Response:**
```json
{
  "success": true,
  "file_id": "uuid",
  "session_id": "uuid (if provided)",
  "mindmaps": [
    {
      "id": "mindmap-uuid",
      "user_id": 21,
      "file_id": "uuid",
      "session_id": "uuid (if linked to session)",
      "title": "Mind Map Title",
      "created_at": "2024-11-24T16:00:00",
      "updated_at": "2024-11-24T16:00:00"
    }
  ]
}
```

### 3a. Get All Mind Maps for Session

**GET** `/api/visual/mindmaps/session?session_id=uuid`

Returns all mind maps associated with a specific chat session. Similar to how past chats are fetched by session.

**Query Parameters:**
- `session_id` (required): Chat session ID

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "mindmaps": [
    {
      "id": "mindmap-uuid",
      "user_id": 21,
      "file_id": "uuid",
      "session_id": "uuid",
      "title": "Mind Map Title",
      "created_at": "2024-11-24T16:00:00",
      "updated_at": "2024-11-24T16:00:00"
    }
  ]
}
```

### 4. Update Node Collapse State

**PUT/POST** `/api/visual/mindmap/node/state`

Updates user's collapse preference for a node.

**Request Body:**
```json
{
  "node_id": "uuid",
  "is_collapsed": true
}
```

**Response:**
```json
{
  "success": true,
  "node_id": "uuid",
  "is_collapsed": true
}
```

**Note:** To expand a node, set `is_collapsed: false` or DELETE the state (reverts to default).

### 5. Delete Mind Map

**DELETE** `/api/visual/mindmap/{mindmap_id}`

Deletes a mind map and all associated data.

**Response:**
```json
{
  "success": true,
  "message": "Mind map deleted successfully"
}
```

## Response Format (NotebookLM Style)

All mind map data follows this structure:

```json
{
  "id": "node-id",
  "label": "Node Text",
  "isCollapsed": false,
  "children": [
    {
      "id": "child-id",
      "label": "Child Text",
      "isCollapsed": false,
      "children": []
    }
  ]
}
```

### Key Features:

- **id**: Unique identifier for each node
- **label**: Display text for the node
- **isCollapsed**: User's collapse state (default: false/expanded)
- **children**: Array of child nodes (empty if collapsed or no children)

## State Management

### Default State
- All nodes are **expanded** by default
- No entries in `user_node_state` table = expanded

### Saving Collapse State
- **Collapse**: `PUT /api/visual/mindmap/node/state` with `is_collapsed: true`
- **Expand**: `PUT /api/visual/mindmap/node/state` with `is_collapsed: false` OR delete the state

### State Persistence
- State is user-specific
- Each user's preferences are stored separately
- State persists across sessions

## Session-Based Mindmaps

Mindmaps can now be linked to specific chat sessions, similar to how past chats are fetched. This allows users to:

- Generate mindmaps within a chat session context
- **Automatically retrieve and display mindmaps when loading previous chats**
- Filter mindmaps by both file and session

### Usage Example

1. **Generate mindmap with session:**
```json
POST /api/visual/generate-mindmap
{
  "file_id": "file-uuid",
  "session_id": "session-uuid",
  "prompt": "Create a mindmap of key concepts"
}
```

2. **Load mindmap when opening previous chat (RECOMMENDED):**
```bash
GET /api/visual/mindmap?session_id=session-uuid
```
This endpoint returns the **complete mindmap structure** with all nodes and user state, ready for immediate rendering. Use this when users open a previous chat session.

**Response includes:**
- Full node tree structure
- User's collapse/expand state for each node
- Metadata (title, file_id, timestamps)
- Formatted in NotebookLM format

3. **Fetch mindmap metadata for a session:**
```bash
GET /api/visual/mindmaps/session?session_id=session-uuid
```
Returns list of mindmap metadata (without full node structure).

4. **Fetch mindmaps for a file, filtered by session:**
```bash
GET /api/visual/mindmaps?file_id=file-uuid&session_id=session-uuid
```

### Backend Implementation Details

The load endpoint uses efficient data aggregation:

1. **Single Query with LEFT JOIN**: Retrieves mindmap metadata and all nodes with user state in one optimized query
2. **Tree Building**: Constructs the nested tree structure server-side
3. **Ready for Rendering**: Returns data in NotebookLM format, ready for immediate frontend display

**Database Query Pattern:**
```sql
SELECT 
    n.id, n.parent_id, n.content, n."order",
    COALESCE(uns.is_collapsed, false) as is_collapsed
FROM mindmap_nodes n
LEFT JOIN user_node_state uns 
    ON n.id = uns.node_id AND uns.user_id = :user_id
WHERE n.mindmap_id = :mindmap_id
ORDER BY n."order"
```

## Setup

1. **Run Database Migrations:**
```bash
# Initial schema
psql -d your_database -f database/migrations/create_mindmap_tables.sql

# Add session_id support
psql -d your_database -f database/migrations/add_session_id_to_mindmaps.sql
```

2. **Install Dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure Environment:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

4. **Start Service:**
```bash
python app.py
```

## Error Responses

All endpoints return standard error format:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Status Codes:**
- `200`: Success
- `400`: Bad Request (missing parameters)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `500`: Internal Server Error

