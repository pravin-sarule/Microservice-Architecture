import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FolderContent from '../components/FolderContent/FolderContent';
import ChatInterface from '../components/ChatInterface/ChatInterface';
import { FileManagerContext } from '../context/FileManagerContext';
import { ArrowLeft } from 'lucide-react';

const FolderDetailPage = () => {
  const { folderName } = useParams();
  const navigate = useNavigate();
  const { setSelectedFolder, selectedFolder, loadFoldersAndFiles } = useContext(FileManagerContext);

  useEffect(() => {
    if (folderName) {
      setSelectedFolder(folderName);
    }
  }, [folderName, setSelectedFolder]);

  // Ensure folders are loaded so context can find the selected folder
  useEffect(() => {
    loadFoldersAndFiles();
  }, [loadFoldersAndFiles]);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left sidebar for navigation back to projects */}
      <div className="w-1/6 p-4 border-r border-gray-700 flex flex-col">
        <button
          onClick={() => navigate('/documents')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2 transition-colors duration-200 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Projects</span>
        </button>
        <h2 className="text-xl font-semibold mb-4">{selectedFolder || 'Loading...'} </h2>
        {/* Potentially add folder details or navigation within the folder here */}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top section for Folder Content */}
        <div className="h-1/2 p-4 border-b border-gray-700">
          <FolderContent />
        </div>

        {/* Bottom section for Chat Interface */}
        <div className="h-1/2 p-4">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
};

export default FolderDetailPage;