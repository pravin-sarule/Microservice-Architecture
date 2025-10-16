


import '../styles/AnalysisPage.css';

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import DownloadPdf from '../components/DownloadPdf/DownloadPdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import ApiService from '../services/api';
import {
  Search, Send, FileText, Layers, Trash2, RotateCcw,
  ArrowRight, ChevronRight, AlertTriangle, Clock, Loader2,
  Upload, Download, AlertCircle, CheckCircle, X, Eye, Quote, BookOpen, Copy,
  ChevronDown, Paperclip, MessageSquare, FileCheck, Bot
} from 'lucide-react';

const AnalysisPage = () => {
  const location = useLocation();
  const { fileId: paramFileId, sessionId: paramSessionId } = useParams();
  const { setIsSidebarHidden, setIsSidebarCollapsed } = useSidebar();
  
  // State Management
  const [activeDropdown, setActiveDropdown] = useState('Summary');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasResponse, setHasResponse] = useState(false);
  const [isSecretPromptSelected, setIsSecretPromptSelected] = useState(false);
  
  // Document and Analysis Data
  const [documentData, setDocumentData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [fileId, setFileId] = useState(paramFileId || null);
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [currentResponse, setCurrentResponse] = useState('');
  const [animatedResponseContent, setAnimatedResponseContent] = useState('');
  const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showSplitView, setShowSplitView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [showAllChats, setShowAllChats] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Secrets state
  const [secrets, setSecrets] = useState([]);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [selectedSecretId, setSelectedSecretId] = useState(null);
  
  // Batch upload state
  const [batchUploads, setBatchUploads] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  
  // Refs
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const responseRef = useRef(null);
  const markdownOutputRef = useRef(null); // New ref for markdown output
  const pollingIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);

  // API Configuration
  const API_BASE_URL = 'https://gateway-service-110685455967.asia-south1.run.app';
  
  const getAuthToken = () => {
    const tokenKeys = [
      'authToken', 'token', 'accessToken', 'jwt', 'bearerToken',
      'auth_token', 'access_token', 'api_token', 'userToken'
    ];
    
    for (const key of tokenKeys) {
      const token = localStorage.getItem(key);
      if (token) return token;
    }
    return null;
  };

  const apiRequest = async (url, options = {}) => {
    try {
      const token = getAuthToken();
      const defaultHeaders = { 'Content-Type': 'application/json' };

      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }

      const headers = options.body instanceof FormData 
        ? (token ? { 'Authorization': `Bearer ${token}` } : {})
        : { ...defaultHeaders, ...options.headers };

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP error! status: ${response.status}` };
        }
        
        switch (response.status) {
          case 401: throw new Error('Authentication required. Please log in again.');
          case 403: throw new Error(errorData.error || 'Access denied.');
          case 404: throw new Error('Resource not found.');
          case 413: throw new Error('File too large.');
          case 415: throw new Error('Unsupported file type.');
          case 429: throw new Error('Too many requests.');
          default: throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Fetch secrets
  const fetchSecrets = async () => {
    try {
      setIsLoadingSecrets(true);
      setError(null);
      
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/files/secrets?fetch=true`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch secrets: ${response.status}`);
      }

      const secretsData = await response.json();
      console.log('[fetchSecrets] Loaded secrets:', secretsData);
      setSecrets(secretsData || []);
      
      if (secretsData && secretsData.length > 0) {
        setActiveDropdown(secretsData[0].name);
        setSelectedSecretId(secretsData[0].id);
      }
    } catch (error) {
      console.error('Error fetching secrets:', error);
      setError(`Failed to load analysis prompts: ${error.message}`);
    } finally {
      setIsLoadingSecrets(false);
    }
  };

  // Batch file upload
  const batchUploadDocuments = async (files) => {
    console.log('Starting batch upload for', files.length, 'files');
    setIsUploading(true);
    setError(null);
    
    const initialBatchUploads = files.map((file, index) => ({
      id: `${file.name}-${Date.now()}-${index}`,
      file: file,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
      fileId: null,
      error: null
    }));
    
    setBatchUploads(initialBatchUploads);
    setShowSplitView(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('document', file);
      });

      setBatchUploads(prev => prev.map(upload => ({ ...upload, status: 'uploading', progress: 10 })));

      const token = getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/files/batch-upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Batch upload response:', data);

      if (data.uploaded_files && Array.isArray(data.uploaded_files)) {
        data.uploaded_files.forEach((uploadedFile, index) => {
          const matchingUpload = initialBatchUploads[index];
          
          if (uploadedFile.error) {
            setBatchUploads(prev => prev.map(upload =>
              upload.id === matchingUpload.id
                ? { ...upload, status: 'failed', error: uploadedFile.error, progress: 0 }
                : upload
            ));
          } else {
            const fileId = uploadedFile.file_id;
            
            setBatchUploads(prev => prev.map(upload =>
              upload.id === matchingUpload.id
                ? { ...upload, status: 'uploaded', fileId, progress: 100 }
                : upload
            ));

            setUploadedDocuments(prev => [...prev, {
              id: fileId,
              fileName: uploadedFile.filename || matchingUpload.fileName,
              fileSize: matchingUpload.fileSize,
              uploadedAt: new Date().toISOString(),
              status: 'batch_processing',
              operationName: uploadedFile.operation_name
            }]);

            if (index === 0) {
              setFileId(fileId);
              setDocumentData({
                id: fileId,
                title: matchingUpload.fileName,
                originalName: matchingUpload.fileName,
                size: matchingUpload.fileSize,
                type: matchingUpload.file.type,
                uploadedAt: new Date().toISOString(),
                status: 'batch_processing'
              });
              startProcessingStatusPolling(fileId);
            }
          }
        });

        const successCount = data.uploaded_files.filter(f => !f.error).length;
        const failCount = data.uploaded_files.filter(f => f.error).length;

        if (successCount > 0) {
          setSuccess(`${successCount} document(s) uploaded successfully!`);
        }
        if (failCount > 0) {
          setError(`${failCount} document(s) failed to upload.`);
        }
      }

    } catch (error) {
      console.error('Batch upload error:', error);
      setError(`Batch upload failed: ${error.message}`);
      setBatchUploads(prev => prev.map(upload => ({
        ...upload,
        status: 'failed',
        error: error.message
      })));
    } finally {
      setIsUploading(false);
    }
  };

  // Processing status polling
  const getProcessingStatus = async (file_id) => {
    try {
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/files/status/${file_id}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error(`Status check failed with status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log('Processing status:', data);
      
      setProcessingStatus(data);
      
      setUploadedDocuments(prev => prev.map(doc =>
        doc.id === file_id ? { ...doc, status: data.status } : doc
      ));
      
      if (data.status === 'processed') {
        setDocumentData(prev => ({
          ...prev,
          status: 'processed',
        }));
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setSuccess('Document processing completed!');
      } else if (data.status === 'error') {
        setError('Document processing failed.');
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error getting processing status:', error);
      return null;
    }
  };

  const startProcessingStatusPolling = (file_id) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    let pollCount = 0;
    const maxPolls = 150;

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      const status = await getProcessingStatus(file_id);
      
      if (status && (status.status === 'processed' || status.status === 'error')) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      } else if (pollCount >= maxPolls) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setError('Document processing timeout.');
      }
    }, 2000);
  };

  // ✅ FASTER Animation with requestAnimationFrame and chunk-based rendering
  const animateResponse = (text) => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setAnimatedResponseContent('');
    setIsAnimatingResponse(true);
    setShowSplitView(true);
    
    let currentIndex = 0;
    const chunkSize = 5; // Render 5 characters at a time for faster display
    const delayMs = 10; // Reduced delay for faster rendering
    
    const animate = () => {
      if (currentIndex < text.length) {
        const nextChunk = text.slice(currentIndex, currentIndex + chunkSize);
        setAnimatedResponseContent(prev => prev + nextChunk);
        currentIndex += chunkSize;
        
        // Auto-scroll to bottom
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
        
        // Schedule next frame
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(animate);
        }, delayMs);
      } else {
        setIsAnimatingResponse(false);
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Option to skip animation and show immediately
  const showResponseImmediately = (text) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAnimatedResponseContent(text);
    setIsAnimatingResponse(false);
    setShowSplitView(true);
    
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  };

  // Chat with document (custom queries - uses Gemini)
  const chatWithDocument = async (file_id, question, currentSessionId) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[chatWithDocument] Sending custom query with Gemini');

      const data = await apiRequest('/files/chat', {
        method: 'POST',
        body: JSON.stringify({
          file_id: file_id,
          question: question.trim(),
          used_secret_prompt: false,
          session_id: currentSessionId
        }),
      });

      const response = data.answer || data.response || 'No response received';
      const newSessionId = data.session_id || currentSessionId;

      if (data.history && Array.isArray(data.history)) {
        setMessages(data.history);
        
        const latestMessage = data.history[data.history.length - 1];
        if (latestMessage) {
          setSelectedMessageId(latestMessage.id);
          setCurrentResponse(latestMessage.answer);
          animateResponse(latestMessage.answer);
        }
      } else {
        const newChat = {
          id: Date.now(),
          file_id: file_id,
          session_id: newSessionId,
          question: question.trim(),
          answer: response,
          display_text_left_panel: question.trim(),
          timestamp: new Date().toISOString(),
          used_chunk_ids: data.used_chunk_ids || [],
          confidence: data.confidence || 0.8,
          type: 'chat',
          used_secret_prompt: false
        };

        setMessages(prev => [...prev, newChat]);
        setSelectedMessageId(newChat.id);
        setCurrentResponse(response);
        animateResponse(response);
      }
      
      setSessionId(newSessionId);
      setChatInput('');
      setHasResponse(true);
      setSuccess('Question answered!');

      return data;
    } catch (error) {
      console.error('[chatWithDocument] Error:', error);
      setError(`Chat failed: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    console.log('Files selected:', files.length);
    
    if (files.length === 0) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/tiff'
    ];

    const maxSize = 100 * 1024 * 1024;

    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        setError(`File "${file.name}" has an unsupported type.`);
        return false;
      }
      if (file.size > maxSize) {
        setError(`File "${file.name}" is too large (max 100MB).`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    try {
      await batchUploadDocuments(validFiles);
    } catch (error) {
      console.error('Upload error:', error);
    }

    event.target.value = '';
  };

  const handleDropdownSelect = (secretName, secretId) => {
    console.log('[handleDropdownSelect] Selected:', secretName, secretId);
    setActiveDropdown(secretName);
    setSelectedSecretId(secretId);
    setIsSecretPromptSelected(true);
    setChatInput('');
    setShowDropdown(false);
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
  };

  // ✅ UPDATED handleSend function
  const handleSend = async (e) => {
    e.preventDefault();

    if (!fileId) {
      setError('Please upload a document first.');
      return;
    }
    
    const currentStatus = processingStatus?.status;
    if (currentStatus === 'processing' || currentStatus === 'batch_processing' || currentStatus === 'batch_queued') {
      setError('Please wait for document processing to complete.');
      return;
    }

    // ✅ CASE 1: User selected a secret dropdown (use secret's LLM model)
    if (isSecretPromptSelected) {
      if (!selectedSecretId) {
        setError('Please select an analysis type.');
        return;
      }
      try {
        setIsGeneratingInsights(true);
        setError(null);
        
        console.log('[handleSend] Triggering LLM with secret:', {
          secretId: selectedSecretId,
          fileId,
          additionalInput: chatInput.trim()
        });
        
        // Call API with secretId, fileId, and optional user input
        const data = await ApiService.triggerLLMWithSecret(
          selectedSecretId, 
          fileId,
          chatInput.trim()
        );
        
        console.log('[handleSend] Received response:', data);
        
        const response = data.response || 'No response received';
        const newSessionId = data.session_id || sessionId;

        const selectedSecret = secrets.find(s => s.id === selectedSecretId);
        const promptLabel = selectedSecret?.name || 'Secret Prompt';

        const newChat = {
          id: Date.now(),
          file_id: fileId,
          session_id: newSessionId,
          question: promptLabel,
          answer: response,
          display_text_left_panel: `Analysis: ${promptLabel}`,
          timestamp: new Date().toISOString(),
          used_chunk_ids: data.used_chunk_ids || [],
          confidence: data.confidence || 0.8,
          type: 'llm_trigger',
          used_secret_prompt: true,
          prompt_label: promptLabel
        };

        setMessages(prev => [...prev, newChat]);
        setSelectedMessageId(newChat.id);
        setCurrentResponse(response);
        animateResponse(response);
        setSessionId(newSessionId);
        setChatInput('');
        setHasResponse(true);
        setSuccess('Analysis completed successfully!');
        
        // Reset secret selection after successful execution
        setIsSecretPromptSelected(false);
        setActiveDropdown('Custom Query');

      } catch (error) {
        console.error('[handleSend] Analysis error:', error);
        setError(`Analysis failed: ${error.message}`);
      } finally {
        setIsGeneratingInsights(false);
      }
    } 
    // ✅ CASE 2: User typed custom query (use default Gemini)
    else {
      if (!chatInput.trim()) {
        setError('Please enter a question.');
        return;
      }
      try {
        console.log('[handleSend] Using custom query with Gemini');
        await chatWithDocument(fileId, chatInput, sessionId);
      } catch (error) {
        console.error('[handleSend] Chat error:', error);
      }
    }
  };

  const handleMessageClick = (message) => {
    setSelectedMessageId(message.id);
    setCurrentResponse(message.answer);
    showResponseImmediately(message.answer); // Show immediately without animation for historical messages
  };

  const clearAllChatData = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setMessages([]);
    setDocumentData(null);
    setFileId(null);
    setCurrentResponse('');
    setHasResponse(false);
    setChatInput('');
    setProcessingStatus(null);
    setError(null);
    setAnimatedResponseContent('');
    setIsAnimatingResponse(false);
    setShowSplitView(false);
    setBatchUploads([]);
    setUploadedDocuments([]);
    setIsSecretPromptSelected(false);
    setSelectedMessageId(null);
    setActiveDropdown('Custom Query');

    const keysToRemove = [
      'messages', 'currentResponse', 'hasResponse', 'documentData',
      'fileId', 'processingStatus', 'animatedResponseContent', 'sessionId'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
    
    setSuccess('New chat session started!');
  };

  const startNewChat = () => {
    clearAllChatData();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  const handleCopyResponse = async () => {
    try {
      const textToCopy = animatedResponseContent || currentResponse;
      if (textToCopy) {
        // Create a temporary div to extract plain text from HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textToCopy;
        await navigator.clipboard.writeText(tempDiv.innerText);
        setSuccess('AI response copied to clipboard!');
      } else {
        setError('No response to copy.');
      }
    } catch (err) {
      console.error('Failed to copy AI response:', err);
      setError('Failed to copy response.');
    }
  };


  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 font-semibold text-black">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchSecrets();
  }, []);

  useEffect(() => {
    if (currentResponse) {
      localStorage.setItem('currentResponse', currentResponse);
      localStorage.setItem('animatedResponseContent', animatedResponseContent);
    }
  }, [currentResponse, animatedResponseContent]);

  useEffect(() => {
    localStorage.setItem('hasResponse', JSON.stringify(hasResponse));
  }, [hasResponse]);

  useEffect(() => {
    if (documentData) {
      localStorage.setItem('documentData', JSON.stringify(documentData));
    }
  }, [documentData]);

  useEffect(() => {
    if (fileId) {
      localStorage.setItem('fileId', fileId);
    }
  }, [fileId]);

  useEffect(() => {
    if (processingStatus) {
      localStorage.setItem('processingStatus', JSON.stringify(processingStatus));
    }
  }, [processingStatus]);

  useEffect(() => {
    const fetchChatHistory = async (currentFileId, currentSessionId, selectedChatId = null) => {
      try {
        const sanitizedSessionId = currentSessionId ? currentSessionId.replace(/:\d+$/, '') : null;
        console.log('[AnalysisPage] Fetching chat history for sessionId:', sanitizedSessionId);
        
        const responseData = await ApiService.fetchChatsBySessionId(sanitizedSessionId);

        let sessionMessages = responseData || [];
        sessionMessages.sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));
        
        const transformedMessages = sessionMessages.map(msg => ({
          ...msg,
          timestamp: msg.created_at || msg.timestamp,
          display_text_left_panel: msg.used_secret_prompt 
            ? `Analysis: ${msg.prompt_label || msg.question}`
            : msg.question
        }));
        
        setMessages(transformedMessages);

        if (transformedMessages.length > 0) {
          setDocumentData({
            id: currentFileId,
            title: `Document for Session ${currentSessionId}`,
            originalName: `Document for Session ${currentSessionId}`,
            size: 0,
            type: 'unknown',
            uploadedAt: new Date().toISOString(),
            status: 'processed',
          });
          setFileId(currentFileId);
          setSessionId(currentSessionId);
          setProcessingStatus({ status: 'processed' });
          setHasResponse(true);
          setShowSplitView(true);

          const chatToDisplay = selectedChatId
            ? transformedMessages.find(chat => chat.id === selectedChatId)
            : transformedMessages[transformedMessages.length - 1];

          if (chatToDisplay) {
            setCurrentResponse(chatToDisplay.answer);
            showResponseImmediately(chatToDisplay.answer);
            setSelectedMessageId(chatToDisplay.id);
          }
        }
        setSuccess('Chat history loaded successfully!');
      } catch (err) {
        console.error('[AnalysisPage] Error in fetchChatHistory:', err);
        setError(`Failed to load chat history: ${err.message}`);
      }
    };

    // ✅ Handle navigation from ChatHistoryPage
    if (location.state?.newChat) {
      clearAllChatData();
      window.history.replaceState({}, document.title);
    } 
    // ✅ Route with both fileId and sessionId params
    else if (paramFileId && paramSessionId) {
      console.log('[AnalysisPage] Loading chat from URL params:', { paramFileId, paramSessionId });
      setFileId(paramFileId);
      setSessionId(paramSessionId);
      fetchChatHistory(paramFileId, paramSessionId);
    } 
    // ✅ Navigation from ChatHistoryPage with state
    else if (location.state?.chat) {
      const chatData = location.state.chat;
      console.log('[AnalysisPage] Loading chat from location state:', chatData);
      
      if (chatData.file_id && chatData.session_id) {
        setFileId(chatData.file_id);
        setSessionId(chatData.session_id);
        fetchChatHistory(chatData.file_id, chatData.session_id, chatData.id);
      } else {
        setError('Unable to load chat: Missing required information');
      }
      
      window.history.replaceState({}, document.title);
    } 
    // ✅ Load from localStorage
    else {
      try {
        const savedMessages = localStorage.getItem('messages');
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        }

        const savedSessionId = localStorage.getItem('sessionId');
        if (savedSessionId) {
          setSessionId(savedSessionId);
        } else {
          const newSessionId = `session-${Date.now()}`;
          setSessionId(newSessionId);
          localStorage.setItem('sessionId', newSessionId);
        }

        const savedCurrentResponse = localStorage.getItem('currentResponse');
        const savedAnimatedResponseContent = localStorage.getItem('animatedResponseContent');
        if (savedCurrentResponse) {
          setCurrentResponse(savedCurrentResponse);
          if (savedAnimatedResponseContent) {
            setAnimatedResponseContent(savedAnimatedResponseContent);
            setShowSplitView(true);
          } else {
            setAnimatedResponseContent(savedCurrentResponse);
          }
          setIsAnimatingResponse(false);
        }

        const savedHasResponse = localStorage.getItem('hasResponse');
        if (savedHasResponse) {
          const parsedHasResponse = JSON.parse(savedHasResponse);
          setHasResponse(parsedHasResponse);
          if (parsedHasResponse) {
            setShowSplitView(true);
          }
        }

        const savedDocumentData = localStorage.getItem('documentData');
        if (savedDocumentData) {
          setDocumentData(JSON.parse(savedDocumentData));
        }

        const savedFileId = localStorage.getItem('fileId');
        if (savedFileId) {
          setFileId(savedFileId);
        }

        const savedProcessingStatus = localStorage.getItem('processingStatus');
        if (savedProcessingStatus) {
          setProcessingStatus(JSON.parse(savedProcessingStatus));
        }

      } catch (error) {
        console.error('[AnalysisPage] Error restoring from localStorage:', error);
        if (!sessionId) {
          const newSessionId = `session-${Date.now()}`;
          setSessionId(newSessionId);
          localStorage.setItem('sessionId', newSessionId);
        }
      }
    }
  }, [location.state, paramFileId, paramSessionId]);
  
  useEffect(() => {
    if (showSplitView) {
      setIsSidebarHidden(false);
      setIsSidebarCollapsed(true);
    } else if (hasResponse) {
      setIsSidebarHidden(false);
      setIsSidebarCollapsed(false);
    } else {
      setIsSidebarHidden(false);
      setIsSidebarCollapsed(false);
    }
  }, [hasResponse, showSplitView, setIsSidebarHidden, setIsSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ✅ Enhanced Markdown Components for all LLM formats (OpenAI, Anthropic, Gemini)
  const markdownComponents = {
    // Headings
    h1: ({node, ...props}) => (
      <h1 className="text-3xl font-bold mb-6 mt-8 text-gray-900 border-b-2 border-gray-300 pb-3 analysis-page-ai-response" {...props} />
    ),
    h2: ({node, ...props}) => (
      <h2 className="text-2xl font-bold mb-5 mt-7 text-gray-900 border-b border-gray-200 pb-2 analysis-page-ai-response" {...props} />
    ),
    h3: ({node, ...props}) => (
      <h3 className="text-xl font-semibold mb-4 mt-6 text-gray-800 analysis-page-ai-response" {...props} />
    ),
    h4: ({node, ...props}) => (
      <h4 className="text-lg font-semibold mb-3 mt-5 text-gray-800 analysis-page-ai-response" {...props} />
    ),
    h5: ({node, ...props}) => (
      <h5 className="text-base font-semibold mb-2 mt-4 text-gray-700 analysis-page-ai-response" {...props} />
    ),
    h6: ({node, ...props}) => (
      <h6 className="text-sm font-semibold mb-2 mt-3 text-gray-700 analysis-page-ai-response" {...props} />
    ),
    
    // Paragraphs
    p: ({node, ...props}) => (
      <p className="mb-4 leading-relaxed text-gray-800 text-[15px] analysis-page-ai-response" {...props} />
    ),
    
    // Text formatting
    strong: ({node, ...props}) => (
      <strong className="font-bold text-gray-900" {...props} />
    ),
    em: ({node, ...props}) => (
      <em className="italic text-gray-800" {...props} />
    ),
    
    // Lists
    ul: ({node, ...props}) => (
      <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-800" {...props} />
    ),
    ol: ({node, ...props}) => (
      <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-800" {...props} />
    ),
    li: ({node, ...props}) => (
      <li className="leading-relaxed text-gray-800 analysis-page-ai-response" {...props} />
    ),
    
    // Links
    a: ({node, ...props}) => (
      <a 
        className="text-blue-600 hover:text-blue-800 underline font-medium transition-colors" 
        target="_blank" 
        rel="noopener noreferrer" 
        {...props} 
      />
    ),
    
    // Blockquotes
    blockquote: ({node, ...props}) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-gray-700 italic rounded-r analysis-page-ai-response" {...props} />
    ),
    
    // Code
    code: ({node, inline, className, children, ...props}) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (inline) {
        return (
          <code 
            className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-200" 
            {...props}
          >
            {children}
          </code>
        );
      }
      
      return (
        <div className="relative my-4">
          {language && (
            <div className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-t font-mono">
              {language}
            </div>
          )}
          <pre className={`bg-gray-900 text-gray-100 p-4 ${language ? 'rounded-b' : 'rounded'} overflow-x-auto`}>
            <code className="font-mono text-sm" {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },
    
    // Pre (for code blocks without language)
    pre: ({node, ...props}) => (
      <pre className="bg-gray-900 text-gray-100 p-4 rounded my-4 overflow-x-auto" {...props} />
    ),
    
    // Tables
    table: ({node, ...props}) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-gray-300">
        <table className="min-w-full divide-y divide-gray-300" {...props} />
      </div>
    ),
    thead: ({node, ...props}) => (
      <thead className="bg-gray-100" {...props} />
    ),
    th: ({node, ...props}) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300" {...props} />
    ),
    tbody: ({node, ...props}) => (
      <tbody className="bg-white divide-y divide-gray-200" {...props} />
    ),
    tr: ({node, ...props}) => (
      <tr className="hover:bg-gray-50 transition-colors" {...props} />
    ),
    td: ({node, ...props}) => (
      <td className="px-4 py-3 text-sm text-gray-800 border-b border-gray-200" {...props} />
    ),
    
    // Horizontal rule
    hr: ({node, ...props}) => (
      <hr className="my-6 border-t-2 border-gray-300" {...props} />
    ),
    
    // Images
    img: ({node, ...props}) => (
      <img className="max-w-full h-auto rounded-lg shadow-md my-4" alt="" {...props} />
    ),
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Error Messages */}
      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Success Messages */}
      {success && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Batch Upload Progress Panel */}
      {(isUploading || batchUploads.length > 0) && (
        <div className="fixed top-20 right-4 z-40 max-w-md w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">
                Uploading {batchUploads.length} file{batchUploads.length > 1 ? 's' : ''}
              </h3>
            </div>
            {!isUploading && (
              <button
                onClick={() => setBatchUploads([])}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 p-4">
            <div className="space-y-3">
              {batchUploads.map((upload) => (
                <div key={upload.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{upload.fileName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(upload.fileSize)}</p>
                    </div>
                    <div className="ml-2">
                      {upload.status === 'uploaded' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {upload.status === 'failed' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      {(upload.status === 'pending' || upload.status === 'uploading') && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        upload.status === 'uploaded' ? 'bg-green-500' :
                        upload.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${upload.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      {upload.status === 'uploaded' && '✓ Uploaded successfully'}
                      {upload.status === 'failed' && `✗ ${upload.error || 'Upload failed'}`}
                      {upload.status === 'uploading' && `${upload.progress}% uploaded`}
                      {upload.status === 'pending' && 'Preparing...'}
                    </p>
                    {upload.fileId && (
                      <span className="text-xs font-mono text-gray-400">
                        ID: {upload.fileId.substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conditional Rendering for Single Page vs Split View */}
      {!showSplitView ? (
        // Single Page View: Only chat input area
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div className="text-center max-w-2xl px-6 mb-12">
            <h3 className="text-3xl font-bold mb-4 text-gray-900">Welcome to Smart Legal Insights</h3>
            <p className="text-gray-600 text-xl leading-relaxed">
              Upload a legal document or ask a question to begin your AI-powered analysis.
            </p>
          </div>
          <div className="w-full max-w-4xl px-6">
            <form onSubmit={handleSend} className="mx-auto">
              <div className="flex items-center space-x-3 bg-gray-50 rounded-xl border border-gray-500 px-5 py-6 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-sm">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title="Upload Document"
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.tiff"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  multiple
                />

                <div className="relative flex-shrink-0" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    disabled={!fileId || processingStatus?.status !== 'processed' || isLoading || isGeneratingInsights || isLoadingSecrets}
                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>{isLoadingSecrets ? 'Loading...' : activeDropdown}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {showDropdown && !isLoadingSecrets && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                      {secrets.length > 0 ? (
                        secrets.map((secret) => (
                          <button
                            key={secret.id}
                            type="button"
                            onClick={() => handleDropdownSelect(secret.name, secret.id)}
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

                <input
                  type="text"
                  value={chatInput}
                  onChange={handleChatInputChange}
                  placeholder={
                    isSecretPromptSelected 
                      ? `Add optional details for ${activeDropdown}...`
                      : fileId 
                        ? "Message Legal Assistant..." 
                        : "Upload a document to get started"
                  }
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-[15px] font-medium py-2 min-w-0 analysis-page-user-input"
                  disabled={isLoading || isGeneratingInsights || !fileId || processingStatus?.status !== 'processed'}
                />

                <button
                  type="submit"
                  disabled={
                    isLoading || 
                    isGeneratingInsights || 
                    (!chatInput.trim() && !isSecretPromptSelected) || 
                    !fileId || 
                    processingStatus?.status !== 'processed'
                  }
                  className="p-2 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg transition-colors flex-shrink-0"
                  title="Send Message"
                >
                  {isLoading || isGeneratingInsights ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {documentData && (processingStatus?.status === 'processing' || processingStatus?.status === 'batch_processing') && (
                <div className="mt-3 text-center">
                  <div className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing document...
                    {processingStatus.processing_progress && (
                      <span className="ml-1">({Math.round(processingStatus.processing_progress)}%)</span>
                    )}
                  </div>
                </div>
              )}

              {documentData && !hasResponse && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <FileCheck className="h-5 w-5 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{documentData.originalName}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(documentData.size)} • {formatDate(documentData.uploadedAt)}
                      </p>
                    </div>
                    {processingStatus && (
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        processingStatus.status === 'processed'
                          ? 'bg-green-100 text-green-800'
                          : processingStatus.status === 'processing' || processingStatus.status === 'batch_processing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {processingStatus.status.charAt(0).toUpperCase() + processingStatus.status.slice(1)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isSecretPromptSelected && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-blue-800">
                    <Bot className="h-4 w-4" />
                    <span>Using analysis prompt: <strong>{activeDropdown}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSecretPromptSelected(false);
                        setActiveDropdown('Custom Query');
                        setSelectedSecretId(null);
                      }}
                      className="ml-auto text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        // Split View: Left and Right Panels
        <>
          {/* Left Panel - Chat Messages List */}
          <div className="w-2/5 border-r border-gray-200 flex flex-col bg-white h-full">
            <div className="p-4 border-b border-black border-opacity-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
                <button
                  onClick={startNewChat}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  New Chat
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Uploaded Documents Section */}
            {uploadedDocuments.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Uploaded Documents ({uploadedDocuments.length})
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uploadedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setFileId(doc.id);
                        setDocumentData({
                          id: doc.id,
                          title: doc.fileName,
                          originalName: doc.fileName,
                          size: doc.fileSize,
                          type: 'unknown',
                          uploadedAt: doc.uploadedAt,
                          status: doc.status,
                        });
                        if (doc.status !== 'processed') {
                          startProcessingStatusPolling(doc.id);
                        }
                      }}
                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                        fileId === doc.id
                          ? 'bg-blue-100 border border-blue-300'
                          : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</p>
                        </div>
                        <div className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                          doc.status === 'processed'
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'processing' || doc.status === 'batch_processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-2">
              <div className="space-y-2">
                {messages
                  .filter(msg =>
                    (msg.display_text_left_panel || msg.question || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .slice(0, showAllChats ? messages.length : displayLimit)
                  .map((msg, i) => (
                    <div
                      key={msg.id || i}
                      onClick={() => handleMessageClick(msg)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedMessageId === msg.id
                          ? 'bg-blue-50 border-blue-200 shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                            {highlightText(msg.display_text_left_panel || msg.question, searchQuery)}
                          </p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{formatDate(msg.timestamp || msg.created_at)}</span>
                            {msg.session_id && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                  {msg.session_id.split('-')[1]?.substring(0, 8) || 'N/A'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {selectedMessageId === msg.id && (
                          <ChevronRight className="h-4 w-4 text-blue-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </div>
                  ))}

                {messages.length > displayLimit && !showAllChats && (
                  <div className="text-center py-4">
                    <button
                      onClick={() => setShowAllChats(true)}
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      See All ({messages.length - displayLimit} more)
                    </button>
                  </div>
                )}
                
                {isLoading && (
                  <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-800">Processing...</span>
                    </div>
                  </div>
                )}
                
                {messages.length === 0 && !isLoading && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">No questions yet</p>
                    <p className="text-gray-400 text-xs">Start by asking a question</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
              <form onSubmit={handleSend} className="mx-auto">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-sm">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    title="Upload Document"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.tiff"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    multiple
                  />

                  <div className="relative flex-shrink-0" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      disabled={!fileId || processingStatus?.status !== 'processed' || isLoading || isGeneratingInsights || isLoadingSecrets}
                      className="flex items-center space-x-2 px-2.5py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{isLoadingSecrets ? 'Loading...' : activeDropdown}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    {showDropdown && !isLoadingSecrets && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                        {secrets.length > 0 ? (
                          secrets.map((secret) => (
                            <button
                              key={secret.id}
                              type="button"
                              onClick={() => handleDropdownSelect(secret.name, secret.id)}
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

                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    placeholder={
                      isSecretPromptSelected 
                        ? `Add details for ${activeDropdown}...`
                        : fileId 
                          ? "Ask a question..." 
                          : "Upload a document first"
                    }
                    className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-sm font-medium py-1 min-w-0 analysis-page-user-input"
                    disabled={isLoading || isGeneratingInsights || !fileId || processingStatus?.status !== 'processed'}
                  />

                  <button
                    type="submit"
                    disabled={
                      isLoading || 
                      isGeneratingInsights || 
                      (!chatInput.trim() && !isSecretPromptSelected) || 
                      !fileId || 
                      processingStatus?.status !== 'processed'
                    }
                    className="p-1.5 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg transition-colors flex-shrink-0"
                    title="Send Message"
                  >
                    {isLoading || isGeneratingInsights ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                
                {documentData && (processingStatus?.status === 'processing' || processingStatus?.status === 'batch_processing') && (
                  <div className="mt-2 text-center">
                    <div className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Processing document...
                      {processingStatus.processing_progress && (
                        <span className="ml-1">({Math.round(processingStatus.processing_progress)}%)</span>
                      )}
                    </div>
                  </div>
                )}

                {documentData && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{documentData.originalName}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(documentData.size)}
                        </p>
                      </div>
                      {processingStatus && (
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          processingStatus.status === 'processed'
                            ? 'bg-green-100 text-green-800'
                            : processingStatus.status === 'processing' || processingStatus.status === 'batch_processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {(processingStatus.status ?? '').charAt(0).toUpperCase() + (processingStatus.status ?? '').slice(1)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isSecretPromptSelected && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-xs text-blue-800">
                      <Bot className="h-3.5 w-3.5" />
                      <span>Using: <strong>{activeDropdown}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSecretPromptSelected(false);
                          setActiveDropdown('Custom Query');
                          setSelectedSecretId(null);
                        }}
                        className="ml-auto text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Right Panel - Response Display */}
          <div className="w-3/5 flex flex-col h-full bg-gray-50">
            <div className="flex-1 overflow-y-auto" ref={responseRef}>
              {selectedMessageId && (currentResponse || animatedResponseContent) ? (
                <div className="px-6 py-6">
                  <div className="max-w-none">
                    {/* Header Section */}
                    <div className="mb-6 pb-4 border-b border-gray-200 bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                          <Bot className="h-5 w-5 mr-2 text-blue-600" />
                          AI Response
                        </h2>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <button
                            onClick={handleCopyResponse}
                            className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                            title="Copy AI Response"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </button>
                          <DownloadPdf markdownOutputRef={markdownOutputRef} />
                          {messages.find(msg => msg.id === selectedMessageId)?.timestamp && (
                            <span>{formatDate(messages.find(msg => msg.id === selectedMessageId).timestamp)}</span>
                          )}
                          {messages.find(msg => msg.id === selectedMessageId)?.session_id && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {messages.find(msg => msg.id === selectedMessageId).session_id.split('-')[1]?.substring(0, 6) || 'N/A'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Question Display */}
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500">
                        <p className="text-sm font-medium text-blue-900 mb-1 flex items-center">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Question:
                        </p>
                        <p className="text-sm text-blue-800 leading-relaxed">
                          {messages.find(msg => msg.id === selectedMessageId)?.question || 'No question available'}
                        </p>
                      </div>

                      {/* Skip Animation Button */}
                      {isAnimatingResponse && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => showResponseImmediately(currentResponse)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <span>Skip animation</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Response Content with Enhanced Markdown Rendering */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="prose prose-gray prose-lg max-w-none" ref={markdownOutputRef}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                          components={markdownComponents}
                        >
                          {animatedResponseContent || currentResponse || ''}
                        </ReactMarkdown>
                        
                        {/* Typing Indicator */}
                        {isAnimatingResponse && (
                          <span className="inline-flex items-center ml-1">
                            <span className="inline-block w-2 h-5 bg-blue-600 animate-pulse"></span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md px-6">
                    <div className="bg-white rounded-full p-6 inline-block mb-6 shadow-lg">
                      <MessageSquare className="h-16 w-16 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-4 text-gray-900">Select a Question</h3>
                    <p className="text-gray-600 text-lg leading-relaxed">
                      Click on any question from the left panel to view the AI response here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisPage;