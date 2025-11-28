# Frontend Integration Guide

This guide shows how to integrate the Visual Graphic Service into your React frontend to generate NotebookLM-style infographics.

## Overview

The service provides async infographic generation. The frontend should:
1. Submit a generation request (returns `job_id`)
2. Poll the status endpoint every 2-3 seconds
3. Display progress updates to the user
4. Show the final image when complete

## React Component Example

```javascript
import { useState, useEffect } from 'react';

export default function InfographicGenerator({ fileId, token }) {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  const generateInfographic = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const response = await fetch('http://localhost:8082/api/infographic/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: fileId }),
      });

      const data = await response.json();
      
      if (data.job_id) {
        setJobId(data.job_id);
        startPolling(data.job_id);
      } else {
        throw new Error(data.error || 'Failed to start generation');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const startPolling = (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8082/api/infographic/status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        setStatus({
          status: data.status,
          step: data.step,
          progress: data.progress || 0,
        });

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          setImageUrl(data.image_url);
          setLoading(false);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setError(data.error || 'Generation failed');
          setLoading(false);
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError(err.message);
        setLoading(false);
      }
    }, 2500); // Poll every 2.5 seconds

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      {!imageUrl && !loading && (
        <button
          onClick={generateInfographic}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
        >
          Generate Infographic
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-teal-600 rounded-full border-t-transparent mb-4"></div>
          <p className="text-gray-600 font-medium">{status?.step || 'Initializing...'}</p>
          {status?.progress && (
            <div className="w-full max-w-xs mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{status.progress}%</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {imageUrl && (
        <div className="mt-4">
          <img
            src={imageUrl}
            alt="Generated Infographic"
            className="w-full shadow-lg rounded"
          />
        </div>
      )}
    </div>
  );
}
```

## Using with Status Updates (NotebookLM Style)

For a more polished UX with status messages:

```javascript
const STATUS_MESSAGES = {
  pending: 'Initializing...',
  processing: 'Fetching document...',
  analyzing: 'Analyzing legal document with AI...',
  designing: 'Generating infographic image...',
  rendering: 'Finalizing visualization...',
  completed: 'Infographic generated successfully!',
  failed: 'Generation failed',
};

// Use in component:
<p className="text-gray-600 font-medium">
  {STATUS_MESSAGES[status?.status] || status?.step || 'Processing...'}
</p>
```

## Integration with Document Service

If you're already using the Document Service, you can integrate seamlessly:

```javascript
// In your document viewer component
function DocumentViewer({ documentId, token }) {
  return (
    <div>
      {/* Your document content */}
      
      {/* Add infographic generator */}
      <InfographicGenerator fileId={documentId} token={token} />
    </div>
  );
}
```

## API Configuration

Update the base URL for production:

```javascript
const API_BASE_URL = process.env.REACT_APP_VISUAL_GRAPHIC_URL || 'http://localhost:8082';

// Or via gateway:
const API_BASE_URL = process.env.REACT_APP_GATEWAY_URL || 'http://localhost:5000';
const ENDPOINT = `${API_BASE_URL}/visual-graphic/api/infographic/generate`;
```

## Error Handling

Handle common errors:

```javascript
const handleError = (error, data) => {
  if (error.response?.status === 401) {
    // Token expired - redirect to login
    window.location.href = '/login';
  } else if (error.response?.status === 404) {
    // Document not found
    setError('Document not found. Please check the document ID.');
  } else if (error.response?.status === 403) {
    // Access denied
    setError('You do not have access to this document.');
  } else {
    // Generic error
    setError(data?.error || error.message || 'An error occurred');
  }
};
```

## Polling Best Practices

1. **Poll Interval**: 2-3 seconds is optimal (not too frequent, not too slow)
2. **Timeout**: Set a maximum polling time (e.g., 5 minutes)
3. **Cleanup**: Always clear intervals on component unmount
4. **Retry Logic**: Implement retry for network errors

```javascript
useEffect(() => {
  if (!jobId) return;

  let pollCount = 0;
  const MAX_POLLS = 120; // 5 minutes max (120 * 2.5s)

  const pollInterval = setInterval(async () => {
    pollCount++;
    
    if (pollCount > MAX_POLLS) {
      clearInterval(pollInterval);
      setError('Generation timed out. Please try again.');
      setLoading(false);
      return;
    }

    // ... polling logic
  }, 2500);

  return () => clearInterval(pollInterval);
}, [jobId]);
```

## Example: Complete Integration

```javascript
import React, { useState, useEffect } from 'react';

const InfographicGenerator = ({ fileId, authToken }) => {
  const [state, setState] = useState({
    loading: false,
    jobId: null,
    status: null,
    imageUrl: null,
    error: null,
  });

  const API_URL = process.env.REACT_APP_VISUAL_GRAPHIC_URL || 'http://localhost:8082';

  const generate = async () => {
    setState({ ...state, loading: true, error: null });

    try {
      const res = await fetch(`${API_URL}/api/infographic/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: fileId }),
      });

      const data = await res.json();
      if (data.job_id) {
        setState({ ...state, jobId: data.job_id, loading: true });
        pollStatus(data.job_id);
      } else {
        throw new Error(data.error || 'Failed to start');
      }
    } catch (err) {
      setState({ ...state, loading: false, error: err.message });
    }
  };

  const pollStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/infographic/status/${jobId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();

        setState(prev => ({
          ...prev,
          status: {
            status: data.status,
            step: data.step,
            progress: data.progress,
          },
        }));

        if (data.status === 'completed') {
          clearInterval(interval);
          setState(prev => ({
            ...prev,
            loading: false,
            imageUrl: data.image_url,
          }));
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setState(prev => ({
            ...prev,
            loading: false,
            error: data.error || 'Generation failed',
          }));
        }
      } catch (err) {
        clearInterval(interval);
        setState(prev => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
      }
    }, 2500);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  return (
    <div className="infographic-generator">
      {/* Your UI here */}
    </div>
  );
};

export default InfographicGenerator;
```

## Next Steps

1. Add the component to your document viewer
2. Configure API URLs for your environment
3. Style the loading states to match your design
4. Add error boundaries for better error handling
5. Consider caching generated infographics



