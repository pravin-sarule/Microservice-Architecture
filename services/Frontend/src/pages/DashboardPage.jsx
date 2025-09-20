import React from 'react';

const DashboardPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="bg-blue-100 rounded-2xl p-4 mb-6">
        <span className="text-4xl">⚖️</span>
      </div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-3">Welcome to Nexintel AI</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Your AI-powered legal assistant for document processing, case analysis, and legal drafting. Choose an action
        below to get started.
      </p>
      {/* <div className="grid md:grid-cols-3 gap-4 w-full max-w-2xl">
        <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
          <div className="bg-blue-600 h-8 w-8 rounded-md mb-3"></div>
          <h3 className="font-semibold text-gray-800 mb-1">Upload Documents</h3>
          <p className="text-sm text-gray-600">Upload case files for AI-powered analysis and summarization</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
          <div className="bg-blue-600 h-8 w-8 rounded-md mb-3"></div>
          <h3 className="font-semibold text-gray-800 mb-1">AI Case Analysis</h3>
          <p className="text-sm text-gray-600">Get role-specific summaries for judges, lawyers, and clients</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
          <div className="bg-blue-600 h-8 w-8 rounded-md mb-3"></div>
          <h3 className="font-semibold text-gray-800 mb-1">Document Drafting</h3>
          <p className="text-sm text-gray-600">Generate legal documents using AI and templates</p>
        </div>
      </div> */}
    </div>
  );
};

export default DashboardPage;