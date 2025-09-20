// import React, { useState, useEffect, useCallback } from 'react';
// import { CheckIcon } from '@heroicons/react/20/solid';
// import { ArrowLeftIcon } from '@heroicons/react/24/outline';
// import { useNavigate } from 'react-router-dom';
// import apiService from '../services/api'; // Import the apiService
// import { useAuth } from '../context/AuthContext'; // Assuming you have an AuthContext

// // Razorpay Configuration (Replace with your actual values)
// const RAZORPAY_KEY_ID = import.meta.env.VITE_APP_RAZORPAY_KEY_ID || 'rzp_test_R6mBF5iIMakFt1';
// console.log('RAZORPAY_KEY_ID:', RAZORPAY_KEY_ID); // Added log
// const BACKEND_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3000/api';
// console.log('BACKEND_BASE_URL:', BACKEND_BASE_URL); // Added log

// const SubscriptionPlanPage = () => {
//   console.log('SubscriptionPlanPage component rendered.');
//   const navigate = useNavigate();
//   const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' or 'yearly'
//   const [planType, setPlanType] = useState('individual'); // 'individual' or 'team'
//   const [plans, setPlans] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [showPaymentForm, setShowPaymentForm] = useState(false); // State to control payment form visibility (will be removed later)
//   const [selectedPlan, setSelectedPlan] = useState(null); // State to store the selected plan
//   const { user, token } = useAuth(); // Get user and token from AuthContext

//   const fetchPlans = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       // Fetch plans without specific type and interval filters, as the backend seems to prefer this.
//       // The backend should return all available plans, and frontend can filter/display as needed.
//       console.log('Calling apiService.getPublicPlans...');
//       const response = await apiService.getPublicPlans();
//       console.log('apiService.getPublicPlans raw response:', response); // Added log for raw response
//       if (response && Array.isArray(response.data)) {
//         // Filter plans based on selected planType and billingCycle
//         const filteredPlans = response.data.filter(plan => {
//           const matchesType = (planType === 'team' && plan.type === 'business') || (planType === 'individual' && plan.type === 'individual');
//           const matchesInterval = (billingCycle === 'monthly' && (plan.interval === 'month' || plan.interval === 'monthly')) ||
//                                   (billingCycle === 'yearly' && (plan.interval === 'year' || plan.interval === 'yearly')) ||
//                                   (billingCycle === 'quarterly' && plan.interval === 'quarterly');
//           console.log(`Plan: ${plan.name}, Type: ${plan.type}, Interval: ${plan.interval}, MatchesType: ${matchesType}, MatchesInterval: ${matchesInterval}`);
//           return matchesType && matchesInterval;
//         });
//         console.log('Filtered plans:', filteredPlans);
//         setPlans(filteredPlans);
//       } else {
//         console.error('API response is not an array or missing data property:', response);
//         setError('Invalid data received from server.');
//       }
//     } catch (err) {
//       console.error('Error in fetchPlans:', err);
//       setError(err.message || 'Failed to fetch plans. Please try again later.');
//     } finally {
//       setLoading(false);
//       console.log('fetchPlans finished. Loading:', false);
//     }
//   }, [planType, billingCycle]);

//   useEffect(() => {
//     fetchPlans();
//   }, [fetchPlans]);

//   const handleGoBack = () => {
//     navigate(-1); // Go back to the previous page
//   };

//   const handlePaymentSuccess = (planName) => {
//     // Update user's plan in local storage (assuming planName is sufficient)
//     const userInfo = JSON.parse(localStorage.getItem('userInfo'));
//     if (userInfo) {
//       userInfo.plan = planName; // Or update with more detailed plan info if available
//       localStorage.setItem('userInfo', JSON.stringify(userInfo));
//       window.dispatchEvent(new CustomEvent('userInfoUpdated'));
//     }
//     navigate('/dashboard'); // Redirect to dashboard after successful payment
//   };

//   const handleSelectPlan = async (plan) => {
//     if (!token) {
//       setError('You must be logged in to subscribe to a plan.');
//       navigate('/login'); // Redirect to login page
//       return;
//     }

//     const currentToken = localStorage.getItem('token'); // Get token directly from localStorage
//     if (!currentToken) {
//       setError('Authentication token not found. Please log in again.');
//       navigate('/login');
//       return;
//     }

//     setSelectedPlan(plan);
//     setLoading(true);
//     setError(null);
//     console.log('Selected plan details:', plan); // Added log to inspect plan object

//     try {
//       console.log('handleSelectPlan called for plan:', plan); // Added log

//       // Load Razorpay script dynamically
//       const loadRazorpayScript = () => {
//         return new Promise((resolve) => {
//           if (document.getElementById('razorpay-sdk')) {
//             console.log('Razorpay SDK already loaded.'); // Added log
//             return resolve(true);
//           }
//           console.log('Loading Razorpay SDK...'); // Added log
//           const script = document.createElement('script');
//           script.id = 'razorpay-sdk';
//           script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//           script.onload = () => {
//             console.log('Razorpay SDK loaded successfully.'); // Added log
//             resolve(true);
//           };
//           script.onerror = () => {
//             console.error('Razorpay SDK failed to load.'); // Added log
//             resolve(false);
//           };
//           document.body.appendChild(script);
//         });
//       };

//       const scriptLoaded = await loadRazorpayScript();
//       if (!scriptLoaded) {
//         throw new Error('Razorpay SDK failed to load.');
//       }

//       console.log('Making API call to create subscription order...');
//       const mappedInterval = plan.interval === 'month' ? 'monthly' :
//                              plan.interval === 'year' ? 'yearly' :
//                              plan.interval; // Assumes 'quarterly' is already correct
//       console.log('Sending plan data to backend:', { // Added log for sent data
//         planId: plan.id,
//         amount: plan.price * 100,
//         currency: 'INR',
//         interval: mappedInterval
//       });
//       const response = await fetch(`${BACKEND_BASE_URL}/payments/subscription/order`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${currentToken}` // Use the token from localStorage
//         },
//         body: JSON.stringify({
//           planId: plan.id,
//           amount: plan.price * 100, // Razorpay expects amount in smallest currency unit (e.g., paise for INR)
//           currency: 'INR', // Assuming INR, adjust if your application supports other currencies
//           interval: mappedInterval
//         })
//       });

//       const data = await response.json();
//       console.log('Backend API response for subscription order:', data); // Added log

//       if (!response.ok) {
//         throw new Error(data.message || 'Failed to create Razorpay order.');
//       }

//       const order = data.order; // This might be for one-time payments, check if it's still needed
//       const razorpaySubscription = data.razorpaySubscription;

//       if (!razorpaySubscription || !razorpaySubscription.id) {
//         throw new Error('Failed to get Razorpay subscription ID from backend.');
//       }
//       console.log('Received Razorpay Subscription ID:', razorpaySubscription.id); // Added log

//       const options = {
//         key: RAZORPAY_KEY_ID,
//         subscription_id: razorpaySubscription.id,
//         name: "NexintelAI Subscriptions",
//         description: plan.name,
//         image: "/src/assets/nexintel.jpg", // Assuming this is now the new logo
//         handler: function (response) {
//           console.log('Razorpay payment successful:', response);
//           alert('Payment successful! Your subscription is now active.');
//           handlePaymentSuccess(plan.name);
//         },
//         prefill: {
//           name: user?.name || '',
//           email: user?.email || '',
//           contact: user?.contact || ''
//         },
//         notes: {
//           user_id: user?.id || '',
//           plan_id: plan.id
//         },
//         theme: {
//           "color": "#1a202c"
//         }
//       };

//       console.log('Initializing Razorpay checkout with options:', options); // Added log
//       const rzp = new window.Razorpay(options);

//       rzp.on('payment.failed', function (response) {
//         alert(`Payment Failed: ${response.error.description || 'Unknown error'}`);
//         console.error('Razorpay payment failed:', response.error);
//         setError(`Payment failed: ${response.error.description || 'Unknown error'}`);
//       });

//       console.log('Opening Razorpay checkout...'); // Added log
//       rzp.open();

//     } catch (err) {
//       const errorMessage = err.message || 'An unexpected error occurred during the subscription process.';
//       setError(errorMessage);
//       console.error('Error during subscription process:', err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-7xl mx-auto">
//         <button
//           onClick={handleGoBack}
//           className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
//         >
//           <ArrowLeftIcon className="h-5 w-5 mr-2" />
//           Back
//         </button>

//         <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-12">
//           Plans that grow with you
//         </h1>

//         {/* Plan Type Toggle */}
//         <div className="flex justify-center mb-8">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md ${
//                 planType === 'individual'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('individual')}
//             >
//               Individual
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md ${
//                 planType === 'team'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('team')}
//             >
//               Team & Enterprise
//             </button>
//           </div>
//         </div>

//         {/* Billing Cycle Toggle */}
//         <div className="flex justify-center mb-12">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md ${
//                 billingCycle === 'monthly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('monthly')}
//             >
//               Monthly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium ${
//                 billingCycle === 'yearly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('yearly')}
//             >
//               Yearly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md ${
//                 billingCycle === 'quarterly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('quarterly')}
//             >
//               Quarterly
//             </button>
//           </div>
//         </div>

//         {loading && (
//           <div className="text-center text-gray-600 text-lg">Loading plans...</div>
//         )}

//         {error && (
//           <div className="text-center text-red-600 text-lg">Error: {error}</div>
//         )}

//         {!loading && !error && plans.length === 0 && (
//           <div className="text-center text-gray-600 text-lg">No plans available for the selected criteria.</div>
//         )}

//         {/* Plan Cards */}
//         {!loading && !error && plans.length > 0 && (
//           <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
//             {plans.map((plan) => {
//               const displayPrice = plan.price ? `$${plan.price}` : 'N/A';
//               const isPriceZero = displayPrice === '$0';

//               return (
//                 <div
//                   key={plan.id}
//                   className={`bg-white rounded-lg shadow-md p-8 flex flex-col ${plan.highlightClass || ''}`}
//                 >
//                   <div className="flex-shrink-0 mb-4">
//                     {plan.icon ? (
//                       plan.icon
//                     ) : (
//                       <svg className="h-12 w-12 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
//                         <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1L21 12h-4m-7 0h-4M7.21 14.77l-2.832 4.904A2 2 0 011.91 21h16.18a2 2 0 001.728-3.224L12.79 8.23" />
//                       </svg>
//                     )}
//                   </div>
//                   <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
//                   <p className="text-gray-500 text-sm mb-4">{plan.tagline}</p>
//                   <div className="flex items-baseline mb-6">
//                     <span className="text-4xl font-extrabold text-gray-900">
//                       {displayPrice}
//                     </span>
//                     {!isPriceZero && (
//                       <span className="ml-1 text-gray-500 text-base">
//                         {billingCycle === 'monthly' ? '/ month billed monthly' : (billingCycle === 'yearly' ? '/ month billed annually' : '/ month billed quarterly')}
//                       </span>
//                     )}
//                   </div>
//                   <button
//                     onClick={() => handleSelectPlan(plan)}
//                     className={`w-full py-3 px-6 rounded-md text-base font-medium transition-colors duration-200 ${plan.buttonClass || 'bg-gray-900 text-white hover:bg-gray-800'}`}
//                     disabled={plan.id === 'free' || !plan.price} // Disable button for free plan or if no price
//                   >
//                     {plan.buttonText || 'Select Plan'}
//                   </button>
//                   <div className="mt-8 flex-1">
//                     <ul className="space-y-4">
//                       {plan.features ? (
//                         // Check if features is a string and split it, otherwise assume it's an array
//                         (typeof plan.features === 'string' ? plan.features.split(',').map(f => f.trim()) : plan.features).map((feature, index) => (
//                           <li key={index} className="flex items-start">
//                             <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-2" />
//                             <span className="text-gray-700 text-sm">{feature}</span>
//                           </li>
//                         ))
//                       ) : (
//                         <li className="text-gray-500 text-sm">No features listed.</li>
//                       )}
//                     </ul>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//       </div>

//       {/* PaymentForm is no longer directly used here as Razorpay Checkout handles the UI */}
//     </div>
//   );
// };

// export default SubscriptionPlanPage;

// import React, { useState, useEffect, useCallback } from 'react';
// import { CheckIcon } from '@heroicons/react/20/solid';
// import { ArrowLeftIcon } from '@heroicons/react/24/outline';
// import { useNavigate } from 'react-router-dom';
// import apiService from '../services/api';
// import { useAuth } from '../context/AuthContext';

// // Razorpay Configuration
// const RAZORPAY_KEY_ID = import.meta.env.VITE_APP_RAZORPAY_KEY_ID || 'rzp_test_R6mBF5iIMakFt1';
// const BACKEND_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3000/api';

// console.log('Environment variables:', { RAZORPAY_KEY_ID, BACKEND_BASE_URL });

// const SubscriptionPlanPage = () => {
//   const navigate = useNavigate();
//   const { user, token } = useAuth();
  
//   // State management
//   const [billingCycle, setBillingCycle] = useState('yearly');
//   const [planType, setPlanType] = useState('individual');
//   const [plans, setPlans] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [processingPayment, setProcessingPayment] = useState(false);
//   const [selectedPlanId, setSelectedPlanId] = useState(null);

//   // Fetch plans from API
//   const fetchPlans = useCallback(async () => {
//     console.log('Fetching plans for:', { planType, billingCycle });
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await apiService.getPublicPlans();
//       console.log('API response:', response);
      
//       if (response?.success && Array.isArray(response.data)) {
//         // Filter plans based on selected criteria
//         const filteredPlans = response.data.filter(plan => {
//           // Type matching
//           const matchesType = (planType === 'team' && plan.type === 'business') || 
//                              (planType === 'individual' && plan.type === 'individual');
          
//           // Interval matching - normalize interval names
//           const planInterval = plan.interval?.toLowerCase();
//           const matchesInterval = (billingCycle === 'monthly' && ['month', 'monthly'].includes(planInterval)) ||
//                                  (billingCycle === 'yearly' && ['year', 'yearly', 'annual'].includes(planInterval)) ||
//                                  (billingCycle === 'quarterly' && ['quarter', 'quarterly'].includes(planInterval));
          
//           console.log(`Plan ${plan.name}: type=${plan.type}, interval=${planInterval}, matchesType=${matchesType}, matchesInterval=${matchesInterval}`);
//           return matchesType && matchesInterval;
//         });
        
//         console.log('Filtered plans:', filteredPlans);
//         setPlans(filteredPlans);
//       } else {
//         throw new Error('Invalid response format from server');
//       }
//     } catch (err) {
//       console.error('Error fetching plans:', err);
//       setError(`Failed to fetch plans: ${err.message}`);
//     } finally {
//       setLoading(false);
//     }
//   }, [planType, billingCycle]);

//   useEffect(() => {
//     fetchPlans();
//   }, [fetchPlans]);

//   // Load Razorpay script dynamically
//   const loadRazorpayScript = () => {
//     return new Promise((resolve) => {
//       // Check if Razorpay is already loaded
//       if (window.Razorpay) {
//         console.log('Razorpay already loaded');
//         return resolve(true);
//       }
      
//       // Check if script is already in DOM
//       if (document.getElementById('razorpay-script')) {
//         console.log('Razorpay script already in DOM');
//         return resolve(true);
//       }
      
//       console.log('Loading Razorpay script...');
//       const script = document.createElement('script');
//       script.id = 'razorpay-script';
//       script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//       script.onload = () => {
//         console.log('Razorpay script loaded successfully');
//         resolve(true);
//       };
//       script.onerror = (error) => {
//         console.error('Failed to load Razorpay script:', error);
//         resolve(false);
//       };
//       document.body.appendChild(script);
//     });
//   };

//   // Handle payment success
//   const handlePaymentSuccess = async (planName, paymentData) => {
//     try {
//       console.log('Payment successful:', paymentData);
      
//       // Update local storage
//       const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
//       userInfo.plan = planName;
//       userInfo.lastPayment = {
//         id: paymentData.razorpay_payment_id,
//         date: new Date().toISOString()
//       };
//       localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
//       // Dispatch event for other components
//       window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: userInfo }));
      
//       // Show success message
//       alert('🎉 Payment successful! Your subscription is now active.');
      
//       // Redirect to dashboard
//       navigate('/dashboard', { replace: true });
//     } catch (error) {
//       console.error('Error handling payment success:', error);
//     }
//   };

//   // Handle payment failure
//   const handlePaymentFailure = (error) => {
//     console.error('Payment failed:', error);
//     const errorMessage = error?.description || error?.message || 'Payment failed due to unknown error';
//     alert(`❌ Payment Failed: ${errorMessage}`);
//     setError(`Payment failed: ${errorMessage}`);
//     setProcessingPayment(false);
//     setSelectedPlanId(null);
//   };

//   // Create payment order and handle Razorpay checkout
//   const handleSelectPlan = async (plan) => {
//     console.log('Selected plan:', plan);

//     // Authentication check
//     if (!token || !user) {
//       setError('Please login to subscribe to a plan');
//       navigate('/login');
//       return;
//     }

//     // Validate plan
//     if (!plan.id || !plan.price || plan.price <= 0) {
//       setError('Invalid plan selected');
//       return;
//     }

//     setProcessingPayment(true);
//     setSelectedPlanId(plan.id);
//     setError(null);

//     try {
//       // Load Razorpay script
//       const scriptLoaded = await loadRazorpayScript();
//       if (!scriptLoaded) {
//         throw new Error('Payment gateway failed to load. Please refresh and try again.');
//       }

//       console.log('Initiating subscription payment for plan ID:', plan.id);

//       // Use direct fetch call as specified by the user
//       const response = await fetch(`${BACKEND_BASE_URL}/payments/subscription/start`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`,
//         },
//         body: JSON.stringify({ plan_id: plan.id }),
//       });

//       const startSubscriptionResponse = await response.json();
//       console.log('startSubscription API response:', startSubscriptionResponse);

//       if (!startSubscriptionResponse.success || !startSubscriptionResponse.subscription_id || !startSubscriptionResponse.key) {
//         throw new Error(startSubscriptionResponse.message || 'Failed to initiate subscription payment.');
//       }

//       // Configure Razorpay checkout options
//       const razorpayOptions = {
//         key: startSubscriptionResponse.key, // Use the key from the backend response
//         subscription_id: startSubscriptionResponse.subscription_id, // Use the subscription_id from the backend response
//         name: "NexintelAI Subscriptions",
//         description: `${plan.name} Subscription`,
//         prefill: {
//           name: user.name || '',
//           email: user.email || '',
//           contact: user.phone || user.contact || ''
//         },
//         theme: {
//           color: "#1a202c"
//         },
//         handler: async function (response) {
//           console.log('Razorpay payment handler response:', response);
//           // Verify the payment with the backend
//           try {
//             const verificationResponse = await apiService.verifySubscription({
//               razorpay_payment_id: response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature: response.razorpay_signature,
//             });

//             if (verificationResponse.success) {
//               await handlePaymentSuccess(plan.name, response);
//             } else {
//               throw new Error(verificationResponse.message || 'Payment verification failed.');
//             }
//           } catch (verifyError) {
//             console.error('Error during payment verification:', verifyError);
//             handlePaymentFailure({ description: verifyError.message || 'Payment verification failed.' });
//           } finally {
//             setProcessingPayment(false);
//             setSelectedPlanId(null);
//           }
//         },
//         modal: {
//           ondismiss: function() {
//             console.log('Payment modal dismissed by user');
//             setProcessingPayment(false);
//             setSelectedPlanId(null);
//           }
//         }
//       };

//       console.log('Opening Razorpay checkout with options:', razorpayOptions);
      
//       // Create and open Razorpay instance
//       const razorpayInstance = new window.Razorpay(razorpayOptions);
      
//       razorpayInstance.on('payment.failed', function (response) {
//         console.error('Razorpay payment.failed event:', response);
//         handlePaymentFailure(response.error);
//       });

//       razorpayInstance.open();

//     } catch (err) {
//       console.error('Error in payment process:', err);
//       setError(err.message || 'Payment process failed. Please try again.');
//       setProcessingPayment(false);
//       setSelectedPlanId(null);
//     }
//   };

//   // Navigation handler
//   const handleGoBack = () => {
//     navigate(-1);
//   };

//   // Retry handler
//   const handleRetry = () => {
//     setError(null);
//     fetchPlans();
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-7xl mx-auto">
//         {/* Back button */}
//         <button
//           onClick={handleGoBack}
//           className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
//           disabled={processingPayment}
//         >
//           <ArrowLeftIcon className="h-5 w-5 mr-2" />
//           Back
//         </button>

//         {/* Page title */}
//         <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-12">
//           Plans that grow with you
//         </h1>

//         {/* Plan Type Toggle */}
//         <div className="flex justify-center mb-8">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
//                 planType === 'individual'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('individual')}
//               disabled={loading || processingPayment}
//             >
//               Individual
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
//                 planType === 'team'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('team')}
//               disabled={loading || processingPayment}
//             >
//               Team & Enterprise
//             </button>
//           </div>
//         </div>

//         {/* Billing Cycle Toggle */}
//         <div className="flex justify-center mb-12">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
//                 billingCycle === 'monthly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('monthly')}
//               disabled={loading || processingPayment}
//             >
//               Monthly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium transition-colors ${
//                 billingCycle === 'yearly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('yearly')}
//               disabled={loading || processingPayment}
//             >
//               Yearly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
//                 billingCycle === 'quarterly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('quarterly')}
//               disabled={loading || processingPayment}
//             >
//               Quarterly
//             </button>
//           </div>
//         </div>

//         {/* Loading State */}
//         {loading && (
//           <div className="text-center py-12">
//             <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
//             <p className="text-gray-600">Loading subscription plans...</p>
//           </div>
//         )}

//         {/* Error State */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
//             <div className="flex justify-between items-center">
//               <div className="text-red-800">{error}</div>
//               <button
//                 onClick={handleRetry}
//                 className="text-red-600 hover:text-red-500 text-sm font-medium"
//                 disabled={loading}
//               >
//                 Try Again
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Empty State */}
//         {!loading && !error && plans.length === 0 && (
//           <div className="text-center py-12">
//             <p className="text-gray-600 text-lg mb-4">
//               No plans available for {planType} - {billingCycle} billing
//             </p>
//             <button
//               onClick={handleRetry}
//               className="text-blue-600 hover:text-blue-500 font-medium"
//             >
//               Refresh Plans
//             </button>
//           </div>
//         )}

//         {/* Plan Cards */}
//         {!loading && !error && plans.length > 0 && (
//           <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
//             {plans.map((plan) => {
//               const displayPrice = plan.price ? `₹${plan.price.toLocaleString()}` : 'Free';
//               const isPriceZero = !plan.price || plan.price === 0;
//               const isCurrentlyProcessing = processingPayment && selectedPlanId === plan.id;
//               const isDisabled = isPriceZero || processingPayment;

//               console.log(`Plan: ${plan.name}, ID: ${plan.id}, processingPayment: ${processingPayment}, selectedPlanId: ${selectedPlanId}, isCurrentlyProcessing: ${isCurrentlyProcessing}, isDisabled: ${isDisabled}`);

//               return (
//                 <div
//                   key={plan.id}
//                   className={`bg-white rounded-lg shadow-lg p-8 flex flex-col border transition-all duration-200 ${
//                     isCurrentlyProcessing ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:shadow-xl'
//                   }`}
//                 >
//                   {/* Plan Icon */}
//                   <div className="flex-shrink-0 mb-4">
//                     <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
//                       <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1L21 12h-4m-7 0h-4" />
//                       </svg>
//                     </div>
//                   </div>
                  
//                   {/* Plan Details */}
//                   <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
//                   <p className="text-gray-500 text-sm mb-6 flex-grow">
//                     {plan.description || plan.tagline || 'Subscription plan'}
//                   </p>
                  
//                   {/* Pricing */}
//                   <div className="flex items-baseline mb-6">
//                     <span className="text-4xl font-extrabold text-gray-900">
//                       {displayPrice}
//                     </span>
//                     {!isPriceZero && (
//                       <span className="ml-1 text-gray-500 text-base">
//                         /{billingCycle === 'monthly' ? 'month' : billingCycle === 'yearly' ? 'year' : 'quarter'}
//                       </span>
//                     )}
//                   </div>
                  
//                   {/* CTA Button */}
//                   <button
//                     onClick={() => handleSelectPlan(plan)}
//                     disabled={isDisabled}
//                     className={`w-full py-3 px-6 rounded-md text-base font-medium transition-all duration-200 mb-6 ${
//                       isDisabled
//                         ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
//                         : 'bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
//                     }`}
//                   >
//                     {isCurrentlyProcessing ? (
//                       <div className="flex items-center justify-center">
//                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                         Processing...
//                       </div>
//                     ) : isPriceZero ? (
//                       'Free Plan'
//                     ) : (
//                       'Select Plan'
//                     )}
//                   </button>
                  
//                   {/* Features List */}
//                   <div className="flex-1">
//                     <ul className="space-y-3">
//                       {plan.features ? (
//                         (typeof plan.features === 'string' ?
//                          plan.features.split(',').map(f => f.trim()).filter(f => f) :
//                          Array.isArray(plan.features) ? plan.features : []
//                         ).map((feature, index) => (
//                           <li key={index} className="flex items-start">
//                             <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-3 mt-0.5" />
//                             <span className="text-gray-700 text-sm">{feature}</span>
//                           </li>
//                         ))
//                       ) : (
//                         <li className="text-gray-500 text-sm italic">No features listed</li>
//                       )}
//                     </ul>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SubscriptionPlanPage;
// import React, { useState, useEffect, useCallback } from 'react';
// import { CheckIcon } from '@heroicons/react/20/solid';
// import { ArrowLeftIcon } from '@heroicons/react/24/outline';
// import { useNavigate } from 'react-router-dom';
// import apiService from '../services/api';
// import { useAuth } from '../context/AuthContext';

// // Razorpay Configuration
// const RAZORPAY_KEY_ID = import.meta.env.VITE_APP_RAZORPAY_KEY_ID || 'rzp_test_R6mBF5iIMakFt1';
// const BACKEND_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:3000/api';

// console.log('Environment variables:', { RAZORPAY_KEY_ID, BACKEND_BASE_URL });

// const SubscriptionPlanPage = () => {
//   const navigate = useNavigate();
//   const { user, token } = useAuth();
  
//   // State management
//   const [billingCycle, setBillingCycle] = useState('yearly');
//   const [planType, setPlanType] = useState('individual');
//   const [plans, setPlans] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [processingPayment, setProcessingPayment] = useState(false);
//   const [selectedPlanId, setSelectedPlanId] = useState(null);

//   // Fetch plans from API
//   const fetchPlans = useCallback(async () => {
//     console.log('Fetching plans for:', { planType, billingCycle });
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await apiService.getPublicPlans();
//       console.log('API response:', response);
      
//       if (response?.success && Array.isArray(response.data)) {
//         // Filter plans based on selected criteria
//         const filteredPlans = response.data.filter(plan => {
//           // Type matching
//           const matchesType = (planType === 'team' && plan.type === 'business') || 
//                              (planType === 'individual' && plan.type === 'individual');
          
//           // Interval matching - normalize interval names
//           const planInterval = plan.interval?.toLowerCase();
//           const matchesInterval = (billingCycle === 'monthly' && ['month', 'monthly'].includes(planInterval)) ||
//                                  (billingCycle === 'yearly' && ['year', 'yearly', 'annual'].includes(planInterval)) ||
//                                  (billingCycle === 'quarterly' && ['quarter', 'quarterly'].includes(planInterval));
          
//           console.log(`Plan ${plan.name}: type=${plan.type}, interval=${planInterval}, matchesType=${matchesType}, matchesInterval=${matchesInterval}`);
//           return matchesType && matchesInterval;
//         });
        
//         console.log('Filtered plans:', filteredPlans);
//         setPlans(filteredPlans);
//       } else {
//         throw new Error('Invalid response format from server');
//       }
//     } catch (err) {
//       console.error('Error fetching plans:', err);
//       setError(`Failed to fetch plans: ${err.message}`);
//     } finally {
//       setLoading(false);
//     }
//   }, [planType, billingCycle]);

//   useEffect(() => {
//     fetchPlans();
//   }, [fetchPlans]);

//   // Load Razorpay script dynamically
//   const loadRazorpayScript = () => {
//     return new Promise((resolve) => {
//       // Check if Razorpay is already loaded
//       if (window.Razorpay) {
//         console.log('Razorpay already loaded');
//         return resolve(true);
//       }
      
//       // Check if script is already in DOM
//       if (document.getElementById('razorpay-script')) {
//         console.log('Razorpay script already in DOM');
//         return resolve(true);
//       }
      
//       console.log('Loading Razorpay script...');
//       const script = document.createElement('script');
//       script.id = 'razorpay-script';
//       script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//       script.onload = () => {
//         console.log('Razorpay script loaded successfully');
//         resolve(true);
//       };
//       script.onerror = (error) => {
//         console.error('Failed to load Razorpay script:', error);
//         resolve(false);
//       };
//       document.body.appendChild(script);
//     });
//   };

//   // Handle payment success
//   const handlePaymentSuccess = async (planName, paymentData) => {
//     try {
//       console.log('Payment successful:', paymentData);
      
//       // Update local storage
//       const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
//       userInfo.plan = planName;
//       userInfo.lastPayment = {
//         id: paymentData.razorpay_payment_id,
//         subscription_id: paymentData.razorpay_subscription_id,
//         date: new Date().toISOString()
//       };
//       localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
//       // Dispatch event for other components
//       window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: userInfo }));
      
//       // Show success message
//       alert('🎉 Payment successful! Your subscription is now active.');
      
//       // Redirect to dashboard
//       navigate('/dashboard', { replace: true });
//     } catch (error) {
//       console.error('Error handling payment success:', error);
//     }
//   };

//   // Handle payment failure
//   const handlePaymentFailure = (error) => {
//     console.error('Payment failed:', error);
//     const errorMessage = error?.description || error?.message || 'Payment failed due to unknown error';
//     alert(`❌ Payment Failed: ${errorMessage}`);
//     setError(`Payment failed: ${errorMessage}`);
//     setProcessingPayment(false);
//     setSelectedPlanId(null);
//   };

//   // Create payment order and handle Razorpay checkout
//   const handleSelectPlan = async (plan) => {
//     console.log('Selected plan:', plan);

//     // Authentication check

//     // Validate plan
//     if (!plan.id || !plan.price || plan.price <= 0) {
//       setError('Invalid plan selected');
//       return;
//     }

//     setProcessingPayment(true);
//     setSelectedPlanId(plan.id);
//     setError(null);

//     try {
//       // Load Razorpay script
//       const scriptLoaded = await loadRazorpayScript();
//       if (!scriptLoaded) {
//         throw new Error('Payment gateway failed to load. Please refresh and try again.');
//       }

//       console.log('Initiating subscription payment for plan ID:', plan.id);
//       console.log('Token being sent for subscription:', token); // Debugging token value

//       // Start subscription
//       const response = await fetch(`${BACKEND_BASE_URL}/payments/subscription/start`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`,
//         },
//         body: JSON.stringify({ plan_id: plan.id }),
//       });

//       const startSubscriptionResponse = await response.json();
//       console.log('startSubscription API response:', startSubscriptionResponse);

//       if (!startSubscriptionResponse.success || !startSubscriptionResponse.subscription_id || !startSubscriptionResponse.key) {
//         throw new Error(startSubscriptionResponse.message || 'Failed to initiate subscription payment.');
//       }

//       // Configure Razorpay checkout options
//       const razorpayOptions = {
//         key: startSubscriptionResponse.key,
//         subscription_id: startSubscriptionResponse.subscription_id,
//         name: "NexintelAI Subscriptions",
//         description: `${plan.name} Subscription`,
//         image: "/src/assets/nexintel.jpg", // Assuming this is now the new logo
//         prefill: {
//           name: user.name || user.username || '',
//           email: user.email || '',
//           contact: user.phone || user.contact || ''
//         },
//         theme: {
//           color: "#1a202c"
//         },
//         handler: async function (response) {
//           console.log('Razorpay payment handler response:', response);
          
//           setProcessingPayment(true);
          
//           try {
//             // Verify the payment with the backend
//             const verificationResponse = await fetch(`${BACKEND_BASE_URL}/payments/subscription/verify`, {
//               method: 'POST',
//               headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//               },
//               body: JSON.stringify({
//                 razorpay_payment_id: response.razorpay_payment_id,
//                 razorpay_subscription_id: response.razorpay_subscription_id,
//                 razorpay_signature: response.razorpay_signature,
//               }),
//             });

//             const verifyResult = await verificationResponse.json();
//             console.log('Verification response:', verifyResult);

//             if (verifyResult.success) {
//               await handlePaymentSuccess(plan.name, response);
//             } else {
//               throw new Error(verifyResult.message || 'Payment verification failed.');
//             }
//           } catch (verifyError) {
//             console.error('Error during payment verification:', verifyError);
//             handlePaymentFailure({ description: verifyError.message || 'Payment verification failed.' });
//           } finally {
//             setProcessingPayment(false);
//             setSelectedPlanId(null);
//           }
//         },
//         modal: {
//           ondismiss: function() {
//             console.log('Payment modal dismissed by user');
//             setProcessingPayment(false);
//             setSelectedPlanId(null);
//           },
//           escape: true,
//           backdropclose: false
//         },
//         notes: {
//           plan_id: plan.id,
//           user_id: user.id
//         }
//       };

//       console.log('Opening Razorpay checkout with options:', razorpayOptions);
      
//       // Create and open Razorpay instance
//       const razorpayInstance = new window.Razorpay(razorpayOptions);
      
//       razorpayInstance.on('payment.failed', function (response) {
//         console.error('Razorpay payment.failed event:', response);
//         handlePaymentFailure(response.error);
//       });

//       razorpayInstance.open();

//     } catch (err) {
//       console.error('Error in payment process:', err);
//       setError(err.message || 'Payment process failed. Please try again.');
//       setProcessingPayment(false);
//       setSelectedPlanId(null);
//     }
//   };

//   // Navigation handler
//   const handleGoBack = () => {
//     navigate(-1);
//   };

//   // Retry handler
//   const handleRetry = () => {
//     setError(null);
//     fetchPlans();
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-7xl mx-auto">
//         {/* Back button */}
//         <button
//           onClick={handleGoBack}
//           className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
//           disabled={processingPayment}
//         >
//           <ArrowLeftIcon className="h-5 w-5 mr-2" />
//           Back
//         </button>

//         {/* Page title */}
//         <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-12">
//           Plans that grow with you
//         </h1>

//         {/* Plan Type Toggle */}
//         <div className="flex justify-center mb-8">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
//                 planType === 'individual'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('individual')}
//               disabled={loading || processingPayment}
//             >
//               Individual
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
//                 planType === 'team'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setPlanType('team')}
//               disabled={loading || processingPayment}
//             >
//               Team & Enterprise
//             </button>
//           </div>
//         </div>

//         {/* Billing Cycle Toggle */}
//         <div className="flex justify-center mb-12">
//           <div className="inline-flex rounded-md shadow-sm">
//             <button
//               type="button"
//               className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
//                 billingCycle === 'monthly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('monthly')}
//               disabled={loading || processingPayment}
//             >
//               Monthly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium transition-colors ${
//                 billingCycle === 'yearly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('yearly')}
//               disabled={loading || processingPayment}
//             >
//               Yearly
//             </button>
//             <button
//               type="button"
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
//                 billingCycle === 'quarterly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('quarterly')}
//               disabled={loading || processingPayment}
//             >
//               Quarterly
//             </button>
//           </div>
//         </div>

//         {/* Loading State */}
//         {loading && (
//           <div className="text-center py-12">
//             <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
//             <p className="text-gray-600">Loading subscription plans...</p>
//           </div>
//         )}

//         {/* Error State */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
//             <div className="flex justify-between items-center">
//               <div className="text-red-800">{error}</div>
//               <button
//                 onClick={handleRetry}
//                 className="text-red-600 hover:text-red-500 text-sm font-medium"
//                 disabled={loading}
//               >
//                 Try Again
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Empty State */}
//         {!loading && !error && plans.length === 0 && (
//           <div className="text-center py-12">
//             <p className="text-gray-600 text-lg mb-4">
//               No plans available for {planType} - {billingCycle} billing
//             </p>
//             <button
//               onClick={handleRetry}
//               className="text-blue-600 hover:text-blue-500 font-medium"
//             >
//               Refresh Plans
//             </button>
//           </div>
//         )}

//         {/* Plan Cards */}
//         {!loading && !error && plans.length > 0 && (
//           <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
//             {plans.map((plan) => {
//               const displayPrice = plan.price ? `₹${plan.price.toLocaleString()}` : 'Free';
//               const isPriceZero = !plan.price || plan.price === 0;
//               const isCurrentlyProcessing = processingPayment && selectedPlanId === plan.id;
//               const isDisabled = isPriceZero || processingPayment || loading; // Disable if auth context is loading

//               console.log(`Plan: ${plan.name}, ID: ${plan.id}, processingPayment: ${processingPayment}, selectedPlanId: ${selectedPlanId}, isCurrentlyProcessing: ${isCurrentlyProcessing}, isDisabled: ${isDisabled}, Auth Loading: ${loading}`);

//               return (
//                 <div
//                   key={plan.id}
//                   className={`bg-white rounded-lg shadow-lg p-8 flex flex-col border transition-all duration-200 ${
//                     isCurrentlyProcessing ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:shadow-xl'
//                   }`}
//                 >
//                   {/* Plan Icon */}
//                   <div className="flex-shrink-0 mb-4">
//                     <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
//                       <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1L21 12h-4m-7 0h-4" />
//                       </svg>
//                     </div>
//                   </div>
                  
//                   {/* Plan Details */}
//                   <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
//                   <p className="text-gray-500 text-sm mb-6 flex-grow">
//                     {plan.description || plan.tagline || 'Subscription plan'}
//                   </p>
                  
//                   {/* Pricing */}
//                   <div className="flex items-baseline mb-6">
//                     <span className="text-4xl font-extrabold text-gray-900">
//                       {displayPrice}
//                     </span>
//                     {!isPriceZero && (
//                       <span className="ml-1 text-gray-500 text-base">
//                         /{billingCycle === 'monthly' ? 'month' : billingCycle === 'yearly' ? 'year' : 'quarter'}
//                       </span>
//                     )}
//                   </div>
                  
//                   {/* CTA Button */}
//                   <button
//                     onClick={() => handleSelectPlan(plan)}
//                     disabled={isDisabled}
//                     className={`w-full py-3 px-6 rounded-md text-base font-medium transition-all duration-200 mb-6 ${
//                       isDisabled
//                         ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
//                         : 'bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
//                     }`}
//                   >
//                     {isCurrentlyProcessing ? (
//                       <div className="flex items-center justify-center">
//                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                         Processing...
//                       </div>
//                     ) : isPriceZero ? (
//                       'Free Plan'
//                     ) : (
//                       'Select Plan'
//                     )}
//                   </button>
                  
//                   {/* Features List */}
//                   <div className="flex-1">
//                     <ul className="space-y-3">
//                       {plan.features ? (
//                         (typeof plan.features === 'string' ?
//                          plan.features.split(',').map(f => f.trim()).filter(f => f) :
//                          Array.isArray(plan.features) ? plan.features : []
//                         ).map((feature, index) => (
//                           <li key={index} className="flex items-start">
//                             <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-3 mt-0.5" />
//                             <span className="text-gray-700 text-sm">{feature}</span>
//                           </li>
//                         ))
//                       ) : (
//                         <li className="text-gray-500 text-sm italic">No features listed</li>
//                       )}
//                     </ul>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SubscriptionPlanPage;


import React, { useState, useEffect, useCallback } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';

// Razorpay Configuration
const RAZORPAY_KEY_ID = import.meta.env.VITE_APP_RAZORPAY_KEY_ID || 'rzp_test_R6mBF5iIMakFt1';
const BACKEND_BASE_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

console.log('Environment variables:', { RAZORPAY_KEY_ID, BACKEND_BASE_URL });

const SubscriptionPlanPage = () => {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  
  // State management
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [planType, setPlanType] = useState('individual');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  // Fetch plans from API
  const fetchPlans = useCallback(async () => {
    console.log('Fetching plans for:', { planType, billingCycle });
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getPublicPlans();
      console.log('API response:', response);
      
      if (response?.success && Array.isArray(response.data)) {
        // Filter plans based on selected criteria
        const filteredPlans = response.data.filter(plan => {
          // Type matching
          const matchesType = (planType === 'team' && plan.type === 'business') || 
                             (planType === 'individual' && plan.type === 'individual');
          
          // Interval matching - normalize interval names
          const planInterval = plan.interval?.toLowerCase();
          const matchesInterval = (billingCycle === 'monthly' && ['month', 'monthly'].includes(planInterval)) ||
                                 (billingCycle === 'yearly' && ['year', 'yearly', 'annual'].includes(planInterval)) ||
                                 (billingCycle === 'quarterly' && ['quarter', 'quarterly'].includes(planInterval));
          
          console.log(`Plan ${plan.name}: type=${plan.type}, interval=${planInterval}, matchesType=${matchesType}, matchesInterval=${matchesInterval}`);
          return matchesType && matchesInterval;
        });
        
        console.log('Filtered plans:', filteredPlans);
        setPlans(filteredPlans);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError(`Failed to fetch plans: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [planType, billingCycle]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Load Razorpay script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      // Check if Razorpay is already loaded
      if (window.Razorpay) {
        console.log('Razorpay already loaded');
        return resolve(true);
      }
      
      // Check if script is already in DOM
      if (document.getElementById('razorpay-script')) {
        console.log('Razorpay script already in DOM');
        return resolve(true);
      }
      
      console.log('Loading Razorpay script...');
      const script = document.createElement('script');
      script.id = 'razorpay-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        console.log('Razorpay script loaded successfully');
        resolve(true);
      };
      script.onerror = (error) => {
        console.error('Failed to load Razorpay script:', error);
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Handle payment success
  const handlePaymentSuccess = async (planName, paymentData) => {
    try {
      console.log('Payment successful:', paymentData);
      
      // Update local storage
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      userInfo.plan = planName;
      userInfo.lastPayment = {
        id: paymentData.razorpay_payment_id,
        subscription_id: paymentData.razorpay_subscription_id,
        date: new Date().toISOString()
      };
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: userInfo }));
      
      // Show success message
      alert('🎉 Payment successful! Your subscription is now active.');
      
      // Redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  };

  // Handle payment failure
  const handlePaymentFailure = (error) => {
    console.error('Payment failed:', error);
    const errorMessage = error?.description || error?.message || 'Payment failed due to unknown error';
    alert(`❌ Payment Failed: ${errorMessage}`);
    setError(`Payment failed: ${errorMessage}`);
    setProcessingPayment(false);
    setSelectedPlanId(null);
  };

  // Create payment order and handle Razorpay checkout
  const handleSelectPlan = async (plan) => {
    console.log('Selected plan:', plan);

    // Check if user is authenticated
    // Authentication check is now handled by AuthChecker.jsx at the route level.
    // If a user reaches this page, they are assumed to be authenticated.
    // If authLoading is true, it means the auth state is still being determined.
    if (authLoading) {
      setError('Please wait while we verify your authentication...');
      return;
    }
    // If for some reason user or token are null/undefined here, it implies an issue
    // with AuthContext or AuthChecker, which should be addressed there.
    // We will not redirect from here to avoid conflicting with AuthChecker.

    // Validate plan
    if (!plan.id || !plan.price || plan.price <= 0) {
      setError('Invalid plan selected');
      return;
    }

    setProcessingPayment(true);
    setSelectedPlanId(plan.id);
    setError(null);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Payment gateway failed to load. Please refresh and try again.');
      }

      console.log('Initiating subscription payment for plan ID:', plan.id);
      console.log('Token being sent for subscription:', token?.substring(0, 20) + '...'); // Log only first 20 chars
      console.log('Sending plan_id to backend:', plan.id); // Added log for plan.id

      // Start subscription
      const response = await fetch(`${BACKEND_BASE_URL}/payments/subscription/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // Get token directly from localStorage
        },
        body: JSON.stringify({ plan_id: plan.id }),
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const startSubscriptionResponse = await response.json();
      console.log('startSubscription API response:', startSubscriptionResponse);

      if (!startSubscriptionResponse.success) {
        throw new Error(startSubscriptionResponse.message || startSubscriptionResponse.error || 'Failed to initiate subscription payment.');
      }

      if (!startSubscriptionResponse.subscription_id || !startSubscriptionResponse.key) {
        throw new Error('Invalid response from payment server. Missing subscription ID or key.');
      }

      // Configure Razorpay checkout options
      const razorpayOptions = {
        key: startSubscriptionResponse.key,
        subscription_id: startSubscriptionResponse.subscription_id,
        name: "NexintelAI Subscriptions",
        description: `${plan.name} Subscription`,
        image: "https://www.nexintelai.com/assets/img/Ai%20logo-01.png", // Add your logo URL here
        prefill: {
          name: user?.name || user?.username || '',
          email: user?.email || '',
          contact: user?.phone || user?.contact || ''
        },
        theme: {
          color: "#1a202c"
        },
        handler: async function (response) {
          console.log('Razorpay payment handler response:', response);
          
          setProcessingPayment(true);
          
          try {
            // Verify the payment with the backend
            const verificationResponse = await fetch(`${BACKEND_BASE_URL}/payments/subscription/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`, // Get token directly from localStorage
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verificationResponse.ok) {
              const errorText = await verificationResponse.text();
              console.error('Verification HTTP Error:', verificationResponse.status, errorText);
              throw new Error(`Verification failed: ${verificationResponse.status} ${verificationResponse.statusText}`);
            }

            const verifyResult = await verificationResponse.json();
            console.log('Verification response:', verifyResult);

            if (verifyResult.success) {
              await handlePaymentSuccess(plan.name, response);
            } else {
              throw new Error(verifyResult.message || 'Payment verification failed.');
            }
          } catch (verifyError) {
            console.error('Error during payment verification:', verifyError);
            handlePaymentFailure({ description: verifyError.message || 'Payment verification failed.' });
          } finally {
            setProcessingPayment(false);
            setSelectedPlanId(null);
          }
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal dismissed by user');
            setProcessingPayment(false);
            setSelectedPlanId(null);
          },
          escape: true,
          backdropclose: false
        },
        notes: {
          plan_id: plan.id,
          user_id: user?.id || 'anonymous' // Safely access user.id with null check
        }
      };

      console.log('Opening Razorpay checkout with options:', razorpayOptions);
      
      // Create and open Razorpay instance
      const razorpayInstance = new window.Razorpay(razorpayOptions);
      
      razorpayInstance.on('payment.failed', function (response) {
        console.error('Razorpay payment.failed event:', response);
        handlePaymentFailure(response.error);
      });

      razorpayInstance.open();

    } catch (err) {
      console.error('Error in payment process:', err);
      setError(err.message || 'Payment process failed. Please try again.');
      setProcessingPayment(false);
      setSelectedPlanId(null);
    }
  };

  // Navigation handler
  const handleGoBack = () => {
    navigate(-1);
  };

  // Retry handler
  const handleRetry = () => {
    setError(null);
    fetchPlans();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <button
          onClick={handleGoBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
          disabled={processingPayment}
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back
        </button>

        {/* Page title */}
        <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-12">
          Plans that grow with you
        </h1>

        {/* Plan Type Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
                planType === 'individual'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setPlanType('individual')}
              disabled={loading || processingPayment}
            >
              Individual
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
                planType === 'team'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setPlanType('team')}
              disabled={loading || processingPayment}
            >
              Team & Enterprise
            </button>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('monthly')}
              disabled={loading || processingPayment}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('yearly')}
              disabled={loading || processingPayment}
            >
              Yearly
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${
                billingCycle === 'quarterly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('quarterly')}
              disabled={loading || processingPayment}
            >
              Quarterly
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading subscription plans...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
            <div className="flex justify-between items-center">
              <div className="text-red-800">{error}</div>
              <button
                onClick={handleRetry}
                className="text-red-600 hover:text-red-500 text-sm font-medium"
                disabled={loading}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && plans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">
              No plans available for {planType} - {billingCycle} billing
            </p>
            <button
              onClick={handleRetry}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Refresh Plans
            </button>
          </div>
        )}

        {/* Plan Cards */}
        {!loading && !error && plans.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const displayPrice = plan.price ? `₹${plan.price.toLocaleString()}` : 'Free';
              const isPriceZero = !plan.price || plan.price === 0;
              const isCurrentlyProcessing = processingPayment && selectedPlanId === plan.id;
              const isDisabled = isPriceZero || processingPayment || authLoading;

              console.log(`Plan: ${plan.name}, ID: ${plan.id}, processingPayment: ${processingPayment}, selectedPlanId: ${selectedPlanId}, isCurrentlyProcessing: ${isCurrentlyProcessing}, isDisabled: ${isDisabled}, Auth Loading: ${authLoading}`);

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-lg shadow-lg p-8 flex flex-col border transition-all duration-200 ${
                    isCurrentlyProcessing ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:shadow-xl'
                  }`}
                >
                  {/* Plan Icon */}
                  <div className="flex-shrink-0 mb-4">
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1L21 12h-4m-7 0h-4" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Plan Details */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
                  <p className="text-gray-500 text-sm mb-6 flex-grow">
                    {plan.description || plan.tagline || 'Subscription plan'}
                  </p>
                  
                  {/* Pricing */}
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">
                      {displayPrice}
                    </span>
                    {!isPriceZero && (
                      <span className="ml-1 text-gray-500 text-base">
                        /{billingCycle === 'monthly' ? 'month' : billingCycle === 'yearly' ? 'year' : 'quarter'}
                      </span>
                    )}
                  </div>
                  
                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isDisabled}
                    className={`w-full py-3 px-6 rounded-md text-base font-medium transition-all duration-200 mb-6 ${
                      isDisabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
                    }`}
                  >
                    {isCurrentlyProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : isPriceZero ? (
                      'Free Plan'
                    ) : (
                      'Select Plan'
                    )}
                  </button>
                  
                  {/* Features List */}
                  <div className="flex-1">
                    <ul className="space-y-3">
                      {plan.features ? (
                        (typeof plan.features === 'string' ?
                         plan.features.split(',').map(f => f.trim()).filter(f => f) :
                         Array.isArray(plan.features) ? plan.features : []
                        ).map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-3 mt-0.5" />
                            <span className="text-gray-700 text-sm">{feature}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 text-sm italic">No features listed</li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlanPage;