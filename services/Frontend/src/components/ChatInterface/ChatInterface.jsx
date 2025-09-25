import React, { useState, useEffect, useContext } from 'react';
import { documentApi } from '../../services/documentApi';
import { FileManagerContext } from '../../context/FileManagerContext';
import ChatSessionList from './ChatSessionList';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

const ChatInterface = () => {
  const { selectedFolder, chatSessions, setChatSessions, selectedChatSessionId, setSelectedChatSessionId } = useContext(FileManagerContext);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [currentChatHistory, setCurrentChatHistory] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState(null);

  const fetchChatSessions = async () => {
    if (!selectedFolder) {
      setChatSessions([]);
      return;
    }
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const data = await documentApi.getFolderChatSessions(selectedFolder);
      setChatSessions(data.sessions);
    } catch (err) {
      setSessionsError('Failed to fetch chat sessions.');
      console.error('Error fetching chat sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchChatHistory = async (sessionId) => {
    if (!selectedFolder || !sessionId) {
      setCurrentChatHistory([]);
      return;
    }
    setLoadingChat(true);
    setChatError(null);
    try {
      const data = await documentApi.getFolderChatSessionById(selectedFolder, sessionId);
      setCurrentChatHistory(data.chatHistory);
    } catch (err) {
      setChatError('Failed to fetch chat history.');
      console.error('Error fetching chat history:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    // Only fetch sessions if a valid folder is selected (not "Test" or null for global queries)
    if (selectedFolder && selectedFolder !== 'Test') {
      fetchChatSessions();
    } else {
      setChatSessions([]);
    }
    setCurrentChatHistory([]); // Clear history when folder changes
    setSelectedChatSessionId(null); // Deselect session when folder changes
  }, [selectedFolder]);

  useEffect(() => {
    // Only fetch history if a valid folder and session are selected
    if (selectedFolder && selectedFolder !== 'Test' && selectedChatSessionId) {
      fetchChatHistory(selectedChatSessionId);
    } else {
      setCurrentChatHistory([]);
    }
  }, [selectedFolder, selectedChatSessionId]);

  const handleNewMessage = async (message) => {
    setLoadingChat(true);
    setChatError(null);

    const TEST_KEYWORD = '/test';
    const isTestMode = message.startsWith(TEST_KEYWORD);
    let processedMessage = message;
    if (isTestMode) {
      processedMessage = message.substring(TEST_KEYWORD.length).trim();
    }

    if (!selectedFolder && !isTestMode) {
      alert('Please select a folder first, or use /test for a global query.');
      setLoadingChat(false);
      return;
    }

    try {
      let response;
      if (isTestMode) {
        // Use the new test query endpoint
        response = await documentApi.queryTestDocuments(processedMessage, selectedChatSessionId);
        console.log('Test query response:', response); // Debugging line
        if (!selectedChatSessionId && response.sessionId) {
          setSelectedChatSessionId(response.sessionId); // Set new session ID if not already set
        }
        // Assuming test query might return a direct message or a different structure
        if (response.chatHistory) {
          setCurrentChatHistory(response.chatHistory);
        } else if (response.message) {
          // If the response is a simple message, format it as a chat history entry
          setCurrentChatHistory([{ sender: 'AI', message: response.message }]);
        } else {
          // Fallback for unexpected response structure
          setCurrentChatHistory([{ sender: 'AI', message: JSON.stringify(response) }]);
        }
      } else if (selectedChatSessionId) {
        // Continue existing session for a folder
        response = await documentApi.continueFolderChat(selectedFolder, selectedChatSessionId, processedMessage);
        setCurrentChatHistory(response.chatHistory);
      } else {
        // Start new query for a folder
        response = await documentApi.queryFolderDocuments(selectedFolder, processedMessage);
        setSelectedChatSessionId(response.sessionId); // Set new session ID
        setCurrentChatHistory(response.chatHistory);
      }
      // Only refresh session list if not in test mode, as test mode doesn't create folder sessions
      if (!isTestMode) {
        fetchChatSessions();
      }
    } catch (err) {
      setChatError(`Failed to send message: ${err.response?.data?.details || err.message}`);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this chat session?')) {
      try {
        await documentApi.deleteFolderChatSession(selectedFolder, sessionId);
        fetchChatSessions(); // Refresh sessions
        if (selectedChatSessionId === sessionId) {
          setSelectedChatSessionId(null);
          setCurrentChatHistory([]);
        }
      } catch (err) {
        setSessionsError(`Failed to delete session: ${err.response?.data?.details || err.message}`);
      }
    }
  };

  return (
    <div className="flex-1 flex bg-gray-800 text-white p-4 rounded-lg shadow-lg">
      <div className="w-1/4 border-r border-gray-700 pr-4">
        <h3 className="text-lg font-semibold mb-4">Chat Sessions</h3>
        {loadingSessions ? (
          <div>Loading sessions...</div>
        ) : sessionsError ? (
          <div className="text-red-500">Error: {sessionsError}</div>
        ) : (
          <ChatSessionList
            sessions={chatSessions}
            selectedSessionId={selectedChatSessionId}
            onSelectSession={setSelectedChatSessionId}
            onDeleteSession={handleDeleteSession}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col pl-4">
        {selectedFolder ? (
          <>
            <div className="flex-grow overflow-y-auto mb-4 p-2 bg-gray-700 rounded-md">
              {loadingChat ? (
                <div>Loading chat history...</div>
              ) : chatError ? (
                <div className="text-red-500">Error: {chatError}</div>
              ) : currentChatHistory.length === 0 ? (
                <p className="text-gray-400">
                  {selectedChatSessionId
                    ? 'No messages in this session. Start a conversation!'
                    : 'Select a chat session or start a new query below.'}
                </p>
              ) : (
                currentChatHistory.map((msg, index) => (
                  <ChatMessage key={index} message={msg} />
                ))
              )}
            </div>
            <ChatInput onSendMessage={handleNewMessage} disabled={!selectedFolder} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">
            Select a folder to start chatting.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;