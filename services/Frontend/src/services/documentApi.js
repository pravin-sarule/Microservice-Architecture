


import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/docs';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const documentApi = {
  // Create a new folder
  createFolder: async (folderName, parentPath = '') => {
    const response = await axios.post(
      `${API_BASE_URL}/create-folder`,
      { folderName, parentPath },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get all folders & files
  getFoldersAndFiles: async () => {
    const response = await axios.get(`${API_BASE_URL}/folders`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Upload multiple documents
  uploadDocuments: async (folderName, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await axios.post(
        `${API_BASE_URL}/${encodeURIComponent(folderName)}/upload`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return { success: true, documents: response.data.documents || [] };
    } catch (error) {
      if (error.response && error.response.status === 403) {
        return { success: false, message: error.response.data.message || 'Token exhausted.' };
      }
      return { success: false, message: error.message || 'An unexpected error occurred during upload.' };
    }
  },

  // Get folder summary
  getFolderSummary: async (folderName) => {
    const response = await axios.get(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/summary`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get file processing status
  getFileProcessingStatus: async (fileId) => {
    const response = await axios.get(`${API_BASE_URL}/status/${fileId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Get folder processing status
  getFolderProcessingStatus: async (folderName) => {
    const response = await axios.get(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/status`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get document content
  getDocumentContent: async (fileId) => {
    const response = await axios.get(`${API_BASE_URL}/status/${fileId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Query folder documents
  queryFolderDocuments: async (folderName, question, sessionId = null) => {
    if (!folderName) {
      throw new Error('Folder name is required to query documents');
    }
    
    const payload = { question };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    const response = await axios.post(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/query`,
      payload,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Query documents from test_case folder
  queryTestDocuments: async (question, sessionId = null) => {
    const payload = { question };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    const response = await axios.post(
      `${API_BASE_URL}/files/test_case/chat`,
      payload,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Query folder documents with a secret prompt
  queryFolderDocumentsWithSecret: async (folderName, promptValue, promptLabel, sessionId = null) => {
    if (!folderName) {
      throw new Error('Folder name is required to query documents');
    }

    const payload = { 
      question: promptValue, 
      promptLabel 
    };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    const response = await axios.post(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/query`,
      payload,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get all chat sessions for a folder
  getFolderChatSessions: async (folderName) => {
    const response = await axios.get(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/sessions`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get a specific chat session
  getFolderChatSessionById: async (folderName, sessionId) => {
    const response = await axios.get(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/sessions/${sessionId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Continue chat in a session
  continueFolderChat: async (folderName, sessionId, question) => {
    const response = await axios.post(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/sessions/${sessionId}/continue`,
      { question },
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Delete a chat session
  deleteFolderChatSession: async (folderName, sessionId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/sessions/${sessionId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // Get all secrets
  getSecrets: async () => {
    const response = await axios.get(`${API_BASE_URL}/files/secrets?fetch=true`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Get a specific secret by ID
  getSecretById: async (secretId) => {
    const response = await axios.get(`${API_BASE_URL}/files/secrets/${secretId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // Get all chats for a specific folder
  getFolderChats: async (folderName) => {
    const response = await axios.get(
      `${API_BASE_URL}/${encodeURIComponent(folderName)}/chats`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },
};

export default documentApi;