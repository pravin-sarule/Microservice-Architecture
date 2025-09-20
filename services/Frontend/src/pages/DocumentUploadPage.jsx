// // import React, { useEffect, useRef, useState } from 'react';
// // import { 
// //   Folder, 
// //   FileText, 
// //   Trash2, 
// //   Eye,
// //   ChevronRight,
// //   ChevronDown,
// //   Upload,
// //   Search,
// //   X,
// //   CheckCircle,
// //   AlertTriangle,
// //   Grid3X3,
// //   List,
// //   Calendar,
// //   Download,
// //   Star,
// //   MoreVertical,
// //   Filter,
// //   SortAsc,
// //   RefreshCw,
// //   BookOpen,
// //   Zap,
// //   TrendingUp,
// //   ArrowLeft,
// //   Settings // Add Settings import
// // } from 'lucide-react';
// // import { useNavigate } from 'react-router-dom';
// // import { useFileManager } from '../context/FileManagerContext';

// // const DocumentUploadPage = () => {
// //   const {
// //     folders,
// //     selectedFolder,
// //     folderContents,
// //     uploading,
// //     loading,
// //     error,
// //     success,
// //     dragActive,
// //     searchQuery,
// //     uploadProgress,
// //     stats,
// //     fileInputRef,
// //     folderInputRef,
// //     setSearchQuery,
// //     setError,
// //     setSuccess,
// //     setDragActive,
// //     loadUserFiles,
// //     loadFolderContents,
// //     deleteFile,
// //     toggleFavorite,
// //     selectFolder,
// //     handleDrag,
// //     handleDrop,
// //     handleFileChange,
// //     handleFolderChange,
// //     navigate: fileManagerNavigate // Renamed to avoid conflict with local navigate
// //   } = useFileManager();

// //   const navigate = useNavigate(); // Local navigate for internal page navigation

// //   const [viewMode, setViewMode] = useState('grid');
// //   const [selectedDocument, setSelectedDocument] = useState(null);
// //   const [showDocumentPreview, setShowDocumentPreview] = useState(false);

// //   // Format file size
// //   const formatFileSize = (bytes) => {
// //     if (!bytes || bytes === 0) return '0 B';
// //     const sizes = ['B', 'KB', 'MB', 'GB'];
// //     const i = Math.floor(Math.log(bytes) / Math.log(1024));
// //     return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
// //   };

// //   // Format date
// //   const formatDate = (dateString) => {
// //     return new Date(dateString).toLocaleDateString('en-US', {
// //       year: 'numeric',
// //       month: 'short',
// //       day: 'numeric',
// //       hour: '2-digit',
// //       minute: '2-digit'
// //     });
// //   };

// //   // Get file icon
// //   const getFileIcon = (mimeType) => {
// //     if (!mimeType) return <FileText className="w-6 h-6 text-gray-400" />;
    
// //     if (mimeType.includes('pdf')) 
// //       return <div className="w-8 h-8 bg-red-500 text-white rounded text-xs font-bold flex items-center justify-center">PDF</div>;
// //     if (mimeType.includes('image')) 
// //       return <div className="w-8 h-8 bg-green-500 text-white rounded text-xs font-bold flex items-center justify-center">IMG</div>;
// //     if (mimeType.includes('word') || mimeType.includes('document')) 
// //       return <div className="w-8 h-8 bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center">DOC</div>;
// //     if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) 
// //       return <div className="w-8 h-8 bg-emerald-500 text-white rounded text-xs font-bold flex items-center justify-center">XLS</div>;
// //     if (mimeType.includes('text')) 
// //       return <div className="w-8 h-8 bg-gray-500 text-white rounded text-xs font-bold flex items-center justify-center">TXT</div>;
    
// //     return <FileText className="w-6 h-6 text-gray-400" />;
// //   };

// //   // Select document for preview
// //   const selectDocument = (document) => {
// //     setSelectedDocument(document);
// //     setShowDocumentPreview(true);
// //   };

// //   // Filter and search files
// //   const filteredFiles = folderContents.filter(item => 
// //     item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
// //     (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
// //     (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
// //   );

// //   return (
// //     <div className="h-screen flex flex-col bg-white">
// //       {/* Google Drive Style Header */}
// //       <div className="h-16 border-b border-gray-200 flex items-center px-4 bg-white">
// //         <div className="flex items-center space-x-4 flex-1">
// //           {/* Removed sidebar toggle button */}
          
// //           <div className="flex items-center space-x-3">
// //             <Folder className="w-8 h-8 text-blue-600" />
// //             <span className="text-xl font-normal text-gray-700">Drive</span>
// //           </div>
          
// //           {/* Search Bar - Google Drive Style */}
// //           <div className="flex-1 max-w-2xl mx-8">
// //             <div className="relative">
// //               <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
// //               <input
// //                 type="text"
// //                 placeholder="Search in Drive"
// //                 value={searchQuery}
// //                 onChange={(e) => setSearchQuery(e.target.value)}
// //                 className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:bg-white focus:shadow-md transition-all"
// //               />
// //             </div>
// //           </div>
          
// //           <div className="flex items-center space-x-2">
// //             <button
// //               onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
// //               className="p-2 rounded-full hover:bg-gray-100 transition-colors"
// //               title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
// //             >
// //               {viewMode === 'grid' ? <List className="w-5 h-5 text-gray-600" /> : <Grid3X3 className="w-5 h-5 text-gray-600" />}
// //             </button>
// //             <button
// //               onClick={() => loadUserFiles()}
// //               className="p-2 rounded-full hover:bg-gray-100 transition-colors"
// //               title="Refresh"
// //             >
// //               <RefreshCw className="w-5 h-5 text-gray-600" />
// //             </button>
// //             <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
// //               <Settings className="w-5 h-5 text-gray-600" />
// //             </button>
// //           </div>
// //         </div>
// //       </div>

// //       <div className="flex flex-1 overflow-hidden">
// //         {/* Removed Google Drive Style Sidebar */}

// //         {/* Main Content */}
// //         <div className="flex-1 flex flex-col overflow-hidden">
// //           {/* Breadcrumb */}
// //           {selectedFolder && (
// //             <div className="h-12 border-b border-gray-200 flex items-center px-6 bg-white">
// //               <button
// //                 onClick={() => {
// //                   selectFolder(null); // Go back to My Drive
// //                 }}
// //                 className="p-1 rounded hover:bg-gray-100 transition-colors mr-2"
// //               >
// //                 <ArrowLeft className="w-4 h-4 text-gray-600" />
// //               </button>
// //               <div className="flex items-center text-sm text-gray-600">
// //                 <span>My Drive</span>
// //                 <ChevronRight className="w-4 h-4 mx-1" />
// //                 <span className="font-medium text-gray-900">{selectedFolder.name}</span>
// //               </div>
// //             </div>
// //           )}

// //           {/* Alert Messages */}
// //           {error && (
// //             <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
// //               <div className="flex items-center">
// //                 <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
// //                 <span className="text-red-800 text-sm flex-1">{error}</span>
// //                 <button onClick={() => setError('')} className="text-red-600 hover:text-red-800 p-1">
// //                   <X className="w-4 h-4" />
// //                 </button>
// //               </div>
// //             </div>
// //           )}
          
// //           {success && (
// //             <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
// //               <div className="flex items-center">
// //                 <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
// //                 <span className="text-green-800 text-sm flex-1">{success}</span>
// //                 <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800 p-1">
// //                   <X className="w-4 h-4" />
// //                 </button>
// //               </div>
// //             </div>
// //           )}

// //           {/* Upload Progress */}
// //           {uploading && (
// //             <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
// //               <div className="flex items-center mb-2">
// //                 <Upload className="w-4 h-4 text-blue-600 mr-2 animate-pulse" />
// //                 <span className="text-blue-800 text-sm flex-1">
// //                   Uploading files...
// //                 </span>
// //                 <span className="text-blue-600 text-sm font-medium">{Math.round(uploadProgress)}%</span>
// //               </div>
// //               <div className="w-full bg-blue-200 rounded-full h-2">
// //                 <div 
// //                   className="bg-blue-600 h-2 rounded-full transition-all duration-300"
// //                   style={{ width: `${uploadProgress}%` }}
// //                 ></div>
// //               </div>
// //             </div>
// //           )}

// //           {/* Toolbar */}
// //           <div className="h-12 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
// //             <div className="flex items-center space-x-4">
// //               <span className="text-sm text-gray-600">
// //                 {selectedFolder ? selectedFolder.name : 'My Drive'}
// //               </span>
// //             </div>
            
// //             <div className="flex items-center space-x-2">
// //               {/* Removed Upload folder button */}
// //               <div className="w-px h-4 bg-gray-300"></div>
// //               <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Sort">
// //                 <SortAsc className="w-4 h-4 text-gray-600" />
// //               </button>
// //               <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Filter">
// //                 <Filter className="w-4 h-4 text-gray-600" />
// //               </button>
// //             </div>
// //           </div>

// //           {/* Content Area */}
// //           <div className="flex-1 overflow-y-auto p-6">
// //             {loading ? (
// //               <div className="flex items-center justify-center h-64 text-gray-500">
// //                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
// //                 <span className="ml-3">Loading...</span>
// //               </div>
// //             ) : filteredFiles.length > 0 ? (
// //               <div className={viewMode === 'grid' ? 
// //                 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4' : 
// //                 'space-y-1'
// //               }>
// //                 {filteredFiles.map((item, index) => (
// //                   <div
// //                     key={index}
// //                     className={`group border border-transparent rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer ${
// //                       viewMode === 'grid' ? 'p-3 text-center' : 'p-2 flex items-center'
// //                     }`}
// //                     onClick={() => item.type?.includes('folder') ? selectFolder(item) : selectDocument(item)}
// //                   >
// //                     {viewMode === 'grid' ? (
// //                       <>
// //                         <div className="mb-2 flex justify-center">
// //                           {item.type?.includes('folder') ? (
// //                             <Folder className="w-12 h-12 text-blue-500" />
// //                           ) : (
// //                             getFileIcon(item.type)
// //                           )}
// //                         </div>
// //                         <div className="text-xs text-gray-900 truncate px-1 mb-1">
// //                           {item.name}
// //                         </div>
// //                         {!item.type?.includes('folder') && (
// //                           <div className="text-xs text-gray-500">
// //                             {formatDate(item.created_at)}
// //                           </div>
// //                         )}
// //                         <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
// //                           <div className="flex justify-center space-x-1">
// //                             <button
// //                               onClick={(e) => {
// //                                 e.stopPropagation();
// //                                 toggleFavorite(item.id);
// //                               }}
// //                               className="p-1 rounded hover:bg-gray-200 transition-colors"
// //                             >
// //                               <Star className={`w-3 h-3 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
// //                             </button>
// //                             {!item.type?.includes('folder') && (
// //                               <button
// //                                 onClick={(e) => {
// //                                   e.stopPropagation();
// //                                   deleteFile(item.id);
// //                                 }}
// //                                 className="p-1 rounded hover:bg-gray-200 transition-colors"
// //                               >
// //                                 <Trash2 className="w-3 h-3 text-gray-400" />
// //                               </button>
// //                             )}
// //                             <button className="p-1 rounded hover:bg-gray-200 transition-colors">
// //                               <MoreVertical className="w-3 h-3 text-gray-400" />
// //                             </button>
// //                           </div>
// //                         </div>
// //                       </>
// //                     ) : (
// //                       <>
// //                         <div className="mr-3 flex-shrink-0">
// //                           {item.type?.includes('folder') ? (
// //                             <Folder className="w-6 h-6 text-blue-500" />
// //                           ) : (
// //                             <div className="w-6 h-6 flex items-center justify-center">
// //                               {getFileIcon(item.type)}
// //                             </div>
// //                           )}
// //                         </div>
// //                         <div className="flex-1 min-w-0">
// //                           <div className="text-sm text-gray-900 truncate">{item.name}</div>
// //                           <div className="text-xs text-gray-500">
// //                             {item.type?.includes('folder') ? 'Folder' : formatFileSize(parseInt(item.size || 0))} • {formatDate(item.created_at)}
// //                           </div>
// //                         </div>
// //                         <div className="opacity-0 group-hover:opacity-100 transition-opacity">
// //                           <div className="flex space-x-1">
// //                             <button
// //                               onClick={(e) => {
// //                                 e.stopPropagation();
// //                                 toggleFavorite(item.id);
// //                               }}
// //                               className="p-1.5 rounded hover:bg-gray-200 transition-colors"
// //                             >
// //                               <Star className={`w-4 h-4 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
// //                             </button>
// //                             {!item.type?.includes('folder') && (
// //                               <button
// //                                 onClick={(e) => {
// //                                   e.stopPropagation();
// //                                   deleteFile(item.id);
// //                                 }}
// //                                 className="p-1.5 rounded hover:bg-gray-200 transition-colors"
// //                               >
// //                                 <Trash2 className="w-4 h-4 text-gray-400" />
// //                               </button>
// //                             )}
// //                             <button className="p-1.5 rounded hover:bg-gray-200 transition-colors">
// //                               <MoreVertical className="w-4 h-4 text-gray-400" />
// //                             </button>
// //                           </div>
// //                         </div>
// //                       </>
// //                     )}
// //                   </div>
// //                 ))}
// //               </div>
// //             ) : (
// //               <div className="flex flex-col items-center justify-center h-64 text-gray-500">
// //                 <Folder className="w-16 h-16 mb-4 text-gray-300" />
// //                 <h3 className="text-lg font-medium mb-2">
// //                   {searchQuery ? 'No files found' : 'Folder is empty'}
// //                 </h3>
// //                 <p className="text-sm text-center max-w-md">
// //                   {searchQuery 
// //                     ? 'Try a different search term'
// //                     : 'Drop files here or use the New button in the sidebar'
// //                   }
// //                 </p>
// //               </div>
// //             )}
// //           </div>
// //         </div>
// //       </div>

// //       {/* Document Preview Modal */}
// //       {showDocumentPreview && selectedDocument && (
// //         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
// //           <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
// //             <div className="p-6 border-b border-gray-200 flex items-center justify-between">
// //               <div className="flex items-center">
// //                 <div className="mr-4">
// //                   {getFileIcon(selectedDocument.type)}
// //                 </div>
// //                 <div>
// //                   <h3 className="text-lg font-medium text-gray-900">{selectedDocument.name}</h3>
// //                   <p className="text-sm text-gray-500">
// //                     {formatFileSize(parseInt(selectedDocument.size))} • {formatDate(selectedDocument.created_at)}
// //                   </p>
// //                 </div>
// //               </div>
// //               <button
// //                 onClick={() => setShowDocumentPreview(false)}
// //                 className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
// //               >
// //                 <X className="w-5 h-5" />
// //               </button>
// //             </div>
            
// //             <div className="p-6 max-h-96 overflow-y-auto">
// //               <div className="mb-6">
// //                 <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
// //                   <Zap className="w-5 h-5 text-blue-500 mr-2" />
// //                   AI Summary
// //                 </h4>
// //                 <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
// //                   <p className="text-gray-700 leading-relaxed">{selectedDocument.summary}</p>
// //                 </div>
// //               </div>

// //               <div className="mb-6">
// //                 <h4 className="text-sm font-medium text-gray-900 mb-3">Tags</h4>
// //                 <div className="flex flex-wrap gap-2">
// //                   {selectedDocument.tags && selectedDocument.tags.length > 0 ? (
// //                     selectedDocument.tags.map((tag, index) => (
// //                       <span
// //                         key={index}
// //                         className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
// //                       >
// //                         {tag}
// //                       </span>
// //                     ))
// //                   ) : (
// //                     <span className="text-gray-500 text-sm">No tags available</span>
// //                   )}
// //                 </div>
// //               </div>

// //               <div className="flex gap-3">
// //                 <button
// //                   onClick={() => {
// //                     console.log(`Navigating to drafting page with document:`, selectedDocument);
// //                     navigate('/drafting', { state: { template: selectedDocument } });
// //                   }}
// //                   className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
// //                 >
// //                   Edit Document
// //                 </button>
// //                 <button
// //                   onClick={() => toggleFavorite(selectedDocument.id)}
// //                   className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center"
// //                 >
// //                   <Star className={`w-4 h-4 mr-2 ${selectedDocument.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
// //                   {selectedDocument.isFavorite ? 'Starred' : 'Add to starred'}
// //                 </button>
// //               </div>
// //             </div>
// //           </div>
// //         </div>
// //       )}

// //       {/* Upload Drop Zone Overlay */}
// //       {dragActive && (
// //         <div 
// //           className="fixed inset-0 bg-blue-600/10 flex items-center justify-center z-50"
// //           onDragEnter={handleDrag}
// //           onDragLeave={handleDrag}
// //           onDragOver={handleDrag}
// //           onDrop={handleDrop}
// //         >
// //           <div className="bg-white rounded-lg p-12 shadow-xl border-2 border-blue-300 border-dashed max-w-md text-center">
// //             <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
// //             <h3 className="text-xl font-medium text-gray-900 mb-2">Drop files to upload</h3>
// //             <p className="text-gray-500">Files will be uploaded to {selectedFolder?.name || 'My Drive'}</p>
// //           </div>
// //         </div>
// //       )}

// //       {/* Hidden file inputs */}
// //       <input
// //         ref={fileInputRef}
// //         type="file"
// //         multiple
// //         onChange={handleFileChange}
// //         className="hidden"
// //         accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
// //       />
// //       <input
// //         ref={folderInputRef}
// //         type="file"
// //         multiple
// //         onChange={handleFolderChange}
// //         className="hidden"
// //         webkitdirectory=""
// //         directory=""
// //       />

// //       {/* Global drag and drop handlers */}
// //       <div
// //         className="fixed inset-0 pointer-events-none"
// //         onDragEnter={handleDrag}
// //         onDragLeave={handleDrag}
// //         onDragOver={handleDrag}
// //         onDrop={handleDrop}
// //       />
// //     </div>
// //   );
// // };

// // export default DocumentUploadPage;


// import React, { useEffect, useRef, useState } from 'react';
// import { 
//   Folder, 
//   FileText, 
//   Trash2, 
//   Eye,
//   ChevronRight,
//   ChevronDown,
//   Upload,
//   Search,
//   X,
//   CheckCircle,
//   AlertTriangle,
//   Grid3X3,
//   List,
//   Calendar,
//   Download,
//   Star,
//   MoreVertical,
//   Filter,
//   SortAsc,
//   RefreshCw,
//   BookOpen,
//   Zap,
//   TrendingUp,
//   ArrowLeft,
//   Settings,
//   Home,
//   FolderPlus
// } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import { useFileManager } from '../context/FileManagerContext';

// const DocumentUploadPage = () => {
//   const {
//     folders,
//     selectedFolder,
//     folderContents,
//     uploading,
//     loading,
//     error,
//     success,
//     dragActive,
//     searchQuery,
//     uploadProgress,
//     stats,
//     fileInputRef,
//     folderInputRef,
//     expandedFolders,
//     setSearchQuery,
//     setError,
//     setSuccess,
//     setDragActive,
//     loadUserFiles,
//     loadFolderContents,
//     deleteFile,
//     toggleFavorite,
//     selectFolder,
//     toggleFolder,
//     handleDrag,
//     handleDrop,
//     handleFileChange,
//     handleFolderChange,
//     navigate: fileManagerNavigate, // Renamed to avoid conflict with local navigate
//     createFolder,
//     setShowNewFolderInput,
//     showNewFolderInput,
//     newFolderName,
//     setNewFolderName,
//     creatingFolder
//   } = useFileManager();

//   const navigate = useNavigate(); // Local navigate for internal page navigation

//   const [viewMode, setViewMode] = useState('list');
//   const [selectedDocument, setSelectedDocument] = useState(null);
//   const [showDocumentPreview, setShowDocumentPreview] = useState(false);

//   // Load user files on component mount
//   useEffect(() => {
//     loadUserFiles();
//   }, []);

//   // Format file size
//   const formatFileSize = (bytes) => {
//     if (!bytes || bytes === 0) return '0 B';
//     const sizes = ['B', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(1024));
//     return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
//   };

//   // Format date
//   const formatDate = (dateString) => {
//     return new Date(dateString).toLocaleDateString('en-US', {
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

//   // Get file icon
//   const getFileIcon = (mimeType) => {
//     if (!mimeType) return <FileText className="w-6 h-6 text-gray-400" />;
    
//     if (mimeType.includes('pdf')) 
//       return <div className="w-8 h-8 bg-red-500 text-white rounded text-xs font-bold flex items-center justify-center">PDF</div>;
//     if (mimeType.includes('image')) 
//       return <div className="w-8 h-8 bg-green-500 text-white rounded text-xs font-bold flex items-center justify-center">IMG</div>;
//     if (mimeType.includes('word') || mimeType.includes('document')) 
//       return <div className="w-8 h-8 bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center">DOC</div>;
//     if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) 
//       return <div className="w-8 h-8 bg-emerald-500 text-white rounded text-xs font-bold flex items-center justify-center">XLS</div>;
//     if (mimeType.includes('text')) 
//       return <div className="w-8 h-8 bg-gray-500 text-white rounded text-xs font-bold flex items-center justify-center">TXT</div>;
    
//     return <FileText className="w-6 h-6 text-gray-400" />;
//   };

//   // Select document for preview
//   const selectDocument = (document) => {
//     setSelectedDocument(document);
//     setShowDocumentPreview(true);
//   };

//   // Filter and search files
//   const filteredFiles = folderContents.filter(item => 
//     item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
//     (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
//   );

//   // Helper component for rendering folder tree
//   const FolderTreeComponent = ({ items, level = 0, parentPath = '', searchQuery = '' }) => {
//     return items
//       .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
//       .map((item, index) => {
//         const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
//         const isExpanded = expandedFolders.has(itemPath);
//         const hasChildren = item.children && item.children.length > 0;
//         const isSelected = selectedFolder?.id === item.id;
        
//         return (
//           <div key={`${itemPath}-${index}`} className="select-none">
//             <button
//               onClick={() => selectFolder(item)}
//               className={`group flex items-center w-full py-1.5 px-3 mx-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
//                 isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
//               }`}
//               style={{ paddingLeft: `${(level * 16) + 12}px` }} // Adjust padding for hierarchy
//             >
//               {hasChildren && (
//                 <span
//                   onClick={(e) => {
//                     e.stopPropagation(); // Prevent button click from also selecting folder
//                     toggleFolder(itemPath);
//                   }}
//                   className="mr-2 p-0.5 rounded hover:bg-gray-200 transition-colors"
//                 >
//                   {isExpanded ? (
//                     <ChevronDown className="w-4 h-4 text-gray-400" />
//                   ) : (
//                     <ChevronRight className="w-4 h-4 text-gray-400" />
//                   )}
//                 </span>
//               )}
//               {!hasChildren && <span className="w-4 h-4 mr-2" />} {/* Spacer for alignment */}
//               <Folder className={`h-4 w-4 mr-2 flex-shrink-0 ${
//                 isSelected ? 'text-blue-600' : 'text-gray-400'
//               }`} />
//               <span className="text-sm truncate">{item.name}</span>
//             </button>
            
//             {hasChildren && isExpanded && (
//               <div className="mt-0.5">
//                 <FolderTreeComponent
//                   items={item.children}
//                   level={level + 1}
//                   parentPath={itemPath}
//                   searchQuery={searchQuery}
//                 />
//               </div>
//             )}
//           </div>
//         );
//       });
//   };

//   return (
//     <div className="h-screen flex flex-col bg-white">
//       {/* Google Drive Style Header */}
//       <div className="h-16 border-b border-gray-200 flex items-center px-4 bg-white">
//         <div className="flex items-center space-x-4 flex-1">
//           <div className="flex items-center space-x-3">
//             <Folder className="w-8 h-8 text-blue-600" />
//             <span className="text-xl font-normal text-gray-700">Drive</span>
//           </div>
          
//           {/* Search Bar - Google Drive Style */}
//           <div className="flex-1 max-w-2xl mx-8">
//             <div className="relative">
//               <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
//               <input
//                 type="text"
//                 placeholder="Search in Drive"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:bg-white focus:shadow-md transition-all"
//               />
//             </div>
//           </div>
          
//           <div className="flex items-center space-x-2">
//             <button
//               onClick={() => loadUserFiles()}
//               className="p-2 rounded-full hover:bg-gray-100 transition-colors"
//               title="Refresh"
//             >
//               <RefreshCw className="w-5 h-5 text-gray-600" />
//             </button>
//             <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
//               <Settings className="w-5 h-5 text-gray-600" />
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="flex flex-1 overflow-hidden">

//         {/* Main Content */}
//         <div className="flex-1 flex flex-col overflow-hidden w-full">
//           {/* Breadcrumb */}
//           {selectedFolder && (
//             <div className="h-12 border-b border-gray-200 flex items-center px-6 bg-white">
//               <button
//                 onClick={() => {
//                   selectFolder(null); // Go back to My Drive
//                 }}
//                 className="p-1 rounded hover:bg-gray-100 transition-colors mr-2"
//               >
//                 <ArrowLeft className="w-4 h-4 text-gray-600" />
//               </button>
//               <div className="flex items-center text-sm text-gray-600">
//                 <span>My Drive</span>
//                 <ChevronRight className="w-4 h-4 mx-1" />
//                 <span className="font-medium text-gray-900">{selectedFolder.name}</span>
//               </div>
//             </div>
//           )}

//           {/* Alert Messages */}
//           {error && (
//             <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
//               <div className="flex items-center">
//                 <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
//                 <span className="text-red-800 text-sm flex-1">{error}</span>
//                 <button onClick={() => setError('')} className="text-red-600 hover:text-red-800 p-1">
//                   <X className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
//           )}
          
//           {success && (
//             <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
//               <div className="flex items-center">
//                 <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
//                 <span className="text-green-800 text-sm flex-1">{success}</span>
//                 <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800 p-1">
//                   <X className="w-4 h-4" />
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* Upload Progress */}
//           {uploading && (
//             <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//               <div className="flex items-center mb-2">
//                 <Upload className="w-4 h-4 text-blue-600 mr-2 animate-pulse" />
//                 <span className="text-blue-800 text-sm flex-1">
//                   Uploading files...
//                 </span>
//                 <span className="text-blue-600 text-sm font-medium">{Math.round(uploadProgress)}%</span>
//               </div>
//               <div className="w-full bg-blue-200 rounded-full h-2">
//                 <div 
//                   className="bg-blue-600 h-2 rounded-full transition-all duration-300"
//                   style={{ width: `${uploadProgress}%` }}
//                 ></div>
//               </div>
//             </div>
//           )}

//           {/* Toolbar */}
//           <div className="h-12 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
//             <div className="flex items-center space-x-4">
//               <span className="text-sm text-gray-600">
//                 {selectedFolder ? selectedFolder.name : 'My Drive'}
//               </span>
//             </div>
            
//             <div className="flex items-center space-x-2">
//               <div className="w-px h-4 bg-gray-300"></div>
//               <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Sort">
//                 <SortAsc className="w-4 h-4 text-gray-600" />
//               </button>
//               <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Filter">
//                 <Filter className="w-4 h-4 text-gray-600" />
//               </button>
//             </div>
//           </div>

//           {/* Content Area */}
//           <div className="flex-1 overflow-y-auto p-6">
//             {loading ? (
//               <div className="flex items-center justify-center h-64 text-gray-500">
//                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
//                 <span className="ml-3">Loading...</span>
//               </div>
//             ) : filteredFiles.length > 0 ? (
//               <div className={viewMode === 'grid' ? 
//                 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4' : 
//                 'space-y-1'
//               }>
//                 {filteredFiles.map((item, index) => (
//                   <div
//                     key={index}
//                     className={`group border border-transparent rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer ${
//                       viewMode === 'grid' ? 'p-3 text-center' : 'p-2 flex items-center'
//                     }`}
//                     onClick={() => item.type?.includes('folder') ? selectFolder(item) : selectDocument(item)}
//                   >
//                     {viewMode === 'grid' ? (
//                       <>
//                         <div className="mb-2 flex justify-center">
//                           {item.type?.includes('folder') ? (
//                             <Folder className="w-12 h-12 text-blue-500" />
//                           ) : (
//                             getFileIcon(item.type)
//                           )}
//                         </div>
//                         <div className="text-xs text-gray-900 truncate px-1 mb-1">
//                           {item.name}
//                         </div>
//                         {!item.type?.includes('folder') && (
//                           <div className="text-xs text-gray-500">
//                             {formatDate(item.created_at)}
//                           </div>
//                         )}
//                         <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
//                           <div className="flex justify-center space-x-1">
//                             <button
//                               onClick={(e) => {
//                                 e.stopPropagation();
//                                 toggleFavorite(item.id);
//                               }}
//                               className="p-1 rounded hover:bg-gray-200 transition-colors"
//                             >
//                               <Star className={`w-3 h-3 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
//                             </button>
//                             {!item.type?.includes('folder') && (
//                               <button
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   deleteFile(item.id);
//                                 }}
//                                 className="p-1 rounded hover:bg-gray-200 transition-colors"
//                               >
//                                 <Trash2 className="w-3 h-3 text-gray-400" />
//                               </button>
//                             )}
//                             <button className="p-1 rounded hover:bg-gray-200 transition-colors">
//                               <MoreVertical className="w-3 h-3 text-gray-400" />
//                             </button>
//                           </div>
//                         </div>
//                       </>
//                     ) : (
//                       <>
//                         <div className="mr-3 flex-shrink-0">
//                           {item.type?.includes('folder') ? (
//                             <Folder className="w-6 h-6 text-blue-500" />
//                           ) : (
//                             <div className="w-6 h-6 flex items-center justify-center">
//                               {getFileIcon(item.type)}
//                             </div>
//                           )}
//                         </div>
//                         <div className="flex-1 min-w-0">
//                           <div className="text-sm text-gray-900 truncate">{item.name}</div>
//                           <div className="text-xs text-gray-500">
//                             {item.type?.includes('folder') ? 'Folder' : formatFileSize(parseInt(item.size || 0))} • {formatDate(item.created_at)}
//                           </div>
//                         </div>
//                         <div className="opacity-0 group-hover:opacity-100 transition-opacity">
//                           <div className="flex space-x-1">
//                             <button
//                               onClick={(e) => {
//                                 e.stopPropagation();
//                                 toggleFavorite(item.id);
//                               }}
//                               className="p-1.5 rounded hover:bg-gray-200 transition-colors"
//                             >
//                               <Star className={`w-4 h-4 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
//                             </button>
//                             {!item.type?.includes('folder') && (
//                               <button
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   deleteFile(item.id);
//                                 }}
//                                 className="p-1.5 rounded hover:bg-gray-200 transition-colors"
//                               >
//                                 <Trash2 className="w-4 h-4 text-gray-400" />
//                               </button>
//                             )}
//                             <button className="p-1.5 rounded hover:bg-gray-200 transition-colors">
//                               <MoreVertical className="w-4 h-4 text-gray-400" />
//                             </button>
//                           </div>
//                         </div>
//                       </>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="flex flex-col items-center justify-center h-64 text-gray-500">
//                 <Folder className="w-16 h-16 mb-4 text-gray-300" />
//                 <h3 className="text-lg font-medium mb-2">
//                   {searchQuery ? 'No files found' : 'Folder is empty'}
//                 </h3>
//                 <p className="text-sm text-center max-w-md">
//                   {searchQuery 
//                     ? 'Try a different search term'
//                     : 'This folder is empty. You can add documents here.'
//                   }
//                 </p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Document Preview Modal */}
//       {showDocumentPreview && selectedDocument && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
//           <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
//             <div className="p-6 border-b border-gray-200 flex items-center justify-between">
//               <div className="flex items-center">
//                 <div className="mr-4">
//                   {getFileIcon(selectedDocument.type)}
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-medium text-gray-900">{selectedDocument.name}</h3>
//                   <p className="text-sm text-gray-500">
//                     {formatFileSize(parseInt(selectedDocument.size))} • {formatDate(selectedDocument.created_at)}
//                   </p>
//                 </div>
//               </div>
//               <button
//                 onClick={() => setShowDocumentPreview(false)}
//                 className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
            
//             <div className="p-6 max-h-96 overflow-y-auto">
//               <div className="mb-6">
//                 <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
//                   <Zap className="w-5 h-5 text-blue-500 mr-2" />
//                   AI Summary
//                 </h4>
//                 <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
//                   <p className="text-gray-700 leading-relaxed">{selectedDocument.summary}</p>
//                 </div>
//               </div>

//               <div className="mb-6">
//                 <h4 className="text-sm font-medium text-gray-900 mb-3">Tags</h4>
//                 <div className="flex flex-wrap gap-2">
//                   {selectedDocument.tags && selectedDocument.tags.length > 0 ? (
//                     selectedDocument.tags.map((tag, index) => (
//                       <span
//                         key={index}
//                         className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
//                       >
//                         {tag}
//                       </span>
//                     ))
//                   ) : (
//                     <span className="text-gray-500 text-sm">No tags available</span>
//                   )}
//                 </div>
//               </div>

//               <div className="flex gap-3">
//                 <button
//                   onClick={() => {
//                     console.log(`Navigating to drafting page with document:`, selectedDocument);
//                     navigate('/drafting', { state: { template: selectedDocument } });
//                   }}
//                   className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
//                 >
//                   Edit Document
//                 </button>
//                 <button
//                   onClick={() => toggleFavorite(selectedDocument.id)}
//                   className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center"
//                 >
//                   <Star className={`w-4 h-4 mr-2 ${selectedDocument.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
//                   {selectedDocument.isFavorite ? 'Starred' : 'Add to starred'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Upload Drop Zone Overlay */}
//       {dragActive && (
//         <div 
//           className="fixed inset-0 bg-blue-600/10 flex items-center justify-center z-50"
//           onDragEnter={handleDrag}
//           onDragLeave={handleDrag}
//           onDragOver={handleDrag}
//           onDrop={handleDrop}
//         >
//           <div className="bg-white rounded-lg p-12 shadow-xl border-2 border-blue-300 border-dashed max-w-md text-center">
//             <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
//             <h3 className="text-xl font-medium text-gray-900 mb-2">Drop files to upload</h3>
//             <p className="text-gray-500">Files will be uploaded to {selectedFolder?.name || 'My Drive'}</p>
//           </div>
//         </div>
//       )}

//       {/* Hidden file inputs */}
//       <input
//         ref={fileInputRef}
//         type="file"
//         multiple
//         onChange={handleFileChange}
//         className="hidden"
//         accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
//       />
//       <input
//         ref={folderInputRef}
//         type="file"
//         multiple
//         onChange={handleFolderChange}
//         className="hidden"
//         webkitdirectory=""
//         directory=""
//       />

//       {/* Global drag and drop handlers */}
//       <div
//         className="fixed inset-0 pointer-events-none"
//         onDragEnter={handleDrag}
//         onDragLeave={handleDrag}
//         onDragOver={handleDrag}
//         onDrop={handleDrop}
//       />
//     </div>
//   );
// };

// export default DocumentUploadPage;


import React, { useEffect, useRef, useState } from 'react';
import { 
  Folder, 
  FileText, 
  Trash2, 
  Eye,
  ChevronRight,
  ChevronDown,
  Upload,
  Search,
  X,
  CheckCircle,
  AlertTriangle,
  Grid3X3,
  List,
  Calendar,
  Download,
  Star,
  MoreVertical,
  Filter,
  SortAsc,
  RefreshCw,
  BookOpen,
  Zap,
  TrendingUp,
  ArrowLeft,
  Settings,
  Home,
  FolderPlus,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFileManager } from '../context/FileManagerContext';

const DocumentUploadPage = () => {
  const {
    folders,
    selectedFolder,
    folderContents,
    uploading,
    loading,
    error,
    success,
    dragActive,
    searchQuery,
    uploadProgress,
    stats,
    fileInputRef,
    folderInputRef,
    expandedFolders,
    setSearchQuery,
    setError,
    setSuccess,
    setDragActive,
    loadUserFiles,
    loadFolderContents,
    deleteFile,
    toggleFavorite,
    selectFolder,
    toggleFolder,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleFolderChange,
    navigate: fileManagerNavigate,
    createFolder,
    setShowNewFolderInput,
    showNewFolderInput,
    newFolderName,
    setNewFolderName,
    creatingFolder
  } = useFileManager();

  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('list');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [documentContent, setDocumentContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Load user files on component mount
  useEffect(() => {
    loadUserFiles();
  }, [loadUserFiles]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Invalid date';
    }
  };

  // Get file icon based on file type
  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileText className="w-6 h-6 text-gray-400" />;
    
    const type = mimeType.toLowerCase();
    
    if (type.includes('pdf')) 
      return <div className="w-8 h-8 bg-red-500 text-white rounded text-xs font-bold flex items-center justify-center">PDF</div>;
    if (type.includes('image')) 
      return <div className="w-8 h-8 bg-green-500 text-white rounded text-xs font-bold flex items-center justify-center">IMG</div>;
    if (type.includes('word') || type.includes('document')) 
      return <div className="w-8 h-8 bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center">DOC</div>;
    if (type.includes('excel') || type.includes('spreadsheet')) 
      return <div className="w-8 h-8 bg-emerald-500 text-white rounded text-xs font-bold flex items-center justify-center">XLS</div>;
    if (type.includes('text')) 
      return <div className="w-8 h-8 bg-gray-500 text-white rounded text-xs font-bold flex items-center justify-center">TXT</div>;
    if (type.includes('presentation') || type.includes('powerpoint'))
      return <div className="w-8 h-8 bg-orange-500 text-white rounded text-xs font-bold flex items-center justify-center">PPT</div>;
    
    return <FileText className="w-6 h-6 text-gray-400" />;
  };

  // Select document for preview
  const selectDocument = async (document) => {
    setSelectedDocument(document);
    setShowDocumentPreview(true);
    setDocumentContent(null); // Clear previous content
    setContentLoading(true);

    if (document.type && document.type.includes('text') && document.url) {
      try {
        const response = await fetch(document.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        setDocumentContent(text);
      } catch (err) {
        console.error("Failed to fetch document content:", err);
        setDocumentContent("Failed to load document content.");
      } finally {
        setContentLoading(false);
      }
    } else {
      setContentLoading(false);
    }
  };

  // Sort files
  const sortFiles = (files) => {
    return [...files].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'date':
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        case 'size':
          aValue = parseInt(a.size || 0);
          bValue = parseInt(b.size || 0);
          break;
        case 'type':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        default:
          aValue = a.name || '';
          bValue = b.name || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Filter and search files
  const filteredFiles = sortFiles(
    folderContents.filter(item => {
      const searchTerm = searchQuery.toLowerCase();
      return (
        (item.name || '').toLowerCase().includes(searchTerm) ||
        (item.summary || '').toLowerCase().includes(searchTerm) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    })
  );

  // Handle new folder creation
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder();
    }
  };

  // Handle file upload trigger
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Helper component for rendering folder tree
  const FolderTreeComponent = ({ items, level = 0, parentPath = '' }) => {
    if (!Array.isArray(items)) return null;

    return items.map((item, index) => {
      if (!item) return null;
      
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      const isExpanded = expandedFolders.has(itemPath);
      const hasChildren = item.children && item.children.length > 0;
      const isSelected = selectedFolder?.id === item.id;
      
      return (
        <div key={`${itemPath}-${index}`} className="select-none">
          <button
            onClick={() => selectFolder(item)}
            className={`group flex items-center w-full py-1.5 px-3 mx-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
              isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
            style={{ paddingLeft: `${(level * 16) + 12}px` }}
          >
            {hasChildren && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(itemPath);
                }}
                className="mr-2 p-0.5 rounded hover:bg-gray-200 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </span>
            )}
            {!hasChildren && <span className="w-4 h-4 mr-2" />}
            <Folder className={`h-4 w-4 mr-2 flex-shrink-0 ${
              isSelected ? 'text-blue-600' : 'text-gray-400'
            }`} />
            <span className="text-sm truncate">{item.name}</span>
            {item.documentCount > 0 && (
              <span className="ml-auto text-xs text-gray-500">{item.documentCount}</span>
            )}
          </button>
          
          {hasChildren && isExpanded && (
            <div className="mt-0.5">
              <FolderTreeComponent
                items={item.children}
                level={level + 1}
                parentPath={itemPath}
              />
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-4 bg-white">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex items-center space-x-3">
            <Folder className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-normal text-gray-700">Client Folder</span>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search in Drive"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:bg-white focus:shadow-md transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List className="w-5 h-5 text-gray-600" /> : <Grid3X3 className="w-5 h-5 text-gray-600" />}
            </button>
            <button
              onClick={() => loadUserFiles()}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* Breadcrumb */}
          {selectedFolder && (
            <div className="h-12 border-b border-gray-200 flex items-center px-6 bg-white">
              <button
                onClick={() => selectFolder(null)}
                className="p-1 rounded hover:bg-gray-100 transition-colors mr-2"
              >
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex items-center text-sm text-gray-600">
                <span>Client Drive</span>
                <ChevronRight className="w-4 h-4 mx-1" />
                <span className="font-medium text-gray-900">{selectedFolder.name}</span>
              </div>
            </div>
          )}

          {/* Alert Messages */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-red-800 text-sm flex-1">{error}</span>
                <button onClick={() => setError('')} className="text-red-600 hover:text-red-800 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {success && (
            <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-green-800 text-sm flex-1">{success}</span>
                <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center mb-2">
                <Upload className="w-4 h-4 text-blue-600 mr-2 animate-pulse" />
                <span className="text-blue-800 text-sm flex-1">
                  Uploading files...
                </span>
                <span className="text-blue-600 text-sm font-medium">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="h-12 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {selectedFolder ? selectedFolder.name : 'Client Drive'}
              </span>
              {filteredFiles.length > 0 && (
                <span className="text-xs text-gray-500">
                  {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="name">Name</option>
                <option value="date">Date</option>
                <option value="size">Size</option>
                <option value="type">Type</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <SortAsc className={`w-4 h-4 text-gray-600 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>


          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3">Loading...</span>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div className={viewMode === 'grid' ? 
                'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4' : 
                'space-y-1'
              }>
                {filteredFiles.map((item, index) => (
                  <div
                    key={item.id || index}
                    className={`group border border-transparent rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer ${
                      viewMode === 'grid' ? 'p-3 text-center' : 'p-2 flex items-center'
                    }`}
                    onClick={() => item.type?.includes('folder') || item.isFolder ? selectFolder(item) : selectDocument(item)}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <div className="mb-2 flex justify-center">
                          {item.type?.includes('folder') || item.isFolder ? (
                            <Folder className="w-12 h-12 text-blue-500" />
                          ) : (
                            getFileIcon(item.type)
                          )}
                        </div>
                        <div className="text-xs text-gray-900 truncate px-1 mb-1">
                          {item.name}
                        </div>
                        {!(item.type?.includes('folder') || item.isFolder) && (
                          <div className="text-xs text-gray-500">
                            {formatDate(item.created_at)}
                          </div>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                          <div className="flex justify-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className="p-1 rounded hover:bg-gray-200 transition-colors"
                            >
                              <Star className={`w-3 h-3 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                            </button>
                            {!(item.type?.includes('folder') || item.isFolder) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFile(item.id);
                                }}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-gray-400" />
                              </button>
                            )}
                            <button className="p-1 rounded hover:bg-gray-200 transition-colors">
                              <MoreVertical className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mr-3 flex-shrink-0">
                          {item.type?.includes('folder') || item.isFolder ? (
                            <Folder className="w-6 h-6 text-blue-500" />
                          ) : (
                            <div className="w-6 h-6 flex items-center justify-center">
                              {getFileIcon(item.type)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            {item.type?.includes('folder') || item.isFolder ? 'Folder' : formatFileSize(parseInt(item.size || 0))} • {formatDate(item.created_at)}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                            >
                              <Star className={`w-4 h-4 ${item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                            </button>
                            {!(item.type?.includes('folder') || item.isFolder) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFile(item.id);
                                }}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button className="p-1.5 rounded hover:bg-gray-200 transition-colors">
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Folder className="w-16 h-16 mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'No files found' : 'Folder is empty'}
                </h3>
                <p className="text-sm text-center max-w-md mb-4">
                  {searchQuery
                    ? 'Try a different search term or clear the search to see all files'
                    : 'This folder is empty.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {showDocumentPreview && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <div className="mr-4">
                  {getFileIcon(selectedDocument.type)}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedDocument.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(parseInt(selectedDocument.size || 0))} • {formatDate(selectedDocument.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDocumentPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              {/* Document Content Section */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <BookOpen className="w-5 h-5 text-purple-500 mr-2" />
                  Document Content
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[150px] flex items-center justify-center">
                  {contentLoading ? (
                    <div className="flex items-center text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
                      <span>Loading document content...</span>
                    </div>
                  ) : documentContent ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 w-full text-left">{documentContent}</pre>
                  ) : selectedDocument.url ? (
                    selectedDocument.type?.includes('pdf') ? (
                      <iframe src={selectedDocument.url} className="w-full h-96 border-0 rounded-lg" title="Document Preview"></iframe>
                    ) : selectedDocument.type?.includes('image') ? (
                      <img src={selectedDocument.url} alt="Document Preview" className="max-w-full max-h-96 object-contain rounded-lg" />
                    ) : (
                      <p className="text-gray-500">No preview available for this document type. You can download it.</p>
                    )
                  ) : (
                    <p className="text-gray-500">No content or URL available for this document.</p>
                  )}
                </div>
              </div>

              {/* AI Summary Section */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <Zap className="w-5 h-5 text-blue-500 mr-2" />
                  AI Summary
                </h4>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-gray-700 leading-relaxed">
                    {selectedDocument.summary || 'No summary available for this document.'}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.tags && selectedDocument.tags.length > 0 ? (
                    selectedDocument.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">No tags available</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    console.log(`Navigating to drafting page with document:`, selectedDocument);
                    navigate('/drafting', { state: { template: selectedDocument } });
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
                >
                  Edit Document
                </button>
                <button
                  onClick={() => toggleFavorite(selectedDocument.id)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center"
                >
                  <Star className={`w-4 h-4 mr-2 ${selectedDocument.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                  {selectedDocument.isFavorite ? 'Starred' : 'Add to starred'}
                </button>
                {selectedDocument.url && (
                  <button
                    onClick={() => window.open(selectedDocument.url, '_blank')}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Drop Zone Overlay */}
      {dragActive && (
        <div 
          className="fixed inset-0 bg-blue-600/10 flex items-center justify-center z-50"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="bg-white rounded-lg p-12 shadow-xl border-2 border-blue-300 border-dashed max-w-md text-center">
            <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Drop files to upload</h3>
            <p className="text-gray-500">Files will be uploaded to {selectedFolder?.name || 'My Drive'}</p>
          </div>
        </div>
      )}


      {/* Global drag and drop handlers */}
      <div
        className="fixed inset-0 pointer-events-none"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      />
    </div>
  );
};

export default DocumentUploadPage;