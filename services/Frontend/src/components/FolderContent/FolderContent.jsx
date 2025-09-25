import React, { useState, useEffect, useContext } from 'react';
import { documentApi } from '../../services/documentApi';
import { FileManagerContext } from '../../context/FileManagerContext';
import DocumentCard from './DocumentCard';
import UploadDocumentModal from './UploadDocumentModal';

const FolderContent = () => {
  const { selectedFolder, documents, setDocuments, setChatSessions, setSelectedChatSessionId } = useContext(FileManagerContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [individualDocStatuses, setIndividualDocStatuses] = useState({}); // New state for individual doc statuses
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const fetchFolderContent = async () => {
    if (!selectedFolder) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await documentApi.getFoldersAndFiles();
      const currentFolder = data.folders.find(f => f.name === selectedFolder);
      if (currentFolder && currentFolder.children) {
        setDocuments(currentFolder.children);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      setError('Failed to fetch folder content.');
      console.error('Error fetching folder content:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderProcessingStatus = async () => {
    if (!selectedFolder) return;
    try {
      const statusData = await documentApi.getFolderProcessingStatus(selectedFolder);
      setProcessingStatus(statusData);
      // Check if any document is still processing, if so, poll again
      if (statusData.processingStatus.processing > 0 || statusData.processingStatus.queued > 0) {
        setTimeout(fetchFolderProcessingStatus, 5000); // Poll every 5 seconds
      } else {
        // If processing is complete, refresh folder content to get updated statuses
        fetchFolderContent();
      }
    } catch (err) {
      console.error('Error fetching folder processing status:', err);
    }
  };

  useEffect(() => {
    fetchFolderContent();
    fetchFolderProcessingStatus(); // Start polling for status
    // Clear chat sessions when folder changes
    setChatSessions([]);
    setSelectedChatSessionId(null);
  }, [selectedFolder]);

  const handleUploadDocuments = async (files) => {
    if (!selectedFolder) {
      alert('Please select a folder first.');
      return;
    }
    try {
      const uploadResponse = await documentApi.uploadDocuments(selectedFolder, files);
      setIsUploadModalOpen(false);
      fetchFolderContent(); // Refresh content to show new files
      fetchFolderProcessingStatus(); // Start/continue polling for folder status

      // Initialize individual document statuses and start polling for each
      if (uploadResponse && uploadResponse.uploadedFiles) {
        const newStatuses = {};
        uploadResponse.uploadedFiles.forEach(file => {
          newStatuses[file.id] = { status: 'queued', progress: 0 }; // Initial status
          pollIndividualDocumentStatus(file.id);
        });
        setIndividualDocStatuses(prev => ({ ...prev, ...newStatuses }));
      }
    } catch (err) {
      setError(`Failed to upload documents: ${err.response?.data?.details || err.message}`);
    }
  };

  const pollIndividualDocumentStatus = async (fileId) => {
    try {
      const statusData = await documentApi.getFileProcessingStatus(fileId);
      setIndividualDocStatuses(prev => ({
        ...prev,
        [fileId]: { status: statusData.status, progress: statusData.progress || 0 }
      }));

      if (statusData.status === 'processing' || statusData.status === 'queued') {
        setTimeout(() => pollIndividualDocumentStatus(fileId), 3000); // Poll every 3 seconds
      } else {
        fetchFolderContent(); // Refresh folder content once processing is complete
      }
    } catch (err) {
      console.error(`Error fetching status for file ${fileId}:`, err);
      setIndividualDocStatuses(prev => ({
        ...prev,
        [fileId]: { status: 'error', progress: 0 }
      }));
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
      // Optionally, you might want to display this summary in the chat interface
      // For now, just an alert.
    } catch (err) {
      setSummaryError(`Failed to get folder summary: ${err.response?.data?.details || err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (!selectedFolder) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-400 text-lg rounded-lg shadow-lg">
        Select a folder to view its contents.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-800 text-white p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Folder: {selectedFolder}</h2>
        <div className="space-x-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-200"
          >
            Upload Documents
          </button>
          <button
            onClick={handleGetSummary}
            disabled={summaryLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-200 disabled:opacity-50"
          >
            {summaryLoading ? 'Generating Summary...' : 'Get Folder Summary'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">Error: {error}</div>}
      {summaryError && <div className="text-red-500 mb-4">Summary Error: {summaryError}</div>}

      {processingStatus && (
        <div className="mb-4 p-3 bg-gray-700 rounded-md text-sm">
          <h3 className="font-medium mb-2">Processing Status for {selectedFolder}:</h3>
          <p>Total Documents: {processingStatus.processingStatus.total}</p>
          <p>Queued: {processingStatus.processingStatus.queued}</p>
          <p>Processing: {processingStatus.processingStatus.processing}</p>
          <p>Completed: {processingStatus.processingStatus.completed}</p>
          <p>Failed: {processingStatus.processingStatus.failed}</p>
          <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
            <div
              className="bg-blue-500 h-2.5 rounded-full"
              style={{ width: `${processingStatus.overallProgress || 0}%` }}
            ></div>
          </div>
          <p className="text-right text-xs mt-1">{processingStatus.overallProgress || 0}% Complete</p>
        </div>
      )}

      <div className="flex-grow overflow-y-auto space-y-3">
        {loading ? (
          <div>Loading documents...</div>
        ) : documents.length === 0 ? (
          <p className="text-gray-400">No documents in this folder. Upload some to get started!</p>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              individualStatus={individualDocStatuses[doc.id]} // Pass individual status
            />
          ))
        )}
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadDocuments}
      />
    </div>
  );
};

export default FolderContent;