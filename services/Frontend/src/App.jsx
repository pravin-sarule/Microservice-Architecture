// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { ToastContainer } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';
// import MainLayout from './layouts/MainLayout';
// import DashboardPage from './pages/DashboardPage';
// import DocumentUploadPage from './pages/DocumentUploadPage';
// import FolderDetailPage from './pages/FolderDetailPage'; // New import
// import EvidenceMatrixPage from './pages/EvidenceMatrixPage';
// import TimelinePage from './pages/TimelinePage';
// import GroundSummaryPage from './pages/GroundSummaryPage';
// import AnalysisPage from './pages/AnalysisPage';
// import DraftingPage from './pages/DraftingPage';
// import ChatHistoryPage from './pages/ChatHistoryPage';
// import LandingPage from './pages/LandingPage';
// import RegisterPage from './pages/auth/RegisterPage';
// import LoginPage from './pages/auth/LoginPage';
// import PublicLayout from './layouts/PublicLayout';
// import ServicesPage from './pages/ServicesPage';
// import AboutUsPage from './pages/AboutUsPage';
// import PricingPage from './pages/PricingPage';
// import AboutNexintelPage from './pages/AboutNexintelPage';
// import SubscriptionPlanPage from './pages/SubscriptionPlanPage';
// import BillingAndUsagePage from './pages/BillingAndUsagePage'; // New import
// import SettingsPage from './pages/SettingsPage'; // New import for SettingsPage
// import GetHelpPage from './pages/GetHelpPage'; // New import for GetHelpPage
// import { SidebarProvider } from './context/SidebarContext';
// import { FileManagerProvider } from './context/FileManagerContext';
// import AuthChecker from './components/AuthChecker'; // New import

// function App() {
//   return (
//     <Router>
//       <ToastContainer />
//       <SidebarProvider>
//         <FileManagerProvider> {/* Wrap with FileManagerProvider */}
//           <Routes>
//             <Route path="/" element={<PublicLayout hideHeaderAndFooter={true}><LandingPage /></PublicLayout>} />
//             <Route path="/register" element={<RegisterPage />} />
//             <Route path="/login" element={<LoginPage />} />
//             <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} /> {/* Wrapped with PublicLayout */}
//             <Route path="/about-us" element={<PublicLayout><AboutUsPage /></PublicLayout>} />   {/* Wrapped with PublicLayout */}
//             <Route path="/pricing" element={<PublicLayout><PricingPage /></PublicLayout>} />   {/* Wrapped with PublicLayout */}
//             <Route path="/about-nexintel" element={<PublicLayout><AboutNexintelPage /></PublicLayout>} /> {/* New route for About Nexintel */}
//             <Route path="/dashboard" element={<AuthChecker><MainLayout><DashboardPage /></MainLayout></AuthChecker>} />
//             <Route
//               path="/documents" // Changed route to /documents
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <DocumentUploadPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/documents/:folderName" // New route for FolderDetailPage
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <FolderDetailPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/evidence-matrix"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <EvidenceMatrixPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/timeline"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <TimelinePage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/ground-summary"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <GroundSummaryPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/analysis"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <AnalysisPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/analysis/:fileId/:sessionId"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <AnalysisPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/drafting"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <DraftingPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/chats"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <ChatHistoryPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/subscription-plans"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <SubscriptionPlanPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/billing-usage"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <BillingAndUsagePage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/settings"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <SettingsPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//             <Route
//               path="/get-help"
//               element={
//                 <AuthChecker>
//                   <MainLayout>
//                     <GetHelpPage />
//                   </MainLayout>
//                 </AuthChecker>
//               }
//             />
//           </Routes>
//         </FileManagerProvider>
//       </SidebarProvider>
//     </Router>
//   );
// }

// export default App;


import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import FolderDetailPage from './pages/FolderDetailPage';
import EvidenceMatrixPage from './pages/EvidenceMatrixPage';
import TimelinePage from './pages/TimelinePage';
import GroundSummaryPage from './pages/GroundSummaryPage';
// import AnalysisPage from './pages/AnalysisPage';
import AnalysisPage from './pages/AnalysisPage';

import DraftingPage from './pages/DraftingPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/auth/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import PublicLayout from './layouts/PublicLayout';
import ServicesPage from './pages/ServicesPage';
import AboutUsPage from './pages/AboutUsPage';
import PricingPage from './pages/PricingPage';
import AboutNexintelPage from './pages/AboutNexintelPage';
import SubscriptionPlanPage from './pages/SubscriptionPlanPage';
import BillingAndUsagePage from './pages/BillingAndUsagePage';
import SettingsPage from './pages/SettingsPage';
import GetHelpPage from './pages/GetHelpPage';
import { SidebarProvider } from './context/SidebarContext';
import { FileManagerProvider } from './context/FileManagerContext';
import AuthChecker from './components/AuthChecker';

function App() {
  return (
    <Router>
      <ToastContainer />
      <SidebarProvider>
        <FileManagerProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout hideHeaderAndFooter={true}><LandingPage /></PublicLayout>} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} />
            <Route path="/about-us" element={<PublicLayout><AboutUsPage /></PublicLayout>} />
            <Route path="/pricing" element={<PublicLayout><PricingPage /></PublicLayout>} />
            <Route path="/about-nexintel" element={<PublicLayout><AboutNexintelPage /></PublicLayout>} />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <AuthChecker>
                  <MainLayout>
                    <DashboardPage />
                  </MainLayout>
                </AuthChecker>
              } 
            />
            
            <Route
              path="/documents"
              element={
                <AuthChecker>
                  <MainLayout>
                    <DocumentUploadPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/documents/:folderName"
              element={
                <AuthChecker>
                  <MainLayout>
                    <FolderDetailPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/evidence-matrix"
              element={
                <AuthChecker>
                  <MainLayout>
                    <EvidenceMatrixPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/timeline"
              element={
                <AuthChecker>
                  <MainLayout>
                    <TimelinePage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/ground-summary"
              element={
                <AuthChecker>
                  <MainLayout>
                    <GroundSummaryPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            {/* Analysis Routes - Multiple routes for different navigation patterns */}
            <Route
              path="/analysis"
              element={
                <AuthChecker>
                  <MainLayout>
                    <AnalysisPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/analysis/:fileId/:sessionId"
              element={
                <AuthChecker>
                  <MainLayout>
                    <AnalysisPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/analysis/session/:sessionId"
              element={
                <AuthChecker>
                  <MainLayout>
                    <AnalysisPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/drafting"
              element={
                <AuthChecker>
                  <MainLayout>
                    <DraftingPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/chats"
              element={
                <AuthChecker>
                  <MainLayout>
                    <ChatHistoryPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/subscription-plans"
              element={
                <AuthChecker>
                  <MainLayout>
                    <SubscriptionPlanPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/billing-usage"
              element={
                <AuthChecker>
                  <MainLayout>
                    <BillingAndUsagePage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/settings"
              element={
                <AuthChecker>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
            
            <Route
              path="/get-help"
              element={
                <AuthChecker>
                  <MainLayout>
                    <GetHelpPage />
                  </MainLayout>
                </AuthChecker>
              }
            />
          </Routes>
        </FileManagerProvider>
      </SidebarProvider>
    </Router>
  );
}

export default App;