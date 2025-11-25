# Backend Implementation Summary: Session-Based Mindmap Loading

## Overview

This implementation provides efficient data aggregation for loading mindmaps when users open previous chat sessions. The backend automatically fetches the complete mindmap structure with all nodes and user state in a single optimized query.

## Key Endpoint

### GET `/api/visual/mindmap?session_id={session_id}`

**Purpose:** Load complete mindmap structure when opening a previous chat session

**Features:**
- Single endpoint for complete mindmap data
- Efficient LEFT JOIN query for data aggregation
- Returns full node tree structure with user state
- Ready for immediate frontend rendering

## Implementation Details

### 1. Database Query Optimization

The implementation uses a single optimized query with LEFT JOIN to fetch all required data:

```sql
-- Step 1: Get mindmap metadata by session_id
SELECT id, user_id, file_id, title, session_id, created_at, updated_at
FROM mindmaps
WHERE session_id = :session_id AND user_id = :user_id
ORDER BY created_at DESC
LIMIT 1

-- Step 2: Get all nodes with user state using LEFT JOIN
SELECT 
    n.id,
    n.mindmap_id,
    n.parent_id,
    n.content,
    n."order",
    COALESCE(uns.is_collapsed, false) as is_collapsed
FROM mindmap_nodes n
LEFT JOIN user_node_state uns 
    ON n.id = uns.node_id AND uns.user_id = :user_id
WHERE n.mindmap_id = :mindmap_id
ORDER BY n."order"
```

**Benefits:**
- Single query for all nodes and user state
- Efficient LEFT JOIN prevents multiple queries
- Server-side tree building reduces frontend processing
- Returns data ready for rendering

### 2. Model Method: `get_mindmap_by_session()`

**Location:** `app/models/mindmap_model.py`

**Functionality:**
1. Finds mindmap by `session_id` and `user_id`
2. Retrieves all nodes with user collapse state using LEFT JOIN
3. Builds complete tree structure server-side
4. Returns formatted data ready for frontend

**Returns:**
```python
{
    'id': 'mindmap-uuid',
    'user_id': 21,
    'file_id': 'file-uuid',
    'title': 'Mind Map Title',
    'session_id': 'session-uuid',
    'created_at': datetime,
    'updated_at': datetime,
    'nodes': [/* nested tree structure */]
}
```

### 3. Controller Method: `get_mindmap_by_session()`

**Location:** `app/controllers/visual_controller.py`

**Functionality:**
1. Validates user authentication
2. Calls model method to get full mindmap structure
3. Formats response in NotebookLM format
4. Returns complete data ready for rendering

**Response Format:**
```json
{
  "success": true,
  "session_id": "uuid",
  "mindmap_id": "uuid",
  "data": {
    "id": "node-uuid",
    "label": "Central Theme",
    "isCollapsed": false,
    "children": [/* full tree structure */]
  },
  "metadata": {
    "title": "Mind Map Title",
    "file_id": "uuid",
    "session_id": "uuid",
    "created_at": "2024-11-24T16:00:00",
    "updated_at": "2024-11-24T16:00:00"
  }
}
```

### 4. Route Integration

**Location:** `app/routes/visual_routes.py`

The existing `/mindmap` route now supports both:
- `GET /api/visual/mindmap?mindmap_id={id}` - Get by mindmap ID
- `GET /api/visual/mindmap?session_id={id}` - Get by session ID (for loading previous chats)

The controller automatically detects which parameter is provided and routes accordingly.

## Data Flow

### When User Opens Previous Chat:

1. **Frontend Request:**
   ```
   GET /api/visual/mindmap?session_id={session_id}
   Authorization: Bearer {token}
   ```

2. **Backend Processing:**
   - Extract `user_id` from JWT token
   - Extract `session_id` from query params
   - Query mindmap metadata by session_id
   - Query all nodes with user state using LEFT JOIN
   - Build tree structure server-side
   - Format in NotebookLM format

3. **Response:**
   - Complete mindmap structure with all nodes
   - User's collapse/expand state for each node
   - Metadata (title, file_id, timestamps)
   - Ready for immediate frontend rendering

4. **Frontend Rendering:**
   - Receive complete data structure
   - Render mindmap immediately (no additional processing needed)
   - Display alongside chat messages

## Performance Optimizations

1. **Single Query:** LEFT JOIN retrieves all data in one database call
2. **Server-Side Tree Building:** Reduces frontend processing time
3. **Indexed Queries:** Uses existing indexes on `session_id` and `mindmap_id`
4. **Efficient State Aggregation:** COALESCE handles missing user state gracefully

## Error Handling

- **No Mindmap Found:** Returns `success: true` with `data: null` (not an error)
- **Unauthorized:** Returns 401 if user_id doesn't match
- **Invalid Session:** Returns 400 if session_id is missing
- **Database Errors:** Returns 500 with error details

## Testing

### Test Cases:

1. ✅ Load mindmap for existing session with mindmap
2. ✅ Load mindmap for session without mindmap (returns null data)
3. ✅ Load mindmap with user-specific collapse state
4. ✅ Verify LEFT JOIN returns correct user state
5. ✅ Verify tree structure is correctly built
6. ✅ Verify NotebookLM format is correct

## Migration Required

Run the database migration to add `session_id` column:

```bash
psql -d your_database -f database/migrations/add_session_id_to_mindmaps.sql
```

## Frontend Integration

See `FRONTEND_MINDMAP_SESSION_INTEGRATION.md` for complete frontend integration guide.

**Key Frontend Code:**
```typescript
// When loading previous chat session
const loadSessionMindmap = async (sessionId: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/visual/mindmap`,
    {
      params: { session_id: sessionId },
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (response.data.success && response.data.data) {
    // response.data.data contains complete mindmap structure
    // Ready for immediate rendering
    setMindmapData(response.data.data);
  }
};
```

## Summary

This implementation provides:
- ✅ Efficient data aggregation using LEFT JOIN
- ✅ Single endpoint for complete mindmap loading
- ✅ Server-side tree building for performance
- ✅ Automatic mindmap display when opening previous chats
- ✅ User state preservation (collapse/expand)
- ✅ Ready-to-render data format (NotebookLM)

The mindmap is now automatically fetched and displayed when users open previous chat sessions, providing a seamless user experience.

