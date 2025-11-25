# Auto-Load Mindmap When Opening Past Chat - Complete Guide

This guide provides a **complete, ready-to-use solution** for automatically loading and displaying mindmaps when users open previous chat sessions.

## Problem

When opening a past chat session, the mindmap should automatically load and display, but currently it's not happening.

## Solution

Add automatic mindmap loading to your chat session component. The mindmap will load automatically whenever a chat session is opened.

---

## Step 1: Update API Service

First, ensure your API service has the correct function to fetch mindmap by session:

```typescript
// api/mindmapService.ts or services/mindmapService.ts

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_VISUAL_SERVICE_URL || 'http://localhost:8081';

// Get auth token from your auth system
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

/**
 * Get full mindmap structure by session ID
 * Use this when opening a previous chat session
 */
export const getMindmapBySession = async (sessionId: string): Promise<any> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await axios.get(
      `${API_BASE_URL}/api/visual/mindmap`,
      {
        params: {
          session_id: sessionId
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('Error fetching mindmap by session:', error);
    // Return null if no mindmap found (not an error)
    if (error.response?.status === 200 && error.response?.data?.data === null) {
      return { success: true, data: null };
    }
    throw error;
  }
};
```

---

## Step 2: Complete Chat Session Component

Here's a **complete, ready-to-use** chat session component that automatically loads mindmaps:

```typescript
// components/ChatSession.tsx or pages/ChatSession.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getMindmapBySession } from '../api/mindmapService';
import './ChatSession.css';

interface MindmapNode {
  id: string;
  label: string;
  isCollapsed: boolean;
  children: MindmapNode[];
}

interface MindmapResponse {
  success: boolean;
  session_id?: string;
  mindmap_id?: string;
  data: MindmapNode | null;
  metadata?: {
    title: string;
    file_id: string;
    session_id: string;
    created_at: string;
    updated_at: string;
  };
}

const ChatSession: React.FC = () => {
  // Get session ID from URL params or location state
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  
  // Try to get sessionId from multiple sources
  const currentSessionId = sessionId || 
                          location.state?.sessionId || 
                          new URLSearchParams(location.search).get('session_id');

  const [mindmapData, setMindmapData] = useState<MindmapNode | null>(null);
  const [mindmapMetadata, setMindmapMetadata] = useState<any>(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [mindmapError, setMindmapError] = useState<string | null>(null);

  // Automatically load mindmap when session opens
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMindmap(currentSessionId);
    }
  }, [currentSessionId]);

  /**
   * Automatically load mindmap for this session
   * This runs whenever a chat session is opened
   */
  const loadSessionMindmap = async (sessionId: string) => {
    setMindmapLoading(true);
    setMindmapError(null);
    
    try {
      console.log('Loading mindmap for session:', sessionId);
      
      const response: MindmapResponse = await getMindmapBySession(sessionId);
      
      if (response.success) {
        if (response.data) {
          // Mindmap found - set it for display
          console.log('Mindmap loaded successfully:', response.mindmap_id);
          setMindmapData(response.data);
          setMindmapMetadata(response.metadata);
        } else {
          // No mindmap for this session (not an error)
          console.log('No mindmap found for this session');
          setMindmapData(null);
          setMindmapMetadata(null);
        }
      } else {
        setMindmapError('Failed to load mindmap');
        setMindmapData(null);
      }
    } catch (error: any) {
      console.error('Error loading session mindmap:', error);
      setMindmapError(error.message || 'Failed to load mindmap');
      setMindmapData(null);
    } finally {
      setMindmapLoading(false);
    }
  };

  return (
    <div className="chat-session-container">
      {/* Your existing chat messages component */}
      <div className="chat-messages">
        {/* Your chat messages here */}
        <h2>Chat Session: {currentSessionId}</h2>
        {/* Messages component */}
      </div>

      {/* Mindmap Section - Automatically displays when available */}
      <div className="session-mindmap-section">
        <div className="mindmap-header">
          <h3>📊 Session Mindmap</h3>
          {mindmapMetadata && (
            <span className="mindmap-title">{mindmapMetadata.title}</span>
          )}
        </div>

        {mindmapLoading ? (
          <div className="mindmap-loading">
            <div className="spinner"></div>
            <span>Loading mindmap...</span>
          </div>
        ) : mindmapError ? (
          <div className="mindmap-error">
            ⚠️ {mindmapError}
          </div>
        ) : mindmapData ? (
          <div className="mindmap-container">
            <MindmapViewer data={mindmapData} />
          </div>
        ) : (
          <div className="mindmap-empty">
            No mindmap available for this session
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Mindmap Viewer Component
 * Renders the mindmap tree structure
 */
const MindmapViewer: React.FC<{ data: MindmapNode }> = ({ data }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderNode = (node: MindmapNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id) || !node.isCollapsed;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className={`mindmap-node level-${level}`}>
        <div
          className={`mindmap-node-content ${hasChildren ? 'has-children' : ''}`}
          onClick={() => hasChildren && toggleNode(node.id)}
          style={{ marginLeft: `${level * 20}px` }}
        >
          <span className="mindmap-node-label">{node.label}</span>
          {hasChildren && (
            <span className="mindmap-toggle">
              {isExpanded ? '−' : '+'}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mindmap-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mindmap-viewer">
      {renderNode(data)}
    </div>
  );
};

export default ChatSession;
```

---

## Step 3: Add CSS Styling

```css
/* components/ChatSession.css */

.chat-session-container {
  display: flex;
  flex-direction: row;
  height: 100vh;
  gap: 20px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.session-mindmap-section {
  width: 400px;
  border-left: 1px solid #e0e0e0;
  padding: 20px;
  background: #f9f9f9;
  overflow-y: auto;
}

.mindmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

.mindmap-header h3 {
  margin: 0;
  color: #333;
}

.mindmap-title {
  font-size: 12px;
  color: #666;
}

.mindmap-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.mindmap-error {
  padding: 15px;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  border-left: 4px solid #c33;
}

.mindmap-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
}

.mindmap-container {
  background: white;
  border-radius: 8px;
  padding: 15px;
}

.mindmap-viewer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mindmap-node {
  margin: 8px 0;
}

.mindmap-node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mindmap-node-content:hover {
  background: #e9ecef;
  border-color: #667eea;
}

.mindmap-node-content.has-children {
  font-weight: 600;
}

.mindmap-node-label {
  flex: 1;
  color: #333;
}

.mindmap-toggle {
  margin-left: 12px;
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: white;
}

.mindmap-children {
  margin-top: 8px;
  border-left: 2px solid #e9ecef;
  padding-left: 16px;
}

.mindmap-node.level-0 .mindmap-node-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 18px;
  font-weight: 700;
}
```

---

## Step 4: Integration with Existing Chat Component

If you already have a chat component, add this code to it:

### Option A: Add to Existing Component

```typescript
// In your existing ChatComponent.tsx

import { useEffect, useState } from 'react';
import { getMindmapBySession } from '../api/mindmapService';

// Add these state variables
const [mindmapData, setMindmapData] = useState(null);
const [mindmapLoading, setMindmapLoading] = useState(false);

// Add this useEffect (runs when component mounts or sessionId changes)
useEffect(() => {
  if (sessionId) {
    loadMindmap(sessionId);
  }
}, [sessionId]);

// Add this function
const loadMindmap = async (sessionId: string) => {
  setMindmapLoading(true);
  try {
    const response = await getMindmapBySession(sessionId);
    if (response.success && response.data) {
      setMindmapData(response.data);
    }
  } catch (error) {
    console.error('Failed to load mindmap:', error);
  } finally {
    setMindmapLoading(false);
  }
};

// Add mindmap display in your JSX
{/* Add this wherever you want to show the mindmap */}
{mindmapData && (
  <div className="session-mindmap">
    <MindmapViewer data={mindmapData} />
  </div>
)}
```

### Option B: Use a Hook

Create a reusable hook:

```typescript
// hooks/useSessionMindmap.ts

import { useState, useEffect } from 'react';
import { getMindmapBySession } from '../api/mindmapService';

export const useSessionMindmap = (sessionId: string | null) => {
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setMindmapData(null);
      return;
    }

    setLoading(true);
    setError(null);

    getMindmapBySession(sessionId)
      .then(response => {
        if (response.success && response.data) {
          setMindmapData(response.data);
        } else {
          setMindmapData(null);
        }
      })
      .catch(err => {
        console.error('Error loading mindmap:', err);
        setError(err.message);
        setMindmapData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  return { mindmapData, loading, error };
};

// Usage in your component:
const { mindmapData, loading, error } = useSessionMindmap(sessionId);
```

---

## Step 5: Verify Backend Endpoint

Test that the backend endpoint is working:

```bash
# Test the endpoint
curl -X GET "http://localhost:8081/api/visual/mindmap?session_id=YOUR_SESSION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "session_id": "uuid",
  "mindmap_id": "uuid",
  "data": {
    "id": "node-uuid",
    "label": "Central Theme",
    "isCollapsed": false,
    "children": [...]
  },
  "metadata": {...}
}
```

---

## Step 6: Debugging Checklist

If mindmap is not loading, check:

1. ✅ **Session ID is correct** - Log `sessionId` to console
2. ✅ **API endpoint is called** - Check browser Network tab
3. ✅ **Authentication token is valid** - Check Authorization header
4. ✅ **Backend returns data** - Check Network response
5. ✅ **Mindmap was generated with session_id** - Verify in database
6. ✅ **Component re-renders** - Check React DevTools

### Debug Code:

```typescript
// Add extensive logging
const loadSessionMindmap = async (sessionId: string) => {
  console.log('🔍 Loading mindmap for session:', sessionId);
  setMindmapLoading(true);
  
  try {
    const response = await getMindmapBySession(sessionId);
    console.log('📦 API Response:', response);
    
    if (response.success) {
      if (response.data) {
        console.log('✅ Mindmap loaded:', response.mindmap_id);
        setMindmapData(response.data);
      } else {
        console.log('ℹ️ No mindmap for this session');
      }
    } else {
      console.error('❌ API returned success: false');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    setMindmapLoading(false);
  }
};
```

---

## Complete Working Example

Here's a minimal complete example:

```typescript
// App.tsx or your main chat component

import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ChatPage = () => {
  const [sessionId, setSessionId] = useState('your-session-id');
  const [mindmap, setMindmap] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadMindmap();
    }
  }, [sessionId]);

  const loadMindmap = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        'http://localhost:8081/api/visual/mindmap',
        {
          params: { session_id: sessionId },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.data.success && response.data.data) {
        setMindmap(response.data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Chat Session: {sessionId}</h1>
      {loading && <p>Loading mindmap...</p>}
      {mindmap && (
        <div>
          <h2>Mindmap</h2>
          <pre>{JSON.stringify(mindmap, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
```

---

## Key Points

1. **Automatic Loading**: The `useEffect` hook automatically loads mindmap when `sessionId` changes
2. **Single Endpoint**: Use `GET /api/visual/mindmap?session_id={id}` for complete data
3. **Error Handling**: Gracefully handle cases where no mindmap exists
4. **Loading States**: Show loading indicator while fetching
5. **Re-render on Session Change**: Component automatically reloads when session changes

---

## Testing

1. Generate a mindmap with a session_id
2. Open that chat session
3. Mindmap should automatically appear
4. Check browser console for any errors
5. Check Network tab to verify API call

---

This solution ensures mindmaps automatically load whenever a past chat session is opened!

