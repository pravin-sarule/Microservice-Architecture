import React, { createContext, useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api'; // Import the API service

export const FileManagerContext = createContext();

export const FileManagerProvider = ({ children }) => {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderContents, setFolderContents] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    recentUploads: 0,
    favorites: 0
  });

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const navigate = useNavigate();

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
    loadUserFiles();
  }, []);

  const loadUserFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request('/files/structure');
      
      // Handle different response structures
      const fileStructure = data.data || data.files || data || [];
      setFolders(processFileStructure(fileStructure));
      
      await loadAllFiles();
    } catch (err) {
      console.error('Error loading files:', err);
      setError(`Error loading files: ${err.message}`);
      setFolders([]);
      setFolderContents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const processFileStructure = useCallback((data) => {
    if (!Array.isArray(data)) {
      console.warn('Expected array for file structure, got:', typeof data);
      return [];
    }

    const processNode = (node) => {
      if (!node || typeof node !== 'object') {
        console.warn('Invalid node:', node);
        return null;
      }

      if (node.type === 'folder' || node.isFolder || node.folder_path !== undefined) {
        const children = node.children ? node.children.map(processNode).filter(Boolean) : [];
        const documentCount = countDocuments(children);
        return {
          id: node.id || node._id || `folder_${Date.now()}_${Math.random()}`,
          name: node.name || node.filename || 'Unnamed Folder',
          type: 'folder',
          folder_path: node.folder_path || node.path || '',
          children,
          documentCount,
          isFolder: true,
          created_at: node.created_at || node.createdAt || new Date().toISOString(),
          updated_at: node.updated_at || node.updatedAt || new Date().toISOString()
        };
      } else {
        return {
          id: node.id || node._id || `file_${Date.now()}_${Math.random()}`,
          name: node.name || node.originalname || node.filename || 'Unnamed File',
          type: node.type || node.mimeType || node.mimetype || 'application/octet-stream',
          size: node.size || 0,
          folder_path: node.folder_path || node.path || '',
          summary: node.summary || '',
          tags: node.tags || [],
          isFavorite: node.isFavorite || node.is_favorite || false,
          isFolder: false,
          created_at: node.created_at || node.createdAt || new Date().toISOString(),
          updated_at: node.updated_at || node.updatedAt || new Date().toISOString(),
          url: node.url || node.file_url || '',
          previewUrl: node.previewUrl || '',
          bucket: node.bucket || '',
          key: node.key || '',
          uploadDate: node.uploadDate || node.upload_date || node.created_at
        };
      }
    };
    console.log("Processed file structure:", data.map(processNode).filter(Boolean));

    return data.map(processNode).filter(Boolean);
  }, []);

  const countDocuments = useCallback((children) => {
    let count = 0;
    children.forEach(child => {
      if (child && child.type !== 'folder' && !child.isFolder) {
        count++;
      } else if (child && (child.type === 'folder' || child.isFolder) && child.children) {
        count += countDocuments(child.children);
      }
    });
    return count;
  }, []);

  const loadAllFiles = useCallback(async () => {
    try {
      const data = await api.request('/files/list?path=');
      
      const files = data.items || data.files || data.data || [];
      
      if (Array.isArray(files)) {
        const processedFiles = files.map(item => ({
          id: item.id || item._id || `item_${Date.now()}_${Math.random()}`,
          name: item.name || item.originalname || item.filename || 'Unnamed',
          type: item.type || item.mimeType || item.mimetype || 'application/octet-stream',
          size: item.size || 0,
          folder_path: item.folder_path || item.path || '',
          summary: item.summary || '',
          tags: item.tags || [],
          isFavorite: item.isFavorite || item.is_favorite || false,
          isFolder: item.type === 'folder' || item.isFolder || false,
          created_at: item.created_at || item.createdAt || new Date().toISOString(),
          updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
          url: item.url || item.file_url || '',
          previewUrl: item.previewUrl || '',
          bucket: item.bucket || '',
          key: item.key || ''
        }));
        console.log("Loaded all files (processed):", processedFiles);

        setFolderContents(processedFiles); // Set all files as folder contents
        
        const totalFiles = processedFiles.filter(item => !item.isFolder).length;
        const totalSize = processedFiles.reduce((acc, file) => {
          const size = parseInt(file.size || 0);
          return acc + (isNaN(size) ? 0 : size);
        }, 0);
        
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentUploads = processedFiles.filter(file => {
          const date = new Date(file.created_at || file.uploadDate || file.createdAt);
          return date > oneWeekAgo;
        }).length;
        
        const favorites = processedFiles.filter(file => file.isFavorite || file.is_favorite).length;
        
        setStats({ totalFiles, totalSize, recentUploads, favorites });
      }
    } catch (err) {
      console.error('Error loading all files:', err);
      setError(`Error loading all files: ${err.message}`);
      setFolderContents([]); // Ensure contents are cleared on error
    }
  }, []);

  const loadFolderContents = useCallback(async (folderPath = '') => {
    setLoading(true);
    setError('');
    try {
      const encodedPath = encodeURIComponent(folderPath);
      const data = await api.request(`/files/list?path=${encodedPath}`);
      
      const items = data.items || data.files || data.data || [];
      
      // Process items to ensure consistent structure
      const processedItems = items.map(item => ({
        id: item.id || item._id || `item_${Date.now()}_${Math.random()}`,
        name: item.name || item.originalname || item.filename || 'Unnamed',
        type: item.type || item.mimeType || item.mimetype || 'application/octet-stream',
        size: item.size || 0,
        folder_path: item.folder_path || item.path || '',
        summary: item.summary || '',
        tags: item.tags || [],
        isFavorite: item.isFavorite || item.is_favorite || false,
        isFolder: item.type === 'folder' || item.isFolder || false,
        created_at: item.created_at || item.createdAt || new Date().toISOString(),
        updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
        url: item.url || item.file_url || '',
        previewUrl: item.previewUrl || '',
        bucket: item.bucket || '',
        key: item.key || ''
      }));
      console.log(`Loaded folder contents for path "${folderPath}":`, processedItems);
      setFolderContents(processedItems);
    } catch (err) {
      console.error('Error loading folder contents:', err);
      setError(`Error loading folder contents: ${err.message}`);
      setFolderContents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setCreatingFolder(true);
    setError('');
    try {
      const parentPath = selectedFolder ? 
        (selectedFolder.folder_path ? `${selectedFolder.folder_path}/` : '') : '';
      
      await api.request('/files/create-folder', {
        method: 'POST',
        body: JSON.stringify({
          folderName: newFolderName.trim(),
          parentPath: parentPath,
        }),
      });

      setSuccess('Folder created successfully');
      setNewFolderName('');
      setShowNewFolderInput(false);
      
      await loadUserFiles();
      if (selectedFolder) {
        await loadFolderContents(selectedFolder.folder_path || selectedFolder.path || '');
      }
    } catch (err) {
      setError(`Error creating folder: ${err.message}`);
      console.error('Error creating folder:', err);
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, selectedFolder, loadUserFiles, loadFolderContents]);

  const uploadFiles = useCallback(async (files, targetFolder = '') => {
    if (!files || files.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      let result;
      if (files.length === 1) {
        result = await api.uploadSingleFile(files[0], targetFolder);
      } else {
        result = await api.uploadMultipleFiles(files, targetFolder);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(async () => {
        setUploading(false);
        setUploadProgress(0);
        setSuccess(`Successfully uploaded ${files.length} file(s)`);
        
        await loadUserFiles();
        if (selectedFolder) {
          await loadFolderContents(selectedFolder.folder_path || selectedFolder.path || '');
        }

        // Clear file inputs
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (folderInputRef.current) {
          folderInputRef.current.value = '';
        }
      }, 500);

    } catch (err) {
      setError(`Upload error: ${err.message}`);
      console.error('Upload error:', err);
      setUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFolder, loadUserFiles, loadFolderContents]);

  const deleteFile = useCallback(async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await api.request(`/files/${fileId}`, {
        method: 'DELETE',
      });

      setSuccess('File deleted successfully');
      
      await loadUserFiles();
      if (selectedFolder) {
        await loadFolderContents(selectedFolder.folder_path || selectedFolder.path || '');
      }
    } catch (err) {
      setError(`Error deleting file: ${err.message}`);
      console.error('Error deleting file:', err);
    }
  }, [selectedFolder, loadUserFiles, loadFolderContents]);

  const toggleFavorite = useCallback(async (fileId) => {
    try {
      const response = await api.request(`/files/${fileId}/favorite`, {
        method: 'PATCH',
      });

      if (response) { // Assuming response indicates success
        // Update local state optimistically
        setFolderContents(prev => prev.map(item => 
          item.id === fileId ? { ...item, isFavorite: !item.isFavorite } : item
        ));
        await loadAllFiles(); // Refresh stats
      } else {
        console.warn('Favorite toggle not implemented on backend or failed silently.');
        // Still update UI optimistically
        setFolderContents(prev => prev.map(item => 
          item.id === fileId ? { ...item, isFavorite: !item.isFavorite } : item
        ));
      }
    } catch (err) {
      console.warn('Error toggling favorite:', err);
      setError(`Error toggling favorite: ${err.message}`);
      // Update UI optimistically even on error
      setFolderContents(prev => prev.map(item => 
        item.id === fileId ? { ...item, isFavorite: !item.isFavorite } : item
      ));
    }
  }, [loadAllFiles]);

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderPath)) {
        newExpanded.delete(folderPath);
      } else {
        newExpanded.add(folderPath);
      }
      return newExpanded;
    });
  }, []);

  const selectFolder = useCallback((folder) => {
    setSelectedFolder(folder);
    const folderPath = folder ? (folder.folder_path || folder.path || '') : '';
    loadFolderContents(folderPath);
    
    if (folderPath) {
      setExpandedFolders(prev => {
        const newExpanded = new Set(prev);
        let currentPath = '';
        folderPath.split('/').filter(p => p).forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          newExpanded.add(currentPath);
        });
        return newExpanded;
      });
    }
  }, [loadFolderContents]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const targetPath = selectedFolder ? (selectedFolder.folder_path || selectedFolder.path || '') : '';
      uploadFiles(e.dataTransfer.files, targetPath);
    }
  }, [selectedFolder, uploadFiles]);

  const handleFileChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const targetPath = selectedFolder ? (selectedFolder.folder_path || selectedFolder.path || '') : '';
      uploadFiles(e.target.files, targetPath);
    }
  }, [selectedFolder, uploadFiles]);

  const handleFolderChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const targetPath = selectedFolder ? (selectedFolder.folder_path || selectedFolder.path || '') : '';
      uploadFiles(e.target.files, targetPath);
    }
  }, [selectedFolder, uploadFiles]);

  const value = useMemo(() => ({
    folders,
    selectedFolder,
    folderContents,
    uploading,
    loading,
    error,
    success,
    dragActive,
    newFolderName,
    showNewFolderInput,
    creatingFolder,
    expandedFolders,
    searchQuery,
    uploadProgress,
    stats,
    fileInputRef,
    folderInputRef,
    setNewFolderName,
    setShowNewFolderInput,
    setSearchQuery,
    setError,
    setSuccess,
    setDragActive,
    loadUserFiles,
    loadFolderContents,
    createFolder,
    uploadFiles,
    deleteFile,
    toggleFavorite,
    toggleFolder,
    selectFolder,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleFolderChange,
    navigate,
    // Removed setAuthToken, getAuthToken as they are now handled by api service
  }), [
    folders, selectedFolder, folderContents, uploading, loading, error, success, 
    dragActive, newFolderName, showNewFolderInput, creatingFolder, expandedFolders, 
    searchQuery, uploadProgress, stats, 
    loadUserFiles, loadFolderContents, createFolder, uploadFiles, deleteFile, 
    toggleFavorite, toggleFolder, selectFolder, handleDrag, handleDrop, 
    handleFileChange, handleFolderChange, navigate
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