// import React from 'react';
// import { Link } from 'react-router-dom';

// const PricingPage = () => {
//   return (
//     <div className="min-h-screen bg-gray-100 font-inter py-16 px-4 sm:px-6 lg:px-8">
//       <div className="container mx-auto">
//         <h3 className="text-3xl sm:text-4xl font-semibold text-center text-gray-800 mb-12">Flexible Pricing Plans</h3>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
//           {/* Free Tier */}
//           <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-gray-400 text-center">
//             <h4 className="text-3xl font-bold text-gray-900 mb-4">Free</h4>
//             <p className="text-5xl font-extrabold text-gray-700 mb-6">$0<span className="text-xl text-gray-500">/month</span></p>
//             <ul className="text-gray-700 text-left mb-8 space-y-3">
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Limited Document Uploads</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Basic AI Summarization</li>
//               <li className="flex items-center"><span className="text-red-500 mr-2">✖</span> Document Drafting</li>
//               <li className="flex items-center"><span className="text-red-500 mr-2">✖</span> Priority Support</li>
//             </ul>
//             <Link to="/register" className="block w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition-colors duration-200" target="_blank" rel="noopener noreferrer">
//               Sign Up - Free
//             </Link>
//           </div>

//           {/* Premium Tier */}
//           <div className="bg-white p-8 rounded-xl shadow-xl border-t-4 border-gray-700 text-center transform scale-105">
//             <h4 className="text-3xl font-bold text-gray-900 mb-4">Premium</h4>
//             <p className="text-5xl font-extrabold text-gray-700 mb-6">$49<span className="text-xl text-gray-500">/month</span></p>
//             <ul className="text-gray-700 text-left mb-8 space-y-3">
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Unlimited Document Uploads</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Advanced AI Analysis</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Basic Document Drafting</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Standard Support</li>
//             </ul>
//             <Link to="/register" className="block w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-lg transition-colors duration-200" target="_blank" rel="noopener noreferrer">
//               Choose Premium
//             </Link>
//           </div>

//           {/* Enterprise Tier */}
//           <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-gray-400 text-center">
//             <h4 className="text-3xl font-bold text-gray-900 mb-4">Enterprise</h4>
//             <p className="text-5xl font-extrabold text-gray-700 mb-6">$99<span className="text-xl text-gray-500">/month</span></p>
//             <ul className="text-gray-700 text-left mb-8 space-y-3">
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> All Premium Features</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Custom AI Models</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Advanced Document Drafting</li>
//               <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Dedicated Account Manager</li>
//             </ul>
//             <Link to="/register" className="block w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition-colors duration-200" target="_blank" rel="noopener noreferrer">
//               Contact Sales
//             </Link>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PricingPage;

// import React, { useState, useEffect, useCallback } from 'react';
// import { CheckIcon } from '@heroicons/react/20/solid';
// import { ArrowLeftIcon } from '@heroicons/react/24/outline';
// import { useNavigate } from 'react-router-dom';
// import PaymentForm from '../components/PaymentForm';
// import apiService from '../services/api'; // Import the apiService
// import { useAuth } from '../context/AuthContext'; // Assuming you have an AuthContext

// const PricingPage = () => {
//   const navigate = useNavigate();
//   const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' or 'yearly'
//   const [planType, setPlanType] = useState('individual'); // 'individual' or 'team'
//   const [plans, setPlans] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [showPaymentForm, setShowPaymentForm] = useState(false); // State to control payment form visibility
//   const [selectedPlan, setSelectedPlan] = useState(null); // State to store the selected plan

//   const fetchPlans = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const filters = {
//         type: planType === 'team' ? 'business' : planType, // Map 'team' to 'business'
//         interval: billingCycle === 'monthly' ? 'month' : 'year',
//       };
//       const response = await apiService.getPublicPlans(filters);
//       if (response && Array.isArray(response.data)) {
//         setPlans(response.data);
//       } else {
//         console.error('API response is not an array or missing data property:', response);
//         setError('Invalid data received from server.');
//       }
//     } catch (err) {
//       setError(err.message || 'Failed to fetch plans. Please try again later.');
//       console.error('Error fetching plans:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [planType, billingCycle]);

//   useEffect(() => {
//     fetchPlans();
//   }, [fetchPlans]);

//   const handleGoBack = () => {
//     navigate(-1); // Go back to the previous page
//   };

//   const handleSelectPlan = (plan) => {
//     setSelectedPlan(plan);
//     setShowPaymentForm(true);
//   };

//   const handleClosePaymentForm = () => {
//     setShowPaymentForm(false);
//     setSelectedPlan(null);
//   };

//   const handlePaymentSuccess = (planName) => {
//     // Update user's plan in local storage
//     const userInfo = JSON.parse(localStorage.getItem('userInfo'));
//     if (userInfo) {
//       userInfo.plan = planName;
//       localStorage.setItem('userInfo', JSON.stringify(userInfo));
//       // Dispatch a custom event to notify other components (like UserProfileMenu)
//       // that user info has changed. This is a workaround if direct context update isn't feasible.
//       window.dispatchEvent(new CustomEvent('userInfoUpdated'));
//     }
//     // Optionally, navigate away or show a success message
//     navigate('/dashboard'); // Redirect to dashboard after successful payment
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
//               className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md ${
//                 billingCycle === 'yearly'
//                   ? 'bg-gray-900 text-white'
//                   : 'bg-white text-gray-700 hover:bg-gray-50'
//               } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
//               onClick={() => setBillingCycle('yearly')}
//             >
//               Yearly
//             </button>
//           </div>
//         </div>

//         {loading && (
//           <div className="text-center text-gray-600 text-lg">Loading plans...</div>
//         )}

//         {error && (
//           <div className="text-center text-red-600 text-lg">{error}</div>
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
//                         {billingCycle === 'monthly' ? '/ month billed monthly' : '/ month billed annually'}
//                       </span>
//                     )}
//                   </div>
//                   <button
//                     onClick={() => handleSelectPlan(plan)}
//                     className={`w-full py-3 px-6 rounded-md text-base font-medium transition-colors duration-200 ${plan.buttonClass}`}
//                     disabled={plan.id === 'free'} // Disable button for free plan
//                   >
//                     {plan.buttonText}
//                   </button>
//                   <div className="mt-8 flex-1">
//                     <ul className="space-y-4">
//                       {plan.features.map((feature, index) => (
//                         <li key={index} className="flex items-start">
//                           <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-2" />
//                           <span className="text-gray-700 text-sm">{feature}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//       </div>

//       {showPaymentForm && selectedPlan && (
//         <PaymentForm
//           plan={selectedPlan}
//           onClose={handleClosePaymentForm}
//           onPaymentSuccess={handlePaymentSuccess}
//         />
//       )}
//     </div>
//   );
// };

// export default PricingPage;


import React, { useState, useEffect, useCallback } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api'; // Import the apiService
import { useAuth } from '../context/AuthContext'; // Assuming you have an AuthContext

// Razorpay Configuration (Replace with your actual values)
const RAZORPAY_KEY_ID = import.meta.env.VITE_APP_RAZORPAY_KEY_ID || 'rzp_test_R6mBF5iIMakFt1'; // Get from environment variables or replace directly
const BACKEND_BASE_URL = import.meta.env.VITE_APP_API_URL || 'https://gateway-service-110685455967.asia-south1.run.app/api';

const PricingPage = () => {
  console.log('SubscriptionPlanPage component rendered.');
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' or 'yearly'
  const [planType, setPlanType] = useState('individual'); // 'individual' or 'team'
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false); // State to control payment form visibility (will be removed later)
  const [selectedPlan, setSelectedPlan] = useState(null); // State to store the selected plan
  const { user, token } = useAuth(); // Get user and token from AuthContext

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch plans without specific type and interval filters, as the backend seems to prefer this.
      // The backend should return all available plans, and frontend can filter/display as needed.
      console.log('Calling apiService.getPublicPlans...');
      const response = await apiService.getPublicPlans();
      console.log('apiService.getPublicPlans response:', response);
      if (response && Array.isArray(response.data)) {
        // Filter plans based on selected planType and billingCycle
        const filteredPlans = response.data.filter(plan => {
          const matchesType = (planType === 'team' && plan.type === 'business') || (planType === 'individual' && plan.type === 'individual');
          const matchesInterval = (billingCycle === 'monthly' && plan.interval === 'month') ||
                                  (billingCycle === 'yearly' && plan.interval === 'year') ||
                                  (billingCycle === 'quarterly' && plan.interval === 'quarterly'); // Ensure backend uses 'quarterly'
          return matchesType && matchesInterval;
        });
        console.log('Filtered plans:', filteredPlans);
        setPlans(filteredPlans);
      } else {
        console.error('API response is not an array or missing data property:', response);
        setError('Invalid data received from server.');
      }
    } catch (err) {
      console.error('Error in fetchPlans:', err);
      setError(err.message || 'Failed to fetch plans. Please try again later.');
    } finally {
      setLoading(false);
      console.log('fetchPlans finished. Loading:', false);
    }
  }, [planType, billingCycle]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page
  };

  const handlePaymentSuccess = (planName) => {
    // Update user's plan in local storage (assuming planName is sufficient)
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (userInfo) {
      userInfo.plan = planName; // Or update with more detailed plan info if available
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      window.dispatchEvent(new CustomEvent('userInfoUpdated'));
    }
    navigate('/dashboard'); // Redirect to dashboard after successful payment
  };

  const handleSelectPlan = async (plan) => {
    if (!token) {
      setError('You must be logged in to subscribe to a plan.');
      navigate('/login'); // Redirect to login page
      return;
    }

    setSelectedPlan(plan);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/payments/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId: plan.id })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create Razorpay order.');
      }

      const order = data.order;
      const razorpaySubscription = data.razorpaySubscription;

      const options = {
        key: RAZORPAY_KEY_ID,
        subscription_id: razorpaySubscription.id,
        name: "NexintelAI Subscriptions",
        description: plan.name,
        image: "/src/assets/nexintel.jpg", // Assuming this is now the new logo
        handler: function (response) {
          console.log('Razorpay payment successful:', response);
          alert('Payment successful! Your subscription is now active.');
          handlePaymentSuccess(plan.name); // Call your success handler
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.contact || '' // Assuming user object has contact
        },
        notes: {
          user_id: user?.id || '',
          plan_id: plan.id
        },
        theme: {
          "color": "#1a202c" // Tailwind's gray-900
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response) {
        alert(`Payment Failed: ${response.error.description || 'Unknown error'}`);
        console.error('Razorpay payment failed:', response.error);
        setError(`Payment failed: ${response.error.description || 'Unknown error'}`);
      });

      rzp.open();

    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred during the subscription process.';
      setError(errorMessage);
      console.error('Error during subscription process:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={handleGoBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back
        </button>

        <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-12">
          Plans that grow with you
        </h1>

        {/* Plan Type Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium rounded-l-md ${
                planType === 'individual'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setPlanType('individual')}
            >
              Individual
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md ${
                planType === 'team'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setPlanType('team')}
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
              className={`py-2 px-4 text-sm font-medium rounded-l-md ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly
            </button>
            <button
              type="button"
              className={`-ml-px py-2 px-4 text-sm font-medium rounded-r-md ${
                billingCycle === 'quarterly'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } focus:z-10 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={() => setBillingCycle('quarterly')}
            >
              Quarterly
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center text-gray-600 text-lg">Loading plans...</div>
        )}

        {error && (
          <div className="text-center text-red-600 text-lg">Error: {error}</div>
        )}

        {!loading && !error && plans.length === 0 && (
          <div className="text-center text-gray-600 text-lg">No plans available for the selected criteria.</div>
        )}

        {/* Plan Cards */}
        {!loading && !error && plans.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => {
              const displayPrice = plan.price ? `$${plan.price}` : 'N/A';
              const isPriceZero = displayPrice === '$0';

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-lg shadow-md p-8 flex flex-col ${plan.highlightClass || ''}`}
                >
                  <div className="flex-shrink-0 mb-4">
                    {plan.icon ? (
                      plan.icon
                    ) : (
                      <svg className="h-12 w-12 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1L21 12h-4m-7 0h-4M7.21 14.77l-2.832 4.904A2 2 0 011.91 21h16.18a2 2 0 001.728-3.224L12.79 8.23" />
                      </svg>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
                  <p className="text-gray-500 text-sm mb-4">{plan.tagline}</p>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">
                      {displayPrice}
                    </span>
                    {!isPriceZero && (
                      <span className="ml-1 text-gray-500 text-base">
                        {billingCycle === 'monthly' ? '/ month billed monthly' : (billingCycle === 'yearly' ? '/ month billed annually' : '/ month billed quarterly')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 px-6 rounded-md text-base font-medium transition-colors duration-200 ${plan.buttonClass || 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    disabled={plan.id === 'free' || !plan.price} // Disable button for free plan or if no price
                  >
                    {plan.buttonText || 'Select Plan'}
                  </button>
                  <div className="mt-8 flex-1">
                    <ul className="space-y-4">
                      {plan.features ? (
                        // Check if features is a string and split it, otherwise assume it's an array
                        (typeof plan.features === 'string' ? plan.features.split(',').map(f => f.trim()) : plan.features).map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mr-2" />
                            <span className="text-gray-700 text-sm">{feature}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 text-sm">No features listed.</li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* PaymentForm is no longer directly used here as Razorpay Checkout handles the UI */}
    </div>
  );
};

export default PricingPage;