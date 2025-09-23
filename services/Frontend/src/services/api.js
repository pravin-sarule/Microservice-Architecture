// // src/services/api.js
// const API_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

// class ApiService {
//   constructor() {
//     this.baseURL = API_BASE_URL;
//   }

//   getAuthToken() {
//     const token = localStorage.getItem('token');
//     console.log('getAuthToken: Retrieved token:', token ? 'Present' : 'Not Present');
//     return token;
//   }

//   async request(endpoint, options = {}) {
//     const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
//       ? endpoint
//       : `${this.baseURL}${endpoint}`;
//     const token = this.getAuthToken();
//     const { responseType, ...fetchOptions } = options;

//     const headers = {
//       ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
//       ...fetchOptions.headers, // Preserve existing headers
//     };

//     if (token) {
//       headers['Authorization'] = `Bearer ${token}`;
//     }

//     const config = {
//       headers,
//       credentials: 'include',
//       ...fetchOptions,
//     };

//     try {
//       const response = await fetch(url, config);

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
//       }

//       if (responseType === 'arrayBuffer') {
//         return await response.arrayBuffer();
//       }
//       return await response.json();
//     } catch (error) {
//       console.error('API request failed:', error);
//       throw error;
//     }
//   }

//   // ========================
//   // ✅ Auth APIs (Optional)
//   // ========================
//   async login(credentials) {
//     const response = await this.request('http://localhost:5000/auth/api/auth/login', {
//       method: 'POST',
//       body: JSON.stringify(credentials),
//        credentials: "include",
//     });
//     if (response.token) {
//       localStorage.setItem('token', response.token);
//     }
//     return response;
//   }

//   async register(userData) {
//     return this.request('/auth/register', {
//       method: 'POST',
//       body: JSON.stringify(userData),
//     });
//   }

//   async logout() {
//     // Clear token and user data from local storage
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//     // Dispatch event to notify other components about user update
//     window.dispatchEvent(new Event('userUpdated'));
//     // No API call is made as per user's request
//     return { message: "Logged out successfully locally" };
//   }

//   async updateProfile(userData) {
//     return this.request('/auth/update', {
//       method: 'PUT',
//       body: JSON.stringify(userData),
//     });
//   }

//   async deleteAccount() {
//     return this.request('/auth/delete', {
//       method: 'DELETE',
//     });
//   }

//   async logoutUser() { // Renamed to avoid conflict with local logout
//     return this.request('/auth/logout', {
//       method: 'POST',
//     });
//   }

//   async fetchProfile() {
//     return this.request('/auth/profile');
//   }

//   // ========================
//   // ✅ Template APIs
//   // ========================
//   async getTemplates() {
//     return this.request('/templates'); // GET /api/templates
//   }

//   async getUserTemplates() {
//     return this.request('/templates/user'); // GET /api/templates/user
//   }

//   async getTemplateById(id) {
//     return this.request(`/templates/${id}`); // GET /api/templates/:id
//   }

//   async openTemplateForEditing(templateId) {
//     return this.request(`/templates/${templateId}/html`); // GET /api/templates/:id/html
//   }

//   async saveUserDraft(templateId, name, file) {
//     const formData = new FormData();
//     formData.append('templateId', templateId);
//     formData.append('name', name);
//     formData.append('file', file); // Assuming backend expects 'file' for template drafts

//     return this.request('/templates/draft', { // Use this.request
//       method: 'POST',
//       body: formData,
//     });
//   }

//   async getTemplateDocxArrayBuffer(templateId) {
//     return this.request(`/templates/${templateId}/docx`, {
//       responseType: 'arrayBuffer',
//     });
//   }

//   async exportUserDraft(draftId) {
//     return this.request(`/templates/${draftId}/export`); // GET /api/templates/:id/export
//   }

//   async addHtmlTemplate(templateData) {
//     return this.request('/templates/admin/html', { // Corrected URL
//       method: 'POST',
//       body: JSON.stringify(templateData),
//     });
//   }

//   // ========================
//   // ✅ Document APIs (Optional)
//   // ========================
//   async saveDocument(documentData) {
//     return this.request('/doc/save', {
//       method: 'POST',
//       body: JSON.stringify(documentData),
//     });
//   }

//   async getDocuments() {
//     return this.request('/doc');
//   }

//   async getDocument(documentId) {
//     return this.request(`/doc/${documentId}`);
//   }

//   // ========================
//   // ✅ Subscription Plans APIs
//   // ========================
//   async getPublicPlans() {
//     return this.request(`/plans`);
//   }

//   async startSubscription(plan_id) {
//     return this.request('/payments/subscription/start', {
//       method: 'POST',
//       body: JSON.stringify({ plan_id }),
//     });
//   }

//   async verifySubscription(paymentData) {
//     return this.request('/payments/subscription/verify', {
//       method: 'POST',
//       body: JSON.stringify(paymentData), // Send as JSON
//     });
//   }

//   async getPaymentPlans() {
//     return this.request(`/payments/plans`);
//   }

//   // ========================
//   // ✅ User Resource and Plan Details APIs
//   // ========================
//   async getUserPlanDetails(service = '') {
//     const endpoint = service ? `/user-resources/plan-details?service=${service}` : `/user-resources/plan-details`;
//     return this.request(endpoint);
//   }

//   async getUserTransactions() {
//     return this.request(`/user-resources/transactions`);
//   }

//   async fetchPaymentHistory() {
//     return this.request('/payments/history');
//   }

//   // ========================
//   // ✅ File Management APIs
//   // ========================
//   async uploadSingleFile(file, folderPath = '') {
//     const formData = new FormData();
//     formData.append('files', file); // Changed from 'file' to 'files'
//     if (folderPath) {
//       formData.append('folderPath', folderPath);
//     }
//     return this.request('/files/upload', {
//       method: 'POST',
//       body: formData,
//     });
//   }

//   async uploadMultipleFiles(files, folderPath = '') {
//     const formData = new FormData();
//     Array.from(files).forEach(file => {
//       formData.append('files', file);
//     });
//     if (folderPath) {
//       formData.append('folderPath', folderPath);
//     }
//     return this.request('/files/upload-folder', {
//       method: 'POST',
//       body: formData,
//     });
//   }

//   // ========================
//   // ✅ Document Processing APIs
//   // ========================
//   async uploadDocumentForProcessing(file) {
//     const formData = new FormData();
//     formData.append('file', file);
//     return this.request('/documents/upload', {
//       method: 'POST',
//       body: formData,
//     });
//   }

//   async batchUploadDocument(file) {
//     const formData = new FormData();
//     formData.append('document', file); // 'document' matches the field name in the backend route
//     return this.request('/documents/batch-upload', {
//       method: 'POST',
//       body: formData,
//     });
//   }

//   // ========================
//   // ✅ Template Drafting APIs
//   // ========================
//   async saveUserDraftFromTemplate(file, templateId, name) {
//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('templateId', templateId);
//     formData.append('name', name);
//     return this.request('/templates/draft', {
//       method: 'POST',
//       body: formData,
//     });
//   }

//   // ========================
//   // ✅ Chat APIs
//   // ========================
//   async fetchChatSessions() {
//     return this.request('/chat');
//   }

//   async fetchFileChatHistory(fileId) {
//     return this.request(`/chat/${fileId}`);
//   }

//   async fetchChatsBySessionId(sessionId) {
//     return this.request(`/chat/session/${sessionId}`);
//   }

//   async fetchSingleChat(chatId) {
//     return this.request(`/chat/single/${chatId}`);
//   }

//   async continueFileChat(fileId, question, sessionId) {
//     return this.request(`/doc/chat`, { // Assuming /doc/chat is the endpoint for continuing chat
//       method: 'POST',
//       body: JSON.stringify({ file_id: fileId, question, session_id: sessionId }),
//     });
//   }
// }

// export default new ApiService();

// src/services/api.js
const API_BASE_URL =
  import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthToken() {
    const token = localStorage.getItem("token");
    console.log(
      `[ApiService] getAuthToken: Token ${token ? 'Present' : 'Not Present'}`
    );
    return token;
  }

  async request(endpoint, options = {}) {
    const url =
      endpoint.startsWith("http://") || endpoint.startsWith("https://")
        ? endpoint
        : `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();
    const { responseType, ...fetchOptions } = options;

    console.log(`[ApiService] Requesting URL: ${url}`);
    console.log(`[ApiService] Request method: ${options.method || 'GET'}`);

    const headers = {
      ...(fetchOptions.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...fetchOptions.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log('[ApiService] Authorization header added.');
    } else {
      console.log('[ApiService] No token found, Authorization header NOT added.');
    }

    const config = {
      headers,
      credentials: "include", // ✅ always include cookies
      ...fetchOptions,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      if (responseType === "arrayBuffer") {
        return await response.arrayBuffer();
      }
      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // ========================
  // ✅ Auth APIs
  // ========================
  async login(credentials) {
    const response = await this.request("/auth/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    if (response.token) {
      localStorage.setItem("token", response.token);
    }
    return response;
  }

  async register(userData) {
    return this.request("/auth/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("userUpdated"));
    return { message: "Logged out successfully locally" };
  }

  async updateProfile(userData) {
    return this.request("/auth/api/auth/update", {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteAccount() {
    return this.request("/auth/api/auth/delete", {
      method: "DELETE",
    });
  }

  async logoutUser() {
    return this.request("/auth/api/auth/logout", {
      method: "POST",
    });
  }

  async fetchProfile() {
    return this.request("/auth/api/auth/profile");
  }

  // ========================
  // ✅ Template APIs
  // ========================
  async getTemplates() {
    return this.request("/templates");
  }

  async getUserTemplates() {
    return this.request("/templates/user");
  }

  async getTemplateById(id) {
    return this.request(`/templates/${id}`);
  }

  async openTemplateForEditing(templateId) {
    return this.request(`/api/templates/${templateId}/open`);
  }

  async saveUserDraft(templateId, name, file) {
    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("name", name);
    formData.append("file", file);

    return this.request("/templates/draft", {
      method: "POST",
      body: formData,
    });
  }

  async getTemplateDocxArrayBuffer(templateId) {
    return this.request(`/templates/${templateId}/docx`, {
      responseType: "arrayBuffer",
    });
  }

  async exportUserDraft(draftId) {
    return this.request(`/templates/${draftId}/export`);
  }

  async addHtmlTemplate(templateData) {
    return this.request("/templates/admin/html", {
      method: "POST",
      body: JSON.stringify(templateData),
    });
  }

  async getDraftingTemplates() {
    return this.request("http://localhost:5000/drafting");
  }

  // ========================
  // ✅ Document APIs
  // ========================
  async saveDocument(documentData) {
    return this.request("/doc/save", {
      method: "POST",
      body: JSON.stringify(documentData),
    });
  }

  async getDocuments() {
    return this.request("/doc");
  }

  async getDocument(documentId) {
    return this.request(`/doc/${documentId}`);
  }

  // ========================
  // ✅ Subscription Plans APIs
  // ========================
  async getPublicPlans() {
    return this.request(`/payments/plans`);
  }

  async startSubscription(plan_id) {
    return this.request("/payments/subscription/start", {
      method: "POST",
      body: JSON.stringify({ plan_id }),
    });
  }

  async verifySubscription(paymentData) {
    return this.request("/payments/subscription/verify", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  async getPaymentPlans() {
    return this.request(`/payments/plans`);
  }

  // ========================
  // ✅ User Resource APIs
  // ========================
  async getUserPlanDetails(service = "") {
    const endpoint = service
      ? `/user-resources/plan-details?service=${service}`
      : `/user-resources/plan-details`;
    return this.request(endpoint);
  }

  async getUserTransactions() {
    return this.request(`/user-resources/transactions`);
  }

  async fetchPaymentHistory() {
    return this.request("/payments/history");
  }

  // ========================
  // ✅ File Management APIs
  // ========================
  async uploadSingleFile(file, folderPath = "") {
    const formData = new FormData();
    formData.append("files", file);
    if (folderPath) {
      formData.append("folderPath", folderPath);
    }
    return this.request("/files/upload", {
      method: "POST",
      body: formData,
    });
  }

  async uploadMultipleFiles(files, folderPath = "") {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });
    if (folderPath) {
      formData.append("folderPath", folderPath);
    }
    return this.request("/files/upload-folder", {
      method: "POST",
      body: formData,
    });
  }

  async getFileStatus(fileId) {
    return this.request(`/files/status/${fileId}`);
  }

  // ========================
  // ✅ Document Processing APIs
  // ========================
  async uploadDocumentForProcessing(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request("/documents/upload", {
      method: "POST",
      body: formData,
    });
  }

  async batchUploadDocument(file) {
    const formData = new FormData();
    formData.append("document", file);
    return this.request("/documents/batch-upload", {
      method: "POST",
      body: formData,
    });
  }

  // ========================
  // ✅ Template Drafting APIs
  // ========================
  async saveUserDraftFromTemplate(file, templateId, name) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("templateId", templateId);
    formData.append("name", name);
    return this.request("/templates/draft", {
      method: "POST",
      body: formData,
    });
  }

  // ========================
  // ✅ Chat APIs
  // ========================
//   async fetchChatSessions() {
//     return this.request("/chat");
//   }

//   async fetchFileChatHistory(fileId) {
//     return this.request(`/chat/${fileId}`);
//   }

//   async fetchChatsBySessionId(sessionId) {
//     return this.request(`/chat/session/${sessionId}`);
//   }

//   async fetchSingleChat(chatId) {
//     return this.request(`/chat/single/${chatId}`);
//   }

//   async continueFileChat(fileId, question, sessionId) {
//     return this.request(`/doc/chat`, {
//       method: "POST",
//       body: JSON.stringify({ file_id: fileId, question, session_id: sessionId }),
//     });
//   }
// }
async fetchChatSessions() {
    return this.request("/files/all");
  }

  async fetchFileChatHistory(fileId) {
    return this.request(`/files/chat/${fileId}`);
  }

  async fetchChatsBySessionId(sessionId) {
    return this.request(`/files/session/${sessionId}`);
  }

  async fetchSingleChat(chatId) {
    return this.request(`/files/chat/single/${chatId}`);
  }

  async continueFileChat(fileId, question, sessionId) {
    return this.request(`files/chat`, {
      method: "POST",
      body: JSON.stringify({ file_id: fileId, question, session_id: sessionId }),
    });
  }

  // ========================
  // ✅ Support APIs
  // ========================
  async submitSupportQuery(queryData) {
    return this.request("/support", {
      method: "POST",
      body: JSON.stringify(queryData),
    });
  }
}
export default new ApiService();