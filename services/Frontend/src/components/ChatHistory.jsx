// import React from 'react';
// import { MessageSquare, User, Bot } from 'lucide-react';

// const ChatHistory = ({ chatHistory = [] }) => {
//   const formatDate = (dateString) => {
//     try {
//       return new Date(dateString).toLocaleString();
//     } catch {
//       return 'Invalid date';
//     }
//   };

//   if (chatHistory.length === 0) {
//     return (
//       <div className="text-center text-gray-500 py-8">
//         <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
//         <p className="text-lg font-medium">No chat history for this file.</p>
//         <p className="text-sm">Start a conversation in AI Analysis to see it here.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6 p-4 bg-white rounded-lg shadow-sm">
//       <h2 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Chat History</h2>
//       {chatHistory.map((chat, index) => (
//         <div key={chat.id || index} className="flex flex-col space-y-2">
//           {/* User Question */}
//           <div className="flex items-start space-x-3">
//             <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
//               <User className="h-5 w-5 text-blue-600" />
//             </div>
//             <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-1">
//               <p className="font-medium text-blue-800">You asked:</p>
//               <p className="text-gray-800 leading-relaxed">
//                 {chat.isSecret ? `[Secret Prompt: ${chat.secretName || chat.promptName || 'Unnamed'}]` : chat.question}
//               </p>
//               <p className="text-xs text-gray-500 mt-1 text-right">{formatDate(chat.timestamp)}</p>
//             </div>
//           </div>

//           {/* AI Response */}
//           <div className="flex items-start space-x-3">
//             <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
//               <Bot className="h-5 w-5 text-green-600" />
//             </div>
//             <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex-1">
//               <p className="font-medium text-green-800">AI responded:</p>
//               <p className="text-gray-800 leading-relaxed">{chat.answer}</p>
//               <p className="text-xs text-gray-500 mt-1 text-right">{formatDate(chat.timestamp)}</p>
//             </div>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// };

// export default ChatHistory;