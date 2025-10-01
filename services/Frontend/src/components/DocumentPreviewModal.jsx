// import React, { useState, useEffect } from 'react';
// import { createPortal } from 'react-dom';
// import { X } from 'lucide-react';
// import { documentApi } from '../services/documentApi';

// const DocumentPreviewModal = ({ document, onClose }) => {
//   const [fileUrl, setFileUrl] = useState(null);
//   const [fileType, setFileType] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     console.log("DocumentPreviewModal - useEffect triggered. Document:", document);
//     if (!document) {
//       console.log("DocumentPreviewModal - No document provided, returning.");
//       return;
//     }

//     const fetchDocument = async () => {
//       setLoading(true);
//       setError(null);
//       setFileUrl(null);
//       setFileType(null);
//       console.log("DocumentPreviewModal - Fetching content for document:", document.id);

//       try {
//         const response = await documentApi.getDocumentContent(document.id);
//         console.log("DocumentPreviewModal - API response:", response);

//         if (response.content) {
//           const blob = new Blob([response.content], { type: 'text/plain' });
//           setFileUrl(URL.createObjectURL(blob));
//           setFileType('text');
//           console.log("DocumentPreviewModal - Set fileType to text, fileUrl:", URL.createObjectURL(blob));
//         } else if (response.url) {
//           setFileUrl(response.url);
//           const ext = response.url.split('.').pop().toLowerCase();
//           if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) setFileType('image');
//           else if (ext === 'pdf') setFileType('pdf');
//           else setFileType('other');
//           console.log("DocumentPreviewModal - Set fileType to", fileType, "fileUrl:", response.url);
//         } else {
//           setError("No preview available for this document type.");
//           console.log("DocumentPreviewModal - No content or URL in API response.");
//         }
//       } catch (err) {
//         console.error("DocumentPreviewModal - Error fetching document content:", err);
//         setError("Failed to load document content.");
//       } finally {
//         setLoading(false);
//         console.log("DocumentPreviewModal - Loading finished.");
//       }
//     };

//     fetchDocument();
//   }, [document]);

//   if (!document) return null;

//   return createPortal(
//     <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
//         <div className="flex justify-between items-center p-4 border-b border-gray-200">
//           <h2 className="text-xl font-semibold text-gray-800">{document.name}</h2>
//           <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
//             <X className="w-6 h-6" />
//           </button>
//         </div>
//         <div className="flex-1 p-4 overflow-auto bg-gray-50">
//           {loading && <div className="text-center text-gray-600">Loading document preview...</div>}
//           {error && <div className="text-center text-red-500">{error}</div>}
//           {fileUrl && (
//             fileType === 'image' ? (
//               <img src={fileUrl} alt="Document Preview" className="max-w-full h-auto mx-auto" />
//             ) : fileType === 'pdf' ? (
//               <iframe src={fileUrl} title={document.name} className="w-full h-full border-none" />
//             ) : fileType === 'text' ? (
//               <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">{documentContent}</pre>
//             ) : (
//               <div className="text-center text-gray-600">
//                 Preview not available for this file type. You can try downloading it: <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Download</a>
//               </div>
//             )
//           )}
//           {!fileUrl && !loading && !error && (
//             <div className="text-center text-gray-600">No preview available for this document type.</div>
//           )}
//         </div>
//       </div>
//     </div>,
//     document.body
//   );
// };

// export default DocumentPreviewModal;
// import React, { useState, useEffect } from "react";
// import { X } from "lucide-react";
// import { documentApi } from "../services/documentApi";

// const DocumentPreview = ({ file, onClose }) => {
//   const [fileUrl, setFileUrl] = useState(null);
//   const [fileType, setFileType] = useState(null);
//   const [textContent, setTextContent] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     if (!file) return;

//     const fetchFile = async () => {
//       setLoading(true);
//       setError(null);
//       setFileUrl(null);
//       setFileType(null);
//       setTextContent(null);

//       try {
//         const response = await documentApi.getDocumentContent(file.id);

//         if (response.summary || response.chunks) {
//           const text =
//             response.summary ||
//             response.chunks?.map((c) => c.text).join("\n\n") ||
//             "No text extracted.";
//           setTextContent(text);
//           setFileType("text");
//         } else if (response.url) {
//           setFileUrl(response.url);
//           const ext = response.url.split(".").pop().toLowerCase();
//           if (["png", "jpg", "jpeg", "gif"].includes(ext)) setFileType("image");
//           else if (ext === "pdf") setFileType("pdf");
//           else setFileType("other");
//         } else {
//           setError("No preview available for this document type.");
//         }
//       } catch (err) {
//         console.error("Error fetching document content:", err);
//         setError("Failed to load document content.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchFile();
//   }, [file]);

//   if (!file) return null;

//   return (
//     <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
//       {/* Header */}
//       <div className="flex justify-between items-center p-3 border-b border-gray-200">
//         <h2 className="text-lg font-semibold text-gray-800">{file.name}</h2>
//         <button
//           onClick={onClose}
//           className="text-gray-500 hover:text-gray-700"
//         >
//           <X className="w-5 h-5" />
//         </button>
//       </div>

//       {/* Content */}
//       <div className="flex-1 p-4 overflow-auto bg-gray-50">
//         {loading && (
//           <div className="text-center text-gray-600">
//             Loading document preview...
//           </div>
//         )}
//         {error && <div className="text-center text-red-500">{error}</div>}

//         {fileType === "image" && fileUrl && (
//           <img
//             src={fileUrl}
//             alt="Document Preview"
//             className="max-w-full h-auto mx-auto"
//           />
//         )}
//         {fileType === "pdf" && fileUrl && (
//           <iframe
//             src={fileUrl}
//             title={file.name}
//             className="w-full h-[70vh] border-none"
//           />
//         )}
//         {fileType === "text" && textContent && (
//           <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
//             {textContent}
//           </pre>
//         )}
//         {fileType === "other" && fileUrl && (
//           <div className="text-center text-gray-600">
//             Preview not available.{" "}
//             <a
//               href={fileUrl}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-500 hover:underline"
//             >
//               Download
//             </a>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DocumentPreview;



import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import documentApi from "../services/documentApi";

const DocumentPreview = ({ file, onClose }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) return;

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      setFileUrl(null);
      setFileType(null);
      setTextContent(null);

      try {
        const response = await documentApi.getDocumentContent(file.id);

        // Check if we have text content (chunks, summary, or direct content)
        if (response.chunks && Array.isArray(response.chunks) && response.chunks.length > 0) {
          const text = response.chunks
            .map((chunk) => chunk.content || chunk.text || "")
            .filter(text => text.trim())
            .join("\n\n---\n\n");
          setTextContent(text || "No content extracted from chunks.");
          setFileType("text");
        } else if (response.content) {
          setTextContent(response.content);
          setFileType("text");
        } else if (response.summary) {
          setTextContent(`=== DOCUMENT SUMMARY ===\n\n${response.summary}`);
          setFileType("text");
        } else if (response.text) {
          setTextContent(response.text);
          setFileType("text");
        } 
        // Check for URL/file download
        else if (response.url) {
          setFileUrl(response.url);
          const ext = response.url.split(".").pop().toLowerCase();
          if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
            setFileType("image");
          } else if (ext === "pdf") {
            setFileType("pdf");
          } else {
            setFileType("other");
          }
        } 
        // No content available
        else {
          setError("No preview available for this document type.");
        }
      } catch (err) {
        console.error("Error fetching document content:", err);
        setError(`Failed to load document content: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [file]);

  if (!file) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 truncate pr-4">
          {file.name}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 flex-shrink-0"
          title="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto bg-gray-50">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full"></div>
            <span className="ml-3 text-gray-600">Loading document preview...</span>
          </div>
        )}
        
        {error && (
          <div className="text-center p-4">
            <div className="text-red-500 mb-2">{error}</div>
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Download file instead
              </a>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {fileType === "image" && fileUrl && (
              <div className="flex items-center justify-center">
                <img
                  src={fileUrl}
                  alt={file.name}
                  className="max-w-full h-auto rounded shadow-md"
                  onError={() => setError("Failed to load image")}
                />
              </div>
            )}
            
            {fileType === "pdf" && fileUrl && (
              <iframe
                src={fileUrl}
                title={file.name}
                className="w-full h-[70vh] border border-gray-300 rounded"
                onError={() => setError("Failed to load PDF")}
              />
            )}
            
            {fileType === "text" && textContent && (
              <div className="bg-white p-4 rounded border border-gray-200">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                  {textContent}
                </pre>
              </div>
            )}
            
            {fileType === "other" && fileUrl && (
              <div className="text-center p-8 text-gray-600">
                <p className="mb-4">Preview not available for this file type.</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
                >
                  Download File
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
