import React from 'react';

const ChatMessage = ({ message }) => {
  return (
    <div className="mb-4">
      <div className="flex items-start mb-1">
        <div className="font-semibold text-blue-400 mr-2">You:</div>
        <div className="text-gray-200">{message.question}</div>
      </div>
      <div className="flex items-start">
        <div className="font-semibold text-green-400 mr-2">AI:</div>
        <div className="text-gray-300 whitespace-pre-wrap">{message.response}</div>
      </div>
      <div className="text-right text-xs text-gray-500 mt-1">
        {new Date(message.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

export default ChatMessage;