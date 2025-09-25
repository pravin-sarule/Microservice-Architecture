import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/docs';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const documentApi = {
  // Create a new folder
  createFolder: async (folderName, parentPath = '') => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/create-folder`,
        { folderName, parentPath },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get all folders and files for a user
  getFoldersAndFiles: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/folders`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching folders and files:', error.response?.data || error.message);
      throw error;
    }
  },

  // Upload multiple documents to a folder
  uploadDocuments: async (folderName, files) => {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post(
        `${API_BASE_URL}/${folderName}/upload`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading documents:', error.response?.data || error.message);
      throw error;
    }
  },

  // Generate and store folder summary
  getFolderSummary: async (folderName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/${folderName}/summary`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error getting folder summary:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get file processing status (individual file)
  getFileProcessingStatus: async (fileId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status/${fileId}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error getting file processing status:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get folder processing status (all documents in folder)
  getFolderProcessingStatus: async (folderName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/${folderName}/status`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error getting folder processing status:', error.response?.data || error.message);
      throw error;
    }
  },

  // Query documents in folder
  queryFolderDocuments: async (folderName, question, sessionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/${folderName}/query`,
        { question, sessionId },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('Error querying folder documents:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get all chat sessions for a folder
  getFolderChatSessions: async (folderName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/${folderName}/sessions`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching folder chat sessions:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get specific chat session with complete conversation history
  getFolderChatSessionById: async (folderName, sessionId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/${folderName}/sessions/${sessionId}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching specific folder chat session:', error.response?.data || error.message);
      throw error;
    }
  },

  // Continue conversation in existing chat session
  continueFolderChat: async (folderName, sessionId, question) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/${folderName}/sessions/${sessionId}/continue`,
        { question },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('Error continuing folder chat:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete entire chat session
  deleteFolderChatSession: async (folderName, sessionId) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/${folderName}/sessions/${sessionId}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting folder chat session:', error.response?.data || error.message);
      throw error;
    }
  },

  // Query documents from the /docs/Test/query endpoint
  queryTestDocuments: async (question, sessionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/Test/query`,
        { question, sessionId },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      console.error('Error querying test documents:', error.response?.data || error.message);
      throw error;
    }
  },
};