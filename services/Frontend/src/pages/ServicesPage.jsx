// import React from 'react';
// import { Link } from 'react-router-dom';
// import { Scale, FileText, BarChart3 } from 'lucide-react';

// const ServicesPage = () => {
//   return (
//     <div className="min-h-screen bg-white font-inter py-16 px-4 sm:px-6 lg:px-8">
//       <div className="container mx-auto">
//         <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 text-center mb-12">Our Core Services</h2>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
//           {/* Service Card 1 */}
//           <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
//             <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
//               <FileText className="w-8 h-8 text-gray-600" />
//             </div>
//             <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Document Upload</h4>
//             <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
//               Securely upload and organize all your legal documents. Our platform supports various formats,
//               ensuring your data is always accessible and protected.
//             </p>
//             <Link to="/document-upload" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
//               Learn More &rarr;
//             </Link>
//           </div>

//           {/* Service Card 2 */}
//           <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
//             <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
//               <BarChart3 className="w-8 h-8 text-gray-600" />
//             </div>
//             <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">AI Analysis</h4>
//             <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
//               Utilize advanced AI to summarize complex legal texts, identify key entities, and extract critical
//               information, saving you countless hours.
//             </p>
//             <Link to="/ai-analysis" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
//               Learn More &rarr;
//             </Link>
//           </div>

//           {/* Service Card 3 */}
//           <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
//             <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
//               <Scale className="w-8 h-8 text-gray-600" />
//             </div>
//             <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Document Drafting</h4>
//             <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
//               Generate precise legal documents, contracts, and briefs with AI-powered drafting tools and customizable
//               templates, ensuring accuracy and compliance.
//             </p>
//             <Link to="/document-drafting" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
//               Learn More &rarr;
//             </Link>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ServicesPage;

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, BarChart3 } from 'lucide-react';

const ServicesPage = () => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="h-full bg-white font-inter flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12">Our Core Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Service Card 1 */}
          <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Document Upload</h4>
            <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
              Securely upload and organize all your legal documents. Our platform supports various formats,
              ensuring your data is always accessible and protected.
            </p>
            <Link to="/document-upload" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
              Learn More &rarr;
            </Link>
          </div>

          {/* Service Card 2 */}
          <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
              <BarChart3 className="w-8 h-8 text-gray-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">AI Analysis</h4>
            <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
              Utilize advanced AI to summarize complex legal texts, identify key entities, and extract critical
              information, saving you countless hours.
            </p>
            <Link to="/ai-analysis" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
              Learn More &rarr;
            </Link>
          </div>

          {/* Service Card 3 */}
          <div className="bg-gray-50 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
              <Scale className="w-8 h-8 text-gray-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Document Drafting</h4>
            <p className="text-gray-600 text-center font-medium leading-relaxed mb-5">
              Generate precise legal documents, contracts, and briefs with AI-powered drafting tools and customizable
              templates, ensuring accuracy and compliance.
            </p>
            <Link to="/document-drafting" className="text-gray-700 hover:text-gray-900 font-medium block text-center" target="_blank" rel="noopener noreferrer">
              Learn More &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;