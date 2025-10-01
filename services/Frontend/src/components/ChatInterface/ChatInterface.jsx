

// import React, { useState, useEffect, useContext, useRef } from "react";
// import { FileManagerContext } from "../../context/FileManagerContext";
// import documentApi from "../../services/documentApi";
// import apiService from "../../services/api";
// import {
//   BookOpen,
//   ChevronDown,
//   Send,
//   Loader2,
//   MessageSquare,
//   Search,
//   ChevronRight,
// } from "lucide-react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import { SidebarContext } from "../../context/SidebarContext";
// import ChatCardList from "./ChatCardList"; // ✅ Card list

// const ChatInterface = () => {
//   const {
//     selectedFolder,
//     setChatSessions,
//     selectedChatSessionId,
//     setSelectedChatSessionId,
//     setHasAiResponse,
//   } = useContext(FileManagerContext);
//   const { setForceSidebarCollapsed } = useContext(SidebarContext);

//   const [currentChatHistory, setCurrentChatHistory] = useState([]);
//   const [loadingChat, setLoadingChat] = useState(false);
//   const [chatError, setChatError] = useState(null);

//   const [chatInput, setChatInput] = useState("");
//   const [currentResponse, setCurrentResponse] = useState("");
//   const [animatedResponseContent, setAnimatedResponseContent] = useState("");
//   const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
//   const [selectedMessageId, setSelectedMessageId] = useState(null);
//   const [hasResponse, setHasResponse] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");

//   const responseRef = useRef(null);

//   // 🔹 Fetch chat history
//   const fetchChatHistory = async (sessionId) => {
//     if (!selectedFolder) return;

//     setLoadingChat(true);
//     setChatError(null);

//     try {
//       let data = await documentApi.getFolderChats(selectedFolder);
//       const chats = Array.isArray(data.chats) ? data.chats : [];
//       setCurrentChatHistory(chats);

//       if (sessionId) {
//         setSelectedChatSessionId(sessionId);
//         const selectedChat = chats.find((c) => c.id === sessionId);
//         if (selectedChat) {
//           const responseText =
//             selectedChat.response ||
//             selectedChat.answer ||
//             selectedChat.message ||
//             "";
//           setCurrentResponse(responseText);
//           setAnimatedResponseContent(responseText);
//           setSelectedMessageId(selectedChat.id);
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         } else if (selectedFolder === 'Test' && chats.length > 0) { // If Test folder has chats, enable input
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         }
//       } else {
//         setHasResponse(false);
//         setHasAiResponse(false);
//         setForceSidebarCollapsed(false);
//       }
//     } catch (err) {
//       console.error("❌ Error fetching chats:", err);
//       setChatError("Failed to fetch chat history.");
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // 🔹 Animate typing effect
//   const animateResponse = (text) => {
//     setAnimatedResponseContent("");
//     setIsAnimatingResponse(true);
//     let i = 0;
//     const interval = setInterval(() => {
//       if (i < text.length) {
//         setAnimatedResponseContent((prev) => prev + text.charAt(i));
//         i++;
//         if (responseRef.current) {
//           responseRef.current.scrollTop = responseRef.current.scrollHeight;
//         }
//       } else {
//         clearInterval(interval);
//         setIsAnimatingResponse(false);
//       }
//     }, 20);
//   };

//   // 🔹 Handle new message
//   const handleNewMessage = async () => {
//     if (!selectedFolder || !chatInput.trim()) return;

//     setLoadingChat(true);
//     setChatError(null);

//     try {
//       const response = await documentApi.queryFolderDocuments(
//         selectedFolder,
//         chatInput,
//         selectedChatSessionId
//       );

//       if (response.sessionId) {
//         setSelectedChatSessionId(response.sessionId);
//       }

//       const history = Array.isArray(response.chatHistory)
//         ? response.chatHistory
//         : [];
//       setCurrentChatHistory(history);

//       if (history.length > 0) {
//         const latestMessage = history[history.length - 1];
//         const responseText =
//           latestMessage.response ||
//           latestMessage.answer ||
//           latestMessage.message ||
//           "";
//         setCurrentResponse(responseText);
//         setSelectedMessageId(latestMessage.id);
//         setHasResponse(true);
//         setHasAiResponse(true);
//         setForceSidebarCollapsed(true);
//         animateResponse(responseText);
//       }
//       setChatInput("");
//     } catch (err) {
//       setChatError(
//         `Failed to send message: ${err.response?.data?.details || err.message}`
//       );
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // 🔹 Handle selecting a chat from ChatCardList
//   const handleSelectChat = (chatId) => {
//     fetchChatHistory(chatId);
//   };

//   useEffect(() => {
//     setChatSessions([]);
//     setCurrentChatHistory([]);
//     setSelectedChatSessionId(null);
//     setHasResponse(false);
//     setHasAiResponse(false);
//     setForceSidebarCollapsed(false);

//     if (selectedFolder && selectedFolder !== 'Test') { // Only fetch history for non-Test folders here
//       fetchChatHistory();
//     }
//     // For 'Test' folder, ChatCardList will handle its own fetching
//   }, [selectedFolder]);

//   if (!selectedFolder) {
//     return (
//       <div className="flex items-center justify-center h-full text-gray-400 text-lg bg-[#FDFCFB]">
//         Select a folder to start chatting.
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-full bg-white">
//       {/* Left panel */}
//       <div className="w-1/2 border-r border-gray-200 flex flex-col">
//         {/* Header */}
//         <div className="p-4 border-b border-gray-200">
//           <div className="flex justify-between items-center mb-4">
//             <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
//             <button
//               type="button"
//               onClick={() => {
//                 setCurrentChatHistory([]);
//                 setSelectedChatSessionId(null);
//                 setHasResponse(false);
//                 setHasAiResponse(false);
//                 setForceSidebarCollapsed(false);
//                 setChatInput("");
//               }}
//               className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
//             >
//               <MessageSquare className="h-4 w-4" />
//               <span>New Chat</span>
//             </button>
//           </div>

//           {/* Search bar */}
//           <div className="relative">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
//             <input
//               type="text"
//               placeholder="Search chats..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//           </div>
//         </div>

//         {/* Chat list */}
//         <div className="flex-1 overflow-y-auto px-4 py-2">
//           <ChatCardList
//             folderName={selectedFolder}
//             onSelectChat={handleSelectChat}
//           />
//         </div>

//         {/* Chat input */}
//         <div className="border-t border-gray-200 p-4">
//           <div className="flex items-center space-x-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
//             <input
//               type="text"
//               value={chatInput}
//               onChange={(e) => setChatInput(e.target.value)}
//               placeholder="Ask a question..."
//               className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-sm font-medium"
//               disabled={loadingChat}
//             />
//             <button
//               type="button"
//               onClick={handleNewMessage}
//               disabled={loadingChat || !chatInput.trim()}
//               className="p-1.5 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg transition-colors"
//             >
//               {loadingChat ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <Send className="h-4 w-4" />
//               )}
//             </button>
//           </div>
//           {chatError && (
//             <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
//               {chatError}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Right panel (AI response) */}
//       <div className="w-1/2 flex flex-col">
//         <div className="flex-1 overflow-y-auto p-6" ref={responseRef}>
//           {selectedMessageId && currentResponse ? (
//             <div className="max-w-none">
//               <div className="mb-6 pb-4 border-b border-gray-200">
//                 <h2 className="text-xl font-semibold text-gray-900">
//                   AI Response
//                 </h2>
//               </div>
//               <div className="prose prose-gray max-w-none">
//                 <ReactMarkdown
//                   remarkPlugins={[remarkGfm]}
//                   components={{
//                     h1: (props) => (
//                       <h1
//                         className="text-2xl font-bold mb-6 mt-8 text-black border-b-2 border-gray-300 pb-2"
//                         {...props}
//                       />
//                     ),
//                     h2: (props) => (
//                       <h2
//                         className="text-xl font-bold mb-4 mt-6 text-black"
//                         {...props}
//                       />
//                     ),
//                     p: (props) => (
//                       <p
//                         className="mb-4 leading-relaxed text-black text-justify"
//                         {...props}
//                       />
//                     ),
//                   }}
//                 >
//                   {animatedResponseContent || currentResponse}
//                 </ReactMarkdown>
//                 {isAnimatingResponse && (
//                   <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1"></span>
//                 )}
//               </div>
//             </div>
//           ) : (
//             <div className="flex items-center justify-center h-full">
//               <div className="text-center max-w-md">
//                 <MessageSquare className="h-16 w-16 mx-auto mb-6 text-gray-300" />
//                 <h3 className="text-2xl font-semibold mb-4 text-gray-900">
//                   {selectedFolder === 'Test' ? 'No chat selected' : 'Select a chat'}
//                 </h3>
//                 <p className="text-gray-600 text-lg">
//                   {selectedFolder === 'Test' ? 'Select a chat from the list on the left.' : 'Click a chat from the left to view the response.'}
//                 </p>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatInterface;
// import React, { useState, useEffect, useContext, useRef } from "react";
// import { FileManagerContext } from "../../context/FileManagerContext";
// import documentApi from "../../services/documentApi";
// import {
//   Plus,
//   Shuffle,
//   Search,
//   BookOpen,
//   ChevronDown,
//   ChevronRight,
//   MoreVertical,
//   MessageSquare,
//   Loader2,
//   Send,
// } from "lucide-react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import { SidebarContext } from "../../context/SidebarContext";

// const ChatInterface = () => {
//   const {
//     selectedFolder,
//     setChatSessions,
//     selectedChatSessionId,
//     setSelectedChatSessionId,
//     setHasAiResponse,
//   } = useContext(FileManagerContext);
//   const { setForceSidebarCollapsed } = useContext(SidebarContext);

//   const [currentChatHistory, setCurrentChatHistory] = useState([]);
//   const [loadingChat, setLoadingChat] = useState(false);
//   const [chatError, setChatError] = useState(null);

//   const [chatInput, setChatInput] = useState("");
//   const [currentResponse, setCurrentResponse] = useState("");
//   const [animatedResponseContent, setAnimatedResponseContent] = useState("");
//   const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
//   const [selectedMessageId, setSelectedMessageId] = useState(null);
//   const [hasResponse, setHasResponse] = useState(false);

//   // Secret prompt states
//   const [secrets, setSecrets] = useState([]);
//   const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
//   const [selectedSecretId, setSelectedSecretId] = useState(null);
//   const [activeDropdown, setActiveDropdown] = useState("Summary");
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [isSecretPromptSelected, setIsSecretPromptSelected] = useState(false);

//   const responseRef = useRef(null);
//   const dropdownRef = useRef(null);

//   // API Configuration
//   const API_BASE_URL = "http://localhost:5000";

//   const getAuthToken = () => {
//     const tokenKeys = [
//       "authToken",
//       "token",
//       "accessToken",
//       "jwt",
//       "bearerToken",
//       "auth_token",
//       "access_token",
//       "api_token",
//       "userToken",
//     ];

//     for (const key of tokenKeys) {
//       const token = localStorage.getItem(key);
//       if (token) {
//         return token;
//       }
//     }
//     return null;
//   };

//   // 🔹 Fetch secrets list
//   const fetchSecrets = async () => {
//     try {
//       setIsLoadingSecrets(true);
//       setChatError(null);

//       const token = getAuthToken();
//       const headers = {
//         "Content-Type": "application/json",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const response = await fetch(`${API_BASE_URL}/files/secrets?fetch=true`, {
//         method: "GET",
//         headers,
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch secrets: ${response.status}`);
//       }

//       const secretsData = await response.json();
//       setSecrets(secretsData || []);

//       if (secretsData && secretsData.length > 0) {
//         setActiveDropdown(secretsData[0].name);
//         setSelectedSecretId(secretsData[0].id);
//       }
//     } catch (error) {
//       console.error("Error fetching secrets:", error);
//       setChatError(`Failed to load analysis prompts: ${error.message}`);
//     } finally {
//       setIsLoadingSecrets(false);
//     }
//   };

//   // 🔹 Fetch secret value by ID
//   const fetchSecretValue = async (secretId) => {
//     try {
//       const existingSecret = secrets.find((secret) => secret.id === secretId);
//       if (existingSecret && existingSecret.value) {
//         return existingSecret.value;
//       }

//       const token = getAuthToken();
//       const headers = {
//         "Content-Type": "application/json",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const response = await fetch(
//         `${API_BASE_URL}/files/secrets/${secretId}`,
//         {
//           method: "GET",
//           headers,
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`Failed to fetch secret value: ${response.status}`);
//       }

//       const secretData = await response.json();
//       const promptValue =
//         secretData.value || secretData.prompt || secretData.content || secretData;

//       setSecrets((prevSecrets) =>
//         prevSecrets.map((secret) =>
//           secret.id === secretId ? { ...secret, value: promptValue } : secret
//         )
//       );

//       return promptValue || "";
//     } catch (error) {
//       console.error("Error fetching secret value:", error);
//       throw new Error("Failed to retrieve analysis prompt");
//     }
//   };

//   // 🔹 Fetch chat history
//   const fetchChatHistory = async (sessionId) => {
//     if (!selectedFolder) return;

//     setLoadingChat(true);
//     setChatError(null);

//     try {
//       let data = await documentApi.getFolderChats(selectedFolder);
//       const chats = Array.isArray(data.chats) ? data.chats : [];
//       setCurrentChatHistory(chats);

//       if (sessionId) {
//         setSelectedChatSessionId(sessionId);
//         const selectedChat = chats.find((c) => c.id === sessionId);
//         if (selectedChat) {
//           const responseText =
//             selectedChat.response ||
//             selectedChat.answer ||
//             selectedChat.message ||
//             "";
//           setCurrentResponse(responseText);
//           setAnimatedResponseContent(responseText);
//           setSelectedMessageId(selectedChat.id);
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         } else if (selectedFolder === "Test" && chats.length > 0) {
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         }
//       } else {
//         setHasResponse(false);
//         setHasAiResponse(false);
//         setForceSidebarCollapsed(false);
//       }
//     } catch (err) {
//       console.error("❌ Error fetching chats:", err);
//       setChatError("Failed to fetch chat history.");
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // 🔹 Animate typing effect
//   const animateResponse = (text) => {
//     setAnimatedResponseContent("");
//     setIsAnimatingResponse(true);
//     let i = 0;
//     const interval = setInterval(() => {
//       if (i < text.length) {
//         setAnimatedResponseContent((prev) => prev + text.charAt(i));
//         i++;
//         if (responseRef.current) {
//           responseRef.current.scrollTop = responseRef.current.scrollHeight;
//         }
//       } else {
//         clearInterval(interval);
//         setIsAnimatingResponse(false);
//       }
//     }, 20);
//   };

//   // 🔹 Chat with AI using secret prompt
//   const chatWithAI = async (folder, secretId, currentSessionId) => {
//     try {
//       setLoadingChat(true);
//       setChatError(null);

//       const selectedSecret = secrets.find((s) => s.id === secretId);
//       if (!selectedSecret) {
//         throw new Error("No prompt found for selected analysis type");
//       }

//       let promptValue = selectedSecret.value;
//       const promptLabel = selectedSecret.name;

//       if (!promptValue) {
//         promptValue = await fetchSecretValue(secretId);
//       }

//       if (!promptValue) {
//         throw new Error("Secret prompt value is empty.");
//       }

//       const response = await documentApi.queryFolderDocuments(
//         folder,
//         promptValue,
//         currentSessionId,
//         {
//           used_secret_prompt: true,
//           prompt_label: promptLabel,
//         }
//       );

//       if (response.sessionId) {
//         setSelectedChatSessionId(response.sessionId);
//       }

//       const history = Array.isArray(response.chatHistory)
//         ? response.chatHistory
//         : [];
//       setCurrentChatHistory(history);

//       if (history.length > 0) {
//         const latestMessage = history[history.length - 1];
//         const responseText =
//           latestMessage.response ||
//           latestMessage.answer ||
//           latestMessage.message ||
//           "";
//         setCurrentResponse(responseText);
//         setSelectedMessageId(latestMessage.id);
//         setHasResponse(true);
//         setHasAiResponse(true);
//         setForceSidebarCollapsed(true);
//         animateResponse(responseText);
//       }

//       return response;
//     } catch (error) {
//       setChatError(`Analysis failed: ${error.message}`);
//       throw error;
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // 🔹 Handle new message (combines regular chat and secret prompt)
//   const handleNewMessage = async () => {
//     if (!selectedFolder) return;

//     if (isSecretPromptSelected) {
//       if (!selectedSecretId) {
//         setChatError("Please select an analysis type.");
//         return;
//       }
//       try {
//         await chatWithAI(selectedFolder, selectedSecretId, selectedChatSessionId);
//         setChatInput("");
//       } catch (error) {
//         // Error already handled
//       }
//     } else {
//       if (!chatInput.trim()) return;

//       setLoadingChat(true);
//       setChatError(null);

//       try {
//         const response = await documentApi.queryFolderDocuments(
//           selectedFolder,
//           chatInput,
//           selectedChatSessionId
//         );

//         if (response.sessionId) {
//           setSelectedChatSessionId(response.sessionId);
//         }

//         const history = Array.isArray(response.chatHistory)
//           ? response.chatHistory
//           : [];
//         setCurrentChatHistory(history);

//         if (history.length > 0) {
//           const latestMessage = history[history.length - 1];
//           const responseText =
//             latestMessage.response ||
//             latestMessage.answer ||
//             latestMessage.message ||
//             "";
//           setCurrentResponse(responseText);
//           setSelectedMessageId(latestMessage.id);
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//           animateResponse(responseText);
//         }
//         setChatInput("");
//       } catch (err) {
//         setChatError(
//           `Failed to send message: ${err.response?.data?.details || err.message}`
//         );
//       } finally {
//         setLoadingChat(false);
//       }
//     }
//   };

//   // 🔹 Handle selecting a chat
//   const handleSelectChat = (chatId) => {
//     fetchChatHistory(chatId);
//   };

//   // 🔹 Handle new chat
//   const handleNewChat = () => {
//     setCurrentChatHistory([]);
//     setSelectedChatSessionId(null);
//     setHasResponse(false);
//     setHasAiResponse(false);
//     setForceSidebarCollapsed(false);
//     setChatInput("");
//     setSelectedMessageId(null);
//     setCurrentResponse("");
//     setIsSecretPromptSelected(false);
//   };

//   // 🔹 Handle dropdown selection
//   const handleDropdownSelect = (secretName, secretId) => {
//     setActiveDropdown(secretName);
//     setSelectedSecretId(secretId);
//     setIsSecretPromptSelected(true);
//     setChatInput("");
//     setShowDropdown(false);
//   };

//   // 🔹 Handle custom input change
//   const handleChatInputChange = (e) => {
//     setChatInput(e.target.value);
//     setIsSecretPromptSelected(false);
//     setActiveDropdown("Custom Query");
//   };

//   // 🔹 Format relative time
//   const getRelativeTime = (dateString) => {
//     const date = new Date(dateString);
//     const now = new Date();
//     const diffInSeconds = Math.floor((now - date) / 1000);

//     if (diffInSeconds < 60) return `Last message ${diffInSeconds} seconds ago`;
//     if (diffInSeconds < 3600)
//       return `Last message ${Math.floor(diffInSeconds / 60)} minutes ago`;
//     if (diffInSeconds < 86400)
//       return `Last message ${Math.floor(diffInSeconds / 3600)} hours ago`;
//     return `Last message ${Math.floor(diffInSeconds / 86400)} days ago`;
//   };

//   // 🔹 Close dropdown when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//         setShowDropdown(false);
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   // 🔹 Load secrets on mount
//   useEffect(() => {
//     fetchSecrets();
//   }, []);

//   useEffect(() => {
//     setChatSessions([]);
//     setCurrentChatHistory([]);
//     setSelectedChatSessionId(null);
//     setHasResponse(false);
//     setHasAiResponse(false);
//     setForceSidebarCollapsed(false);

//     if (selectedFolder && selectedFolder !== "Test") {
//       fetchChatHistory();
//     }
//   }, [selectedFolder]);

//   if (!selectedFolder) {
//     return (
//       <div className="flex items-center justify-center h-full text-gray-400 text-lg bg-[#FDFCFB]">
//         Select a folder to start chatting.
//       </div>
//     );
//   }

//   return (
//     <div className="h-full bg-[#FDFCFB] overflow-hidden">
//       <div className="max-w-4xl mx-auto h-full flex flex-col py-6 px-4">
//         {/* Top Search/Input Card */}
//         <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex-shrink-0">
//           <input
//             type="text"
//             placeholder="How can I help you today?"
//             value={chatInput}
//             onChange={handleChatInputChange}
//             onKeyPress={(e) => e.key === "Enter" && handleNewMessage()}
//             className="w-full text-base text-gray-700 placeholder-gray-400 outline-none bg-transparent mb-4"
//             disabled={loadingChat}
//           />

//           {/* Action Buttons Row */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center space-x-2">
//               <button
//                 onClick={handleNewChat}
//                 className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
//                 title="New Chat"
//               >
//                 <Plus className="h-5 w-5 text-gray-600" />
//               </button>
//               <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors">
//                 <Shuffle className="h-5 w-5 text-gray-600" />
//               </button>
//               <button className="flex items-center space-x-2 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition-colors">
//                 <Search className="h-4 w-4 text-gray-600" />
//                 <span className="text-sm text-gray-700">Research</span>
//               </button>

//               {/* Analysis Dropdown */}
//               <div className="relative" ref={dropdownRef}>
//                 <button
//                   onClick={() => setShowDropdown(!showDropdown)}
//                   disabled={isLoadingSecrets || loadingChat}
//                   className="flex items-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
//                 >
//                   <BookOpen className="h-4 w-4" />
//                   <span className="text-sm font-medium">
//                     {isLoadingSecrets ? "Loading..." : activeDropdown}
//                   </span>
//                   <ChevronDown className="h-4 w-4" />
//                 </button>

//                 {showDropdown && !isLoadingSecrets && (
//                   <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
//                     {secrets.length > 0 ? (
//                       secrets.map((secret) => (
//                         <button
//                           key={secret.id}
//                           onClick={() =>
//                             handleDropdownSelect(secret.name, secret.id)
//                           }
//                           className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
//                         >
//                           {secret.name}
//                         </button>
//                       ))
//                     ) : (
//                       <div className="px-4 py-2.5 text-sm text-gray-500">
//                         No analysis prompts available
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </div>
//             </div>

//             <div className="flex items-center space-x-2">
//               <button className="flex items-center space-x-1 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
//                 <span>Sonnet 4.5</span>
//                 <ChevronDown className="h-4 w-4" />
//               </button>
//               <button
//                 onClick={handleNewMessage}
//                 disabled={
//                   loadingChat ||
//                   (!chatInput.trim() && !isSecretPromptSelected)
//                 }
//                 className="p-2.5 bg-orange-300 hover:bg-orange-400 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
//               >
//                 {loadingChat ? (
//                   <Loader2 className="h-5 w-5 text-white animate-spin" />
//                 ) : (
//                   <Send className="h-5 w-5 text-white" />
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Chat History List */}
//         <div className="flex-1 overflow-y-auto space-y-3 pb-4">
//           {currentChatHistory.map((chat) => (
//             <div
//               key={chat.id}
//               onClick={() => handleSelectChat(chat.id)}
//               className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer transition-all hover:shadow-md hover:border-gray-300 ${
//                 selectedMessageId === chat.id
//                   ? "ring-2 ring-blue-500 border-blue-500"
//                   : ""
//               }`}
//             >
//               <div className="flex items-start justify-between">
//                 <div className="flex-1">
//                   <h3 className="text-base font-semibold text-gray-900 mb-1">
//                     {chat.question || chat.query || "Untitled"}
//                   </h3>
//                   <p className="text-sm text-gray-500">
//                     {getRelativeTime(chat.created_at || chat.timestamp)}
//                   </p>
//                 </div>
//                 <button
//                   onClick={(e) => {
//                     e.stopPropagation();
//                   }}
//                   className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
//                 >
//                   <MoreVertical className="h-5 w-5 text-gray-400" />
//                 </button>
//               </div>
//             </div>
//           ))}

//           {currentChatHistory.length === 0 && !loadingChat && (
//             <div className="text-center py-12">
//               <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p className="text-gray-500">
//                 No chats yet. Start a conversation!
//               </p>
//             </div>
//           )}

//           {loadingChat && currentChatHistory.length === 0 && (
//             <div className="flex justify-center py-8">
//               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//             </div>
//           )}
//         </div>

//         {/* Error Message */}
//         {chatError && (
//           <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex-shrink-0">
//             {chatError}
//           </div>
//         )}
//       </div>

//       {/* Modal Response View */}
//       {selectedMessageId && currentResponse && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
//           <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
//             <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
//               <h2 className="text-xl font-semibold text-gray-900">
//                 AI Response
//               </h2>
//               <button
//                 onClick={() => {
//                   setSelectedMessageId(null);
//                   setCurrentResponse("");
//                 }}
//                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
//               >
//                 ✕
//               </button>
//             </div>

//             <div className="flex-1 overflow-y-auto p-6" ref={responseRef}>
//               <div className="prose prose-gray max-w-none">
//                 <ReactMarkdown
//                   remarkPlugins={[remarkGfm]}
//                   components={{
//                     h1: (props) => (
//                       <h1
//                         className="text-2xl font-bold mb-6 mt-8 text-black border-b-2 border-gray-300 pb-2"
//                         {...props}
//                       />
//                     ),
//                     h2: (props) => (
//                       <h2
//                         className="text-xl font-bold mb-4 mt-6 text-black"
//                         {...props}
//                       />
//                     ),
//                     p: (props) => (
//                       <p
//                         className="mb-4 leading-relaxed text-black"
//                         {...props}
//                       />
//                     ),
//                   }}
//                 >
//                   {animatedResponseContent || currentResponse}
//                 </ReactMarkdown>
//                 {isAnimatingResponse && (
//                   <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1"></span>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatInterface;


// import React, { useState, useEffect, useContext, useRef } from "react";
// import { FileManagerContext } from "../../context/FileManagerContext";
// import documentApi from "../../services/documentApi";
// import {
//   Plus,
//   Shuffle,
//   Search,
//   BookOpen,
//   ChevronDown,
//   MoreVertical,
//   MessageSquare,
//   Loader2,
//   Send,
// } from "lucide-react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import { SidebarContext } from "../../context/SidebarContext";

// const ChatInterface = () => {
//   const {
//     selectedFolder,
//     setChatSessions,
//     selectedChatSessionId,
//     setSelectedChatSessionId,
//     setHasAiResponse,
//   } = useContext(FileManagerContext);
//   const { setForceSidebarCollapsed } = useContext(SidebarContext);

//   const [currentChatHistory, setCurrentChatHistory] = useState([]);
//   const [loadingChat, setLoadingChat] = useState(false);
//   const [chatError, setChatError] = useState(null);

//   const [chatInput, setChatInput] = useState("");
//   const [currentResponse, setCurrentResponse] = useState("");
//   const [animatedResponseContent, setAnimatedResponseContent] = useState("");
//   const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
//   const [selectedMessageId, setSelectedMessageId] = useState(null);
//   const [hasResponse, setHasResponse] = useState(false);

//   // Secret prompt states
//   const [secrets, setSecrets] = useState([]);
//   const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
//   const [selectedSecretId, setSelectedSecretId] = useState(null);
//   const [activeDropdown, setActiveDropdown] = useState("Summary");
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [isSecretPromptSelected, setIsSecretPromptSelected] = useState(false);

//   const responseRef = useRef(null);
//   const dropdownRef = useRef(null);

//   // API Configuration
//   const API_BASE_URL = "http://localhost:5000";

//   const getAuthToken = () => {
//     const tokenKeys = [
//       "authToken",
//       "token",
//       "accessToken",
//       "jwt",
//       "bearerToken",
//       "auth_token",
//       "access_token",
//       "api_token",
//       "userToken",
//     ];

//     for (const key of tokenKeys) {
//       const token = localStorage.getItem(key);
//       if (token) {
//         return token;
//       }
//     }
//     return null;
//   };

//   // Fetch secrets list
//   const fetchSecrets = async () => {
//     try {
//       setIsLoadingSecrets(true);
//       setChatError(null);

//       const token = getAuthToken();
//       const headers = {
//         "Content-Type": "application/json",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const response = await fetch(`${API_BASE_URL}/files/secrets?fetch=true`, {
//         method: "GET",
//         headers,
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch secrets: ${response.status}`);
//       }

//       const secretsData = await response.json();
//       setSecrets(secretsData || []);

//       if (secretsData && secretsData.length > 0) {
//         setActiveDropdown(secretsData[0].name);
//         setSelectedSecretId(secretsData[0].id);
//       }
//     } catch (error) {
//       console.error("Error fetching secrets:", error);
//       setChatError(`Failed to load analysis prompts: ${error.message}`);
//     } finally {
//       setIsLoadingSecrets(false);
//     }
//   };

//   // Fetch secret value by ID
//   const fetchSecretValue = async (secretId) => {
//     try {
//       const existingSecret = secrets.find((secret) => secret.id === secretId);
//       if (existingSecret && existingSecret.value) {
//         return existingSecret.value;
//       }

//       const token = getAuthToken();
//       const headers = {
//         "Content-Type": "application/json",
//       };

//       if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//       }

//       const response = await fetch(
//         `${API_BASE_URL}/files/secrets/${secretId}`,
//         {
//           method: "GET",
//           headers,
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`Failed to fetch secret value: ${response.status}`);
//       }

//       const secretData = await response.json();
//       const promptValue =
//         secretData.value || secretData.prompt || secretData.content || secretData;

//       setSecrets((prevSecrets) =>
//         prevSecrets.map((secret) =>
//           secret.id === secretId ? { ...secret, value: promptValue } : secret
//         )
//       );

//       return promptValue || "";
//     } catch (error) {
//       console.error("Error fetching secret value:", error);
//       throw new Error("Failed to retrieve analysis prompt");
//     }
//   };

//   // Fetch chat history
//   const fetchChatHistory = async (sessionId) => {
//     if (!selectedFolder) return;

//     setLoadingChat(true);
//     setChatError(null);

//     try {
//       let data = await documentApi.getFolderChats(selectedFolder);
//       const chats = Array.isArray(data.chats) ? data.chats : [];
//       setCurrentChatHistory(chats);

//       if (sessionId) {
//         setSelectedChatSessionId(sessionId);
//         const selectedChat = chats.find((c) => c.id === sessionId);
//         if (selectedChat) {
//           const responseText =
//             selectedChat.response ||
//             selectedChat.answer ||
//             selectedChat.message ||
//             "";
//           setCurrentResponse(responseText);
//           setAnimatedResponseContent(responseText);
//           setSelectedMessageId(selectedChat.id);
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         } else if (selectedFolder === "Test" && chats.length > 0) {
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//         }
//       } else {
//         setHasResponse(false);
//         setHasAiResponse(false);
//         setForceSidebarCollapsed(false);
//       }
//     } catch (err) {
//       console.error("❌ Error fetching chats:", err);
//       setChatError("Failed to fetch chat history.");
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // Animate typing effect
//   const animateResponse = (text) => {
//     setAnimatedResponseContent("");
//     setIsAnimatingResponse(true);
//     let i = 0;
//     const interval = setInterval(() => {
//       if (i < text.length) {
//         setAnimatedResponseContent((prev) => prev + text.charAt(i));
//         i++;
//         if (responseRef.current) {
//           responseRef.current.scrollTop = responseRef.current.scrollHeight;
//         }
//       } else {
//         clearInterval(interval);
//         setIsAnimatingResponse(false);
//       }
//     }, 20);
//   };

//   // Chat with AI using secret prompt
//   const chatWithAI = async (folder, secretId, currentSessionId) => {
//     try {
//       setLoadingChat(true);
//       setChatError(null);

//       const selectedSecret = secrets.find((s) => s.id === secretId);
//       if (!selectedSecret) {
//         throw new Error("No prompt found for selected analysis type");
//       }

//       let promptValue = selectedSecret.value;
//       const promptLabel = selectedSecret.name;

//       if (!promptValue) {
//         promptValue = await fetchSecretValue(secretId);
//       }

//       if (!promptValue) {
//         throw new Error("Secret prompt value is empty.");
//       }

//       const response = await documentApi.queryFolderDocuments(
//         folder,
//         promptValue,
//         currentSessionId,
//         {
//           used_secret_prompt: true,
//           prompt_label: promptLabel,
//         }
//       );

//       if (response.sessionId) {
//         setSelectedChatSessionId(response.sessionId);
//       }

//       const history = Array.isArray(response.chatHistory)
//         ? response.chatHistory
//         : [];
//       setCurrentChatHistory(history);

//       if (history.length > 0) {
//         const latestMessage = history[history.length - 1];
//         const responseText =
//           latestMessage.response ||
//           latestMessage.answer ||
//           latestMessage.message ||
//           "";
//         setCurrentResponse(responseText);
//         setSelectedMessageId(latestMessage.id);
//         setHasResponse(true);
//         setHasAiResponse(true);
//         setForceSidebarCollapsed(true);
//         animateResponse(responseText);
//       }

//       return response;
//     } catch (error) {
//       setChatError(`Analysis failed: ${error.message}`);
//       throw error;
//     } finally {
//       setLoadingChat(false);
//     }
//   };

//   // Handle new message (combines regular chat and secret prompt)
//   const handleNewMessage = async () => {
//     if (!selectedFolder) return;

//     if (isSecretPromptSelected) {
//       if (!selectedSecretId) {
//         setChatError("Please select an analysis type.");
//         return;
//       }
//       try {
//         await chatWithAI(selectedFolder, selectedSecretId, selectedChatSessionId);
//         setChatInput("");
//       } catch (error) {
//         // Error already handled
//       }
//     } else {
//       if (!chatInput.trim()) return;

//       setLoadingChat(true);
//       setChatError(null);

//       try {
//         const response = await documentApi.queryFolderDocuments(
//           selectedFolder,
//           chatInput,
//           selectedChatSessionId
//         );

//         if (response.sessionId) {
//           setSelectedChatSessionId(response.sessionId);
//         }

//         const history = Array.isArray(response.chatHistory)
//           ? response.chatHistory
//           : [];
//         setCurrentChatHistory(history);

//         if (history.length > 0) {
//           const latestMessage = history[history.length - 1];
//           const responseText =
//             latestMessage.response ||
//             latestMessage.answer ||
//             latestMessage.message ||
//             "";
//           setCurrentResponse(responseText);
//           setSelectedMessageId(latestMessage.id);
//           setHasResponse(true);
//           setHasAiResponse(true);
//           setForceSidebarCollapsed(true);
//           animateResponse(responseText);
//         }
//         setChatInput("");
//       } catch (err) {
//         setChatError(
//           `Failed to send message: ${err.response?.data?.details || err.message}`
//         );
//       } finally {
//         setLoadingChat(false);
//       }
//     }
//   };

//   // Handle selecting a chat
//   const handleSelectChat = (chat) => {
//     setSelectedMessageId(chat.id);
//     const responseText = chat.response || chat.answer || chat.message || "";
//     setCurrentResponse(responseText);
//     setAnimatedResponseContent(responseText);
//     setIsAnimatingResponse(false);
//     setHasResponse(true);
//     setHasAiResponse(true);
//     setForceSidebarCollapsed(true);
//   };

//   // Handle new chat
//   const handleNewChat = () => {
//     setCurrentChatHistory([]);
//     setSelectedChatSessionId(null);
//     setHasResponse(false);
//     setHasAiResponse(false);
//     setForceSidebarCollapsed(false);
//     setChatInput("");
//     setSelectedMessageId(null);
//     setCurrentResponse("");
//     setAnimatedResponseContent("");
//     setIsSecretPromptSelected(false);
//   };

//   // Handle dropdown selection
//   const handleDropdownSelect = (secretName, secretId) => {
//     setActiveDropdown(secretName);
//     setSelectedSecretId(secretId);
//     setIsSecretPromptSelected(true);
//     setChatInput("");
//     setShowDropdown(false);
//   };

//   // Handle custom input change
//   const handleChatInputChange = (e) => {
//     setChatInput(e.target.value);
//     setIsSecretPromptSelected(false);
//     setActiveDropdown("Custom Query");
//   };

//   // Format relative time
//   const getRelativeTime = (dateString) => {
//     const date = new Date(dateString);
//     const now = new Date();
//     const diffInSeconds = Math.floor((now - date) / 1000);

//     if (diffInSeconds < 60) return `Last message ${diffInSeconds} seconds ago`;
//     if (diffInSeconds < 3600)
//       return `Last message ${Math.floor(diffInSeconds / 60)} minutes ago`;
//     if (diffInSeconds < 86400)
//       return `Last message ${Math.floor(diffInSeconds / 3600)} hours ago`;
//     return `Last message ${Math.floor(diffInSeconds / 86400)} days ago`;
//   };

//   const formatDate = (dateString) => {
//     try {
//       return new Date(dateString).toLocaleString();
//     } catch (e) {
//       return 'Invalid date';
//     }
//   };

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//         setShowDropdown(false);
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   // Load secrets on mount
//   useEffect(() => {
//     fetchSecrets();
//   }, []);

//   useEffect(() => {
//     setChatSessions([]);
//     setCurrentChatHistory([]);
//     setSelectedChatSessionId(null);
//     setHasResponse(false);
//     setHasAiResponse(false);
//     setForceSidebarCollapsed(false);

//     if (selectedFolder && selectedFolder !== "Test") {
//       fetchChatHistory();
//     }
//   }, [selectedFolder]);

//   if (!selectedFolder) {
//     return (
//       <div className="flex items-center justify-center h-full text-gray-400 text-lg bg-[#FDFCFB]">
//         Select a folder to start chatting.
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-white">
//       {/* Left Panel - Chat History */}
//       <div className={`${hasResponse ? 'w-1/2' : 'w-full'} border-r border-gray-200 flex flex-col bg-white h-full`}>
//         {/* Header */}
//         <div className="p-4 border-b border-black border-opacity-20 flex-shrink-0">
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
//             <button
//               onClick={handleNewChat}
//               className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
//             >
//               New Chat
//             </button>
//           </div>

//           {/* Search Input */}
//           <div className="relative mb-4">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
//             <input
//               type="text"
//               placeholder="Search questions..."
//               className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>
//         </div>

//         {/* Chat History List - Scrollable */}
//         <div className="flex-1 overflow-y-auto px-4 py-2">
//           <div className="space-y-2">
//             {currentChatHistory.map((chat) => (
//               <div
//                 key={chat.id}
//                 onClick={() => handleSelectChat(chat)}
//                 className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
//                   selectedMessageId === chat.id
//                     ? "bg-blue-50 border-blue-200 shadow-sm"
//                     : "bg-white border-gray-200 hover:bg-gray-50"
//                 }`}
//               >
//                 <div className="flex items-start justify-between">
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
//                       {chat.question || chat.query || "Untitled"}
//                     </p>
//                     <p className="text-xs text-gray-500">
//                       {getRelativeTime(chat.created_at || chat.timestamp)}
//                     </p>
//                   </div>
//                   <button
//                     onClick={(e) => {
//                       e.stopPropagation();
//                     }}
//                     className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
//                   >
//                     <MoreVertical className="h-5 w-5 text-gray-400" />
//                   </button>
//                 </div>
//               </div>
//             ))}

//             {currentChatHistory.length === 0 && !loadingChat && (
//               <div className="text-center py-12">
//                 <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//                 <p className="text-gray-500">
//                   No chats yet. Start a conversation!
//                 </p>
//               </div>
//             )}

//             {loadingChat && currentChatHistory.length === 0 && (
//               <div className="flex justify-center py-8">
//                 <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Input Area - Fixed at bottom */}
//         <div className="border-t border-gray-200 p-2 bg-white flex-shrink-0">
//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
//             <input
//               type="text"
//               placeholder="How can I help you today?"
//               value={chatInput}
//               onChange={handleChatInputChange}
//               onKeyPress={(e) => e.key === "Enter" && handleNewMessage()}
//               className="w-full text-base text-gray-700 placeholder-gray-400 outline-none bg-transparent"
//               disabled={loadingChat}
//             />

//             {/* Action Buttons Row */}
//             <div className="flex items-center justify-between">
//               <div className="flex items-center space-x-2">
//                 <button
//                   onClick={handleNewChat}
//                   className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
//                   title="New Chat"
//                 >
//                 </button>

//                 {/* Analysis Dropdown */}
//                 <div className="relative" ref={dropdownRef}>
//                   <button
//                     onClick={() => setShowDropdown(!showDropdown)}
//                     disabled={isLoadingSecrets || loadingChat}
//                     className="flex items-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
//                   >
//                     <BookOpen className="h-4 w-4" />
//                     <span className="text-sm font-medium">
//                       {isLoadingSecrets ? "Loading..." : activeDropdown}
//                     </span>
//                     <ChevronDown className="h-4 w-4" />
//                   </button>

//                   {showDropdown && !isLoadingSecrets && (
//                     <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
//                       {secrets.length > 0 ? (
//                         secrets.map((secret) => (
//                           <button
//                             key={secret.id}
//                             onClick={() =>
//                               handleDropdownSelect(secret.name, secret.id)
//                             }
//                             className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
//                           >
//                             {secret.name}
//                           </button>
//                         ))
//                       ) : (
//                         <div className="px-4 py-2.5 text-sm text-gray-500">
//                           No analysis prompts available
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <div className="flex items-center space-x-2">
//                 <button
//                   onClick={handleNewMessage}
//                   disabled={
//                     loadingChat ||
//                     (!chatInput.trim() && !isSecretPromptSelected)
//                   }
//                   className="p-2.5 bg-orange-300 hover:bg-orange-400 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
//                 >
//                   {loadingChat ? (
//                     <Loader2 className="h-5 w-5 text-white animate-spin" />
//                   ) : (
//                     <Send className="h-5 w-5 text-white" />
//                   )}
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* Error Message */}
//           {chatError && (
//             <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
//               {chatError}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Right Panel - AI Response (Similar to AnalysisPage) */}
//       {hasResponse && selectedMessageId && (
//         <div className="w-1/2 flex flex-col h-full">
//           <div className="flex-1 overflow-y-auto" ref={responseRef}>
//             {currentResponse || animatedResponseContent ? (
//               <div className="px-6 py-6">
//                 <div className="max-w-none">
//                   {/* Response Header */}
//                   <div className="mb-6 pb-4 border-b border-gray-200">
//                     <div className="flex items-center justify-between">
//                       <h2 className="text-xl font-semibold text-gray-900">AI Response</h2>
//                       <div className="flex items-center space-x-2 text-sm text-gray-500">
//                         {currentChatHistory.find(msg => msg.id === selectedMessageId)?.timestamp && (
//                           <span>{formatDate(currentChatHistory.find(msg => msg.id === selectedMessageId).timestamp)}</span>
//                         )}
//                       </div>
//                     </div>
//                     {/* Original Question */}
//                     <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
//                       <p className="text-sm font-medium text-blue-900 mb-1">Question:</p>
//                       <p className="text-sm text-blue-800">
//                         {currentChatHistory.find(msg => msg.id === selectedMessageId)?.question || 'No question available'}
//                       </p>
//                     </div>
//                   </div>

//                   {/* Response Content */}
//                   <div className="prose prose-gray max-w-none">
//                     <ReactMarkdown
//                       remarkPlugins={[remarkGfm]}
//                       components={{
//                         h1: (props) => (
//                           <h1
//                             className="text-2xl font-bold mb-6 mt-8 text-black border-b-2 border-gray-300 pb-2"
//                             {...props}
//                           />
//                         ),
//                         h2: (props) => (
//                           <h2
//                             className="text-xl font-bold mb-4 mt-6 text-black"
//                             {...props}
//                           />
//                         ),
//                         h3: (props) => (
//                           <h3
//                             className="text-lg font-bold mb-3 mt-4 text-black"
//                             {...props}
//                           />
//                         ),
//                         p: (props) => (
//                           <p
//                             className="mb-4 leading-relaxed text-black text-justify"
//                             {...props}
//                           />
//                         ),
//                         strong: (props) => (
//                           <strong className="font-bold text-black" {...props} />
//                         ),
//                         ul: (props) => (
//                           <ul className="list-disc pl-5 mb-4 text-black" {...props} />
//                         ),
//                         ol: (props) => (
//                           <ol className="list-decimal pl-5 mb-4 text-black" {...props} />
//                         ),
//                         li: (props) => (
//                           <li className="mb-2 leading-relaxed text-black" {...props} />
//                         ),
//                         blockquote: (props) => (
//                           <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4" {...props} />
//                         ),
//                         code: ({ inline, ...props }) => {
//                           const className = inline 
//                             ? "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-700" 
//                             : "block bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto my-4 text-red-700";
//                           return <code className={className} {...props} />;
//                         },
//                       }}
//                     >
//                       {animatedResponseContent || currentResponse}
//                     </ReactMarkdown>
//                     {isAnimatingResponse && (
//                       <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1"></span>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex items-center justify-center h-full">
//                 <div className="text-center max-w-md px-6">
//                   <MessageSquare className="h-16 w-16 mx-auto mb-6 text-gray-300" />
//                   <h3 className="text-2xl font-semibold mb-4 text-gray-900">Select a Question</h3>
//                   <p className="text-gray-600 text-lg leading-relaxed">
//                     Click on any question from the left panel to view the AI response here.
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatInterface;



import React, { useState, useEffect, useContext, useRef } from "react";
import { FileManagerContext } from "../../context/FileManagerContext";
import documentApi from "../../services/documentApi";
import {
  Plus,
  Shuffle,
  Search,
  BookOpen,
  ChevronDown,
  MoreVertical,
  MessageSquare,
  Loader2,
  Send,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SidebarContext } from "../../context/SidebarContext";

const ChatInterface = () => {
  const {
    selectedFolder,
    setChatSessions,
    selectedChatSessionId,
    setSelectedChatSessionId,
    setHasAiResponse,
  } = useContext(FileManagerContext);
  const { setForceSidebarCollapsed } = useContext(SidebarContext);

  const [currentChatHistory, setCurrentChatHistory] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState(null);

  const [chatInput, setChatInput] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const [animatedResponseContent, setAnimatedResponseContent] = useState("");
  const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [hasResponse, setHasResponse] = useState(false);

  // Secret prompt states
  const [secrets, setSecrets] = useState([]);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [selectedSecretId, setSelectedSecretId] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState("Summary");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSecretPromptSelected, setIsSecretPromptSelected] = useState(false);

  const responseRef = useRef(null);
  const dropdownRef = useRef(null);

  // API Configuration
  const API_BASE_URL = "http://localhost:5000";

  const getAuthToken = () => {
    const tokenKeys = [
      "authToken",
      "token",
      "accessToken",
      "jwt",
      "bearerToken",
      "auth_token",
      "access_token",
      "api_token",
      "userToken",
    ];

    for (const key of tokenKeys) {
      const token = localStorage.getItem(key);
      if (token) {
        return token;
      }
    }
    return null;
  };

  // Fetch secrets list
  const fetchSecrets = async () => {
    try {
      setIsLoadingSecrets(true);
      setChatError(null);

      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/files/secrets?fetch=true`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch secrets: ${response.status}`);
      }

      const secretsData = await response.json();
      setSecrets(secretsData || []);

      if (secretsData && secretsData.length > 0) {
        setActiveDropdown(secretsData[0].name);
        setSelectedSecretId(secretsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching secrets:", error);
      setChatError(`Failed to load analysis prompts: ${error.message}`);
    } finally {
      setIsLoadingSecrets(false);
    }
  };

  // Fetch secret value by ID
  const fetchSecretValue = async (secretId) => {
    try {
      const existingSecret = secrets.find((secret) => secret.id === secretId);
      if (existingSecret && existingSecret.value) {
        return existingSecret.value;
      }

      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/files/secrets/${secretId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch secret value: ${response.status}`);
      }

      const secretData = await response.json();
      const promptValue =
        secretData.value || secretData.prompt || secretData.content || secretData;

      setSecrets((prevSecrets) =>
        prevSecrets.map((secret) =>
          secret.id === secretId ? { ...secret, value: promptValue } : secret
        )
      );

      return promptValue || "";
    } catch (error) {
      console.error("Error fetching secret value:", error);
      throw new Error("Failed to retrieve analysis prompt");
    }
  };

  // Fetch chat history
  const fetchChatHistory = async (sessionId) => {
    if (!selectedFolder) return;

    setLoadingChat(true);
    setChatError(null);

    try {
      let data = await documentApi.getFolderChats(selectedFolder);
      const chats = Array.isArray(data.chats) ? data.chats : [];
      setCurrentChatHistory(chats);

      if (sessionId) {
        setSelectedChatSessionId(sessionId);
        const selectedChat = chats.find((c) => c.id === sessionId);
        if (selectedChat) {
          const responseText =
            selectedChat.response ||
            selectedChat.answer ||
            selectedChat.message ||
            "";
          setCurrentResponse(responseText);
          setAnimatedResponseContent(responseText);
          setSelectedMessageId(selectedChat.id);
          setHasResponse(true);
          setHasAiResponse(true);
          setForceSidebarCollapsed(true);
        } else if (selectedFolder === "Test" && chats.length > 0) {
          setHasResponse(true);
          setHasAiResponse(true);
          setForceSidebarCollapsed(true);
        }
      } else {
        setHasResponse(false);
        setHasAiResponse(false);
        setForceSidebarCollapsed(false);
      }
    } catch (err) {
      console.error("❌ Error fetching chats:", err);
      setChatError("Failed to fetch chat history.");
    } finally {
      setLoadingChat(false);
    }
  };

  // Animate typing effect
  const animateResponse = (text) => {
    setAnimatedResponseContent("");
    setIsAnimatingResponse(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setAnimatedResponseContent((prev) => prev + text.charAt(i));
        i++;
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setIsAnimatingResponse(false);
      }
    }, 20);
  };

  // Chat with AI using secret prompt - CORRECTED
  const chatWithAI = async (folder, secretId, currentSessionId) => {
    try {
      setLoadingChat(true);
      setChatError(null);

      const selectedSecret = secrets.find((s) => s.id === secretId);
      if (!selectedSecret) {
        throw new Error("No prompt found for selected analysis type");
      }

      let promptValue = selectedSecret.value;
      const promptLabel = selectedSecret.name;

      // If the secret doesn't have a value, fetch it
      if (!promptValue) {
        promptValue = await fetchSecretValue(secretId);
      }

      if (!promptValue) {
        throw new Error("Secret prompt value is empty.");
      }

      // CORRECTED: Send the actual prompt value to backend with metadata
      const response = await documentApi.queryFolderDocuments(
        folder,
        promptValue, // Send the actual prompt content
        currentSessionId,
        {
          used_secret_prompt: true,  // Flag that this uses a secret prompt
          prompt_label: promptLabel,  // Store the name/label of the prompt
          secret_id: secretId         // Optional: store the secret ID reference
        }
      );

      if (response.sessionId) {
        setSelectedChatSessionId(response.sessionId);
      }

      const history = Array.isArray(response.chatHistory)
        ? response.chatHistory
        : [];
      setCurrentChatHistory(history);

      if (history.length > 0) {
        const latestMessage = history[history.length - 1];
        const responseText =
          latestMessage.response ||
          latestMessage.answer ||
          latestMessage.message ||
          "";
        setCurrentResponse(responseText);
        setSelectedMessageId(latestMessage.id);
        setHasResponse(true);
        setHasAiResponse(true);
        setForceSidebarCollapsed(true);
        animateResponse(responseText);
      }

      return response;
    } catch (error) {
      setChatError(`Analysis failed: ${error.message}`);
      throw error;
    } finally {
      setLoadingChat(false);
    }
  };

  // Handle new message (combines regular chat and secret prompt)
  const handleNewMessage = async () => {
    if (!selectedFolder) return;

    if (isSecretPromptSelected) {
      // Using secret prompt
      if (!selectedSecretId) {
        setChatError("Please select an analysis type.");
        return;
      }
      try {
        await chatWithAI(selectedFolder, selectedSecretId, selectedChatSessionId);
        setChatInput("");
        setIsSecretPromptSelected(false); // Reset after sending
      } catch (error) {
        // Error already handled
      }
    } else {
      // Regular chat
      if (!chatInput.trim()) return;

      setLoadingChat(true);
      setChatError(null);

      try {
        const response = await documentApi.queryFolderDocuments(
          selectedFolder,
          chatInput,
          selectedChatSessionId,
          {
            used_secret_prompt: false // Explicitly mark as regular chat
          }
        );

        if (response.sessionId) {
          setSelectedChatSessionId(response.sessionId);
        }

        const history = Array.isArray(response.chatHistory)
          ? response.chatHistory
          : [];
        setCurrentChatHistory(history);

        if (history.length > 0) {
          const latestMessage = history[history.length - 1];
          const responseText =
            latestMessage.response ||
            latestMessage.answer ||
            latestMessage.message ||
            "";
          setCurrentResponse(responseText);
          setSelectedMessageId(latestMessage.id);
          setHasResponse(true);
          setHasAiResponse(true);
          setForceSidebarCollapsed(true);
          animateResponse(responseText);
        }
        setChatInput("");
      } catch (err) {
        setChatError(
          `Failed to send message: ${err.response?.data?.details || err.message}`
        );
      } finally {
        setLoadingChat(false);
      }
    }
  };

  // Handle selecting a chat
  const handleSelectChat = (chat) => {
    setSelectedMessageId(chat.id);
    const responseText = chat.response || chat.answer || chat.message || "";
    setCurrentResponse(responseText);
    setAnimatedResponseContent(responseText);
    setIsAnimatingResponse(false);
    setHasResponse(true);
    setHasAiResponse(true);
    setForceSidebarCollapsed(true);
  };

  // Handle new chat
  const handleNewChat = () => {
    setCurrentChatHistory([]);
    setSelectedChatSessionId(null);
    setHasResponse(false);
    setHasAiResponse(false);
    setForceSidebarCollapsed(false);
    setChatInput("");
    setSelectedMessageId(null);
    setCurrentResponse("");
    setAnimatedResponseContent("");
    setIsSecretPromptSelected(false);
    setSelectedSecretId(null);
    // Reset to first secret as default
    if (secrets.length > 0) {
      setActiveDropdown(secrets[0].name);
      setSelectedSecretId(secrets[0].id);
    }
  };

  // Handle dropdown selection
  const handleDropdownSelect = (secretName, secretId) => {
    setActiveDropdown(secretName);
    setSelectedSecretId(secretId);
    setIsSecretPromptSelected(true);
    setChatInput(""); // Clear any custom input
    setShowDropdown(false);
  };

  // Handle custom input change
  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    setIsSecretPromptSelected(false); // Switch to custom query mode
    setActiveDropdown("Custom Query");
  };

  // Format relative time
  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return `Last message ${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
      return `Last message ${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `Last message ${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `Last message ${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load secrets on mount
  useEffect(() => {
    fetchSecrets();
  }, []);

  useEffect(() => {
    setChatSessions([]);
    setCurrentChatHistory([]);
    setSelectedChatSessionId(null);
    setHasResponse(false);
    setHasAiResponse(false);
    setForceSidebarCollapsed(false);

    if (selectedFolder && selectedFolder !== "Test") {
      fetchChatHistory();
    }
  }, [selectedFolder]);

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg bg-[#FDFCFB]">
        Select a folder to start chatting.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel - Chat History */}
      <div className={`${hasResponse ? 'w-1/2' : 'w-full'} border-r border-gray-200 flex flex-col bg-white h-full`}>
        {/* Header */}
        <div className="p-4 border-b border-black border-opacity-20 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              New Chat
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Chat History List - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="space-y-2">
            {currentChatHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedMessageId === chat.id
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                      {chat.question || chat.query || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRelativeTime(chat.created_at || chat.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>
            ))}

            {currentChatHistory.length === 0 && !loadingChat && (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">
                  No chats yet. Start a conversation!
                </p>
              </div>
            )}

            {loadingChat && currentChatHistory.length === 0 && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="border-t border-gray-200 p-2 bg-white flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
            <input
              type="text"
              placeholder={isSecretPromptSelected ? `Analysis: ${activeDropdown}` : "How can I help you today?"}
              value={chatInput}
              onChange={handleChatInputChange}
              onKeyPress={(e) => e.key === "Enter" && handleNewMessage()}
              className="w-full text-base text-gray-700 placeholder-gray-400 outline-none bg-transparent"
              disabled={loadingChat}
            />

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2">
                {/* Analysis Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    disabled={isLoadingSecrets || loadingChat}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isLoadingSecrets ? "Loading..." : activeDropdown}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {showDropdown && !isLoadingSecrets && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                      {secrets.length > 0 ? (
                        secrets.map((secret) => (
                          <button
                            key={secret.id}
                            onClick={() =>
                              handleDropdownSelect(secret.name, secret.id)
                            }
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                          >
                            {secret.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2.5 text-sm text-gray-500">
                          No analysis prompts available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleNewMessage}
                  disabled={
                    loadingChat ||
                    (!chatInput.trim() && !isSecretPromptSelected)
                  }
                  className="p-2.5 bg-orange-300 hover:bg-orange-400 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {loadingChat ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Send className="h-5 w-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {chatError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {chatError}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - AI Response */}
      {hasResponse && selectedMessageId && (
        <div className="w-1/2 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto" ref={responseRef}>
            {currentResponse || animatedResponseContent ? (
              <div className="px-6 py-6">
                <div className="max-w-none">
                  {/* Response Header */}
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-gray-900">AI Response</h2>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        {currentChatHistory.find(msg => msg.id === selectedMessageId)?.timestamp && (
                          <span>{formatDate(currentChatHistory.find(msg => msg.id === selectedMessageId).timestamp)}</span>
                        )}
                      </div>
                    </div>
                    {/* Original Question */}
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <p className="text-sm font-medium text-blue-900 mb-1">Question:</p>
                      <p className="text-sm text-blue-800">
                        {currentChatHistory.find(msg => msg.id === selectedMessageId)?.question || 'No question available'}
                      </p>
                    </div>
                  </div>

                  {/* Response Content */}
                  <div className="prose prose-gray max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: (props) => (
                          <h1
                            className="text-2xl font-bold mb-6 mt-8 text-black border-b-2 border-gray-300 pb-2"
                            {...props}
                          />
                        ),
                        h2: (props) => (
                          <h2
                            className="text-xl font-bold mb-4 mt-6 text-black"
                            {...props}
                          />
                        ),
                        h3: (props) => (
                          <h3
                            className="text-lg font-bold mb-3 mt-4 text-black"
                            {...props}
                          />
                        ),
                        p: (props) => (
                          <p
                            className="mb-4 leading-relaxed text-black text-justify"
                            {...props}
                          />
                        ),
                        strong: (props) => (
                          <strong className="font-bold text-black" {...props} />
                        ),
                        ul: (props) => (
                          <ul className="list-disc pl-5 mb-4 text-black" {...props} />
                        ),
                        ol: (props) => (
                          <ol className="list-decimal pl-5 mb-4 text-black" {...props} />
                        ),
                        li: (props) => (
                          <li className="mb-2 leading-relaxed text-black" {...props} />
                        ),
                        blockquote: (props) => (
                          <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4" {...props} />
                        ),
                        code: ({ inline, ...props }) => {
                          const className = inline 
                            ? "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-700" 
                            : "block bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto my-4 text-red-700";
                          return <code className={className} {...props} />;
                        },
                      }}
                    >
                      {animatedResponseContent || currentResponse}
                    </ReactMarkdown>
                    {isAnimatingResponse && (
                      <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1"></span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md px-6">
                  <MessageSquare className="h-16 w-16 mx-auto mb-6 text-gray-300" />
                  <h3 className="text-2xl font-semibold mb-4 text-gray-900">Select a Question</h3>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    Click on any question from the left panel to view the AI response here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;