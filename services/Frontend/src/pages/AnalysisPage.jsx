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

// Helper to extract LLM name and clean prompt (defined globally)
const extractLlmNameAndCleanPrompt = (prompt) => {
  const llmTagRegex = /\[LLM:(\w+)\]/i;
  const match = prompt.match(llmTagRegex);
  let llmName = null;
  let cleanedPrompt = prompt;

  if (match && match[1]) {
    llmName = match[1];
    cleanedPrompt = prompt.replace(llmTagRegex, '').trim();
  }
  return { llmName, cleanedPrompt };
};

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
      console.log('[fetchSecrets] Raw secrets data:', secretsData); // Added console.log
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

    console.log('[chatWithDocument] Sending custom query with Gemini:', {
      file_id,
      question: question.substring(0, 50) + '...',
      session_id: currentSessionId
    });

    const data = await apiRequest('/files/chat', {
      method: 'POST',
      body: JSON.stringify({
        file_id: file_id,
        question: question.trim(),
        used_secret_prompt: false,  // ✅ Custom query = false
        prompt_label: null,
        session_id: currentSessionId
      }),
    });

    console.log('[chatWithDocument] Response received:', data);

    const response = data.answer || data.response || 'No response received';
    const newSessionId = data.session_id || currentSessionId;

    // ✅ Backend returns complete history - use it to update state
    if (data.history && Array.isArray(data.history) && data.history.length > 0) {
      console.log('[chatWithDocument] Updating messages from history:', data.history.length);
      setMessages(data.history);
      
      const latestMessage = data.history[data.history.length - 1];
      if (latestMessage) {
        setSelectedMessageId(latestMessage.id);
        setCurrentResponse(latestMessage.answer);
        animateResponse(latestMessage.answer);
      }
    } else {
      // Fallback: Create local message if no history returned
      console.warn('[chatWithDocument] No history in response, creating local message');
      const newChat = {
        id: data.message_id || Date.now(),
        file_id: file_id,
        session_id: newSessionId,
        question: question.trim(),
        answer: response,
        display_text_left_panel: question.trim(),
        timestamp: data.timestamp || new Date().toISOString(),
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

// ✅ Main handleSend function
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

    const selectedSecret = secrets.find(s => s.id === selectedSecretId);
    let secretPromptContent = selectedSecret?.value || ''; // Get the raw prompt content
    const promptLabel = selectedSecret?.name || 'Secret Prompt';

    if (!fileId) {
      setError('Document ID is missing for secret prompt. Please upload a document.');
      return;
    }

    if (!secretPromptContent.trim()) {
      setError('Secret prompt content is empty. Please select a valid analysis type or ensure it has content.');
      return;
    }

    const { llmName, cleanedPrompt } = extractLlmNameAndCleanPrompt(secretPromptContent);
    secretPromptContent = cleanedPrompt; // Update secretPromptContent with the cleaned version

    try {
      setIsGeneratingInsights(true);
      setError(null);
      
      console.log('[handleSend] Triggering LLM with secret:', {
        secretId: selectedSecretId,
        fileId,
        additionalInput: chatInput.trim(),
        promptLabel: promptLabel,
        sessionId,
        llmName: llmName, // Log the extracted LLM name
        cleanedPrompt: secretPromptContent // Log the cleaned prompt
      });
      
      // ✅ Call the trigger-secret-llm endpoint
      const data = await apiRequest('/api/trigger-secret-llm', {
        method: 'POST',
        body: JSON.stringify({
          secretId: selectedSecretId,
          fileId: fileId,
          additionalInput: chatInput.trim(),
          sessionId: sessionId,
          llm_name: llmName, // Pass the extracted LLM name
          question: secretPromptContent // Pass the cleaned prompt as the question
        }),
      });

      console.log('[handleSend] Secret prompt response:', data);
      
      const response = data.answer || data.response || 'No response received';
      const newSessionId = data.session_id || sessionId;

      // ✅ Backend returns complete history - use it to update state
      if (data.history && Array.isArray(data.history) && data.history.length > 0) {
        console.log('[handleSend] Updating messages from history:', data.history.length);
        setMessages(data.history);
        
        // Show the latest message (the one just created)
        const latestMessage = data.history[data.history.length - 1];
        if (latestMessage) {
          setSelectedMessageId(latestMessage.id);
          setCurrentResponse(latestMessage.answer);
          animateResponse(latestMessage.answer);
        }
      } else {
        // Fallback: Create message object if no history returned
        console.warn('[handleSend] No history in response, creating local message');
        const newChat = {
          id: data.message_id || Date.now(),
          file_id: fileId,
          session_id: newSessionId,
          question: promptLabel,
          answer: response,
          display_text_left_panel: `Analysis: ${promptLabel}`,
          timestamp: data.timestamp || new Date().toISOString(),
          used_chunk_ids: data.used_chunk_ids || [],
          confidence: data.confidence || 0.8,
          type: 'chat',
          used_secret_prompt: true,
          prompt_label: promptLabel
        };

        setMessages(prev => [...prev, newChat]);
        setSelectedMessageId(newChat.id);
        setCurrentResponse(response);
        animateResponse(response);
      }
      
      setSessionId(newSessionId);
      setChatInput('');
      setHasResponse(true);
      setSuccess('Analysis completed successfully!');
      
      // Reset secret selection after successful execution
      setIsSecretPromptSelected(false);
      setActiveDropdown('Custom Query');

    } catch (error) {
      console.error('[handleSend] Secret prompt error:', error);
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
};

export default AnalysisPage;