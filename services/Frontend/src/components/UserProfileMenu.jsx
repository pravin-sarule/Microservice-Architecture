// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// const UserProfileMenu = () => {
//   const navigate = useNavigate();
//   const [userPlan, setUserPlan] = useState('Free plan'); // Default plan
//   const [userEmail, setUserEmail] = useState('');
//   const [userInitials, setUserInitials] = useState('U'); // Default to 'U' for unknown

//   useEffect(() => {
//     const updateUserInfo = () => {
//       const userInfo = JSON.parse(localStorage.getItem('userInfo'));
//       if (userInfo) {
//         // Set user plan
//         setUserPlan(userInfo.plan || 'Free plan');

//         // Set user email
//         setUserEmail(userInfo.email || userInfo.username || ''); // Use email, then username as fallback

//         // Generate and set user initials
//         let initials = 'U'; // Default to 'U'
//         if (userInfo.name) {
//           const nameParts = userInfo.name.split(' ').filter(Boolean); // Filter out empty strings
//           if (nameParts.length > 0) {
//             initials = nameParts[0].charAt(0).toUpperCase();
//             if (nameParts.length > 1) {
//               initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
//             }
//           }
//         } else if (userInfo.username) { // Prioritize username if name is not available
//           const usernamePart = userInfo.username.split('@')[0]; // Get 'pravin' from 'pravin@gmail.com'
//           const usernameParts = usernamePart.split(' ').filter(Boolean);
//           if (usernameParts.length > 0) {
//             initials = usernameParts[0].charAt(0).toUpperCase();
//             if (usernameParts.length > 1) {
//               initials += usernameParts[usernameParts.length - 1].charAt(0).toUpperCase();
//             }
//           }
//         } else if (userInfo.email) { // Fallback to email if neither name nor username provides initials
//           initials = userInfo.email.charAt(0).toUpperCase();
//         }
//         setUserInitials(initials || 'U'); // Fallback to 'U' if no initials can be derived
//       } else {
//         setUserPlan('Free plan');
//         setUserEmail('');
//         setUserInitials('U');
//       }
//     };

//     updateUserInfo(); // Fetch info on component mount

//     // Listen for custom event to update info dynamically
//     window.addEventListener('userInfoUpdated', updateUserInfo);

//     return () => {
//       window.removeEventListener('userInfoUpdated', updateUserInfo);
//     };
//   }, []);

//   const handleLogout = () => {
//     localStorage.removeItem('token'); // Remove the token from local storage
//     localStorage.removeItem('userInfo'); // Clear user info as well
//     navigate('/login'); // Redirect to the login page
//   };

//   return (
//     <div className="p-4 border-b border-border-color">
//       <div className="flex items-center space-x-3">
//         <div className="flex-shrink-0">
//           <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-accent-color">
//             <span className="font-medium leading-none text-bg-secondary">{userInitials}</span>
//           </span>
//         </div>
//         <div className="flex-1">
//           <div className="text-sm font-medium text-text-primary">{userEmail}</div>
//           <div className="text-sm text-text-secondary">Personal</div>
//           <div className="text-xs text-text-secondary">{userPlan}</div>
//         </div>
//         <div className="flex-shrink-0">
//           <svg className="h-5 w-5 text-accent-color" fill="currentColor" viewBox="0 0 20 20">
//             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//           </svg>
//         </div>
//       </div>
//       <nav className="mt-4">
//         <ul className="space-y-2">
//           <li>
//             <button onClick={() => navigate('/settings')} className="flex items-center w-full px-3 py-2 text-sm font-medium text-text-primary rounded-md hover:bg-bg-primary">
//               <svg className="h-4 w-4 mr-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//               </svg>
//               Settings
//             </button>
//           </li>
//           <li>
//             <a href="#" className="flex items-center justify-between px-3 py-2 text-sm font-medium text-text-primary rounded-md hover:bg-bg-primary">
//               <div className="flex items-center">
//                 <svg className="h-4 w-4 mr-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
//                 </svg>
//                 Language
//               </div>
//               <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
//               </svg>
//             </a>
//           </li>
//           <li>
//             <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-text-primary rounded-md hover:bg-bg-primary">
//               <svg className="h-4 w-4 mr-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//               </svg>
//               Get help
//             </a>
//           </li>
//           <li>
//             <button onClick={() => navigate('/subscription-plans')} className="flex items-center w-full px-3 py-2 text-sm font-medium text-accent-color bg-bg-primary rounded-lg hover:bg-bg-secondary">
//               Upgrade plan
//             </button>
//           </li>
//           <li>
//             <a href="#" className="flex items-center justify-between px-3 py-2 text-sm font-medium text-text-primary rounded-md hover:bg-bg-primary">
//               <div className="flex items-center">
//                 <svg className="h-4 w-4 mr-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
//                 </svg>
//                 Learn more
//               </div>
//               <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
//               </svg>
//             </a>
//           </li>
//           <li>
//             <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">
//               <svg className="h-4 w-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
//               </svg>
//               Log out
//             </button>
//           </li>
//         </ul>
//       </nav>
//     </div>
//   );
// };

// export default UserProfileMenu;

// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';

// const UserProfileMenu = () => {
//   const navigate = useNavigate();
//   const [userPlan, setUserPlan] = useState('Free plan');
//   const [userEmail, setUserEmail] = useState('');
//   const [userName, setUserName] = useState('');
//   const [userInitials, setUserInitials] = useState('U');

//   useEffect(() => {
//     const updateUserInfo = () => {
//       // Debug: Log all localStorage keys
//       console.log('All localStorage keys:', Object.keys(localStorage));
      
//       // Try to get user info from localStorage
//       let userInfo = null;
//       try {
//         // Try different possible keys
//         const possibleKeys = ['userInfo', 'user', 'userData', 'currentUser', 'authUser'];
//         let storedUserInfo = null;
//         let foundKey = null;
        
//         for (const key of possibleKeys) {
//           const data = localStorage.getItem(key);
//           if (data) {
//             console.log(`Found raw data in localStorage[${key}]:`, data); // Added raw data log
//             storedUserInfo = data;
//             foundKey = key;
//             break;
//           }
//         }
        
//         if (storedUserInfo) {
//           userInfo = JSON.parse(storedUserInfo);
//           console.log('Parsed userInfo (from localStorage):', userInfo); // More specific log
//         } else {
//           console.log('No user data found in localStorage under common keys.');
//         }
//       } catch (error) {
//         console.error('Error parsing userInfo from localStorage:', error);
//       }

//       if (userInfo) {
//         // Debug: Log all relevant user info fields
//         console.log('User info fields from parsed object:');
//         console.log('  userInfo.name:', userInfo.name);
//         console.log('  userInfo.username:', userInfo.username);
//         console.log('  userInfo.email:', userInfo.email);
//         console.log('  userInfo.role:', userInfo.role);
//         console.log('  userInfo.plan:', userInfo.plan);
        
//         // Set user plan - prioritize userInfo.plan, then map from role, default to Free plan
//         let currentPlan = 'Free plan';
//         if (userInfo.plan) {
//           currentPlan = userInfo.plan;
//           console.log('Plan set from userInfo.plan:', currentPlan);
//         } else if (userInfo.role) {
//           const planMap = {
//             'admin': 'Admin Plan',
//             'premium': 'Premium Plan',
//             'pro': 'Pro Plan',
//             'user': 'Free Plan'
//           };
//           currentPlan = planMap[userInfo.role] || 'Free plan';
//           console.log('Plan set from userInfo.role mapping:', currentPlan);
//         }
//         setUserPlan(currentPlan);
//         console.log('Final userPlan set to:', currentPlan);

//         // Set user email - prioritize email field, fallback to username
//         const email = userInfo.email || userInfo.username || '';
//         setUserEmail(email);
//         console.log('Final userEmail set to:', email);

//         // Set user name - extract from username (before @) since no name field exists
//         let displayName = '';
//         if (userInfo.name) { // Prioritize a 'name' field if it exists
//           displayName = userInfo.name;
//           console.log('Name derived from userInfo.name:', displayName);
//         } else if (userInfo.username) {
//           // Extract name from username (everything before @)
//           const usernamePart = userInfo.username.split('@')[0];
//           // Capitalize first letter and replace dots/underscores with spaces
//           displayName = usernamePart.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//           console.log('Name derived from userInfo.username:', displayName);
//         } else if (userInfo.email) { // Fallback to email if no name or username
//           displayName = userInfo.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//           console.log('Name derived from userInfo.email:', displayName);
//         }
//         setUserName(displayName || 'User'); // Ensure a default display name
//         console.log('Final userName set to:', displayName || 'User');

//         // Generate user initials
//         let initials = 'U';
//         if (userInfo.name) {
//           const nameParts = userInfo.name.split(' ').filter(Boolean);
//           if (nameParts.length > 0) {
//             initials = nameParts[0].charAt(0).toUpperCase();
//             if (nameParts.length > 1) {
//               initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
//             }
//           }
//           console.log('Initials derived from userInfo.name:', initials);
//         } else if (userInfo.username) {
//           const usernamePart = userInfo.username.split('@')[0];
//           if (usernamePart.includes('.')) {
//             const parts = usernamePart.split('.');
//             initials = parts[0].charAt(0).toUpperCase() +
//                       parts[parts.length - 1].charAt(0).toUpperCase();
//           } else if (usernamePart.includes('_')) {
//             const parts = usernamePart.split('_');
//             initials = parts[0].charAt(0).toUpperCase() +
//                       parts[parts.length - 1].charAt(0).toUpperCase();
//           } else {
//             initials = usernamePart.charAt(0).toUpperCase();
//           }
//           console.log('Initials derived from userInfo.username:', initials);
//         } else if (userInfo.email) {
//           initials = userInfo.email.charAt(0).toUpperCase();
//           console.log('Initials derived from userInfo.email:', initials);
//         }
//         setUserInitials(initials || 'U'); // Fallback to 'U' if no initials can be derived
//         console.log('Final userInitials set to:', initials || 'U');
//       } else {
//         // Fallback values if no user info available
//         console.log('No user info found, using defaults');
//         setUserPlan('Free plan');
//         setUserEmail('');
//         setUserName('');
//         setUserInitials('U');
//         console.log('User info not found, states reset to defaults.'); // Added log
//       }
//     };

//     updateUserInfo();
    
//     // Listen for storage changes (when localStorage is updated from other tabs)
//     const handleStorageChange = (e) => {
//       if (e.key === 'userInfo') {
//         updateUserInfo();
//       }
//     };
//     window.addEventListener('storage', handleStorageChange);
    
//     // Listen for custom event to update info dynamically
//     window.addEventListener('userInfoUpdated', updateUserInfo);
    
//     return () => {
//       window.removeEventListener('storage', handleStorageChange);
//       window.removeEventListener('userInfoUpdated', updateUserInfo);
//     };
//   }, []);

//   const handleLogout = () => {
//     try {
//       // Clear all user-related data from localStorage
//       localStorage.removeItem('token');
//       localStorage.removeItem('userInfo');
      
//       // Also clear any other auth-related items (adjust these based on your app)
//       localStorage.removeItem('authToken');
//       localStorage.removeItem('accessToken');
//       localStorage.removeItem('refreshToken');
//       localStorage.removeItem('user');
      
//       // Reset component state to default values
//       setUserPlan('Free plan');
//       setUserEmail('');
//       setUserName('');
//       setUserInitials('U');
      
//       console.log('User logged out successfully - localStorage cleared');
      
//       // Redirect to login page
//       navigate('/login');
      
//     } catch (error) {
//       console.error('Error during logout:', error);
//       // Still try to redirect even if there was an error
//       navigate('/login');
//     }
//   };

  

//   return (
//     <div className="p-4 border-b border-gray-200 bg-white relative z-[9999]">
//       {/* User Profile Section */}
//       <div className="flex items-center space-x-3 mb-4">
//         <div className="flex-shrink-0">
//           <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-purple-500 text-white font-semibold text-sm shadow-sm">
//             {userInitials}
//           </div>
//         </div>
//         <div className="flex-1 min-w-0">
//           {userName && (
//             <div className="text-sm font-semibold text-gray-900 truncate">
//               {userName}
//             </div>
//           )}
//           {userEmail && (
//             <div className="text-sm text-gray-600 truncate">
//               {userEmail}
//             </div>
//           )}
//           <div className="flex items-center space-x-2 mt-1">
//             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
//               {userPlan}
//             </span>
//             <span className="text-xs text-gray-500">Personal</span>
//           </div>
//         </div>
//         <div className="flex-shrink-0">
//           <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
//             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//           </svg>
//         </div>
//       </div>

//       {/* Navigation Menu */}
//       <nav>
//         <ul className="space-y-1">
//           <li>
//             <button
//               onClick={() => navigate('/settings')}
//               className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
//             >
//               <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//               </svg>
//               Settings
//             </button>
//           </li>
//           <li>
//             <a href="#" className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
//               <div className="flex items-center">
//                 <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
//                 </svg>
//                 Language
//               </div>
//               <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
//               </svg>
//             </a>
//           </li>
//           <li>
//             <button
//               onClick={() => navigate('/get-help')}
//               className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
//             >
//               <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//               </svg>
//               Get help
//             </button>
//           </li>
//           <li>
//             <button
//               onClick={() => {
//                 console.log('Attempting to navigate to /subscription-plans from UserProfileMenu');
//                 navigate('/subscription-plans');
//               }}
//               className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
//               style={{ zIndex: '9999 !important', pointerEvents: 'auto !important' }}
//             >
//               Upgrade plan
//             </button>
//           </li>
//           <li>
//             <a href="#" className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
//               <div className="flex items-center">
//                 <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
//                 </svg>
//                 Learn more
//               </div>
//               <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
//               </svg>
//             </a>
//           </li>
//           <li>
//             <button
//               onClick={handleLogout}
//               className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
//             >
//               <svg className="h-4 w-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
//               </svg>
//               Log out
//             </button>
//           </li>
//         </ul>
//       </nav>
//     </div>
//   );
// };

// export default UserProfileMenu;
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const UserProfileMenu = () => {
  const navigate = useNavigate();
  const [userPlan, setUserPlan] = useState('Free plan');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('U');
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to safely access localStorage
  const getFromStorage = useCallback((key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
    }
    return null;
  }, []);

  // Helper function to safely set localStorage
  const setToStorage = useCallback((key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error setting ${key} to localStorage:`, error);
    }
  }, []);

  // Helper function to safely remove from localStorage
  const removeFromStorage = useCallback((key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  }, []);

  // Generate initials from name
  const generateInitials = useCallback((name, email) => {
    if (name && name.trim()) {
      const nameParts = name.trim().split(' ').filter(Boolean);
      if (nameParts.length >= 2) {
        return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
      } else if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
      }
    }
    
    if (email) {
      const emailPart = email.split('@')[0];
      if (emailPart.includes('.')) {
        const parts = emailPart.split('.');
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      } else if (emailPart.includes('_')) {
        const parts = emailPart.split('_');
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      }
      return emailPart.charAt(0).toUpperCase();
    }
    
    return 'U';
  }, []);

  // Extract display name from email
  const getDisplayNameFromEmail = useCallback((email) => {
    if (!email) return '';
    const emailPart = email.split('@')[0];
    return emailPart
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }, []);

  // Main function to update user info
  const updateUserInfo = useCallback(() => {
    setIsLoading(true);
    
    // Your specific localStorage structure:
    // user: {"id":12,"username":"pravin sarule","email":"admin12@gmail.com","role":"user","is_blocked":false}
    // userInfo: {"plan":"Pro Plan v2","lastPayment":{"id":"pay_R9r6N7wBm4NlBQ",...}}
    
    let userInfo = null;
    let planInfo = null;

    // Get user data from 'user' key
    userInfo = getFromStorage('user');
    if (userInfo) {
      console.log('✅ Found user data in localStorage["user"]:', userInfo);
    } else {
      // Fallback to other possible user keys
      const userKeys = ['userData', 'currentUser', 'authUser', 'auth', 'profile'];
      for (const key of userKeys) {
        const data = getFromStorage(key);
        if (data && data.id && data.email) {
          userInfo = data;
          console.log(`✅ Found user data in localStorage["${key}"]`, userInfo);
          break;
        }
      }
    }

    // Get plan data from 'userInfo' key (yes, confusing naming but that's your structure)
    planInfo = getFromStorage('userInfo');
    if (planInfo && planInfo.plan) {
      console.log('✅ Found plan data in localStorage["userInfo"]:', planInfo);
    } else {
      // Fallback to other possible plan keys
      const planKeys = ['plan', 'subscription', 'userPlan', 'planInfo', 'userSubscription'];
      for (const key of planKeys) {
        const data = getFromStorage(key);
        if (data) {
          if (typeof data === 'object' && data.plan) {
            planInfo = data;
            console.log(`✅ Found plan data in localStorage["${key}"]`, planInfo);
            break;
          } else if (typeof data === 'string') {
            planInfo = { plan: data };
            console.log(`✅ Found plan as string in localStorage["${key}"]`, data);
            break;
          }
        }
      }
    }

    if (userInfo) {
      // Extract user information based on your exact structure
      const email = userInfo.email || '';
      const name = userInfo.username || getDisplayNameFromEmail(email);
      
      // Determine user plan - prioritize planInfo from 'userInfo' localStorage key
      let plan = 'Free plan';
      
      if (planInfo && planInfo.plan) {
        // Use the plan from 'userInfo' localStorage key
        plan = planInfo.plan;
        console.log('✅ Plan set from localStorage["userInfo"]:', plan);
        console.log('📊 Plan details:', {
          plan: planInfo.plan,
          lastPayment: planInfo.lastPayment
        });
      } else if (userInfo.plan) {
        // Plan stored directly in user object (backup)
        plan = userInfo.plan;
        console.log('✅ Plan set from user.plan:', plan);
      } else if (userInfo.role) {
        // Map role to plan as fallback
        const planMap = {
          'admin': 'Admin Plan',
          'premium': 'Premium Plan', 
          'pro': 'Pro Plan',
          'plus': 'Plus Plan',
          'free': 'Free Plan',
          'user': 'Free Plan'
        };
        plan = planMap[userInfo.role.toLowerCase()] || 'Free Plan';
        console.log('⚠️ Plan set from user role mapping (fallback):', plan);
      } else {
        console.log('❌ No plan data found, using default:', plan);
      }

      // Generate initials from username
      const initials = generateInitials(name, email);

      // Update state
      setUserEmail(email);
      setUserName(name || 'User');
      setUserPlan(plan);
      setUserInitials(initials);

      console.log('🎉 Final user info update:', {
        id: userInfo.id,
        email,
        username: userInfo.username,
        name: name || 'User',
        role: userInfo.role,
        is_blocked: userInfo.is_blocked,
        plan,
        initials,
        lastPayment: planInfo?.lastPayment
      });
    } else {
      // No user data found - reset to defaults
      console.log('❌ No user data found in localStorage');
      setUserEmail('');
      setUserName('');
      setUserPlan('Free plan');
      setUserInitials('U');
    }
    
    setIsLoading(false);
  }, [getFromStorage, generateInitials, getDisplayNameFromEmail]);

  // Effect to initialize and listen for changes
  useEffect(() => {
    // Initial load
    updateUserInfo();

    // Listen for storage changes (cross-tab updates)
    const handleStorageChange = (e) => {
      const userDataKeys = ['user', 'userInfo', 'userData', 'currentUser', 'authUser', 'auth', 'profile', 'plan', 'subscription', 'userPlan', 'planInfo'];
      if (userDataKeys.includes(e.key)) {
        console.log(`Storage change detected for key: ${e.key}`);
        updateUserInfo();
      }
    };

    // Listen for custom events
    const handleCustomUpdate = () => {
      console.log('Custom user info update event received');
      updateUserInfo();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userInfoUpdated', handleCustomUpdate);
    window.addEventListener('userDataChanged', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userInfoUpdated', handleCustomUpdate);
      window.removeEventListener('userDataChanged', handleCustomUpdate);
    };
  }, [updateUserInfo]);

  // Handle logout
  const handleLogout = useCallback(() => {
    try {
      // Keys that might contain user/auth data based on your structure
      const keysToRemove = [
        'token',
        'accessToken',
        'refreshToken',
        'authToken',
        'jwt',
        'user',
        'userInfo',
        'userData',
        'currentUser',
        'authUser',
        'auth',
        'profile',
        'session',
        'plan',
        'subscription',
        'userPlan',
        'planInfo'
      ];

      // Remove all auth-related data
      keysToRemove.forEach(key => {
        removeFromStorage(key);
      });

      // Reset component state
      setUserPlan('Free plan');
      setUserEmail('');
      setUserName('');
      setUserInitials('U');
      setIsLoading(false);

      console.log('User logged out successfully - localStorage cleared');

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('userLoggedOut'));

      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      navigate('/login');
    }
  }, [navigate, removeFromStorage]);

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="p-4 border-b border-gray-200 bg-white relative z-[9999]">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-gray-200 animate-pulse">
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200 bg-white relative z-[9999]">
      {/* User Profile Section */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="flex-shrink-0">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-purple-500 text-white font-semibold text-sm shadow-sm">
            {userInitials}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {userName && (
            <div className="text-sm font-semibold text-gray-900 truncate">
              {userName}
            </div>
          )}
          {userEmail && (
            <div className="text-sm text-gray-600 truncate">
              {userEmail}
            </div>
          )}
          <div className="flex items-center space-x-2 mt-1">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {userPlan}
            </span>
            <span className="text-xs text-gray-500">Personal</span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </li>
          <li>
            <a href="#" className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Language
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </a>
          </li>
          <li>
            <button
              onClick={() => navigate('/get-help')}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get help
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                console.log('Attempting to navigate to /subscription-plans from UserProfileMenu');
                navigate('/subscription-plans');
              }}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              Upgrade plan
            </button>
          </li>
          <li>
            <a href="#" className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Learn more
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </a>
          </li>
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <svg className="h-4 w-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default UserProfileMenu;