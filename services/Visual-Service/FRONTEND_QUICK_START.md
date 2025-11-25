# Frontend Quick Start - Mind Map Integration

## Quick Integration Steps

### 1. Add API Service Method

Add this to your existing API service file:

```javascript
// Generate mind map
async generateMindmap(fileId, prompt = null) {
  const response = await axios.post(
    `${API_URL}/visual/generate-mindmap`,
    { file_id: fileId, prompt },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data; // Returns { success, mindmap_id, data: {...} }
}

// Get mind map
async getMindmap(mindmapId) {
  const response = await axios.get(
    `${API_URL}/visual/mindmap`,
    { params: { mindmap_id: mindmapId }, headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

// Update node state
async updateNodeState(nodeId, isCollapsed) {
  await axios.put(
    `${API_URL}/visual/mindmap/node/state`,
    { node_id: nodeId, is_collapsed: isCollapsed },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
```

### 2. Update Your Mind Map Component

Replace your existing mind map generation call:

**Before:**
```javascript
const response = await fetch('/api/visual/generate-flowchart', {
  method: 'POST',
  body: JSON.stringify({ file_id: fileId })
});
```

**After:**
```javascript
const response = await mindmapService.generateMindmap(fileId);
// response.data contains the mind map in NotebookLM format:
// {
//   id: "node-id",
//   label: "Central Theme",
//   isCollapsed: false,
//   children: [...]
// }
```

### 3. Handle Response Format

The response structure is:

```javascript
{
  success: true,
  mindmap_id: "uuid",
  data: {
    id: "root-node-id",
    label: "Central Theme",
    isCollapsed: false,
    children: [
      {
        id: "child-id",
        label: "Main Branch",
        isCollapsed: false,
        children: [...]
      }
    ]
  }
}
```

### 4. Render Mind Map Nodes

```javascript
const renderNode = (node, level = 0) => {
  const isExpanded = !node.isCollapsed;
  
  return (
    <div key={node.id} className={`node level-${level}`}>
      <div onClick={() => handleToggle(node.id, node.isCollapsed)}>
        {node.label}
        {node.children?.length > 0 && (
          <span>{isExpanded ? '−' : '+'}</span>
        )}
      </div>
      {isExpanded && node.children?.map(child => renderNode(child, level + 1))}
    </div>
  );
};
```

### 5. Save Collapse State

```javascript
const handleToggle = async (nodeId, currentState) => {
  const newState = !currentState;
  
  // Update UI immediately
  updateLocalState(nodeId, newState);
  
  // Save to backend
  await mindmapService.updateNodeState(nodeId, newState);
};
```

## Key Changes Summary

1. **API Endpoint**: Use `/visual/generate-mindmap` instead of flowchart endpoint
2. **Response Format**: Data is in `response.data` (NotebookLM format)
3. **State Management**: Use `isCollapsed` property for expand/collapse
4. **Persistence**: Call `updateNodeState` when user toggles nodes
5. **Mind Map ID**: Save `mindmap_id` from response for later retrieval

## Minimal Example

```jsx
import { useState } from 'react';
import { mindmapService } from './services/mindmapService';

function MindMapView({ fileId }) {
  const [mindmap, setMindmap] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await mindmapService.generateMindmap(fileId);
      setMindmap(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = async (nodeId, isCollapsed) => {
    await mindmapService.updateNodeState(nodeId, !isCollapsed);
    // Update local state...
  };

  if (loading) return <div>Loading...</div>;
  if (!mindmap) return <button onClick={generate}>Generate Mind Map</button>;

  return <MindMapTree node={mindmap} onToggle={toggleNode} />;
}
```

## Testing

```javascript
// Test with a file ID
const testMindmap = async () => {
  const fileId = 'your-file-uuid';
  const result = await mindmapService.generateMindmap(fileId);
  console.log('Mind Map:', result.data);
};
```

