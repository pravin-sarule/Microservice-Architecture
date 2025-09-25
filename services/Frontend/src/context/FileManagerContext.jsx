import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { documentApi } from '../services/documentApi'; // Import the new API service

export const FileManagerContext = createContext();

export const FileManagerProvider = ({ children }) => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // Stores folder name
  const [documents, setDocuments] = useState([]); // Files within the selected folder
  const [chatSessions, setChatSessions] = useState([]); // Chat sessions for the selected folder
  const [selectedChatSessionId, setSelectedChatSessionId] = useState(null); // Active chat session ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load user files/folders on component mount
  useEffect(() => {
    loadFoldersAndFiles();
  }, []);

  const loadFoldersAndFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await documentApi.getFoldersAndFiles();
      setFolders(data.folders);
      // If a folder is already selected, update its documents
      if (selectedFolder) {
        const currentFolder = data.folders.find(f => f.name === selectedFolder);
        setDocuments(currentFolder ? currentFolder.children || [] : []);
      }
    } catch (err) {
      console.error('Error loading folders and files:', err);
      setError(`Error loading folders and files: ${err.message}`);
      setFolders([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder]);

  const createFolder = useCallback(async (folderName) => {
    setError('');
    try {
      await documentApi.createFolder(folderName);
      setSuccess('Folder created successfully');
      await loadFoldersAndFiles(); // Refresh folders after creation
    } catch (err) {
      setError(`Error creating folder: ${err.response?.data?.details || err.message}`);
      console.error('Error creating folder:', err);
    }
  }, [loadFoldersAndFiles]);

  const uploadDocuments = useCallback(async (folderName, files) => {
    setError('');
    try {
      await documentApi.uploadDocuments(folderName, files);
      setSuccess('Documents uploaded and processing started');
      await loadFoldersAndFiles(); // Refresh files in the selected folder
    } catch (err) {
      setError(`Error uploading documents: ${err.response?.data?.details || err.message}`);
      console.error('Error uploading documents:', err);
    }
  }, [loadFoldersAndFiles]);

  const value = useMemo(() => ({
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    documents,
    setDocuments,
    chatSessions,
    setChatSessions,
    selectedChatSessionId,
    setSelectedChatSessionId,
    loading,
    error,
    success,
    setError,
    setSuccess,
    loadFoldersAndFiles,
    createFolder,
    uploadDocuments,
  }), [
    folders, selectedFolder, documents, chatSessions, selectedChatSessionId,
    loading, error, success,
    loadFoldersAndFiles, createFolder, uploadDocuments,
  ]);

  return (
    <FileManagerContext.Provider value={value}>
      {children}
    </FileManagerContext.Provider>
  );
};

export const useFileManager = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManager must be used within a FileManagerProvider');
  }
  return context;
};