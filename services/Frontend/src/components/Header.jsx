// import React from 'react';
// import { Bars3Icon } from '@heroicons/react/24/outline';

// const Header = () => {
//   return (
//     <div className="p-4 border-b border-gray-200 flex items-center justify-end bg-white">
//       <div className="flex items-center space-x-4">
//         <div className="text-right">
//           <div className="text-sm font-semibold text-slate-700">Advocate John Doe</div>
//           <div className="text-xs text-slate-500">Mumbai High Court</div>
//         </div>
//         <div className="relative">
//           <img
//             className="h-10 w-10 rounded-full"
//             src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
//             alt=""
//           />
//           <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />
//         </div>
//         <button className="md:hidden bg-gray-100 p-2 rounded-lg">
//           <Bars3Icon className="h-6 w-6 text-gray-600" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Header;


// import React, { useEffect, useState } from 'react';
// import { Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';

// const Header = () => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchUserFromStorage = () => {
//       try {
//         // Debug: Check what's in localStorage
//         console.log('=== DEBUGGING LOCALSTORAGE ===');
//         console.log('All localStorage keys:', Object.keys(localStorage));
        
//         // Check different possible keys
//         const userKey = localStorage.getItem('user');
//         const userDataKey = localStorage.getItem('userData');
//         const authUserKey = localStorage.getItem('authUser');
//         const loginUserKey = localStorage.getItem('loginUser');
        
//         console.log('localStorage "user":', userKey);
//         console.log('localStorage "userData":', userDataKey);
//         console.log('localStorage "authUser":', authUserKey);
//         console.log('localStorage "loginUser":', loginUserKey);
        
//         // Try to find the user data
//         let storedUser = userKey || userDataKey || authUserKey || loginUserKey;
        
//         if (storedUser) {
//           console.log('Found stored user:', storedUser);
//           const parsedUser = JSON.parse(storedUser);
//           console.log('Parsed user object:', parsedUser);
//           console.log('User first_name:', parsedUser.first_name);
//           console.log('User last_name:', parsedUser.last_name);
//           console.log('User email:', parsedUser.email);
          
//           setUser(parsedUser);
//         } else {
//           console.log('No user found in localStorage');
//           setUser(null);
//         }
//       } catch (error) {
//         console.error("Failed to parse user from localStorage:", error);
//         setUser(null);
//       } finally {
//         setLoading(false);
//       }
//     };

//     // Initial load
//     fetchUserFromStorage();

//     // Listen for custom events
//     const handleUserUpdate = () => {
//       console.log('User update event received');
//       fetchUserFromStorage();
//     };

//     window.addEventListener('userUpdated', handleUserUpdate);

//     // Also listen for storage events
//     const handleStorageChange = (e) => {
//       console.log('Storage change detected:', e.key, e.newValue);
//       if (e.key === 'user' || e.key === 'userData' || e.key === 'authUser') {
//         fetchUserFromStorage();
//       }
//     };

//     window.addEventListener('storage', handleStorageChange);
//     // Cleanup
//     return () => {
//       window.removeEventListener('userUpdated', handleUserUpdate);
//       window.removeEventListener('storage', handleStorageChange);
//     };
//   }, []);

//   // Debug: Show current state
//   console.log('Current user state:', user);
//   console.log('Loading state:', loading);

//   if (loading) {
//     return (
//       <div className="p-4 border-b border-gray-200 flex items-center justify-end bg-white">
//         <div className="flex items-center space-x-4">
//           <div className="text-right">
//             <div className="text-sm text-slate-400">Loading...</div>
//           </div>
//           <UserCircleIcon className="h-10 w-10 text-slate-300" />
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-4 border-b border-gray-200 flex items-center justify-end bg-white">
//       <div className="flex items-center space-x-4">
//         {user ? (
//           <div className="text-right">
//             <div className="text-sm font-semibold text-slate-700">
//               Advocate {user.first_name} {user.last_name}
//             </div>
//             <div className="text-xs text-slate-500">Mumbai High Court</div>
//           </div>
//         ) : (
//           <div className="text-right">
//             <div className="text-sm text-slate-400">Not logged in</div>
//             <div className="text-xs text-slate-300">Check console for debug info</div>
//           </div>
//         )}
        
//         <div className="relative">
//           <UserCircleIcon className="h-10 w-10 text-slate-500" />
//           {user && (
//             <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />
//           )}
//         </div>
        
//         <button className="md:hidden bg-gray-100 p-2 rounded-lg">
//           <Bars3Icon className="h-6 w-6 text-gray-600" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Header;

// import React, { useEffect, useState } from 'react';
// import { Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';

// const Header = () => {
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     const fetchUser = () => {
//       try {
//         const stored = localStorage.getItem('user');
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           setUser(parsed);
//         } else {
//           setUser(null);
//         }
//       } catch (err) {
//         console.error('Error parsing user:', err);
//         setUser(null);
//       }
//     };

//     fetchUser();

//     // Optional: listen to custom or storage updates
//     const handleUpdate = () => fetchUser();
//     window.addEventListener('userUpdated', handleUpdate);
//     window.addEventListener('storage', handleUpdate);

//     return () => {
//       window.removeEventListener('userUpdated', handleUpdate);
//       window.removeEventListener('storage', handleUpdate);
//     };
//   }, []);

//   return (
//     <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
//       <div className="text-xl font-bold text-blue-600">NexIntel Legal AI</div>

//       <div className="flex items-center space-x-4">
//         {user ? (
//           <div className="text-right">
//             <div className="text-sm font-semibold text-slate-700">
//               Advocate {user.first_name} {user.last_name}
//             </div>
//             <div className="text-xs text-slate-500">{user.email}</div>
//           </div>
//         ) : (
//           <div className="text-right">
//             <div className="text-sm text-slate-400">Not logged in</div>
//           </div>
//         )}

//         <div className="relative">
//           <UserCircleIcon className="h-10 w-10 text-slate-500" />
//           {user && (
//             <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />
//           )}
//         </div>

//         <button className="md:hidden bg-gray-100 p-2 rounded-lg">
//           <Bars3Icon className="h-6 w-6 text-gray-600" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Header;
import React, { useEffect, useState, useRef } from 'react';
import { Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api'; // Import the apiService

const Header = () => {
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error parsing user from localStorage:', err);
        setUser(null);
      }
    };

    loadUser();

    window.addEventListener('userUpdated', loadUser);
    return () => window.removeEventListener('userUpdated', loadUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await apiService.logout();
      navigate('/login'); // Redirect to login page after successful logout
    } catch (error) {
      console.error('Logout failed:', error);
      // Display user-friendly error message
      alert(`Logout failed: ${error.message || 'Please try again.'}`);
      // Even if API call fails, if it's due to invalid token, we should still clear local storage and redirect
      if (error.message.includes('Session expired') || error.message.includes('401') || error.message.includes('403')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('userUpdated'));
        navigate('/login');
      }
    } finally {
      setIsDropdownOpen(false); // Close dropdown regardless of success or failure
    }
  };

  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-end bg-white">
      <div className="flex items-center space-x-4">
        {user ? (
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-700">
              {user.first_name || ''} {user.last_name || ''}
            </div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-sm text-slate-400">Not logged in</div>
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="focus:outline-none"
          >
            <UserCircleIcon className="h-10 w-10 text-slate-500" />
            {user && (
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <button className="md:hidden bg-gray-100 p-2 rounded-lg">
          <Bars3Icon className="h-6 w-6 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default Header;
