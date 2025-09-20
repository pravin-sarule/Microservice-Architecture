// import React from 'react';

// const AboutUsPage = () => {
//   return (
//     <div className="min-h-screen bg-white font-inter py-16 px-4 sm:px-6 lg:px-8">
//       <div className="container mx-auto">
//         <div className="text-center mb-12">
//           <h3 className="text-3xl sm:text-4xl font-semibold text-gray-800 mb-4">About Nexintel AI</h3>
//           <p className="text-gray-600 font-medium max-w-2xl mx-auto">
//             Built for modern legal professionals who demand efficiency, security, and comprehensive functionality.
//           </p>
//         </div>
        
//         <div className="max-w-4xl mx-auto text-lg text-gray-700 leading-relaxed">
//           <p className="mb-6">
//             Nexintel AI is at the forefront of legal technology, dedicated to transforming how legal professionals
//             interact with documents. Our mission is to empower lawyers, paralegals, and legal researchers with
//             intelligent tools that streamline workflows, enhance accuracy, and provide deeper insights into legal data.
//           </p>
//           <p className="mb-6">
//             Founded by a team of legal experts and AI innovators, we understand the unique challenges of the legal
//             industry. We are committed to delivering secure, reliable, and user-friendly solutions that meet the
//             highest standards of professional practice.
//           </p>
//           <p>
//             Join us in shaping the future of legal practice with AI-powered efficiency and intelligence.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AboutUsPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
// import missionImage from '../assets/2 pic.jpg';
// import visionImage from '../assets/4.jpg';

// A simple checkmark icon component
const CheckIcon = () => (
  <svg className="w-6 h-6 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

const AboutUsPage = () => {
  const navigate = useNavigate();

  const handleExploreClick = () => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="bg-white font-inter">
      <div className="container mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-800 mb-4">About Nexintel AI</h1>
          <p className="text-slate-600 font-medium max-w-3xl mx-auto">
            Built for modern legal professionals who demand efficiency, security, and comprehensive functionality. We are at the forefront of legal technology, dedicated to transforming how legal professionals interact with documents.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Mission Section */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl font-semibold text-gray-800 mb-4">Our Mission</h2>
              <p className="text-slate-600 mb-6">
                At Nexintel AI, our mission is to empower legal professionals with intelligent tools that simplify and accelerate legal work. We aim to remove repetitive manual tasks through AI-driven solutions.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Securely upload and manage documents with ease.</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Analyze legal content with unparalleled precision.</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Draft professional documents in a fraction of the time.</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <img src={missionImage} alt="Our Mission" className="rounded-xl shadow-lg w-full aspect-video object-cover cursor-pointer transition-shadow duration-300 hover:shadow-2xl" />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-16"></div>

          {/* Vision Section */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img src={visionImage} alt="Our Vision" className="rounded-xl shadow-lg w-full aspect-video object-cover cursor-pointer transition-shadow duration-300 hover:shadow-2xl" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-gray-800 mb-4">Our Vision</h2>
              <p className="text-slate-600 mb-6">
                Our vision is to build the world’s most trusted Legal AI partner—a platform where legal professionals can seamlessly manage documents, gain insights through advanced AI analysis, and create accurate legal drafts in minutes.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Enhance legal expertise, not replace it.</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Make legal services faster and smarter.</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  <span className="ml-3 text-slate-600">Increase accessibility to justice for everyone.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CTA Row */}
          <div className="text-center mt-20">
            <h3 className="text-3xl font-semibold text-gray-800 mb-4">Join Us in Shaping the Future</h3>
            <p className="text-slate-600 max-w-2xl mx-auto mb-8">
              Discover how Nexintel AI can transform your legal practice. Explore our features or contact us for a demo.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleExploreClick}
                className="bg-teal-500 text-white font-semibold py-3 px-8 rounded-lg hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-md"
              >
                Explore Features
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;