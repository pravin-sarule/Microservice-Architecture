# Frontend Integration Guide - Mind Map API

## Overview

This guide explains how to integrate the Mind Map API into your frontend application. The API provides endpoints for generating, retrieving, and managing mind maps with user-specific expand/collapse state.

## API Base URL

```
Development: http://localhost:8081/api/visual
Production: https://your-gateway-url/visual
```

## Required Changes

### 1. API Service/Client Setup

Create or update your API service file to include mind map endpoints.

#### Example: `services/mindmapService.js` or `services/visualService.js`

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const VISUAL_SERVICE_URL = `${API_BASE_URL}/visual`;

// Get auth token from your auth system
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const getHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json'
});

export const mindmapService = {
  /**
   * Generate a new mind map from a document
   * @param {string} fileId - Document file ID
   * @param {string} sessionId - Optional session ID to link mindmap to chat session
   * @param {string} prompt - Optional custom prompt
   * @returns {Promise} Mind map data in NotebookLM format
   */
  async generateMindmap(fileId, sessionId = null, prompt = null) {
    try {
      const response = await axios.post(
        `${VISUAL_SERVICE_URL}/generate-mindmap`,
        {
          file_id: fileId,
          session_id: sessionId,  // Link to chat session
          prompt: prompt
        },
        { headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error generating mind map:', error);
      throw error;
    }
  },

  /**
   * Get mind map by ID
   * @param {string} mindmapId - Mind map ID
   * @returns {Promise} Mind map data with user state
   */
  async getMindmap(mindmapId) {
    try {
      const response = await axios.get(
        `${VISUAL_SERVICE_URL}/mindmap`,
        {
          params: { mindmap_id: mindmapId },
          headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting mind map:', error);
      throw error;
    }
  },

  /**
   * Get all mind maps for a file
   * @param {string} fileId - Document file ID
   * @param {string} sessionId - Optional session ID to filter by session
   * @returns {Promise} List of mind maps
   */
  async getMindmapsByFile(fileId, sessionId = null) {
    try {
      const params = { file_id: fileId };
      if (sessionId) {
        params.session_id = sessionId;
      }
      const response = await axios.get(
        `${VISUAL_SERVICE_URL}/mindmaps`,
        {
          params: params,
          headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting mind maps:', error);
      throw error;
    }
  },

  /**
   * Get all mind maps for a specific chat session
   * @param {string} sessionId - Chat session ID
   * @returns {Promise} List of mind maps for the session
   */
  async getMindmapsBySession(sessionId) {
    try {
      const response = await axios.get(
        `${VISUAL_SERVICE_URL}/mindmaps/session`,
        {
          params: { session_id: sessionId },
          headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting mind maps by session:', error);
      throw error;
    }
  },

  /**
   * Update node collapse state
   * @param {string} nodeId - Node ID
   * @param {boolean} isCollapsed - Collapse state
   * @returns {Promise} Updated state
   */
  async updateNodeState(nodeId, isCollapsed) {
    try {
      const response = await axios.put(
        `${VISUAL_SERVICE_URL}/mindmap/node/state`,
        {
          node_id: nodeId,
          is_collapsed: isCollapsed
        },
        { headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating node state:', error);
      throw error;
    }
  },

  /**
   * Delete a mind map
   * @param {string} mindmapId - Mind map ID
   * @returns {Promise} Deletion result
   */
  async deleteMindmap(mindmapId) {
    try {
      const response = await axios.delete(
        `${VISUAL_SERVICE_URL}/mindmap/${mindmapId}`,
        { headers: getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting mind map:', error);
      throw error;
    }
  }
};
```

### 2. Mind Map Component

Create a React component to render the mind map.

#### Example: `components/MindMap/MindMap.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { mindmapService } from '../../services/mindmapService';
import './MindMap.css';

const MindMap = ({ fileId, mindmapId = null }) => {
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mindmapId) {
      loadMindmap(mindmapId);
    } else if (fileId) {
      generateMindmap(fileId);
    }
  }, [fileId, mindmapId]);

  const generateMindmap = async (fileId, sessionId = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await mindmapService.generateMindmap(fileId, sessionId);
      setMindmapData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate mind map');
    } finally {
      setLoading(false);
    }
  };

  const loadMindmap = async (mindmapId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await mindmapService.getMindmap(mindmapId);
      setMindmapData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load mind map');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNode = async (nodeId, currentState) => {
    const newState = !currentState;
    
    // Optimistic update
    const updateNodeState = (nodes) => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isCollapsed: newState };
        }
        if (node.children) {
          return { ...node, children: updateNodeState(node.children) };
        }
        return node;
      });
    };

    setMindmapData(prev => ({
      ...prev,
      children: updateNodeState(prev.children || [])
    }));

    // Save to backend
    try {
      await mindmapService.updateNodeState(nodeId, newState);
    } catch (err) {
      // Revert on error
      setMindmapData(prev => ({
        ...prev,
        children: updateNodeState(prev.children || [])
      }));
      console.error('Failed to save node state:', err);
    }
  };

  if (loading) {
    return <div className="mindmap-loading">Generating mind map...</div>;
  }

  if (error) {
    return <div className="mindmap-error">Error: {error}</div>;
  }

  if (!mindmapData) {
    return null;
  }

  return (
    <div className="mindmap-container">
      <MindMapNode
        node={mindmapData}
        onToggle={handleToggleNode}
        level={0}
      />
    </div>
  );
};

const MindMapNode = ({ node, onToggle, level }) => {
  const [isExpanded, setIsExpanded] = useState(!node.isCollapsed);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      const newState = !isExpanded;
      setIsExpanded(newState);
      onToggle(node.id, !newState); // isCollapsed is inverse of isExpanded
    }
  };

  return (
    <div className={`mindmap-node level-${level}`}>
      <div
        className={`mindmap-node-content ${hasChildren ? 'has-children' : ''}`}
        onClick={handleToggle}
      >
        <span className="mindmap-node-label">{node.label}</span>
        {hasChildren && (
          <span className="mindmap-toggle-icon">
            {isExpanded ? '−' : '+'}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="mindmap-children">
          {node.children.map((child) => (
            <MindMapNode
              key={child.id}
              node={child}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MindMap;
```

### 3. CSS Styling

#### Example: `components/MindMap/MindMap.css`

```css
.mindmap-container {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mindmap-node {
  margin: 8px 0;
}

.mindmap-node-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 200px;
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

.mindmap-toggle-icon {
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
  margin-left: 32px;
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

.mindmap-node.level-1 .mindmap-node-content {
  background: #e3f2fd;
  border-color: #2196f3;
}

.mindmap-node.level-2 .mindmap-node-content {
  background: #f3e5f5;
  border-color: #9c27b0;
}

.mindmap-loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.mindmap-error {
  padding: 20px;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  border-left: 4px solid #c33;
}
```

### 4. Update Existing Mind Map Component

If you already have a mind map component (like `MindmapControls.jsx`), update it:

#### Example Update:

```javascript
// In your existing MindmapControls.jsx or similar component

import { mindmapService } from '../services/mindmapService';

const generateMindmap = async (fileId) => {
  try {
    setLoading(true);
    setError(null);
    
    // Call the new API
    const response = await mindmapService.generateMindmap(fileId);
    
    // Response format:
    // {
    //   success: true,
    //   mindmap_id: "uuid",
    //   data: {
    //     id: "node-id",
    //     label: "Central Theme",
    //     isCollapsed: false,
    //     children: [...]
    //   }
    // }
    
    setMindmapData(response.data); // NotebookLM format
    setMindmapId(response.mindmap_id); // Save for later retrieval
    
  } catch (error) {
    console.error('Error generating mindmap:', error);
    setError(error.response?.data?.error || 'Failed to generate mind map');
  } finally {
    setLoading(false);
  }
};

// Handle node collapse/expand
const handleNodeToggle = async (nodeId, isCollapsed) => {
  try {
    await mindmapService.updateNodeState(nodeId, isCollapsed);
    // Update local state
    updateLocalNodeState(nodeId, isCollapsed);
  } catch (error) {
    console.error('Error updating node state:', error);
  }
};
```

### 5. Environment Variables

Add to your `.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
# or production URL
REACT_APP_API_URL=https://your-gateway-url
```

### 6. Response Format Handling

The API returns data in NotebookLM format:

```typescript
interface MindMapNode {
  id: string;
  label: string;
  isCollapsed: boolean;
  children: MindMapNode[];
}

interface MindMapResponse {
  success: boolean;
  mindmap_id: string;
  file_id: string;
  document_name: string;
  data: MindMapNode; // Root node with children
  model_used: string;
  generated_at: string;
  user_id: number;
}
```

### 7. State Management (Optional)

If using Redux or Context API:

```javascript
// actions/mindmapActions.js
export const generateMindmap = (fileId) => async (dispatch) => {
  dispatch({ type: 'MINDMAP_GENERATE_START' });
  try {
    const response = await mindmapService.generateMindmap(fileId);
    dispatch({
      type: 'MINDMAP_GENERATE_SUCCESS',
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: 'MINDMAP_GENERATE_ERROR',
      payload: error.message
    });
  }
};

export const updateNodeState = (nodeId, isCollapsed) => async (dispatch) => {
  try {
    await mindmapService.updateNodeState(nodeId, isCollapsed);
    dispatch({
      type: 'MINDMAP_NODE_STATE_UPDATE',
      payload: { nodeId, isCollapsed }
    });
  } catch (error) {
    console.error('Failed to update node state:', error);
  }
};
```

## Integration Checklist

- [ ] Create/update API service file with mind map endpoints
- [ ] Add authentication headers to API calls
- [ ] Create or update MindMap component
- [ ] Implement node rendering with expand/collapse
- [ ] Add CSS styling for mind map visualization
- [ ] Handle loading and error states
- [ ] Implement state persistence (save collapse state)
- [ ] Add environment variables for API URL
- [ ] Test with real file IDs
- [ ] Handle edge cases (empty mind maps, network errors)

## Example Usage

```jsx
import MindMap from './components/MindMap/MindMap';

function DocumentView({ fileId }) {
  return (
    <div>
      <h2>Document Mind Map</h2>
      <MindMap fileId={fileId} />
    </div>
  );
}
```

Or with existing mind map ID:

```jsx
<MindMap mindmapId="existing-mindmap-uuid" />
```

## Error Handling

```javascript
try {
  const response = await mindmapService.generateMindmap(fileId);
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    switch (error.response.status) {
      case 401:
        // Unauthorized - redirect to login
        break;
      case 404:
        // Document not found
        break;
      case 500:
        // Server error
        break;
      default:
        // Other errors
    }
  } else {
    // Network error
  }
}
```

## Session-Based Mindmaps

Mindmaps can now be linked to specific chat sessions. When loading a previous chat, fetch associated mindmaps:

```javascript
// When loading a chat session
const loadChatSession = async (sessionId) => {
  // Load chat messages...
  
  // Also load associated mindmaps
  const mindmapResponse = await mindmapService.getMindmapsBySession(sessionId);
  if (mindmapResponse.success && mindmapResponse.mindmaps.length > 0) {
    // Display mindmaps alongside chat
    setSessionMindmaps(mindmapResponse.mindmaps);
  }
};

// When generating a mindmap in a chat session
const generateMindmapInSession = async (fileId, sessionId) => {
  const response = await mindmapService.generateMindmap(fileId, sessionId);
  // Mindmap is now linked to the session
};
```

See `FRONTEND_MINDMAP_SESSION_INTEGRATION.md` for detailed session integration guide.

## Notes

1. **Authentication**: All endpoints require JWT token in Authorization header
2. **State Persistence**: Node collapse state is automatically saved per user
3. **Default State**: Nodes are expanded by default (isCollapsed: false)
4. **Optimistic Updates**: Update UI immediately, then sync with backend
5. **Error Recovery**: Revert UI changes if backend update fails
6. **Session Linking**: Always pass `session_id` when generating mindmaps in a chat session

