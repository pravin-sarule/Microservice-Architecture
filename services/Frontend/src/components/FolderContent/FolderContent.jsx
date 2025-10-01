


// import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
// import { documentApi } from "../../services/documentApi";
// import { FileManagerContext } from "../../context/FileManagerContext";
// import DocumentCard from "./DocumentCard";

// const FolderContent = ({ onDocumentClick }) => {
//   const {
//     selectedFolder,
//     documents,
//     setDocuments,
//     setChatSessions,
//     setSelectedChatSessionId,
//     loading: contextLoading,
//     error: contextError,
//     setError: setContextError,
//   } = useContext(FileManagerContext);

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [processingStatus, setProcessingStatus] = useState(null);
//   const [summaryLoading, setSummaryLoading] = useState(false);
//   const [summaryError, setSummaryError] = useState(null);
//   const [uploading, setUploading] = useState(false);
//   const [processingDocuments, setProcessingDocuments] = useState(new Map());
//   const [selectedDocument, setSelectedDocument] = useState(null);
//   const [showDocumentModal, setShowDocumentModal] = useState(false);
//   const [documentContent, setDocumentContent] = useState("");
//   const [loadingContent, setLoadingContent] = useState(false);
//   const statusIntervalRef = useRef(null);

//   // Helper function to get auth token
//   const getAuthToken = () => {
//     return localStorage.getItem("token") || localStorage.getItem("authToken");
//   };

//   // Helper function to get auth headers
//   const getAuthHeaders = () => {
//     const token = getAuthToken();
//     return {
//       ...(token && { Authorization: `Bearer ${token}` }),
//     };
//   };

//   const fetchFolderContent = useCallback(async () => {
//     if (!selectedFolder) {
//       setDocuments([]);
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await documentApi.getFoldersAndFiles();
//       const currentFolder = (data.folders || []).find(
//         (f) => f.name === selectedFolder
//       );
//       setDocuments(currentFolder?.children || []);
//     } catch (err) {
//       setError("Failed to fetch folder content.");
//       console.error('Error fetching folder content:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [selectedFolder, setDocuments]);

//   const fetchFolderProcessingStatus = useCallback(async () => {
//     if (!selectedFolder) return;
//     try {
//       const statusData = await documentApi.getFolderProcessingStatus(selectedFolder);
//       setProcessingStatus(statusData);
//       if (statusData.processingStatus?.processing > 0 || statusData.processingStatus?.queued > 0) {
//         setTimeout(fetchFolderProcessingStatus, 5000);
//       } else {
//         fetchFolderContent();
//       }
//     } catch (err) {
//       console.error('Error fetching folder processing status:', err);
//     }
//   }, [selectedFolder, fetchFolderContent]);

//   useEffect(() => {
//     fetchFolderContent();
//     fetchFolderProcessingStatus();
//     if (setChatSessions) setChatSessions([]);
//     if (setSelectedChatSessionId) setSelectedChatSessionId(null);
//   }, [selectedFolder, fetchFolderContent, fetchFolderProcessingStatus, setChatSessions, setSelectedChatSessionId]);

//   // Cleanup interval on unmount
//   useEffect(() => {
//     return () => {
//       if (statusIntervalRef.current) {
//         clearInterval(statusIntervalRef.current);
//       }
//     };
//   }, []);

//   const checkProcessingStatus = async (documentId) => {
//     try {
//       const response = await fetch(
//         `http://localhost:5000/docs/status/${documentId}`,
//         {
//           method: "GET",
//           headers: {
//             "Content-Type": "application/json",
//             ...getAuthHeaders(),
//           },
//         }
//       );

//       if (!response.ok) {
//         if (response.status === 401) {
//           throw new Error("Unauthorized - Please login again");
//         }
//         throw new Error("Failed to fetch status");
//       }

//       const statusData = await response.json();
//       console.log(`Status for document ${documentId}:`, statusData); // Debug log
//       return statusData;
//     } catch (err) {
//       console.error("Status check error:", err);
//       return null;
//     }
//   };

//   const startStatusPolling = (documentInfoArray) => {
//     if (statusIntervalRef.current) {
//       clearInterval(statusIntervalRef.current);
//       statusIntervalRef.current = null;
//     }

//     const initialMap = new Map();
//     documentInfoArray.forEach(({ id, name }) => {
//       initialMap.set(id, {
//         name: name,
//         status: "pending",
//         progress: 0,
//         message: "Initializing...",
//       });
//     });
//     setProcessingDocuments(initialMap);

//     const pollStatus = async () => {
//       // Get current processing documents to check
//       const currentDocIds = Array.from(initialMap.keys());
      
//       // If no documents to track, stop polling
//       if (currentDocIds.length === 0) {
//         if (statusIntervalRef.current) {
//           clearInterval(statusIntervalRef.current);
//           statusIntervalRef.current = null;
//         }
//         return;
//       }

//       const statusPromises = currentDocIds.map((id) => checkProcessingStatus(id));
//       const statuses = await Promise.all(statusPromises);

//       const updatedMap = new Map();
//       let allCompleted = true;
//       let hasProcessing = false;

//       statuses.forEach((statusData, index) => {
//         const docId = currentDocIds[index];
//         const docName = initialMap.get(docId).name;

//         if (statusData) {
//           const status = statusData.status || "unknown";
//           const progress = statusData.processing_progress || 0;
//           const message = statusData.message || "";

//           if (status === "processing" || status === "pending" || status === "queued") {
//             allCompleted = false;
//             hasProcessing = true;
//             updatedMap.set(docId, {
//               name: docName,
//               status: status,
//               progress: progress,
//               message: message || "Processing...",
//             });
//           } else if (status === "completed" || status === "processed" || status === "ready") {
//             // Don't add completed/processed documents to the map - they're done
//             // This will make them disappear from the UI
//             console.log(`Document ${docName} is ${status}, removing from tracking`);
//           } else if (status === "failed" || status === "error") {
//             allCompleted = false;
//             updatedMap.set(docId, {
//               name: docName,
//               status: "failed",
//               progress: 0,
//               message: statusData.error || message || "Processing failed",
//             });
//           } else {
//             allCompleted = false;
//             hasProcessing = true;
//             updatedMap.set(docId, {
//               name: docName,
//               status: status,
//               progress: progress,
//               message: message || "Processing...",
//             });
//           }
//         } else {
//           allCompleted = false;
//           hasProcessing = true;
//           updatedMap.set(docId, {
//             name: docName,
//             status: "unknown",
//             progress: 0,
//             message: "Unable to fetch status",
//           });
//         }
//       });

//       setProcessingDocuments(updatedMap);

//       // Stop polling if all documents are completed or if there are no more documents processing
//       if (allCompleted || updatedMap.size === 0) {
//         console.log("All documents processed. Stopping polling.");
//         if (statusIntervalRef.current) {
//           clearInterval(statusIntervalRef.current);
//           statusIntervalRef.current = null;
//         }
//         // Clear the processing documents map
//         setProcessingDocuments(new Map());
//         // Refresh folder content to show the new documents
//         await fetchFolderContent();
//       }
//     };

//     statusIntervalRef.current = setInterval(pollStatus, 2000);
//     pollStatus();
//   };

//   const handleUploadDocuments = async (files) => {
//     if (!selectedFolder) {
//       alert("Please select a folder first.");
//       return;
//     }

//     if (!files || files.length === 0) {
//       return;
//     }

//     const token = getAuthToken();
//     if (!token) {
//       setError("Authentication required. Please login.");
//       return;
//     }

//     if (processingDocuments.size > 0) {
//       alert("Please wait for current documents to finish processing.");
//       return;
//     }

//     setUploading(true);
//     setError(null);

//     try {
//       const formData = new FormData();
//       Array.from(files).forEach((file) => {
//         formData.append("files", file);
//       });

//       const response = await fetch(
//         `http://localhost:5000/docs/${encodeURIComponent(selectedFolder)}/upload`,
//         {
//           method: "POST",
//           headers: {
//             ...getAuthHeaders(),
//           },
//           body: formData,
//         }
//       );

//       if (!response.ok) {
//         if (response.status === 401) {
//           throw new Error("Unauthorized - Please login again");
//         }
//         const errorData = await response.json();
//         throw new Error(errorData.message || "Upload failed");
//       }

//       const result = await response.json();

//       let uploadedDocs = [];
      
//       if (result.documents && Array.isArray(result.documents)) {
//         uploadedDocs = result.documents.map((doc) => ({
//           id: doc.id,
//           name: doc.name || doc.filename || "Unknown",
//         }));
//       } else if (result.data && Array.isArray(result.data)) {
//         uploadedDocs = result.data.map((doc) => ({
//           id: doc.id,
//           name: doc.name || doc.filename || "Unknown",
//         }));
//       } else if (result.id) {
//         uploadedDocs = [{
//           id: result.id,
//           name: result.name || result.filename || "Unknown",
//         }];
//       }

//       if (uploadedDocs.length > 0) {
//         startStatusPolling(uploadedDocs);
//       } else {
//         await fetchFolderContent();
//       }

//       await fetchFolderContent();
//     } catch (err) {
//       setError(`Failed to upload documents: ${err.message}`);
//       console.error("Upload error:", err);
//     } finally {
//       setUploading(false);
//     }
//   };

//   const handleGetSummary = async () => {
//     if (!selectedFolder) {
//       alert('Please select a folder first.');
//       return;
//     }
//     setSummaryLoading(true);
//     setSummaryError(null);
//     try {
//       const summaryData = await documentApi.getFolderSummary(selectedFolder);
//       alert(`Folder Summary: ${summaryData.summary}`);
//     } catch (err) {
//       setSummaryError(`Failed to get folder summary: ${err.response?.data?.details || err.message}`);
//     } finally {
//       setSummaryLoading(false);
//     }
//   };

//   const handleDocumentClick = async (doc) => {
//     setSelectedDocument(doc);
//     setShowDocumentModal(true);
//     setLoadingContent(true);
//     setDocumentContent("");

//     try {
//       const data = await documentApi.getDocumentContent(doc.id);
//       let displayedContent = "No content available";

//       if (data.chunks && Array.isArray(data.chunks)) {
//         displayedContent = data.chunks.map(chunk => chunk.content).join("\n\n");
//       } else if (data.content) {
//         displayedContent = data.content;
//       } else if (data.summary) {
//         displayedContent = data.summary;
//       }
//       setDocumentContent(displayedContent);
//     } catch (err) {
//       console.error("Error fetching document content:", err);
//       setDocumentContent("Error loading document content");
//     } finally {
//       setLoadingContent(false);
//     }
//   };

//   const closeDocumentModal = () => {
//     setShowDocumentModal(false);
//     setSelectedDocument(null);
//     setDocumentContent("");
//   };

//   const isUploadDisabled = uploading || processingDocuments.size > 0;

//   if (!selectedFolder) {
//     return (
//       <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
//         Select a folder to view its contents.
//       </div>
//     );
//   }

//   return (
//     <div className="flex-1 flex flex-col text-gray-800 h-full overflow-hidden">
//       <div className="flex justify-between items-center mb-4 flex-shrink-0">
//         <h2 className="text-xl font-semibold">Folder: {selectedFolder}</h2>
//         <div className="flex space-x-2">
//           <label
//             htmlFor="document-upload"
//             className={`cursor-pointer ${
//               isUploadDisabled
//                 ? "bg-gray-400 cursor-not-allowed"
//                 : "bg-gray-600 hover:bg-gray-700"
//             } text-white px-4 py-2 rounded-md text-sm transition-colors duration-200 flex items-center justify-center`}
//             title={
//               isUploadDisabled
//                 ? "Please wait for processing to complete"
//                 : "Upload documents"
//             }
//           >
//             <span className="text-xl font-bold">
//               {uploading || processingDocuments.size > 0 ? "..." : "+"}
//             </span>
//             <input
//               id="document-upload"
//               type="file"
//               multiple
//               disabled={isUploadDisabled}
//               className="hidden"
//               onChange={(e) => {
//                 handleUploadDocuments(Array.from(e.target.files));
//                 e.target.value = "";
//               }}
//             />
//           </label>
//           <button
//             onClick={handleGetSummary}
//             disabled={summaryLoading}
//             className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-200 disabled:opacity-50"
//           >
//             {summaryLoading ? 'Generating Summary...' : 'Get Folder Summary'}
//           </button>
//         </div>
//       </div>

//       {(error || contextError) && (
//         <div className="text-red-500 mb-4 p-3 bg-red-50 rounded border border-red-200 flex-shrink-0">
//           <strong>Error:</strong> {error || contextError}
//         </div>
//       )}
//       {summaryError && (
//         <div className="text-red-500 mb-4 flex-shrink-0">Summary Error: {summaryError}</div>
//       )}

//       {uploading && (
//         <div className="text-blue-500 mb-4 p-3 bg-blue-50 rounded border border-blue-200 flex-shrink-0">
//           <strong>Uploading documents...</strong>
//         </div>
//       )}

//       {processingDocuments.size > 0 && (
//         <div className="mb-4 p-4 bg-amber-50 rounded border border-amber-200 flex-shrink-0">
//           <div className="flex items-center mb-3">
//             <svg
//               className="animate-spin h-5 w-5 mr-3 text-amber-600"
//               xmlns="http://www.w3.org/2000/svg"
//               fill="none"
//               viewBox="0 0 24 24"
//             >
//               <circle
//                 className="opacity-25"
//                 cx="12"
//                 cy="12"
//                 r="10"
//                 stroke="currentColor"
//                 strokeWidth="4"
//               ></circle>
//               <path
//                 className="opacity-75"
//                 fill="currentColor"
//                 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//               ></path>
//             </svg>
//             <strong className="text-amber-700">
//               Processing {processingDocuments.size} document
//               {processingDocuments.size > 1 ? "s" : ""}
//             </strong>
//           </div>
          
//           <div className="space-y-3">
//             {Array.from(processingDocuments.entries()).map(([id, info]) => (
//               <div key={id} className="bg-white p-3 rounded border border-amber-100">
//                 <div className="flex items-center justify-between mb-2">
//                   <span className="text-sm font-medium text-gray-700 truncate flex-1">
//                     {info.name}
//                   </span>
//                   <span
//                     className={`text-xs px-2 py-1 rounded ml-2 ${
//                       info.status === "completed"
//                         ? "bg-green-100 text-green-700"
//                         : info.status === "failed"
//                         ? "bg-red-100 text-red-700"
//                         : info.status === "processing"
//                         ? "bg-blue-100 text-blue-700"
//                         : "bg-gray-100 text-gray-700"
//                     }`}
//                   >
//                     {info.status}
//                   </span>
//                 </div>
                
//                 <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
//                   <div
//                     className={`h-2 rounded-full transition-all duration-300 ${
//                       info.status === "completed"
//                         ? "bg-green-500"
//                         : info.status === "failed"
//                         ? "bg-red-500"
//                         : "bg-blue-500"
//                     }`}
//                     style={{ width: `${info.progress}%` }}
//                   ></div>
//                 </div>
                
//                 <p className="text-xs text-gray-600">{info.message}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
//         {(loading || contextLoading) ? (
//           <div className="flex items-center justify-center p-8">
//             <div className="text-gray-500">Loading documents...</div>
//           </div>
//         ) : documents.length === 0 ? (
//           <p className="text-gray-400 text-center p-8">
//             No documents in this folder. Upload some to get started!
//           </p>
//         ) : (
//           documents.map((doc) => (
//             <DocumentCard
//               key={doc.id}
//               document={doc}
//               individualStatus={processingDocuments.get(doc.id)}
//               onDocumentClick={() => handleDocumentClick(doc)}
//             />
//           ))
//         )}
//       </div>

//       {/* Document Content Modal */}
//       {showDocumentModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
//             <div className="flex justify-between items-center p-6 border-b">
//               <h3 className="text-xl font-semibold text-gray-800">
//                 {selectedDocument?.name || "Document Content"}
//               </h3>
//               <button
//                 onClick={closeDocumentModal}
//                 className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
//               >
//                 &times;
//               </button>
//             </div>
            
//             <div className="flex-1 overflow-y-auto p-6">
//               {loadingContent ? (
//                 <div className="flex items-center justify-center py-8">
//                   <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full"></div>
//                 </div>
//               ) : (
//                 <div className="prose max-w-none">
//                   <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded">
//                     {documentContent}
//                   </pre>
//                 </div>
//               )}
//             </div>
            
//             <div className="flex justify-end p-6 border-t">
//               <button
//                 onClick={closeDocumentModal}
//                 className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition-colors duration-200"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default FolderContent;




import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import documentApi from "../../services/documentApi";
import { FileManagerContext } from "../../context/FileManagerContext";
import DocumentCard from "./DocumentCard";

const FolderContent = ({ onDocumentClick }) => {
  const {
    selectedFolder,
    documents,
    setDocuments,
    setChatSessions,
    setSelectedChatSessionId,
    loading: contextLoading,
    error: contextError,
    setError: setContextError,
  } = useContext(FileManagerContext);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState(new Map());
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentContent, setDocumentContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const statusIntervalRef = useRef(null);
  const pollingActiveRef = useRef(false);

  const getAuthToken = () => {
    return localStorage.getItem("token") || localStorage.getItem("authToken");
  };

  const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  const fetchFolderContent = useCallback(async () => {
    if (!selectedFolder) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await documentApi.getFoldersAndFiles();
      const currentFolder = (data.folders || []).find(
        (f) => f.name === selectedFolder
      );
      setDocuments(currentFolder?.children || []);
    } catch (err) {
      setError("Failed to fetch folder content.");
      console.error('Error fetching folder content:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, setDocuments]);

  const fetchFolderProcessingStatus = useCallback(async () => {
    if (!selectedFolder) return;
    try {
      const statusData = await documentApi.getFolderProcessingStatus(selectedFolder);
      setProcessingStatus(statusData);
      if (statusData.processingStatus?.processing > 0 || statusData.processingStatus?.queued > 0) {
        setTimeout(fetchFolderProcessingStatus, 5000);
      } else {
        fetchFolderContent();
      }
    } catch (err) {
      console.error('Error fetching folder processing status:', err);
    }
  }, [selectedFolder, fetchFolderContent]);

  useEffect(() => {
    fetchFolderContent();
    fetchFolderProcessingStatus();
    if (setChatSessions) setChatSessions([]);
    if (setSelectedChatSessionId) setSelectedChatSessionId(null);
  }, [selectedFolder, fetchFolderContent, fetchFolderProcessingStatus, setChatSessions, setSelectedChatSessionId]);

  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      pollingActiveRef.current = false;
    };
  }, []);

  const checkProcessingStatus = async (documentId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/docs/status/${documentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Please login again");
        }
        throw new Error("Failed to fetch status");
      }

      const statusData = await response.json();
      console.log(`Status for document ${documentId}:`, statusData);
      return statusData;
    } catch (err) {
      console.error("Status check error:", err);
      return null;
    }
  };

  const startStatusPolling = (documentInfoArray) => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    pollingActiveRef.current = true;

    const trackingMap = new Map();
    documentInfoArray.forEach(({ id, name }) => {
      trackingMap.set(id, {
        name: name,
        status: "pending",
        progress: 0,
        message: "Initializing...",
      });
    });
    setProcessingDocuments(trackingMap);

    const pollStatus = async () => {
      if (!pollingActiveRef.current) {
        console.log("Polling stopped - flag is false");
        return;
      }

      const currentDocIds = Array.from(trackingMap.keys());
      
      if (currentDocIds.length === 0) {
        console.log("No documents to track");
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        pollingActiveRef.current = false;
        return;
      }

      const statusPromises = currentDocIds.map((id) => checkProcessingStatus(id));
      const statuses = await Promise.all(statusPromises);

      const updatedMap = new Map();
      let allCompleted = true;

      statuses.forEach((statusData, index) => {
        const docId = currentDocIds[index];
        const docInfo = trackingMap.get(docId);

        if (statusData) {
          const status = (statusData.status || "unknown").toLowerCase();
          const progress = statusData.processing_progress || statusData.progress || 0;
          const message = statusData.message || "";

          // Check for completion statuses
          if (status === "completed" || status === "processed" || status === "ready" || status === "success") {
            console.log(`Document ${docInfo.name} is ${status} - removing from tracking`);
            // Don't add to updatedMap - this removes it from UI
          } 
          // Check for active processing statuses
          else if (status === "processing" || status === "pending" || status === "queued") {
            allCompleted = false;
            updatedMap.set(docId, {
              name: docInfo.name,
              status: status,
              progress: progress,
              message: message || "Processing...",
            });
          } 
          // Check for error statuses
          else if (status === "failed" || status === "error") {
            allCompleted = false;
            updatedMap.set(docId, {
              name: docInfo.name,
              status: "failed",
              progress: 0,
              message: statusData.error || message || "Processing failed",
            });
          } 
          // Unknown status - keep tracking
          else {
            console.log(`Unknown status "${status}" for ${docInfo.name}`);
            allCompleted = false;
            updatedMap.set(docId, {
              name: docInfo.name,
              status: status,
              progress: progress,
              message: message || "Processing...",
            });
          }
        } else {
          allCompleted = false;
          updatedMap.set(docId, {
            name: docInfo.name,
            status: "unknown",
            progress: 0,
            message: "Unable to fetch status",
          });
        }
      });

      setProcessingDocuments(updatedMap);

      if (allCompleted || updatedMap.size === 0) {
        console.log("✓ All documents processed. Stopping polling.");
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        pollingActiveRef.current = false;
        setProcessingDocuments(new Map());
        await fetchFolderContent();
      }
    };

    statusIntervalRef.current = setInterval(pollStatus, 2000);
    pollStatus();
  };

  const handleUploadDocuments = async (files) => {
    if (!selectedFolder) {
      alert("Please select a folder first.");
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Authentication required. Please login.");
      return;
    }

    if (processingDocuments.size > 0) {
      alert("Please wait for current documents to finish processing.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(
        `http://localhost:5000/docs/${encodeURIComponent(selectedFolder)}/upload`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Please login again");
        }
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      const result = await response.json();

      let uploadedDocs = [];
      
      if (result.documents && Array.isArray(result.documents)) {
        uploadedDocs = result.documents.map((doc) => ({
          id: doc.id,
          name: doc.name || doc.filename || "Unknown",
        }));
      } else if (result.data && Array.isArray(result.data)) {
        uploadedDocs = result.data.map((doc) => ({
          id: doc.id,
          name: doc.name || doc.filename || "Unknown",
        }));
      } else if (result.id) {
        uploadedDocs = [{
          id: result.id,
          name: result.name || result.filename || "Unknown",
        }];
      }

      if (uploadedDocs.length > 0) {
        startStatusPolling(uploadedDocs);
      } else {
        await fetchFolderContent();
      }

      await fetchFolderContent();
    } catch (err) {
      setError(`Failed to upload documents: ${err.message}`);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleGetSummary = async () => {
    if (!selectedFolder) {
      alert('Please select a folder first.');
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const summaryData = await documentApi.getFolderSummary(selectedFolder);
      alert(`Folder Summary: ${summaryData.summary}`);
    } catch (err) {
      setSummaryError(`Failed to get folder summary: ${err.response?.data?.details || err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDocumentClick = async (doc) => {
    setSelectedDocument(doc);
    setShowDocumentModal(true);
    setLoadingContent(true);
    setDocumentContent("");

    try {
      const data = await documentApi.getDocumentContent(doc.id);
      let displayContent = "";

      if (data.chunks && Array.isArray(data.chunks) && data.chunks.length > 0) {
        displayContent = data.chunks
          .map(chunk => chunk.content || chunk.text || "")
          .filter(text => text.trim())
          .join("\n\n---\n\n");
      } else if (data.content) {
        displayContent = data.content;
      } else if (data.summary) {
        displayContent = `=== DOCUMENT SUMMARY ===\n\n${data.summary}`;
      } else if (data.text) {
        displayContent = data.text;
      }

      setDocumentContent(displayContent || "No content available for this document.");
    } catch (err) {
      console.error("Error fetching document content:", err);
      setDocumentContent(`Error loading document content: ${err.message}`);
    } finally {
      setLoadingContent(false);
    }
  };

  const closeDocumentModal = () => {
    setShowDocumentModal(false);
    setSelectedDocument(null);
    setDocumentContent("");
  };

  const isUploadDisabled = uploading || processingDocuments.size > 0;

  if (!selectedFolder) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a folder to view its contents.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col text-gray-800 h-full overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold">Folder: {selectedFolder}</h2>
        <div className="flex space-x-2">
          <label
            htmlFor="document-upload"
            className={`cursor-pointer ${
              isUploadDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gray-600 hover:bg-gray-700"
            } text-white px-4 py-2 rounded-md text-sm transition-colors duration-200 flex items-center justify-center`}
            title={
              isUploadDisabled
                ? "Please wait for processing to complete"
                : "Upload documents"
            }
          >
            <span className="text-xl font-bold">
              {uploading || processingDocuments.size > 0 ? "..." : "+"}
            </span>
            <input
              id="document-upload"
              type="file"
              multiple
              disabled={isUploadDisabled}
              className="hidden"
              onChange={(e) => {
                handleUploadDocuments(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={handleGetSummary}
            disabled={summaryLoading}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-200 disabled:opacity-50"
          >
            {summaryLoading ? 'Generating Summary...' : 'Get Folder Summary'}
          </button>
        </div>
      </div>

      {(error || contextError) && (
        <div className="text-red-500 mb-4 p-3 bg-red-50 rounded border border-red-200 flex-shrink-0">
          <strong>Error:</strong> {error || contextError}
        </div>
      )}
      {summaryError && (
        <div className="text-red-500 mb-4 flex-shrink-0">Summary Error: {summaryError}</div>
      )}

      {uploading && (
        <div className="text-blue-500 mb-4 p-3 bg-blue-50 rounded border border-blue-200 flex-shrink-0">
          <strong>Uploading documents...</strong>
        </div>
      )}

      {processingDocuments.size > 0 && (
        <div className="mb-4 p-4 bg-amber-50 rounded border border-amber-200 flex-shrink-0">
          <div className="flex items-center mb-3">
            <svg
              className="animate-spin h-5 w-5 mr-3 text-amber-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <strong className="text-amber-700">
              Processing {processingDocuments.size} document
              {processingDocuments.size > 1 ? "s" : ""}
            </strong>
          </div>
          
          <div className="space-y-3">
            {Array.from(processingDocuments.entries()).map(([id, info]) => (
              <div key={id} className="bg-white p-3 rounded border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 truncate flex-1">
                    {info.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ml-2 ${
                      info.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : info.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : info.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {info.status}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      info.status === "completed"
                        ? "bg-green-500"
                        : info.status === "failed"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${info.progress}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-gray-600">{info.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {(loading || contextLoading) ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-500">Loading documents...</div>
          </div>
        ) : documents.length === 0 ? (
          <p className="text-gray-400 text-center p-8">
            No documents in this folder. Upload some to get started!
          </p>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              individualStatus={processingDocuments.get(doc.id)}
              onDocumentClick={() => handleDocumentClick(doc)}
            />
          ))
        )}
      </div>

      {showDocumentModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-800">
                {selectedDocument?.name || "Document Content"}
              </h3>
              <button
                onClick={closeDocumentModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full"></div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-4 rounded border border-gray-200 font-sans">
                    {documentContent}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="flex justify-end p-6 border-t bg-white">
              <button
                onClick={closeDocumentModal}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderContent;