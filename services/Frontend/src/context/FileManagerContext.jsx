import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import documentApi from '../services/documentApi';

export const FileManagerContext = createContext();

export const FileManagerProvider = ({ children }) => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAiResponse, setHasAiResponse] = useState(false); // New state for AI response

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

  const loadFoldersAndFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await documentApi.getFoldersAndFiles();
      setFolders(data.folders || []);
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
      await loadFoldersAndFiles();
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
      await loadFoldersAndFiles();
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
    hasAiResponse, // Expose hasAiResponse
    setHasAiResponse, // Expose setHasAiResponse
    loadFoldersAndFiles,
    createFolder,
    uploadDocuments,
  }), [
    folders, selectedFolder, documents, chatSessions, selectedChatSessionId,
    loading, error, success, hasAiResponse,
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
