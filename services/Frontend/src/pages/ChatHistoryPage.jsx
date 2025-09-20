

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";

const ChatHistoryPage = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const navigate = useNavigate();

  const fetchChats = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const data = await apiService.fetchChatSessions(pageNumber, 20);

      if (data.length < 20) setHasMore(false); // No more results

      if (pageNumber === 1) {
        setChats(data);
      } else {
        setChats((prev) => [...prev, ...data]);
      }
    } catch (err) {
      console.error("Error fetching chats:", err);
      setError(err.message || "Error fetching chats");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchChats(1); // Initial fetch
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchChats(nextPage);
  };

  const generateTopicTitle = (chat) => {
    if (chat.isSecret) return chat.secretName || chat.promptName || "Secret Prompt";
    if (!chat.question) return "Untitled Chat";

    const words = chat.question.trim().split(" ");
    return words.length <= 8 ? chat.question : words.slice(0, 8).join(" ") + "...";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: new Date().getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    });
  };

  const handleChatClick = (chat) => {
    navigate(`/analysis/${chat.file_id}/${chat.session_id}`, { state: { chat } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-600 text-sm bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
          {error}
        </div>
      </div>
    );
  }

  const filteredChats = chats.filter(
    (chat) =>
      chat.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.answer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-slate-900 mb-2">Conversations</h1>
          <p className="text-slate-600 text-sm mb-6">Your recent chat history</p>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="space-y-3">
          {[...filteredChats]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // ✅ latest first
            .map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className="cursor-pointer block p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 mb-2 line-clamp-1">
                      {generateTopicTitle(chat)}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {chat.isSecret ? "Secret prompt used." : chat.question}
                    </p>
                    <p className="text-sm text-slate-500 line-clamp-2">{chat.answer}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs text-slate-400">
                      {formatDate(chat.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200"
            >
              {loadingMore ? "Loading..." : "Load older conversations"}
            </button>
          </div>
        )}

        {/* No Results */}
        {searchQuery && filteredChats.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No conversations match your search
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistoryPage;
