import React from 'react';

const DocumentCard = ({ document, individualStatus }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'processed':
        return 'bg-green-500';
      case 'processing':
      case 'batch_processing':
        return 'bg-yellow-500';
      case 'queued':
      case 'batch_queued':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-700 p-4 rounded-md shadow-sm flex items-center justify-between">
      <div className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 mr-3 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <div>
          <p className="font-medium text-white">{document.name}</p>
          <p className="text-gray-400 text-sm">
            {document.size ? `${(document.size / 1024).toFixed(2)} KB` : 'N/A'} - {new Date(document.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(individualStatus?.status || document.status)}`}
        >
          {individualStatus?.status || document.status}
        </span>
        {(individualStatus?.status === 'processing' || individualStatus?.status === 'batch_processing' || individualStatus?.status === 'queued' || individualStatus?.status === 'batch_queued') ? (
          <div className="w-20 bg-gray-600 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${individualStatus?.progress || 0}%` }}
            ></div>
          </div>
        ) : null}
        {document.url && document.status === 'processed' && (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
};

export default DocumentCard;