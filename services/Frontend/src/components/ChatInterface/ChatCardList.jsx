import React, { useEffect, useState } from "react";
import documentApi from "../../services/documentApi"; // Corrected import path

const ChatCardList = ({ folderName, onSelectChat }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (folderName) {
      const loadChats = async () => {
        try {
          setLoading(true);
          const data = await documentApi.getFolderChats(folderName);
          console.log("Chats fetched by ChatCardList:", data); // Added logging
          // backend returns { success, folderName, chats }
          setChats(data.chats || []);
        } catch (err) {
          console.error("❌ Error fetching chats:", err.message);
          setChats([]);
        } finally {
          setLoading(false);
        }
      };
      loadChats();
    }
  }, [folderName]);

  if (loading) {
    return <p className="text-gray-400 text-center p-8">Loading chats...</p>;
  }

  if (!chats || chats.length === 0) {
    return <p className="text-gray-400 text-center p-8">No chat conversations found.</p>;
  }

  return (
    <div className="space-y-3">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => onSelectChat(chat.id)}
        >
          <h4 className="text-sm font-semibold text-gray-800 mb-1">
            {chat.question?.slice(0, 40) || `Chat ${chat.id.substring(0, 8)}`}
          </h4>
          <p className="text-xs text-gray-500">
            {chat.created_at
              ? `Last message ${new Date(chat.created_at).toLocaleString()}`
              : "Last message N/A"}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ChatCardList;
