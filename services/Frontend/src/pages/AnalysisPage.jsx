

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ApiService from '../services/api'; // Keep ApiService import
import {
 Search,
 Send,
 FileText,
 Edit3,
 Layers,
 Minus,
 Plus,
 Trash2,
 RotateCcw,
 ArrowRight,
 ChevronRight,
 ChevronLeft,
 AlertTriangle,
 Clock,
 Scale,
 Loader2,
 Upload,
 Download,
 AlertCircle,
 CheckCircle,
 X,
 Save,
 Eye,
 Quote,
 BookOpen,
 Gavel,
 ChevronDown,
 Paperclip,
 MessageSquare,
 FileCheck,
 User,
 Bot
} from 'lucide-react';

// Animated text rendering utility
const animateText = (text, setter, isAnimatingSetter, delay = 10) => {
 let i = 0;
 setter(''); // Clear previous content
 isAnimatingSetter(true);
 const interval = setInterval(() => {
 if (i < text.length) {
 setter(prev => prev + text.charAt(i));
 i++;
 } else {
 clearInterval(interval);
 isAnimatingSetter(false);
 }
 }, delay);
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
 const [isSaving, setIsSaving] = useState(false);
 const [showSidebar, setShowSidebar] = useState(true);
 const [error, setError] = useState(null);
 const [success, setSuccess] = useState(null);
 const [editMode, setEditMode] = useState(false);
 const [editedContent, setEditedContent] = useState('');
 const [showDropdown, setShowDropdown] = useState(false);
 const [hasResponse, setHasResponse] = useState(false);
 const [isSecretPromptSelected, setIsSecretPromptSelected] = useState(false); 
 
 // Document and Analysis Data
 const [documentData, setDocumentData] = useState(null);
 const [analysisResults, setAnalysisResults] = useState(null);
 const [caseSummary, setCaseSummary] = useState(null);
 const [legalGrounds, setLegalGrounds] = useState([]);
 const [citations, setCitations] = useState([]);
 const [keyIssues, setKeyIssues] = useState([]);
 const [messages, setMessages] = useState([]);
 const [fileId, setFileId] = useState(paramFileId || null);
 const [sessionId, setSessionId] = useState(paramSessionId || null);
 const [uploadProgress, setUploadProgress] = useState(0);
 const [processingStatus, setProcessingStatus] = useState(null);
 const [currentResponse, setCurrentResponse] = useState('');
 const [animatedResponseContent, setAnimatedResponseContent] = useState('');
 const [isAnimatingResponse, setIsAnimatingResponse] = useState(false);
 const [chatInput, setChatInput] = useState('');
 const [showSplitView, setShowSplitView] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedMessageId, setSelectedMessageId] = useState(null);
 const [displayLimit, setDisplayLimit] = useState(10); // New state for display limit
 const [showAllChats, setShowAllChats] = useState(false); // New state to toggle all chats
 
 // New state for secrets
 const [secrets, setSecrets] = useState([]);
 const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
 const [selectedSecretId, setSelectedSecretId] = useState(null);
 
 // Refs
 const fileInputRef = useRef(null);
 const dropdownRef = useRef(null);
 const responseRef = useRef(null);

 // API Configuration - CORRECTED
 const API_BASE_URL = 'https://gateway-service-110685455967.asia-south1.run.app';
 
 // Get auth token with comprehensive fallback options
 const getAuthToken = () => {
 const tokenKeys = [
 'authToken', 'token', 'accessToken', 'jwt', 'bearerToken',
 'auth_token', 'access_token', 'api_token', 'userToken'
 ];
 
 for (const key of tokenKeys) {
 const token = localStorage.getItem(key);
 if (token) {
 return token;
 }
 }
 
 return null;
 };

 // API request helper
 const apiRequest = async (url, options = {}) => {
 try {
 const token = getAuthToken();
 const defaultHeaders = {
 'Content-Type': 'application/json',
 };

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
 case 401:
 throw new Error('Authentication required. Please log in again.');
 case 403:
 throw new Error('Access denied.');
 case 404:
 throw new Error('Resource not found.');
 case 413:
 throw new Error('File too large.');
 case 415:
 throw new Error('Unsupported file type.');
 case 429:
 throw new Error('Too many requests.');
 default:
 throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
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

 // CORRECTED: Function to fetch secrets list
 const fetchSecrets = async () => {
 try {
 setIsLoadingSecrets(true);
 setError(null);
 
 const token = getAuthToken();
 const headers = {
 'Content-Type': 'application/json',
 };

 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // CORRECT API CALL
 const response = await fetch(`${API_BASE_URL}/files/secrets?fetch=true`, {
 method: 'GET',
 headers,
 });

 if (!response.ok) {
 throw new Error(`Failed to fetch secrets: ${response.status}`);
 }

 const secretsData = await response.json();
 
 setSecrets(secretsData || []);
 
 // Set default selection to first secret if available
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

 // CORRECTED: Function to fetch secret value by ID using your specific endpoint
 const fetchSecretValue = async (secretId) => {
 console.log('fetchSecretValue: Called for secretId:', secretId);
 try {
 // First, check if we already have the value in our secrets array
 const existingSecret = secrets.find(secret => secret.id === secretId);
 if (existingSecret && existingSecret.value) {
 console.log('fetchSecretValue: Using cached secret value for:', secretId);
 return existingSecret.value;
 }
 console.log('fetchSecretValue: Value not in cache, fetching from API for secretId:', secretId);

 // If not found in cache, fetch from API using your specific endpoint
 const token = getAuthToken();
 const headers = {
 'Content-Type': 'application/json',
 };

 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // Using your specific API endpoint format
 const response = await fetch(`${API_BASE_URL}/files/secrets/${secretId}`, {
 method: 'GET',
 headers,
 });

 if (!response.ok) {
 throw new Error(`Failed to fetch secret value: ${response.status}`);
 }

 const secretData = await response.json();
 console.log('fetchSecretValue: Raw secretData from API:', secretData);
 
 // The response should contain the prompt value - adjust based on your API response structure
 const promptValue = secretData.value || secretData.prompt || secretData.content || secretData;
 console.log('fetchSecretValue: Extracted promptValue:', promptValue);
 
 // Update the secrets array with the fetched value
 setSecrets(prevSecrets =>
 prevSecrets.map(secret =>
 secret.id === secretId
 ? { ...secret, value: promptValue }
 : secret
 )
 );
 
 return promptValue || '';
 } catch (error) {
 console.error('Error fetching secret value:', error);
 throw new Error('Failed to retrieve analysis prompt');
 }
 };

 // CORRECTED: Alternative function to fetch all secrets with their values upfront
 const fetchSecretsWithValues = async () => {
 try {
 setIsLoadingSecrets(true);
 setError(null);
 
 const token = getAuthToken();
 const headers = {
 'Content-Type': 'application/json',
 };

 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // First get all secrets
 const secretsResponse = await fetch(`${API_BASE_URL}/files/secrets`, {
 method: 'GET',
 headers,
 });

 if (!secretsResponse.ok) {
 throw new Error(`Failed to fetch secrets: ${secretsResponse.status}`);
 }

 const secretsList = await secretsResponse.json();
 
 if (!secretsList || secretsList.length === 0) {
 setSecrets([]);
 return;
 }

 // Fetch values for all secrets using your specific endpoint format
 const secretsWithValues = await Promise.all(
 secretsList.map(async (secret) => {
 try {
 const valueResponse = await fetch(`${API_BASE_URL}/files/secrets/${secret.id}`, {
 method: 'GET',
 headers,
 });
 
 if (valueResponse.ok) {
 const valueData = await valueResponse.json();
 // Handle different possible response formats for the prompt value
 const promptValue = valueData.value || valueData.prompt || valueData.content || valueData;
 return { ...secret, value: promptValue || '' };
 } else {
 console.warn(`Failed to fetch value for secret ${secret.id}`);
 return { ...secret, value: '' };
 }
 } catch (error) {
 console.warn(`Error fetching value for secret ${secret.id}:`, error);
 return { ...secret, value: '' };
 }
 })
 );

 setSecrets(secretsWithValues);
 
 // Set default selection to first secret if available
 if (secretsWithValues.length > 0) {
 setActiveDropdown(secretsWithValues[0].name);
 setSelectedSecretId(secretsWithValues[0].id);
 }
 
 } catch (error) {
 console.error('Error fetching secrets:', error);
 setError(`Failed to load analysis prompts: ${error.message}`);
 } finally {
 setIsLoadingSecrets(false);
 }
 };

 // State for batch uploads
 const [batchUploads, setBatchUploads] = useState([]);

 // File upload with progress tracking (for single file)
 const uploadDocument = async (file) => {
 try {
 setError(null);
 
 const formData = new FormData();
 formData.append('document', file);

 return new Promise((resolve, reject) => {
 const xhr = new XMLHttpRequest();
 
 xhr.upload.onprogress = (event) => {
 if (event.lengthComputable) {
 const progress = Math.round((event.loaded / event.total) * 100);
 setUploadProgress(progress);
 }
 };

 xhr.onload = () => {
 if (xhr.status >= 200 && xhr.status < 300) {
 try {
 const data = JSON.parse(xhr.responseText);
 const documentId = data.file_id || data.document_id || data.id;
 
 if (!documentId) {
 throw new Error('No document ID returned from server');
 }

 setFileId(documentId);
 setDocumentData({
 id: documentId,
 title: file.name,
 originalName: file.name,
 size: file.size,
 type: file.type,
 uploadedAt: new Date().toISOString(),
 status: 'uploaded',
 content: data.html_content || data.content || 'Document uploaded. Processing...'
 });
 
 setSuccess('Document uploaded successfully!');
 
 if (data.file_id) {
 startProcessingStatusPolling(data.file_id);
 } else {
 setProcessingStatus({ status: 'processed' });
 }
 
 resolve(data);
 } catch (error) {
 reject(new Error('Failed to parse server response.'));
 }
 } else {
 reject(new Error(`Upload failed with status ${xhr.status}`));
 }
 };

 xhr.onerror = () => {
 reject(new Error('Network error occurred during upload.'));
 };

 xhr.ontimeout = () => {
 reject(new Error('Upload timeout.'));
 };

 const token = getAuthToken();
 xhr.open('POST', `${API_BASE_URL}/files/batch-upload`);
 
 if (token) {
 xhr.setRequestHeader('Authorization', `Bearer ${token}`);
 }
 
 xhr.timeout = 300000;
 xhr.send(formData);
 });
 } catch (error) {
 setError(`Upload failed: ${error.message}`);
 throw error;
 }
 };

 // Batch file upload with progress tracking
 const batchUploadDocuments = async (files) => {
 setIsUploading(true);
 setError(null);
 setBatchUploads(files.map(file => ({
 file: file,
 progress: 0,
 status: 'pending',
 id: file.name + Date.now()
 })));

 const uploadPromises = files.map(file => {
 return new Promise((resolve, reject) => {
 const formData = new FormData();
 formData.append('document', file);

 const xhr = new XMLHttpRequest();

 xhr.upload.onprogress = (event) => {
 if (event.lengthComputable) {
 const progress = Math.round((event.loaded / event.total) * 100);
 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, progress: progress } : upload
 ));
 }
 };

 xhr.onload = () => {
 if (xhr.status >= 200 && xhr.status < 300) {
 try {
 const data = JSON.parse(xhr.responseText);
 const documentId = data.file_id || data.document_id || data.id;

 if (!documentId) {
 throw new Error('No document ID returned from server');
 }

 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, status: 'uploaded', file_id: documentId } : upload
 ));
 resolve(data);
 } catch (error) {
 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, status: 'failed', error: 'Failed to parse server response.' } : upload
 ));
 reject(new Error('Failed to parse server response.'));
 }
 } else {
 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, status: 'failed', error: `Upload failed with status ${xhr.status}` } : upload
 ));
 reject(new Error(`Upload failed with status ${xhr.status}`));
 }
 };

 xhr.onerror = () => {
 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, status: 'failed', error: 'Network error occurred during upload.' } : upload
 ));
 reject(new Error('Network error occurred during upload.'));
 };

 xhr.ontimeout = () => {
 setBatchUploads(prev => prev.map(upload =>
 upload.id === (file.name + Date.now()) ? { ...upload, status: 'failed', error: 'Upload timeout.' } : upload
 ));
 reject(new Error('Upload timeout.'));
 };

 const token = getAuthToken();
 xhr.open('POST', `${API_BASE_URL}/files/batch-upload`);
 
 if (token) {
 xhr.setRequestHeader('Authorization', `Bearer ${token}`);
 }
 
 xhr.timeout = 300000;
 xhr.send(formData);
 });
 });

 try {
 const results = await Promise.allSettled(uploadPromises);
 const successfulUploads = results.filter(result => result.status === 'fulfilled');
 const failedUploads = results.filter(result => result.status === 'rejected');

 if (successfulUploads.length > 0) {
 setSuccess(`${successfulUploads.length} document(s) uploaded successfully!`);
 const firstSuccessfulUpload = successfulUploads[0];
 const firstSuccessfulFile = firstSuccessfulUpload.value;
 const originalFile = batchUploads.find(u => u.file_id === firstSuccessfulFile.file_id)?.file;

 if (firstSuccessfulFile.file_id && originalFile) {
 setFileId(firstSuccessfulFile.file_id);
 setDocumentData({
 id: firstSuccessfulFile.file_id,
 title: originalFile.name,
 originalName: originalFile.name,
 size: originalFile.size,
 type: originalFile.type,
 uploadedAt: new Date().toISOString(),
 status: 'uploaded',
 content: firstSuccessfulFile.html_content || firstSuccessfulFile.content || 'Document uploaded. Processing...'
 });
 startProcessingStatusPolling(firstSuccessfulFile.file_id);
 }
 }

 if (failedUploads.length > 0) {
 setError(`${failedUploads.length} document(s) failed to upload.`);
 }

 } catch (error) {
 setError(`Batch upload process encountered an error: ${error.message}`);
 } finally {
 setIsUploading(false);
 setUploadProgress(0);
 }
 };

 // Processing status polling
 const getProcessingStatus = async (file_id) => {
 try {
 const data = await ApiService.getFileStatus(file_id); // Use the new API service method
 setProcessingStatus(data);
 
 if (data.status === 'processed') {
 setDocumentData(prev => ({
 ...prev,
 status: 'processed',
 content: prev?.content || 'Document processed successfully.'
 }));
 } else if (data.status === 'error') {
 setError('Document processing failed.');
 }
 
 return data;
 } catch (error) {
 return null;
 }
 };

 const startProcessingStatusPolling = (file_id) => {
 let pollCount = 0;
 const maxPolls = 150;

 const pollInterval = setInterval(async () => {
 pollCount++;
 const status = await getProcessingStatus(file_id);
 
 if (status && (status.status === 'processed' || status.status === 'error')) {
 clearInterval(pollInterval);
 if (status.status === 'processed') {
 setSuccess('Document processing completed!');
 } else {
 setError('Document processing failed.');
 }
 } else if (pollCount >= maxPolls) {
 clearInterval(pollInterval);
 setError('Document processing timeout.');
 }
 }, 2000);

 return pollInterval;
 };

 // Format key issues response
 const formatKeyIssuesResponse = (issues) => {
 if (!issues || issues.length === 0) return 'No key issues identified in the document.';
 
 let formatted = 'Key Legal Issues Identified\n\n';
 
 issues.forEach((issue, index) => {
 formatted += `${index + 1}. ${issue.title}\n\n`;
 formatted += `Severity: ${issue.severity.toUpperCase()}\n`;
 formatted += `Category: ${issue.category}\n\n`;
 formatted += `${issue.description}\n\n`;
 if (index < issues.length - 1) formatted += '---\n\n';
 });
 
 return formatted;
 };

 // Toggle sidebar
 const toggleSidebar = () => {
 setShowSidebar(!showSidebar);
 };

 // Updated animateResponse function
 const animateResponse = (text) => {
 setAnimatedResponseContent('');
 setIsAnimatingResponse(true);
 setShowSplitView(true);
 
 let i = 0;
 const interval = setInterval(() => {
 if (i < text.length) {
 setAnimatedResponseContent(prev => prev + text.charAt(i));
 i++;
 
 if (responseRef.current) {
 responseRef.current.scrollTop = responseRef.current.scrollHeight;
 }
 } else {
 clearInterval(interval);
 setIsAnimatingResponse(false);
 }
 }, 20);
 
 return interval;
 };

 // CORRECTED: Chat with AI using custom prompt from secrets
 const chatWithAI = async (file_id, secretId, currentSessionId) => {
 console.log('chatWithAI: Called with:', { file_id, secretId, currentSessionId });
 try {
 setIsGeneratingInsights(true);
 setError(null);

 // Get the prompt from the selected secret
 const selectedSecret = secrets.find(s => s.id === secretId);
 if (!selectedSecret) {
 throw new Error('No prompt found for selected analysis type');
 }

 let promptValue = selectedSecret.value;
 const promptLabel = selectedSecret.name;
 console.log('chatWithAI: Initial promptValue from state:', promptValue, 'promptLabel:', promptLabel);
 
 // If the secret doesn't have a value, fetch it
 if (!promptValue) {
 console.log('chatWithAI: promptValue is empty, attempting to fetch secret value for secretId:', secretId);
 try {
 promptValue = await fetchSecretValue(secretId);
 console.log('chatWithAI: Fetched promptValue:', promptValue);
 } catch (fetchError) {
 console.error('chatWithAI: Error fetching secret prompt:', fetchError);
 throw new Error(`Failed to fetch secret prompt: ${fetchError.message}`);
 }
 }

 if (!promptValue) {
 console.error('chatWithAI: Final promptValue is empty after all attempts.');
 throw new Error('Secret prompt value is empty.');
 }
 console.log('chatWithAI: Sending promptValue to API:', promptValue);

 // Send the prompt and other data to the backend
 const data = await apiRequest('/files/chat', {
 method: 'POST',
 body: JSON.stringify({
 file_id: file_id,
 question: promptValue,
 used_secret_prompt: true,
 prompt_label: promptLabel,
 session_id: currentSessionId
 }),
 });

 const response = data.answer || data.response || 'No response received';
 const newSessionId = data.session_id || currentSessionId;

 const newChat = {
 id: Date.now(),
 file_id: file_id,
 session_id: newSessionId,
 question: promptLabel,
 answer: response,
 display_text_left_panel: `Analysis: ${promptLabel}`,
 timestamp: new Date().toISOString(),
 used_chunk_ids: data.used_chunk_ids || [],
 confidence: data.confidence || 0.8,
 type: 'analysis'
 };

 if (data.history) {
   setMessages(data.history);
 } else {
   setMessages(prev => [...prev, newChat]);
 }
 setSessionId(newSessionId);
 
 setCurrentResponse(response);
 setHasResponse(true);
 setSuccess('Analysis completed!');

 // Set selected message to show response in right panel
 setSelectedMessageId(newChat.id);
 animateResponse(response);

 return data;
 } catch (error) {
 setError(`Analysis failed: ${error.message}`);
 throw error;
 } finally {
 setIsGeneratingInsights(false);
 }
 };

 // Updated chat with document function
 const chatWithDocument = async (file_id, question, currentSessionId, displayQuestion = null) => {
 try {
 setIsLoading(true);
 setError(null);

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

 const newChat = {
 id: Date.now(),
 file_id: file_id,
 session_id: newSessionId,
 question: question.trim(),
 answer: response,
 display_text_left_panel: displayQuestion || question.trim(),
 timestamp: new Date().toISOString(),
 used_chunk_ids: data.used_chunk_ids || [],
 confidence: data.confidence || 0.8,
 type: 'chat'
 };

 if (data.history) {
   setMessages(data.history);
 } else {
   setMessages(prev => [...prev, newChat]);
 }
 setSessionId(newSessionId);
 setChatInput('');
 
 setCurrentResponse(response);
 setHasResponse(true);
 setSuccess('Question answered!');

 // Set selected message to show response in right panel
 setSelectedMessageId(newChat.id);
 animateResponse(response);

 return data;
 } catch (error) {
 setError(`Chat failed: ${error.message}`);
 throw error;
 } finally {
 setIsLoading(false);
 }
 };

 // Handle file upload
 const handleFileUpload = async (event) => {
 const files = Array.from(event.target.files);
 if (files.length === 0) return;

 const allowedTypes = [
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'text/plain'
 ];

 const maxSize = 100 * 1024 * 1024; // 100MB

 const validFiles = files.filter(file => {
 if (!allowedTypes.includes(file.type)) {
 setError(`File "${file.name}" has an unsupported type. Please upload PDF, DOC, DOCX, or TXT.`);
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
 if (validFiles.length === 1) {
 await uploadDocument(validFiles[0]);
 } else {
 await batchUploadDocuments(validFiles);
 }
 } catch (error) {
 // Error already handled by uploadDocument or batchUploadDocuments
 }

 event.target.value = '';
 };

 // Handle dropdown selection
 const handleDropdownSelect = (secretName, secretId) => {
 console.log('handleDropdownSelect: Selected secret:', { secretName, secretId });
 setActiveDropdown(secretName);
 setSelectedSecretId(secretId);
 setIsSecretPromptSelected(true);
 setChatInput('');
 setShowDropdown(false);
 };

 // Handle custom input change
 const handleChatInputChange = (e) => {
 setChatInput(e.target.value);
 setIsSecretPromptSelected(false);
 setActiveDropdown('Custom Query');
 };

 // Handle send button logic (combines chat and analysis)
 const handleSend = async (e) => {
 e.preventDefault();
 console.log('handleSend: Triggered. isSecretPromptSelected:', isSecretPromptSelected, 'selectedSecretId:', selectedSecretId, 'chatInput:', chatInput);

 if (!fileId) {
 setError('Please upload a document first.');
 return;
 }
 if (processingStatus?.status === 'processing') {
 setError('Please wait for document processing to complete.');
 return;
 }

 if (isSecretPromptSelected) {
 // Use the analysis logic
 if (!selectedSecretId) {
 setError('Please select an analysis type.');
 return;
 }
 try {
 await chatWithAI(fileId, selectedSecretId, sessionId);
 } catch (error) {
 // Error already handled
 }
 } else {
 // Use the regular chat logic
 if (!chatInput.trim()) {
 setError('Please enter a question.');
 return;
 }
 try {
 await chatWithDocument(fileId, chatInput, sessionId);
 } catch (error) {
 // Error already handled
 }
 }
 };

 // Handle message click to show response in right panel
 const handleMessageClick = (message) => {
 setSelectedMessageId(message.id);
 setCurrentResponse(message.answer);
 setAnimatedResponseContent(message.answer);
 setIsAnimatingResponse(false);
 setShowSplitView(true);
 };

 // Clear all chat data
 const clearAllChatData = () => {
 setMessages([]);
 setDocumentData(null);
 setFileId(null);
 setAnalysisResults(null);
 setCaseSummary(null);
 setLegalGrounds([]);
 setCitations([]);
 setKeyIssues([]);
 setCurrentResponse('');
 setHasResponse(false);
 setChatInput('');
 setProcessingStatus(null);
 setError(null);
 setAnimatedResponseContent('');
 setIsAnimatingResponse(false);
 setShowSplitView(false);
 setBatchUploads([]);
 setIsSecretPromptSelected(false);
 setSelectedMessageId(null);

 const keysToRemove = [
 'messages', 'currentResponse', 'hasResponse', 'documentData',
 'fileId', 'analysisResults', 'caseSummary', 'legalGrounds',
 'citations', 'keyIssues', 'processingStatus', 'animatedResponseContent', 'sessionId'
 ];
 keysToRemove.forEach(key => localStorage.removeItem(key));
 
 const newSessionId = `session-${Date.now()}`;
 setSessionId(newSessionId);
 localStorage.setItem('sessionId', newSessionId);
 
 setSuccess('New chat session started!');
 };

 // Start new chat
 const startNewChat = () => {
 clearAllChatData();
 };

 // Utility functions
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

 // Helper function to highlight text
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

 // CORRECTED: Load secrets on component mount
 useEffect(() => {
 // Option 1: Fetch secrets list first, then values on demand (recommended)
 fetchSecrets();
 
 // Option 2: Fetch all secrets with values upfront (uncomment to use instead)
 // fetchSecretsWithValues();
 }, []);

 // Save currentResponse as string
 useEffect(() => {
 if (currentResponse) {
 localStorage.setItem('currentResponse', currentResponse);
 localStorage.setItem('animatedResponseContent', animatedResponseContent);
 }
 }, [currentResponse, animatedResponseContent]);

 // Save other state
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
 if (analysisResults) {
 localStorage.setItem('analysisResults', JSON.stringify(analysisResults));
 }
 }, [analysisResults]);

 useEffect(() => {
 if (caseSummary) {
 localStorage.setItem('caseSummary', JSON.stringify(caseSummary));
 }
 }, [caseSummary]);

 useEffect(() => {
 if (legalGrounds.length > 0) {
 localStorage.setItem('legalGrounds', JSON.stringify(legalGrounds));
 }
 }, [legalGrounds]);

 useEffect(() => {
 if (citations.length > 0) {
 localStorage.setItem('citations', JSON.stringify(citations));
 }
 }, [citations]);

 useEffect(() => {
 if (keyIssues.length > 0) {
 localStorage.setItem('keyIssues', JSON.stringify(keyIssues));
 }
 }, [keyIssues]);

 useEffect(() => {
 if (processingStatus) {
 localStorage.setItem('processingStatus', JSON.stringify(processingStatus));
 }
 }, [processingStatus]);

 // Combined effect for loading/initializing
 useEffect(() => {
   const fetchChatHistory = async (currentFileId, currentSessionId, selectedChatId = null) => {
     try {
       const token = getAuthToken();
       // Use ApiService.fetchChatsBySessionId for specific session history
       const sanitizedSessionId = currentSessionId ? currentSessionId.replace(/:\d+$/, '') : null;
       console.log('fetchChatHistory: Original sessionId:', currentSessionId);
       console.log('fetchChatHistory: Sanitized sessionId:', sanitizedSessionId);
       const responseData = await ApiService.fetchChatsBySessionId(currentFileId, sanitizedSessionId);

       // The API returns an array of messages for the specific session
       let sessionMessages = responseData || [];
       // Sort messages by timestamp in descending order (most recent first)
       sessionMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
       setMessages(sessionMessages);

       if (sessionMessages.length > 0) {
         setDocumentData({
           id: currentFileId,
           title: `Document for Session ${currentSessionId}`,
           originalName: `Document for Session ${currentSessionId}`,
           size: 0, // Placeholder, as document content is not directly fetched here
           type: 'unknown', // Placeholder
           uploadedAt: new Date().toISOString(), // Use current date or a relevant date from chat
           status: 'processed',
           content: 'Document content will be loaded here if available.'
         });
         setFileId(currentFileId);
         setSessionId(currentSessionId);
         setProcessingStatus({ status: 'processed' });
         setHasResponse(true);

         const chatToDisplay = selectedChatId
           ? sessionMessages.find(chat => chat.id === selectedChatId)
           : sessionMessages[sessionMessages.length - 1];

         if (chatToDisplay) {
           setCurrentResponse(chatToDisplay.answer);
           setAnimatedResponseContent(chatToDisplay.answer);
           setIsAnimatingResponse(false);
           setShowSplitView(true);
           setSelectedMessageId(chatToDisplay.id);
         } else {
           setCurrentResponse('');
           setAnimatedResponseContent('');
           setIsAnimatingResponse(false);
           setShowSplitView(false);
           setSelectedMessageId(null);
         }
       } else {
         setMessages([]); // Clear messages if no specific session or messages found
         setHasResponse(false);
         setError('No chat history found for this session.');
         setProcessingStatus({ status: 'error' });
       }
       setSuccess('Chat history loaded successfully!');
     } catch (err) {
       console.error('Error in fetchChatHistory:', err);
       setError(`Failed to load chat history: ${err.message}`);
     }
   };

   if (location.state?.newChat) {
     const newSessionId = `session-${Date.now()}`;
     setSessionId(newSessionId);
     localStorage.setItem('sessionId', newSessionId);

     // Clear all data for new session
     setMessages([]);
     setDocumentData(null);
     setFileId(null);
     setAnalysisResults(null);
     setCaseSummary(null);
     setLegalGrounds([]);
     setCitations([]);
     setKeyIssues([]);
     setCurrentResponse('');
     setHasResponse(false);
     setChatInput('');
     setProcessingStatus(null);
     setError(null);
     setAnimatedResponseContent('');
     setIsAnimatingResponse(false);
     setShowSplitView(false);
     setBatchUploads([]);
     setIsSecretPromptSelected(false);
     setSelectedMessageId(null);

     const keysToRemove = [
       'messages', 'currentResponse', 'hasResponse', 'documentData',
       'fileId', 'analysisResults', 'caseSummary', 'legalGrounds',
       'citations', 'keyIssues', 'processingStatus', 'animatedResponseContent', 'sessionId'
     ];
     keysToRemove.forEach(key => localStorage.removeItem(key));

     window.history.replaceState({}, document.title);
   } else if (paramFileId && paramSessionId) {
     setFileId(paramFileId);
     setSessionId(paramSessionId);
     fetchChatHistory(paramFileId, paramSessionId);
   } else if (!paramFileId && paramSessionId) { // Handle /analysis/session/:session_id route
     setFileId(null); // No file_id in this route
     setSessionId(paramSessionId);
     fetchChatHistory(null, paramSessionId); // Pass null for fileId
   } else if (location.state?.chat) {
     const chatData = location.state.chat;
     setFileId(chatData.file_id);
     setSessionId(chatData.session_id);
     fetchChatHistory(chatData.file_id, chatData.session_id, chatData.id);
     window.history.replaceState({}, document.title);
   } else {
     // Handle initial load or refresh without specific chat/session data
     try {
       const savedMessages = localStorage.getItem('messages');
       if (savedMessages) {
         const parsedHistory = JSON.parse(savedMessages);
         setMessages(parsedHistory);
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
         const parsedDocumentData = JSON.parse(savedDocumentData);
         setDocumentData(parsedDocumentData);
       }

       const savedFileId = localStorage.getItem('fileId');
       if (savedFileId) {
         setFileId(savedFileId);
       }

       const savedAnalysisResults = localStorage.getItem('analysisResults');
       if (savedAnalysisResults) {
         const parsedResults = JSON.parse(savedAnalysisResults);
         setAnalysisResults(parsedResults);
       }

       const savedCaseSummary = localStorage.getItem('caseSummary');
       if (savedCaseSummary) {
         const parsedSummary = JSON.parse(savedCaseSummary);
         setCaseSummary(parsedSummary);
       }

       const savedLegalGrounds = localStorage.getItem('legalGrounds');
       if (savedLegalGrounds) {
         const parsedGrounds = JSON.parse(savedLegalGrounds);
         setLegalGrounds(parsedGrounds);
       }

       const savedCitations = localStorage.getItem('citations');
       if (savedCitations) {
         const parsedCitations = JSON.parse(savedCitations);
         setCitations(parsedCitations);
       }

       const savedKeyIssues = localStorage.getItem('keyIssues');
       if (savedKeyIssues) {
         const parsedIssues = JSON.parse(savedKeyIssues);
         setKeyIssues(parsedIssues);
       }

       const savedProcessingStatus = localStorage.getItem('processingStatus');
       if (savedProcessingStatus) {
         const parsedStatus = JSON.parse(savedProcessingStatus);
         setProcessingStatus(parsedStatus);
       }

     } catch (error) {
       console.error('Error restoring from localStorage:', error);
       if (!sessionId) {
         const newSessionId = `session-${Date.now()}`;
         setSessionId(newSessionId);
         localStorage.setItem('sessionId', newSessionId);
       }
     }
   }
 }, [location.state, paramFileId, paramSessionId]);
 
 // Automatically manage sidebar visibility and collapsed state
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

 // Save messages to localStorage whenever it changes
 useEffect(() => {
 localStorage.setItem('messages', JSON.stringify(messages));
 }, [messages]);

 // Clear success messages after 5 seconds
 useEffect(() => {
 if (success) {
 const timer = setTimeout(() => setSuccess(null), 5000);
 return () => clearTimeout(timer);
 }
 }, [success]);

 // Clear error messages after 8 seconds
 useEffect(() => {
 if (error) {
 const timer = setTimeout(() => setError(null), 8000);
 return () => clearTimeout(timer);
 }
 }, [error]);

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
 <button
 onClick={() => setError(null)}
 className="text-red-500 hover:text-red-700"
 >
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
 <button
 onClick={() => setSuccess(null)}
 className="ml-auto text-green-500 hover:text-green-700"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 )}

 {/* Upload Progress Modal */}
 {isUploading && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
 <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
 <div className="text-center">
 <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
 <h3 className="text-lg font-semibold mb-4 text-gray-900">Uploading Document(s)</h3>
 {batchUploads.length > 0 ? (
 <div className="space-y-4">
 {batchUploads.map((upload) => (
 <div key={upload.id} className="text-left">
 <p className="text-sm font-medium text-gray-800 truncate mb-1">{upload.file.name}</p>
 <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
 <div
 className={`h-2 rounded-full transition-all duration-300 ${
 upload.status === 'uploaded' ? 'bg-green-500' :
 upload.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
 }`}
 style={{ width: `${upload.progress}%` }}
 ></div>
 </div>
 <p className="text-xs text-gray-600">
 {upload.status === 'uploaded' ? 'Completed' :
 upload.status === 'failed' ? `Failed: ${upload.error}` :
 `${upload.progress}% complete`}
 </p>
 </div>
 ))}
 </div>
 ) : (
 <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
 <div
 className="bg-blue-600 h-2 rounded-full transition-all duration-300"
 style={{ width: `${uploadProgress}%` }}
 ></div>
 </div>
 )}
 {batchUploads.length === 0 && (
 <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Conditional Rendering for Single Page vs Split View */}
 {!hasResponse && !documentData ? (
 // Single Page View: Only chat input area
 <div className="flex flex-col items-center justify-center h-full w-full">
 <div className="text-center max-w-2xl px-6 mb-12">
 <h3 className="text-3xl font-bold mb-4 text-gray-900">Welcome to smart legal insights </h3>
 <p className="text-gray-600 text-xl leading-relaxed">
 Upload a legal document or ask a question to begin your AI-powered analysis.
 </p>
 </div>
 <div className="w-full max-w-4xl px-6">
 <form onSubmit={handleSend} className="mx-auto">
 <div className="flex items-center space-x-3 bg-gray-50 rounded-xl border border-gray-500 px-5 py-6 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-sm">
 {/* Upload Button */}
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
 accept=".pdf,.doc,.docx,.txt"
 onChange={handleFileUpload}
 disabled={isUploading}
 multiple
 />

 {/* Analysis Dropdown */}
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

 {/* Chat Input */}
 <input
 type="text"
 value={chatInput}
 onChange={handleChatInputChange}
 placeholder={fileId ? "Message Legal Assistant..." : "Upload a document to get started"}
 className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-[15px] font-medium py-2 min-w-0"
 disabled={isLoading || isGeneratingInsights || !fileId || processingStatus?.status !== 'processed'}
 />

 {/* Send Button */}
 <button
 type="submit"
 disabled={isLoading || isGeneratingInsights || (!chatInput.trim() && !isSecretPromptSelected) || !fileId || processingStatus?.status !== 'processed'}
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
 
 {/* Processing Status */}
 {documentData && processingStatus?.status === 'processing' && (
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

 {/* Document Info */}
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
 : processingStatus.status === 'processing'
 ? 'bg-blue-100 text-blue-800'
 : 'bg-red-100 text-red-800'
 }`}>
 {processingStatus.status.charAt(0).toUpperCase() + processingStatus.status.slice(1)}
 </div>
 )}
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
 <div className={`${showSplitView ? 'w-1/2' : 'w-full'} border-r border-gray-200 flex flex-col bg-white h-full`}>
 {/* Header */}
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
 {/* Search Input */}
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
 
 {/* Messages List - Scrollable */}
 <div className="flex-1 overflow-y-auto px-4 py-2">
   <div className="space-y-2">
     {messages
       .filter(msg =>
         msg.question.toLowerCase().includes(searchQuery.toLowerCase())
       )
       .slice(0, showAllChats ? messages.length : displayLimit) // Apply display limit
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
                 <span>{formatDate(msg.timestamp)}</span>
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

     {/* "See All" button */}
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

 {/* Input Area - Fixed at bottom */}
 <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
 <form onSubmit={handleSend} className="mx-auto">
 <div className="flex items-center space-x-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-sm">
 {/* Upload Button */}
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
 accept=".pdf,.doc,.docx,.txt"
 onChange={handleFileUpload}
 disabled={isUploading}
 multiple
 />

 {/* Analysis Dropdown */}
 <div className="relative flex-shrink-0" ref={dropdownRef}>
 <button
 type="button"
 onClick={() => setShowDropdown(!showDropdown)}
 disabled={!fileId || processingStatus?.status !== 'processed' || isLoading || isGeneratingInsights || isLoadingSecrets}
 className="flex items-center space-x-2 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

 {/* Chat Input */}
 <input
 type="text"
 value={chatInput}
 onChange={handleChatInputChange}
 placeholder={fileId ? "Ask a question..." : "Upload a document first"}
 className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-sm font-medium py-1 min-w-0"
 disabled={isLoading || isGeneratingInsights || !fileId || processingStatus?.status !== 'processed'}
 />

 {/* Send Button */}
 <button
 type="submit"
 disabled={isLoading || isGeneratingInsights || (!chatInput.trim() && !isSecretPromptSelected) || !fileId || processingStatus?.status !== 'processed'}
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
 
 {/* Processing Status */}
 {documentData && processingStatus?.status === 'processing' && (
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

 {/* Document Info */}
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
 : processingStatus.status === 'processing'
 ? 'bg-blue-100 text-blue-800'
 : 'bg-red-100 text-red-800'
 }`}>
 {(processingStatus.status ?? '').charAt(0).toUpperCase() + (processingStatus.status ?? '').slice(1)}
 </div>
 )}
 </div>
 </div>
 )}
 </form>
 </div>
 </div>

 {/* Right Panel - Response Display */}
 <div className={`${showSplitView ? 'w-1/2' : 'w-full'} flex flex-col h-full`}>
 {/* Response Area */}
 <div className="flex-1 overflow-y-auto" ref={responseRef}>
 {showSplitView && selectedMessageId && (currentResponse || animatedResponseContent) ? (
 <div className="px-6 py-6">
 <div className="max-w-none">
 {/* Response Header */}
 <div className="mb-6 pb-4 border-b border-gray-200">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900">AI Response</h2>
 <div className="flex items-center space-x-2 text-sm text-gray-500">
 {messages.find(msg => msg.id === selectedMessageId)?.timestamp && (
 <span>{formatDate(messages.find(msg => msg.id === selectedMessageId).timestamp)}</span>
 )}
 {messages.find(msg => msg.id === selectedMessageId)?.session_id && (
 <>
 <span>•</span>
 <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
 {messages.find(msg => msg.id === selectedMessageId).session_id}
 </span>
 </>
 )}
 </div>
 </div>
 {/* Original Question */}
 <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
 <p className="text-sm font-medium text-blue-900 mb-1">Question:</p>
 <p className="text-sm text-blue-800">
 {messages.find(msg => msg.id === selectedMessageId)?.question || 'No question available'}
 </p>
 </div>
 </div>

 {/* Response Content */}
 <div className="prose prose-gray max-w-none custom-markdown-renderer">
 <ReactMarkdown
 remarkPlugins={[remarkGfm]}
 children={animatedResponseContent || currentResponse || ''}
 components={{
 h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-6 mt-8 text-black border-b-2 border-gray-300 pb-2" {...props} />,
 h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-4 mt-6 text-black" {...props} />,
 h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-3 mt-4 text-black" {...props} />,
 h4: ({node, ...props}) => <h4 className="text-base font-bold mb-2 mt-3 text-black" {...props} />,
 h5: ({node, ...props}) => <h5 className="text-base font-bold mb-2 mt-3 text-black" {...props} />,
 h6: ({node, ...props}) => <h6 className="text-base font-bold mb-2 mt-3 text-black" {...props} />,
 p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-black text-justify" {...props} />,
 strong: ({node, ...props}) => <strong className="font-bold text-black" {...props} />,
 em: ({node, ...props}) => <em className="italic text-black" {...props} />,
 ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 text-black" {...props} />,
 ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 text-black" {...props} />,
 li: ({node, ...props}) => <li className="mb-2 leading-relaxed text-black" {...props} />,
 a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
 blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4" {...props} />,
 code: ({node, inline, ...props}) => {
 const className = inline ? "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-700" : "block bg-gray-100 p-4 rounded-md text-sm font-mono overflow-x-auto my-4 text-red-700";
 return <code className={className} {...props} />;
 },
 table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="min-w-full border-collapse border border-gray-400" {...props} /></div>,
 thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
 th: ({node, ...props}) => <th className="border border-gray-400 px-4 py-3 text-left font-bold text-black" {...props} />,
 tbody: ({node, ...props}) => <tbody {...props} />,
 td: ({node, ...props}) => <td className="border border-gray-400 px-4 py-3 text-black" {...props} />,
 hr: ({node, ...props}) => <hr className="my-6 border-gray-400" {...props} />,
 }}
 />
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
 </>
 )}
 </div>
 );
};

export default AnalysisPage;