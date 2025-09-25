import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { FileManagerContext } from '../context/FileManagerContext';
import CreateFolderModal from '../components/FolderBrowser/CreateFolderModal';

const DocumentUploadPage = () => {
  const { folders, loadFoldersAndFiles, createFolder, loading, error } = useContext(FileManagerContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('activity'); // 'activity' or 'name'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadFoldersAndFiles();
  }, []);

  const handleCreateFolder = async (newFolderName) => {
    await createFolder(newFolderName);
    setIsModalOpen(false);
  };

  const handleProjectClick = (folderName) => {
    navigate(`/documents/${folderName}`);
  };

  const sortedFolders = [...folders].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    // Default sort by activity (most recent first)
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const filteredFolders = sortedFolders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Projects</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-6 py-3 rounded-md flex items-center space-x-2 hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New project</span>
          </button>
        </div>

        <div className="flex items-center mb-8 space-x-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="activity">Activity</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading projects...</div>
        ) : error ? (
          <div className="text-center text-red-500">Error: {error}</div>
        ) : filteredFolders.length === 0 ? (
          <div className="text-center text-gray-500">No projects found. Create a new one!</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleProjectClick(folder.name)}
              >
                <h3 className="text-lg font-semibold mb-2">{folder.name}</h3>
                <p className="text-sm text-gray-500">
                  Updated {new Date(folder.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateFolderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateFolder}
      />
    </div>
  );
};

export default DocumentUploadPage;