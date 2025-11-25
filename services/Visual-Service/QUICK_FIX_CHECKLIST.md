# Quick Fix Checklist: Auto-Load Mindmap on Past Chat

## Problem
Mindmap is not displaying when opening past chat sessions.

## Quick Fix Steps

### ✅ Step 1: Verify Mindmap Was Generated with Session ID

**Check if existing mindmaps have session_id:**

```sql
-- Run this in your database
SELECT id, session_id, title, created_at 
FROM mindmaps 
WHERE user_id = YOUR_USER_ID 
ORDER BY created_at DESC 
LIMIT 10;
```

**If session_id is NULL**, the mindmap wasn't linked to a session. You need to:
1. Regenerate the mindmap WITH session_id, OR
2. Update existing mindmaps to link them to sessions

### ✅ Step 2: Test Backend Endpoint Directly

Test if the endpoint works:

```bash
# Replace with your actual values
SESSION_ID="your-session-id-here"
TOKEN="your-jwt-token-here"

curl -X GET "http://localhost:8081/api/visual/mindmap?session_id=${SESSION_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "mindmap_id": "uuid",
  "data": { /* mindmap structure */ }
}
```

**If you get `"data": null`**, it means:
- No mindmap exists for that session_id
- The mindmap wasn't generated with that session_id

### ✅ Step 3: Add Auto-Load Code to Your Chat Component

**Find your chat component** (where past chats are displayed) and add this:

```typescript
// Add these imports
import { useEffect, useState } from 'react';
import axios from 'axios';

// In your component, add state:
const [mindmapData, setMindmapData] = useState(null);
const [mindmapLoading, setMindmapLoading] = useState(false);

// Add this useEffect - runs when sessionId changes
useEffect(() => {
  if (sessionId) {  // sessionId from your chat component
    loadMindmap(sessionId);
  }
}, [sessionId]);

// Add this function
const loadMindmap = async (sessionId: string) => {
  setMindmapLoading(true);
  try {
    const token = localStorage.getItem('token'); // or your token storage
    const response = await axios.get(
      'http://localhost:8081/api/visual/mindmap',  // or your API URL
      {
        params: { session_id: sessionId },
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Mindmap response:', response.data); // Debug log
    
    if (response.data.success && response.data.data) {
      setMindmapData(response.data.data);
      console.log('✅ Mindmap loaded successfully');
    } else {
      console.log('ℹ️ No mindmap for this session');
      setMindmapData(null);
    }
  } catch (error: any) {
    console.error('❌ Error loading mindmap:', error);
    setMindmapData(null);
  } finally {
    setMindmapLoading(false);
  }
};

// Add this to your JSX (wherever you want to show mindmap):
{mindmapLoading && <div>Loading mindmap...</div>}
{mindmapData && (
  <div className="session-mindmap">
    <h3>Session Mindmap</h3>
    <MindmapViewer data={mindmapData} />
  </div>
)}
```

### ✅ Step 4: Verify Session ID is Available

**Make sure your chat component has access to sessionId:**

```typescript
// Option 1: From URL params
const { sessionId } = useParams();

// Option 2: From route state
const location = useLocation();
const sessionId = location.state?.sessionId;

// Option 3: From props
const ChatComponent = ({ sessionId }: { sessionId: string }) => {
  // ...
};

// Option 4: From your chat state/context
const { currentSession } = useChatContext();
const sessionId = currentSession?.id;
```

**Add debug logging:**
```typescript
useEffect(() => {
  console.log('🔍 Current sessionId:', sessionId);
  if (sessionId) {
    loadMindmap(sessionId);
  } else {
    console.warn('⚠️ No sessionId available');
  }
}, [sessionId]);
```

### ✅ Step 5: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Open a past chat
4. Look for:
   - `🔍 Current sessionId: ...` - Should show the session ID
   - `Mindmap response: ...` - Should show API response
   - Any error messages

### ✅ Step 6: Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Open a past chat
4. Look for request to `/api/visual/mindmap?session_id=...`
5. Check:
   - Status code (should be 200)
   - Response body (should have `success: true`)
   - Request headers (should have Authorization)

### ✅ Step 7: Common Issues & Fixes

#### Issue: "No mindmap found for this session"
**Cause:** Mindmap wasn't generated with session_id
**Fix:** Regenerate mindmap WITH session_id:
```typescript
// When generating mindmap, include session_id
await generateMindmap(fileId, sessionId, prompt);
```

#### Issue: "Unauthorized" error
**Cause:** Token missing or invalid
**Fix:** Check token is being sent:
```typescript
const token = localStorage.getItem('token');
console.log('Token:', token ? 'Present' : 'Missing');
```

#### Issue: API call not happening
**Cause:** useEffect not running or sessionId is null
**Fix:** Add logging:
```typescript
useEffect(() => {
  console.log('useEffect triggered, sessionId:', sessionId);
  // ...
}, [sessionId]);
```

#### Issue: Mindmap loads but doesn't display
**Cause:** Rendering issue or data format
**Fix:** Check data structure:
```typescript
console.log('Mindmap data:', JSON.stringify(mindmapData, null, 2));
```

---

## Complete Minimal Example

Here's a complete minimal example you can copy-paste:

```typescript
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PastChatView = ({ sessionId }: { sessionId: string }) => {
  const [mindmap, setMindmap] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    
    setLoading(true);
    const token = localStorage.getItem('token');
    
    axios.get('http://localhost:8081/api/visual/mindmap', {
      params: { session_id: sessionId },
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.data.success && res.data.data) {
        setMindmap(res.data.data);
      }
    })
    .catch(err => console.error('Error:', err))
    .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div>
      <h2>Past Chat: {sessionId}</h2>
      {loading && <p>Loading mindmap...</p>}
      {mindmap && (
        <div>
          <h3>Mindmap</h3>
          <pre>{JSON.stringify(mindmap, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default PastChatView;
```

---

## Verification Checklist

- [ ] Mindmap was generated WITH session_id
- [ ] Backend endpoint returns data when tested with curl
- [ ] Frontend component has sessionId available
- [ ] useEffect runs when sessionId changes
- [ ] API call is made (check Network tab)
- [ ] Response has `success: true` and `data` is not null
- [ ] Mindmap state is updated
- [ ] Component re-renders with mindmap data

---

## Still Not Working?

1. **Check database:**
   ```sql
   SELECT * FROM mindmaps WHERE session_id = 'your-session-id';
   ```

2. **Check backend logs:**
   - Look for errors in Python console
   - Check if endpoint is being called

3. **Check frontend logs:**
   - Browser console for errors
   - Network tab for failed requests

4. **Test with Postman/Insomnia:**
   - Manually test the endpoint
   - Verify response format

5. **Verify session_id format:**
   - Should be a valid UUID
   - Should match the session_id used when generating mindmap

---

## Quick Test Script

Save this as `test-mindmap-load.js` and run with Node.js:

```javascript
const axios = require('axios');

const SESSION_ID = 'your-session-id';
const TOKEN = 'your-token';
const API_URL = 'http://localhost:8081/api/visual/mindmap';

axios.get(API_URL, {
  params: { session_id: SESSION_ID },
  headers: { 
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ Success!');
  console.log('Response:', JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
});
```

Run: `node test-mindmap-load.js`

