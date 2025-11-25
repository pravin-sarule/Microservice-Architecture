# Frontend Integration Guide: Session-Based Mindmaps

This guide explains how to integrate session-based mindmap functionality into your frontend application, allowing mindmaps to be stored and fetched per chat session, similar to how past chats are handled.

## Overview

Mindmaps can now be linked to specific chat sessions. When a user loads a previous chat session, the associated mindmaps will also be fetched and displayed automatically.

## API Endpoints

### 1. Generate Mindmap with Session
**POST** `/api/visual/generate-mindmap`

### 2. Fetch Full Mindmap by Session (RECOMMENDED)
**GET** `/api/visual/mindmap?session_id={sessionId}`

Returns the complete mindmap structure with all nodes and user state, ready for immediate rendering. Use this when loading previous chat sessions.

### 2a. Fetch Mindmap Metadata by Session
**GET** `/api/visual/mindmaps/session?session_id={sessionId}`

Returns list of mindmap metadata (without full node structure).

### 3. Fetch Mindmaps by File (with optional session filter)
**GET** `/api/visual/mindmaps?file_id={fileId}&session_id={sessionId}`

---

## Integration Steps

### Step 1: Update Mindmap Generation

When generating a mindmap, include the `session_id` from the current chat session.

#### React/TypeScript Example:

```typescript
// types.ts
interface GenerateMindmapRequest {
  file_id: string;
  session_id?: string;  // Add session_id
  prompt?: string;
}

interface MindmapResponse {
  success: boolean;
  mindmap_id: string;
  file_id: string;
  session_id?: string;  // Response includes session_id
  document_name: string;
  data: MindmapNode;
  model_used: string;
  generated_at: string;
  user_id: number;
}

// api/mindmapService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_VISUAL_SERVICE_URL || 'http://localhost:8081';

export const generateMindmap = async (
  fileId: string,
  sessionId?: string,  // Add sessionId parameter
  prompt?: string,
  token: string
): Promise<MindmapResponse> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/visual/generate-mindmap`,
      {
        file_id: fileId,
        session_id: sessionId,  // Include session_id
        prompt: prompt
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error generating mindmap:', error);
    throw error;
  }
};
```

#### Usage in Component:

```typescript
// components/MindmapGenerator.tsx
import { useState } from 'react';
import { generateMindmap } from '../api/mindmapService';
import { useAuth } from '../hooks/useAuth';
import { useChatSession } from '../hooks/useChatSession';  // Your chat session hook

const MindmapGenerator = ({ fileId }: { fileId: string }) => {
  const { token } = useAuth();
  const { currentSessionId } = useChatSession();  // Get current session ID
  const [loading, setLoading] = useState(false);
  const [mindmap, setMindmap] = useState<MindmapResponse | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Pass currentSessionId when generating mindmap
      const result = await generateMindmap(
        fileId,
        currentSessionId,  // Link mindmap to current session
        undefined,
        token
      );
      setMindmap(result);
    } catch (error) {
      console.error('Failed to generate mindmap:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Mindmap'}
      </button>
      {mindmap && <MindmapViewer data={mindmap.data} />}
    </div>
  );
};
```

---

### Step 2: Fetch Mindmaps When Loading Previous Chat

When loading a previous chat session, fetch the associated mindmaps.

#### API Service:

```typescript
// api/mindmapService.ts

export const getMindmapBySession = async (
  sessionId: string,
  token: string
): Promise<MindmapResponse> => {
  try {
    // This endpoint returns the full mindmap structure with nodes and user state
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
  } catch (error) {
    console.error('Error fetching mindmap by session:', error);
    throw error;
  }
};

// Alternative: Get mindmap metadata only (list of mindmaps for session)
export const getMindmapsBySession = async (
  sessionId: string,
  token: string
): Promise<MindmapListResponse> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/visual/mindmaps/session`,
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
  } catch (error) {
    console.error('Error fetching mindmaps by session:', error);
    throw error;
  }
};

export const getMindmapsByFile = async (
  fileId: string,
  sessionId?: string,  // Optional session filter
  token: string
): Promise<MindmapListResponse> => {
  try {
    const params: Record<string, string> = { file_id: fileId };
    if (sessionId) {
      params.session_id = sessionId;
    }

    const response = await axios.get(
      `${API_BASE_URL}/api/visual/mindmaps`,
      {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching mindmaps by file:', error);
    throw error;
  }
};

interface MindmapListResponse {
  success: boolean;
  session_id?: string;
  file_id?: string;
  mindmaps: MindmapMetadata[];
}

interface MindmapMetadata {
  id: string;
  user_id: number;
  file_id: string;
  session_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
}
```

#### Chat Session Component:

```typescript
// components/ChatSession.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMindmapsBySession } from '../api/mindmapService';
import { useAuth } from '../hooks/useAuth';
import { MindmapViewer } from './MindmapViewer';

const ChatSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { token } = useAuth();
  const [mindmapData, setMindmapData] = useState<MindmapNode | null>(null);
  const [mindmapMetadata, setMindmapMetadata] = useState<MindmapMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch mindmap when session loads
  useEffect(() => {
    if (sessionId) {
      loadSessionMindmap(sessionId);
    }
  }, [sessionId]);

  const loadSessionMindmap = async (sessionId: string) => {
    setLoading(true);
    try {
      // Use the session-based endpoint to get full mindmap structure
      const response = await getMindmapBySession(sessionId, token);
      if (response.success && response.data) {
        // response.data contains the full mindmap structure ready for rendering
        setMindmapData(response.data);
        setMindmapMetadata(response.metadata);
      } else {
        // No mindmap for this session
        setMindmapData(null);
      }
    } catch (error) {
      console.error('Failed to load session mindmap:', error);
      setMindmapData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-session">
      <div className="chat-messages">
        {/* Your chat messages component */}
      </div>
      
      {/* Display associated mindmap automatically */}
      <div className="session-mindmap">
        <h3>Session Mindmap</h3>
        {loading ? (
          <div>Loading mindmap...</div>
        ) : !mindmapData ? (
          <div>No mindmap for this session</div>
        ) : (
          <MindmapViewer data={mindmapData} />
        )}
      </div>
    </div>
  );
};
```

---

### Step 3: Update Chat History Component

When displaying chat history, show which chats have associated mindmaps.

```typescript
// components/ChatHistory.tsx
import { useEffect, useState } from 'react';
import { getMindmapsBySession } from '../api/mindmapService';
import { useAuth } from '../hooks/useAuth';

interface ChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  hasMindmap?: boolean;  // Add flag for mindmap presence
}

const ChatHistory = () => {
  const { token } = useAuth();
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    // Load your chat history
    const chatList = await fetchChatHistory(); // Your existing function
    
    // Check which chats have mindmaps
    const chatsWithMindmaps = await Promise.all(
      chatList.map(async (chat) => {
        try {
          const mindmapResponse = await getMindmapsBySession(chat.id, token);
          return {
            ...chat,
            hasMindmap: mindmapResponse.mindmaps.length > 0
          };
        } catch (error) {
          return { ...chat, hasMindmap: false };
        }
      })
    );
    
    setChats(chatsWithMindmaps);
  };

  return (
    <div className="chat-history">
      <h2>Chat History</h2>
      {chats.map((chat) => (
        <div key={chat.id} className="chat-item">
          <h3>{chat.title}</h3>
          <span>{new Date(chat.createdAt).toLocaleDateString()}</span>
          {chat.hasMindmap && (
            <span className="mindmap-badge">📊 Has Mindmap</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

### Step 4: Vue.js Example

```vue
<!-- components/MindmapGenerator.vue -->
<template>
  <div class="mindmap-generator">
    <button @click="generateMindmap" :disabled="loading">
      {{ loading ? 'Generating...' : 'Generate Mindmap' }}
    </button>
    <MindmapViewer v-if="mindmap" :data="mindmap.data" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { generateMindmap } from '@/api/mindmapService';

const props = defineProps<{
  fileId: string;
}>();

const authStore = useAuthStore();
const chatStore = useChatStore();
const loading = ref(false);
const mindmap = ref(null);

const generateMindmap = async () => {
  loading.value = true;
  try {
    const result = await generateMindmap(
      props.fileId,
      chatStore.currentSessionId,  // Use current session ID
      undefined,
      authStore.token
    );
    mindmap.value = result;
  } catch (error) {
    console.error('Failed to generate mindmap:', error);
  } finally {
    loading.value = false;
  }
};
</script>
```

---

### Step 5: Angular Example

```typescript
// services/mindmap.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MindmapService {
  private apiUrl = 'http://localhost:8081/api/visual';

  constructor(private http: HttpClient) {}

  generateMindmap(
    fileId: string,
    sessionId?: string,
    prompt?: string
  ): Observable<MindmapResponse> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<MindmapResponse>(
      `${this.apiUrl}/generate-mindmap`,
      {
        file_id: fileId,
        session_id: sessionId,
        prompt: prompt
      },
      { headers }
    );
  }

  getMindmapsBySession(sessionId: string): Observable<MindmapListResponse> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<MindmapListResponse>(
      `${this.apiUrl}/mindmaps/session`,
      {
        params: { session_id: sessionId },
        headers
      }
    );
  }

  private getToken(): string {
    // Your token retrieval logic
    return localStorage.getItem('token') || '';
  }
}

// components/chat-session.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MindmapService } from '../services/mindmap.service';

@Component({
  selector: 'app-chat-session',
  template: `
    <div class="chat-session">
      <div class="chat-messages"><!-- Chat messages --></div>
      <div class="session-mindmaps">
        <h3>Session Mindmaps</h3>
        <div *ngIf="loading">Loading...</div>
        <div *ngIf="!loading && mindmaps.length === 0">
          No mindmaps for this session
        </div>
        <div *ngFor="let mindmap of mindmaps" class="mindmap-item">
          <h4>{{ mindmap.title }}</h4>
        </div>
      </div>
    </div>
  `
})
export class ChatSessionComponent implements OnInit {
  sessionId: string | null = null;
  mindmaps: any[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private mindmapService: MindmapService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.sessionId = params['sessionId'];
      if (this.sessionId) {
        this.loadSessionMindmaps();
      }
    });
  }

  loadSessionMindmaps() {
    if (!this.sessionId) return;
    
    this.loading = true;
    this.mindmapService.getMindmapsBySession(this.sessionId).subscribe({
      next: (response) => {
        if (response.success) {
          this.mindmaps = response.mindmaps;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load mindmaps:', error);
        this.loading = false;
      }
    });
  }
}
```

---

## Key Points to Remember

1. **Always pass `session_id` when generating mindmaps** - This links the mindmap to the current chat session
2. **Fetch mindmaps when loading previous chats** - Use the session-based endpoint to retrieve associated mindmaps
3. **Handle cases where session_id is null** - Some mindmaps may not have a session (backward compatibility)
4. **Display mindmap indicators** - Show users which chats have associated mindmaps
5. **Error handling** - Gracefully handle cases where mindmaps fail to load

## Example Flow

1. User starts a chat session → `sessionId` is created
2. User generates a mindmap → Include `sessionId` in the request
3. User closes chat → Session is saved
4. User loads previous chat → **Automatically fetch and display mindmap** using `GET /api/visual/mindmap?session_id={sessionId}`
5. Mindmap is automatically rendered alongside chat messages with full structure and user state

## Testing Checklist

- [ ] Generate mindmap with session_id
- [ ] Generate mindmap without session_id (backward compatibility)
- [ ] Fetch mindmaps by session
- [ ] Fetch mindmaps by file with session filter
- [ ] Display mindmaps when loading previous chat
- [ ] Handle empty mindmap list gracefully
- [ ] Handle API errors appropriately

---

## Additional Resources

- See `MINDMAP_API.md` for complete API documentation
- See `FRONTEND_INTEGRATION.md` for general frontend integration guide

