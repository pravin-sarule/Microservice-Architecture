// import React from 'react';

// const DocumentCard = ({ document, individualStatus }) => {
//   const getStatusColor = (status) => {
//     switch (status) {
//       case 'processed':
//         return 'bg-green-500';
//       case 'processing':
//       case 'batch_processing':
//         return 'bg-yellow-500';
//       case 'queued':
//       case 'batch_queued':
//         return 'bg-blue-500';
//       case 'error':
//         return 'bg-red-500';
//       default:
//         return 'bg-gray-500';
//     }
//   };

//   return (
//     <div
//       className="bg-white p-4 rounded-md shadow-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors duration-200"
//       onClick={() => onDocumentClick(document)}
//     >
//       <div className="flex items-center">
//         <svg
//           xmlns="http://www.w3.org/2000/svg"
//           className="h-6 w-6 mr-3 text-gray-500"
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             strokeWidth={2}
//             d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
//           />
//         </svg>
//         <div>
//           <p className="font-medium text-gray-800">{document.name}</p>
//           <p className="text-gray-500 text-sm">
//             {document.size ? `${(document.size / 1024).toFixed(2)} KB` : 'N/A'} - {new Date(document.created_at).toLocaleDateString()}
//           </p>
//         </div>
//       </div>
//       <div className="flex items-center space-x-2">
//         <span
//           className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(individualStatus?.status || document.status)}`}
//         >
//           {individualStatus?.status || document.status}
//         </span>
//         {(individualStatus?.status === 'processing' || individualStatus?.status === 'batch_processing' || individualStatus?.status === 'queued' || individualStatus?.status === 'batch_queued') ? (
//           <div className="w-20 bg-gray-200 rounded-full h-2">
//             <div
//               className="bg-blue-500 h-2 rounded-full"
//               style={{ width: `${individualStatus?.progress || 0}%` }}
//             ></div>
//           </div>
//         ) : null}
//       </div>
//     </div>
//   );
// };

// export default DocumentCard;


import React from 'react';

const DocumentCard = ({ document, individualStatus, onDocumentClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'processed':
        return 'bg-green-500';
      case 'processing':
      case 'batch_processing':
      case 'pending':
        return 'bg-yellow-500';
      case 'queued':
      case 'batch_queued':
        return 'bg-blue-500';
      case 'failed':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const currentStatus = individualStatus || { status: document.status, progress: 0, message: '' };

  return (
    <div
      className="bg-white p-4 rounded-lg shadow hover:shadow-md flex flex-col cursor-pointer transition"
      onClick={() => onDocumentClick(document)}
    >
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="font-semibold text-gray-800">{document.name}</p>
          <p className="text-sm text-gray-500">
            {document.size ? `${(document.size / 1024).toFixed(2)} KB` : 'N/A'} · {new Date(document.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs text-white ${getStatusColor(currentStatus.status)}`}
        >
          {currentStatus.status}
        </span>
      </div>

      {(['processing', 'queued', 'pending', 'failed'].includes(currentStatus.status)) && (
        <div className="w-full mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(currentStatus.status)}`}
              style={{ width: `${currentStatus.progress || 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600">{currentStatus.message || 'Processing...'}</p>
        </div>
      )}
    </div>
  );
};

export default DocumentCard;
