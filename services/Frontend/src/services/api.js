

// // src/services/api.js
// const API_BASE_URL =
//   import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

// class ApiService {
//   constructor() {
//     this.baseURL = API_BASE_URL;
//   }

//   getAuthToken() {
//     const token = localStorage.getItem("token");
//     console.log(
//       `[ApiService] getAuthToken: Token ${token ? 'Present' : 'Not Present'}`
//     );
//     return token;
//   }

//   async request(endpoint, options = {}) {
//     const url =
//       endpoint.startsWith("http://") || endpoint.startsWith("https://")
//         ? endpoint
//         : `${this.baseURL}${endpoint}`;
//     const token = this.getAuthToken();
//     const { responseType, ...fetchOptions } = options;

//     console.log(`[ApiService] Requesting URL: ${url}`);
//     console.log(`[ApiService] Request method: ${options.method || 'GET'}`);
//     console.log(`[ApiService] Full URL being sent: ${url}`);

//     const headers = {
//       ...(fetchOptions.body instanceof FormData
//         ? {}
//         : { "Content-Type": "application/json" }),
//       ...fetchOptions.headers,
//     };

//     if (token) {
//       headers["Authorization"] = `Bearer ${token}`;
//       console.log('[ApiService] Authorization header added.');
//     } else {
//       console.log('[ApiService] No token found, Authorization header NOT added.');
//     }

//     const config = {
//       headers,
//       credentials: "include", // ✅ always include cookies
//       ...fetchOptions,
//     };

//     try {
//       const response = await fetch(url, config);

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(
//           errorData.message || `HTTP error! status: ${response.status}`
//         );
//       }

//       if (responseType === "arrayBuffer") {
//         return await response.arrayBuffer();
//       }
//       return await response.json();
//     } catch (error) {
//       console.error("API request failed:", error);
//       throw error;
//     }
//   }

//   // ========================
//   // ✅ Auth APIs
//   // ========================
//   async login(credentials) {
//     const response = await this.request("/auth/api/auth/login", {
//       method: "POST",
//       body: JSON.stringify(credentials),
//     });
//     if (response.token) {
//       localStorage.setItem("token", response.token);
//     }
//     return response;
//   }

//   async register(userData) {
//     return this.request("/auth/api/auth/register", {
//       method: "POST",
//       body: JSON.stringify(userData),
//     });
//   }

//   async logout() {
//     localStorage.removeItem("token");
//     localStorage.removeItem("user");
//     window.dispatchEvent(new Event("userUpdated"));
//     return { message: "Logged out successfully locally" };
//   }

//   async updateProfile(userData) {
//     return this.request("/auth/api/auth/update", {
//       method: "PUT",
//       body: JSON.stringify(userData),
//     });
//   }

//   async deleteAccount() {
//     return this.request("/auth/api/auth/delete", {
//       method: "DELETE",
//     });
//   }

//   async logoutUser() {
//     return this.request("/auth/api/auth/logout", {
//       method: "POST",
//     });
//   }

//   async fetchProfile() {
//     return this.request("/auth/api/auth/profile");
//   }

//   // ========================
//   // ✅ Template APIs
//   // ========================
//   async getTemplates() {
//     return this.request("/drafting");
//   }

//   async getUserTemplates() {
//     return this.request("/drafting/user");
//   }

//   async getTemplateById(id) {
//     return this.request(`/drafting/${id}`);
//   }

//   async openTemplateForEditing(templateId) {
//     return this.request(`/drafting/${templateId}/open`);
//   }

//   async saveUserDraft(templateId, name, file) {
//     const formData = new FormData();
//     formData.append("templateId", templateId);
//     formData.append("name", name);
//     formData.append("file", file);

//     return this.request("/templates/draft", {
//       method: "POST",
//       body: formData,
//     });
//   }

//   async getTemplateDocxArrayBuffer(templateId) {
//     return this.request(`/templates/${templateId}/docx`, {
//       responseType: "arrayBuffer",
//     });
//   }

//   async exportUserDraft(draftId) {
//     return this.request(`/templates/${draftId}/export`);
//   }

//   async addHtmlTemplate(templateData) {
//     return this.request("/templates/admin/html", {
//       method: "POST",
//       body: JSON.stringify(templateData),
//     });
//   }

//   async getDraftingTemplates() {
//     return this.request("http://localhost:5000/drafting");
//   }

//   // ========================
//   // ✅ Document APIs
//   // ========================
//   async saveDocument(documentData) {
//     return this.request("/doc/save", {
//       method: "POST",
//       body: JSON.stringify(documentData),
//     });
//   }

//   async getDocuments() {
//     return this.request("/doc");
//   }

//   async getDocument(documentId) {
//     return this.request(`/doc/${documentId}`);
//   }

//   // ========================
//   // ✅ Subscription Plans APIs
//   // ========================
//   async getPublicPlans() {
//     return this.request(`/payments/plans`);
//   }

//   async startSubscription(plan_id) {
//     return this.request("/payments/subscription/start", {
//       method: "POST",
//       body: JSON.stringify({ plan_id }),
//     });
//   }

//   async verifySubscription(paymentData) {
//     return this.request("/payments/subscription/verify", {
//       method: "POST",
//       body: JSON.stringify(paymentData),
//     });
//   }

//   async getPaymentPlans() {
//     return this.request(`/payments/plans`);
//   }

//   // ========================
//   // ✅ User Resource APIs
//   // ========================
//   async getUserPlanDetails(service = "") {
//     const endpoint = service
//       ? `/user-resources/plan-details?service=${service}`
//       : `/user-resources/plan-details`;
//     return this.request(endpoint);
//   }

//   async getUserTransactions() {
//     return this.request(`/user-resources/transactions`);
//   }

//   async fetchPaymentHistory() {
//     return this.request("/payments/history");
//   }

//   async getUserTokenUsage(userId) {
//     return this.request(`/files/user-usage-and-plan/${userId}`);
//   }

//   // ========================
//   // ✅ File Management APIs
//   // ========================
//   async uploadSingleFile(file, folderPath = "") {
//     const formData = new FormData();
//     formData.append("files", file);
//     if (folderPath) {
//       formData.append("folderPath", folderPath);
//     }
//     return this.request("/files/upload", {
//       method: "POST",
//       body: formData,
//     });
//   }

//   async uploadMultipleFiles(files, folderPath = "") {
//     const formData = new FormData();
//     Array.from(files).forEach((file) => {
//       formData.append("files", file);
//     });
//     if (folderPath) {
//       formData.append("folderPath", folderPath);
//     }
//     return this.request("/files/upload-folder", {
//       method: "POST",
//       body: formData,
//     });
//   }

//   async getFileStatus(fileId) {
//     return this.request(`/files/status/${fileId}`);
//   }

//   // ========================
//   // ✅ Document Processing APIs
//   // ========================
//   async uploadDocumentForProcessing(file) {
//     const formData = new FormData();
//     formData.append("file", file);
//     return this.request("/documents/upload", {
//       method: "POST",
//       body: formData,
//     });
//   }

//   async batchUploadDocument(file) {
//     const formData = new FormData();
//     formData.append("document", file);
//     return this.request("/documents/batch-upload", {
//       method: "POST",
//       body: formData,
//     });
//   }

//   // ========================
//   // ✅ Template Drafting APIs
//   // ========================
//   async saveUserDraftFromTemplate(file, templateId, name) {
//     const formData = new FormData();
//     formData.append("file", file);
//     formData.append("templateId", templateId);
//     formData.append("name", name);
//     return this.request("/templates/draft", {
//       method: "POST",
//       body: formData,
//     });
//   }








//   async fetchChatsBySessionId(sessionId) {
//   if (!sessionId) {
//     console.warn("[ApiService] fetchChatsBySessionId called without sessionId.");
//     return;
//   }
//   // Correct endpoint to match backend route
//   return this.request(`/api/chat/session/${sessionId}`);
// }




//   // ========================
//   // ✅ Chat APIs
//   // ========================
//   async fetchChatSessions(page = 1, limit = 20) {
//     return this.request(`/files?page=${page}&limit=${limit}`);
//   }

// // //   async fetchFileChatHistory(fileId) {
// // //     return this.request(`/chat/${fileId}`);
// // //   }

// //   // async fetchChatsBySessionId(fileId, sessionId) {
// //   //   if (!fileId) {
// //   //     console.warn("[ApiService] fetchChatsBySessionId called without fileId. This might lead to issues if the backend expects it.");
// //   //     // Fallback to the original endpoint if fileId is not provided, though it's likely to 404.
// //   //     return this.request(`/chat/session/${sessionId}`);
// //   //   }
// //   //   return this.request(`/files/${fileId}/chat/session/${sessionId}`);
// //   // }
// // async fetchChatsBySessionId(sessionId) {
// //   if (!sessionId) {
// //     console.warn("[ApiService] fetchChatsBySessionId called without sessionId.");
// //     return;
// //   }
// //   return this.request(`/session/${sessionId}`);
// // }

// // //   async fetchSingleChat(chatId) {
// // //     return this.request(`/chat/single/${chatId}`);
// // //   }

// // //   async continueFileChat(fileId, question, sessionId) {
// // //     return this.request(`/doc/chat`, {
// // //       method: "POST",
// // //       body: JSON.stringify({ file_id: fileId, question, session_id: sessionId }),
// // //     });
// // //   }
// // // }
//   async getFolderChatSessions(folderName) {
//     return this.request(`/files/${folderName}/chat/sessions`);
//   }

//   async getFolderChatSessionById(folderName, sessionId) {
//     return this.request(`/files/${folderName}/chat/sessions/${sessionId}`);
//   }

//   async queryFolderDocuments(folderName, question) {
//     return this.request(`/files/${folderName}/chat`, {
//       method: "POST",
//       body: JSON.stringify({ question }),
//     });
//   }

//   async continueFolderChat(folderName, sessionId, question) {
//     return this.request(`/files/${folderName}/chat/${sessionId}`, {
//       method: "POST",
//       body: JSON.stringify({ question }),
//     });
//   }

//   async deleteFolderChatSession(folderName, sessionId) {
//     return this.request(`/files/${folderName}/chat/sessions/${sessionId}`, {
//       method: "DELETE",
//     });
//   }

//   async queryTestDocuments(question, sessionId) {
//     return this.request(`/files/test/chat`, {
//       method: "POST",
//       body: JSON.stringify({ question, session_id: sessionId }),
//     });
//   }

//   async queryFolderDocumentsWithSecret(folderName, question, promptLabel, sessionId) {
//     return this.request(`/files/${folderName}/query`, {
//       method: "POST",
//       body: JSON.stringify({ question, prompt_label: promptLabel, session_id: sessionId }),
//     });
//   }

//   // ========================
//   // ✅ Secret Manager APIs
//   // ========================
//   async getSecrets() {
//     return this.request(`/files/secrets?fetch=true`);
//   }

//   async getSecretById(secretId) {
//     return this.request(`/files/secrets/${secretId}`);
//   }

//   async triggerLLMWithSecret(secretId, prompt, fileId) {
//     return this.request("/files/trigger-llm", {
//       method: "POST",
//       body: JSON.stringify({ secretId, prompt, file_id: fileId }),
//     });
//   }

//   // ========================
//   // ✅ Support APIs
//   // ========================
//   async submitSupportQuery(queryData) {
//     return this.request("/support", {
//       method: "POST",
//       body: JSON.stringify(queryData),
//     });
//   }
// }
// export default new ApiService();



// src/services/api.js
const API_BASE_URL =
  import.meta.env.VITE_APP_API_URL || "https://gateway-service-110685455967.asia-south1.run.app";

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
    console.log(`[ApiService] Full URL being sent: ${url}`);

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
      credentials: "include",
      ...fetchOptions,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || `HTTP error! status: ${response.status}`
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
      console.log('[ApiService] Token saved to localStorage during login:', response.token ? 'Present' : 'Not Present');
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

  async verifyOtp(email, otp) {
    const response = await this.request("http://localhost:5000/auth/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
    if (response.token) {
      localStorage.setItem("token", response.token);
      console.log('[ApiService] Token saved to localStorage during OTP verification:', response.token ? 'Present' : 'Not Present');
    }
    return response;
  }

  // ========================
  // ✅ Template APIs
  // ========================
  async getTemplates() {
    return this.request("/drafting");
  }

  async getUserTemplates() {
    return this.request("/drafting/user");
  }

  async getTemplateById(id) {
    return this.request(`/drafting/${id}`);
  }

  async openTemplateForEditing(templateId) {
    return this.request(`/drafting/${templateId}/open`);
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

  async getUserTokenUsage(userId) {
    return this.request(`/files/user-usage-and-plan/${userId}`);
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

  async fetchChatsBySessionId(sessionId) {
    if (!sessionId) {
      console.warn("[ApiService] fetchChatsBySessionId called without sessionId.");
      return;
    }
    return this.request(`/files/session/${sessionId}`);
  }

  // ========================
  // ✅ Chat APIs
  // ========================
  async fetchChatSessions(page = 1, limit = 20) {
    return this.request(`/files?page=${page}&limit=${limit}`);
  }

  async getFolderChatSessions(folderName) {
    return this.request(`/files/${folderName}/chat/sessions`);
  }

  async getFolderChatSessionById(folderName, sessionId) {
    return this.request(`/files/${folderName}/chat/sessions/${sessionId}`);
  }

  async queryFolderDocuments(folderName, question) {
    return this.request(`/files/${folderName}/chat`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }

  async continueFolderChat(folderName, sessionId, question) {
    return this.request(`/files/${folderName}/chat/${sessionId}`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }

  async deleteFolderChatSession(folderName, sessionId) {
    return this.request(`/files/${folderName}/chat/sessions/${sessionId}`, {
      method: "DELETE",
    });
  }

  async queryTestDocuments(question, sessionId) {
    return this.request(`/files/test/chat`, {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId }),
    });
  }

  async queryFolderDocumentsWithSecret(folderName, question, promptLabel, sessionId) {
    return this.request(`/files/${folderName}/query`, {
      method: "POST",
      body: JSON.stringify({ question, prompt_label: promptLabel, session_id: sessionId }),
    });
  }

  // ========================
  // ✅ Secret Manager APIs
  // ========================
  async getSecrets() {
    return this.request(`/files/secrets?fetch=true`);
  }

  async getSecretById(secretId) {
    return this.request(`/files/secrets/${secretId}`);
  }

  // ✅ UPDATED: triggerLLMWithSecret method
  async triggerLLMWithSecret(secretId, fileId, additionalInput = "", promptLabel = "", aiResponse = "") {
    return this.request("/files/trigger-llm", {
      method: "POST",
      body: JSON.stringify({
        secretId,
        fileId,
        additionalInput,
        prompt_label: promptLabel,
        ai_response: aiResponse
      }),
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