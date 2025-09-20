// import React, { useState, useEffect, useCallback } from 'react';
// import { CreditCard, Users, Calendar, TrendingUp, Download, Settings, AlertCircle, RefreshCw } from 'lucide-react';
// import html2pdf from 'html2pdf.js';
// import api from '../services/api'; // Import the API service

// const BillingAndUsagePage = () => {
//   const [activeTab, setActiveTab] = useState('overview');
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [planData, setPlanData] = useState(null); // Will now hold activePlan, resourceUtilization, allPlanConfigurations
//   const [allPlans, setAllPlans] = useState([]);
//   const [userSubscription, setUserSubscription] = useState(null);
//   const [transactions, setTransactions] = useState([]);
//   const [latestPayment, setLatestPayment] = useState(null); // New state for latest payment
//   const [loadingTransactions, setLoadingTransactions] = useState(false);
//   const [loadingPlans, setLoadingPlans] = useState(false);
//   const [loadingSubscription, setLoadingSubscription] = useState(false);
//   const [refreshTrigger, setRefreshTrigger] = useState(0); // New state to trigger re-fetches

//   // Fetch plan details, all available plans, and user's active subscription
//   const fetchPlanData = async () => {
//     try {
//       setLoadingPlans(true);
//       setLoadingSubscription(true);
//       setError(null);

//       console.log('Fetching all plan and resource details...');
//       const data = await api.getUserPlanDetails(); // Use the new API service method
      
//       console.log('Fetched plan and resource details (all):', data);
//       console.log('allPlanConfigurations from API:', data.allPlanConfigurations);
//       console.log('activePlan from API:', data.activePlan);
//       console.log('resourceUtilization from API:', data.resourceUtilization);
//       console.log('latestPayment from API:', data.latestPayment); // Log latestPayment

//       setPlanData(data); // Set the entire response data
//       setAllPlans(data.allPlanConfigurations || []);
//       setUserSubscription(data.activePlan || null);
//       setLatestPayment(data.latestPayment || null); // Set latest payment

//     } catch (err) {
//       setError(`Failed to fetch plan data: ${err.message}`);
//       console.error('Error fetching plan data:', err);
//       if (err.message.includes('Authentication required') || err.message.includes('session has expired')) {
//         localStorage.clear();
//         sessionStorage.clear();
//         // Optionally redirect to login
//         // window.location.href = '/login'; 
//       }
//     } finally {
//       setLoadingPlans(false);
//       setLoadingSubscription(false);
//     }
//   };

//   // Fetch user transactions (now payment history)
//   const fetchTransactions = async () => {
//     try {
//       setLoadingTransactions(true);
//       console.log('Fetching user payment history...');
//       const data = await api.fetchPaymentHistory(); // Use the new API service method
      
//       console.log('Fetched payment history data:', data);
//       if (data.data && Array.isArray(data.data)) { // Assuming data.data is the array of payments
//         data.data.forEach((t, i) => console.log(`Payment Transaction ${i}:`, t)); // Detailed log for debugging
//         setTransactions(data.data);
//       } else {
//         console.warn('No payment history array found in response');
//         setTransactions([]);
//       }
//     } catch (err) {
//       console.error('Error fetching payment history:', err);
//       setError(`Failed to fetch payment history: ${err.message}`);
//       setTransactions([]);
//     } finally {
//       setLoadingTransactions(false);
//     }
//   };

//   const loadAllData = useCallback(async () => {
//     setLoading(true);
//     try {
//       await Promise.all([
//         fetchPlanData(),
//         fetchTransactions(),
//       ]);
//     } catch (err) {
//       console.error('Error loading data:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, []); // Dependencies for useCallback if any, currently none as fetchPlanData and fetchTransactions are stable

//   useEffect(() => {
//     loadAllData();
//   }, [loadAllData, refreshTrigger]); // Add refreshTrigger to dependencies

//   const handleRefresh = () => {
//     setRefreshTrigger(prev => prev + 1); // Increment to trigger useEffect
//   };

//   const getUsagePercentage = (used, limit) => {
//     if (limit === 'Unlimited' || limit === null || limit === undefined || limit === 0) return 0;
//     return Math.min((used / limit) * 100, 100);
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return 'N/A';
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) {
//       return 'Invalid Date';
//     }
//     return date.toLocaleDateString('en-US', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     });
//   };

//   const formatCurrency = (amount, currency = 'INR') => { // Added currency parameter
//     if (amount === null || amount === undefined) return 'N/A';
//     return new Intl.NumberFormat('en-IN', {
//       style: 'currency',
//       currency: currency
//     }).format(amount);
//   };

//   const TabButton = ({ id, label, icon: Icon }) => (
//     <button
//       onClick={() => setActiveTab(id)}
//       className={`flex items-center px-6 py-3 font-medium transition-colors border rounded-lg ${
//         activeTab === id
//           ? 'bg-black text-white border-black'
//           : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
//       }`}
//     >
//       <Icon size={18} className="mr-2" />
//       {label}
//     </button>
//   );

//   const getTransactionAmountDisplay = (transaction) => {
//     // For payment history, amount is in smallest unit, so divide by 100
//     if (transaction.amount) {
//       return formatCurrency(parseFloat(transaction.amount) || 0, transaction.currency || 'INR');
//     }
//     return 'N/A'; 
//   };

//   const exportTransactionsToCSV = () => {
//     if (transactions.length === 0) {
//       alert('No transactions to export.');
//       return;
//     }

//     const headers = [
//       'Date', 'Description', 'Amount', 'Currency', 'Status', 'Payment Method', 'Invoice Number', 'Transaction Type', 'Razorpay Payment ID', 'Razorpay Order ID', 'Subscription ID'
//     ];
    
//     const csvRows = transactions.map(transaction => {
//       const description = transaction.plan_name || 'Subscription Payment'; // Use plan_name for description
//       const amountDisplay = getTransactionAmountDisplay(transaction);
//       const currency = transaction.currency || 'INR';
//       const status = transaction.payment_status || 'N/A'; // Use payment_status
//       const paymentMethod = transaction.payment_method || 'N/A';
//       const invoiceNumber = transaction.razorpay_payment_id || transaction.payment_id || 'N/A'; // Use razorpay_payment_id or payment_id for invoice
//       const type = 'payment'; // Assuming payment history items are always payments

//       return [
//         formatDate(transaction.payment_date || transaction.transaction_date), // Use payment_date for payment history
//         `"${description.replace(/"/g, '""')}"`,
//         amountDisplay,
//         currency,
//         status,
//         paymentMethod,
//         invoiceNumber,
//         type,
//         transaction.razorpay_payment_id || 'N/A',
//         transaction.razorpay_order_id || 'N/A', // Keep razorpay_order_id for completeness if available
//         transaction.user_subscription_id || 'N/A' // Use user_subscription_id
//       ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
//     });

//     const csvContent = [
//       headers.map(header => `"${header}"`).join(','),
//       ...csvRows
//     ].join('\n');

//     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//     const link = document.createElement('a');
//     if (link.download !== undefined) {
//       const url = URL.createObjectURL(blob);
//       link.setAttribute('href', url);
//       link.setAttribute('download', 'transactions_history.csv');
//       link.style.visibility = 'hidden';
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//     }
//   };

//   const downloadReceipt = (transaction) => {
//     const amountDisplay = getTransactionAmountDisplay(transaction);
//     const paymentMethodDisplay = transaction.payment_method || 'N/A';

//     const receiptHtml = `
//       <div style="font-family: 'Arial', sans-serif; padding: 40px; max-width: 750px; margin: auto; border: 1px solid #cccccc; border-radius: 10px; background-color: #f9f9f9; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
//         <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333333;">
//           <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="NexintelAI Logo" style="width: 180px; margin-bottom: 20px;"/>
//           <h1 style="color: #333333; font-size: 32px; margin: 0;">OFFICIAL PAYMENT RECEIPT</h1>
//           <p style="color: #666666; font-size: 16px; margin-top: 10px;">Thank you for your recent payment.</p>
//         </div>
        
//         <div style="margin-bottom: 30px;">
//           <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
//             <tr>
//               <td style="padding: 10px 0; color: #555; width: 40%; font-weight: bold;">Receipt Number:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.razorpay_payment_id || transaction.payment_id || 'N/A'}</td>
//             </tr>
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Date:</td>
//               <td style="padding: 10px 0; color: #333;">${formatDate(transaction.payment_date || transaction.transaction_date)}</td>
//             </tr>
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Description:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.plan_name || 'Subscription Payment'}</td>
//             </tr>
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Payment Method:</td>
//               <td style="padding: 10px 0; color: #333;">${paymentMethodDisplay}</td>
//             </tr>
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Payment Status:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.payment_status || 'N/A'}</td>
//             </tr>
//             ${transaction.razorpay_payment_id ? `
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Razorpay Payment ID:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.razorpay_payment_id}</td>
//             </tr>
//             ` : ''}
//             ${transaction.razorpay_order_id ? `
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Razorpay Order ID:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.razorpay_order_id}</td>
//             </tr>
//             ` : ''}
//             ${transaction.user_subscription_id ? `
//             <tr>
//               <td style="padding: 10px 0; color: #555; font-weight: bold;">Subscription ID:</td>
//               <td style="padding: 10px 0; color: #333;">${transaction.user_subscription_id}</td>
//             </tr>
//             ` : ''}
//           </table>
//         </div>

//         <div style="border-top: 2px solid #333333; padding-top: 25px; margin-top: 30px; text-align: right;">
//           <p style="font-size: 24px; color: #333333; margin: 0;"><strong>TOTAL PAID:</strong> ${amountDisplay}</p>
//           <p style="font-size: 16px; color: #28a745; margin-top: 10px;"><strong>Payment Status:</strong> ${transaction.payment_status || 'N/A'}</p>
//         </div>
        
//         <p style="text-align: center; margin-top: 50px; color: #888888; font-size: 13px;">This is an electronically generated receipt and does not require a signature.</p>
//         <p style="text-align: center; color: #aaaaaa; font-size: 12px;">Generated on ${formatDate(new Date())}</p>
//       </div>
//     `;

//     html2pdf().from(receiptHtml).set({
//       margin: 1,
//       filename: `receipt_${transaction.id || transaction.razorpay_payment_id || 'unknown'}.pdf`,
//       image: { type: 'jpeg', quality: 0.98 },
//       html2canvas: { scale: 2, useCORS: true }, // Added useCORS: true
//       jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
//     }).save();
//   };

//   const LoadingSpinner = () => (
//     <div className="flex justify-center items-center py-12">
//       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
//       <span className="ml-3 text-gray-600">Loading data...</span>
//     </div>
//   );

//   const ErrorMessage = () => (
//     <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
//       <div className="flex items-center">
//         <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
//         <h3 className="text-red-800 font-medium">Error loading data</h3>
//       </div>
//       <p className="text-red-700 mt-2">{error}</p>
//       {error && (error.includes('Authentication required') || error.includes('session has expired')) ? (
//         <div className="mt-4">
//           <p className="text-sm text-red-600 mb-2">Please ensure you are logged in and try again.</p>
//           <button
//             onClick={() => {
//               localStorage.clear();
//               sessionStorage.clear();
//               window.location.reload();
//             }}
//             className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors mr-2"
//           >
//             Refresh Page
//           </button>
//           <button
//             onClick={() => {
//               localStorage.clear();
//               sessionStorage.clear();
//               window.location.href = '/login';
//             }}
//             className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
//           >
//             Go to Login
//           </button>
//         </div>
//       ) : (
//         <button
//           onClick={() => {
//             fetchPlanData();
//             fetchTransactions();
//           }}
//           className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
//         >
//           Retry
//         </button>
//       )}
//     </div>
//   );

//   if (error && !planData) {
//     return (
//       <div className="p-8 bg-white min-h-screen">
//         <div className="max-w-7xl mx-auto">
//           <div className="mb-8 pb-6 border-b border-gray-200">
//             <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage Dashboard</h1>
//             <p className="text-gray-600">Comprehensive subscription management and usage analytics</p>
//           </div>
//           <ErrorMessage />
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-8 bg-white min-h-screen">
//       <div className="max-w-7xl mx-auto">
//         {/* Header */}
//         <div className="mb-8 pb-6 border-b border-gray-200 flex justify-between items-center">
//           <div>
//             <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage Dashboard</h1>
//             <p className="text-gray-600">Comprehensive subscription management and usage analytics</p>
//           </div>
//           <button
//             onClick={handleRefresh}
//             className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center"
//             disabled={loading || loadingPlans || loadingSubscription || loadingTransactions}
//           >
//             <RefreshCw size={18} className="mr-2" />
//             Refresh Data
//           </button>
//         </div>

//         {/* Navigation Tabs */}
//         <div className="flex flex-wrap gap-3 mb-8">
//           <TabButton id="overview" label="Overview" icon={TrendingUp} />
//           <TabButton id="usage" label="Usage Analytics" icon={Calendar} />
//           <TabButton id="history" label="Billing Records" icon={Download} />
//         </div>

//         {loading || loadingPlans || loadingSubscription ? (
//           <LoadingSpinner />
//         ) : (
//           <>
//             {/* Overview Tab */}
//             {activeTab === 'overview' && planData && userSubscription && (
//               <div className="space-y-8">
//                 {/* Current Plan Details */}
//                 <div className="bg-white border border-gray-300 rounded-lg p-8">
//                   <div className="flex justify-between items-start mb-6">
//                     <div>
//                       <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Subscription</h2>
//                       <p className="text-gray-600">Current plan configuration and billing details</p>
//                     </div>
//                     <button className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center">
//                       <Settings size={18} className="mr-2" />
//                       Manage Subscription
//                     </button>
//                   </div>
                  
//                   <div className="grid md:grid-cols-4 gap-6">
//                     <div className="border border-gray-200 rounded-lg p-6">
//                       <div className="text-sm text-gray-500 font-medium mb-2">PLAN TIER</div>
//                       <div className="text-2xl font-bold text-gray-900">
//                         {userSubscription.plan_name || userSubscription.name || 'Basic'}
//                       </div>
//                     </div>
//                     <div className="border border-gray-200 p-6">
//                       <div className="text-sm text-gray-500 font-medium mb-2">ACCOUNT TYPE</div>
//                       <div className="text-2xl font-bold text-gray-900">
//                         {userSubscription.type || userSubscription.accountType || 'Individual'}
//                       </div>
//                     </div>
//                     <div className="border border-gray-200 p-6">
//                       <div className="text-sm text-gray-500 font-medium mb-2">BILLING CYCLE</div>
//                       <div className="text-2xl font-bold text-gray-900">
//                         {userSubscription.interval || userSubscription.billingCycle || userSubscription.billing_cycle || 'Monthly'}
//                       </div>
//                     </div>
//                     <div className="border border-gray-200 p-6">
//                       <div className="text-sm text-gray-500 font-medium mb-2">MONTHLY COST</div>
//                       <div className="text-2xl font-bold text-gray-900">
//                         {userSubscription.price || userSubscription.cost ? 
//                           formatCurrency(userSubscription.price ?? userSubscription.cost, userSubscription.currency) : 'N/A'}
//                       </div>
//                     </div>
//                   </div>

//                   <div className="mt-8 pt-6 border-t border-gray-200">
//                     <div className="grid md:grid-cols-3 gap-4 text-sm">
//                       <div>
//                         <span className="text-gray-500">Next Billing Date:</span>{' '}
//                         <span className="font-semibold text-gray-900">
//                           {formatDate(userSubscription.end_date || userSubscription.nextBillingDate || userSubscription.next_billing_date)}
//                         </span>
//                       </div>
//                       <div>
//                         <span className="text-gray-500">Status:</span>{' '}
//                         <span className="font-semibold text-gray-900">
//                           {userSubscription.subscription_status || userSubscription.status || (userSubscription.is_active ? 'Active' : 'Inactive')}
//                         </span>
//                       </div>
//                       <div>
//                         <span className="text-gray-500">Plan Started:</span>{' '}
//                         <span className="font-semibold text-gray-900">
//                           {formatDate(userSubscription.start_date || userSubscription.startDate || userSubscription.created_at)}
//                         </span>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Latest Payment Details */}
//                 {latestPayment && (
//                   <div className="bg-white border border-gray-300 rounded-lg p-8">
//                     <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Payment</h2>
//                     <div className="grid md:grid-cols-4 gap-6">
//                       <div className="border border-gray-200 rounded-lg p-6">
//                         <div className="text-sm text-gray-500 font-medium mb-2">AMOUNT</div>
//                         <div className="text-2xl font-bold text-gray-900">
//                           {formatCurrency(parseFloat(latestPayment.amount) / 100, latestPayment.currency)}
//                         </div>
//                       </div>
//                       <div className="border border-gray-200 p-6">
//                         <div className="text-sm text-gray-500 font-medium mb-2">PAYMENT METHOD</div>
//                         <div className="text-2xl font-bold text-gray-900">
//                           {latestPayment.payment_method || 'N/A'}
//                         </div>
//                       </div>
//                       <div className="border border-gray-200 p-6">
//                         <div className="text-sm text-gray-500 font-medium mb-2">STATUS</div>
//                         <div className="text-2xl font-bold text-gray-900">
//                           {latestPayment.status || 'N/A'}
//                         </div>
//                       </div>
//                       <div className="border border-gray-200 p-6">
//                         <div className="text-sm text-gray-500 font-medium mb-2">PAYMENT DATE</div>
//                         <div className="text-2xl font-bold text-gray-900">
//                           {formatDate(latestPayment.payment_date)}
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 )}

//                 {/* Usage Summary */}
//                 <div className="bg-white border border-gray-300 rounded-lg p-8">
//                   <h2 className="text-2xl font-bold text-gray-900 mb-6">Resource Utilization</h2>
//                   <div className="grid md:grid-cols-4 gap-6">
//                     {planData.resourceUtilization && Object.entries(planData.resourceUtilization).map(([key, resourceData]) => {
//                       const used = resourceData?.total_used || resourceData?.used_gb || 0;
//                       const limit = resourceData?.limit || resourceData?.limit_gb;
//                       const percentage = parseFloat(resourceData?.percentage_used) || getUsagePercentage(used, limit); // Parse to float
                      
//                       return (
//                         <div key={key} className="border border-gray-200 rounded-lg p-6">
//                           <div className="flex justify-between items-center mb-4">
//                             <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
//                               {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
//                             </span>
//                             <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-1">
//                               {limit === 'Unlimited' || limit === null || limit === undefined ? 'UNLIMITED' : `${percentage.toFixed(0)}% USED`}
//                             </span>
//                           </div>
//                           <div className="text-2xl font-bold text-gray-900 mb-2">
//                             {key.toLowerCase().includes('storage') ? `${used} GB` : used.toLocaleString()}
//                           </div>
//                           <div className="text-sm text-gray-500">
//                             {limit === 'Unlimited' || limit === null || limit === undefined
//                               ? 'No restrictions'
//                               : `of ${limit.toLocaleString()}${key.toLowerCase().includes('storage') ? ' GB' : ''} limit`
//                             }
//                           </div>
//                           {limit !== 'Unlimited' && limit !== null && limit !== undefined && (
//                             <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
//                               <div
//                                 className={`h-2 rounded-full transition-all ${
//                                   percentage >= 90 ? 'bg-red-500' :
//                                   percentage >= 70 ? 'bg-yellow-500' :
//                                   'bg-green-500'
//                                 }`}
//                                 style={{ width: `${percentage}%` }}
//                               />
//                             </div>
//                           )}
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Usage Analytics Tab */}
//             {activeTab === 'usage' && planData && planData.resourceUtilization && (
//               <div className="bg-white border border-gray-300 rounded-lg">
//                 <div className="p-8 border-b border-gray-200">
//                   <h2 className="text-2xl font-bold text-gray-900 mb-2">Detailed Usage Analytics</h2>
//                   <p className="text-gray-600">Comprehensive breakdown of feature utilization and consumption metrics</p>
//                 </div>
//                 <div className="overflow-x-auto">
//                   <table className="w-full">
//                     <thead className="bg-gray-50 border-b border-gray-200">
//                       <tr>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Feature</th>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Current Usage</th>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Plan Allocation</th>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Utilization Rate</th>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Status</th>
//                         <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Last Updated</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-gray-200">
//                       {planData.resourceUtilization && Object.entries(planData.resourceUtilization).map(([feature, resourceData]) => {
//                         const used = resourceData?.total_used || resourceData?.used_gb || 0;
//                         const limit = resourceData?.limit || resourceData?.limit_gb;
//                         const percentage = parseFloat(resourceData?.percentage_used) || getUsagePercentage(used, limit); // Parse to float
//                         const status = percentage >= 90 ? 'Critical' : percentage >= 70 ? 'High' : 'Normal';
                        
//                         return (
//                           <tr key={feature} className="hover:bg-gray-50">
//                             <td className="px-8 py-6 whitespace-nowrap">
//                               <div className="text-base font-semibold text-gray-900">
//                                 {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}
//                               </div>
//                             </td>
//                             <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-medium">
//                               {feature.toLowerCase().includes('storage') ? `${used} GB` : used.toLocaleString()}
//                             </td>
//                             <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700">
//                               {limit === 'Unlimited' || limit === null || limit === undefined
//                                 ? 'Unlimited'
//                                 : `${limit.toLocaleString()}${feature.toLowerCase().includes('storage') ? ' GB' : ''}`
//                               }
//                             </td>
//                             <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700">
//                               {limit === 'Unlimited' || limit === null || limit === undefined ? 'N/A' : `${percentage.toFixed(1)}%`}
//                             </td>
//                             <td className="px-8 py-6 whitespace-nowrap">
//                               <span className={`px-3 py-1 text-sm font-bold rounded ${
//                                 status === 'Critical' ? 'text-red-600' :
//                                 status === 'High' ? 'text-yellow-600' :
//                                 'text-green-600'
//                               }`}>
//                                 {status}
//                               </span>
//                             </td>
//                             <td className="px-8 py-6 whitespace-nowrap text-base text-gray-500">
//                               {formatDate(resourceData?.latest_usage_details?.latest_usage_date || resourceData?.expiration_date) || 'Recently'}
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             )}

//             {/* Billing Records Tab */}
//             {activeTab === 'history' && (
//               <div className="bg-white border border-gray-300 rounded-lg">
//                 <div className="p-8 border-b border-gray-200 flex justify-between items-center">
//                   <div>
//                     <h2 className="text-2xl font-bold text-gray-900 mb-2">Billing Transaction History</h2>
//                     <p className="text-gray-600">Complete record of payments, invoices, and subscription changes</p>
//                   </div>
//                   <button
//                     onClick={exportTransactionsToCSV}
//                     className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center"
//                   >
//                     <Download size={18} className="mr-2" />
//                     Export Records
//                   </button>
//                 </div>
                
//                 {loadingTransactions ? (
//                   <LoadingSpinner />
//                 ) : (
//                   <div className="overflow-x-auto">
//                     {transactions.length === 0 ? (
//                       <div className="text-center py-12">
//                         <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
//                         <h3 className="text-xl font-semibold text-gray-900 mb-2">No Transaction History</h3>
//                         <p className="text-gray-600">Your transaction history will appear here once you make your first payment.</p>
//                       </div>
//                     ) : (
//                       <table className="w-full">
//                         <thead className="bg-gray-50 border-b border-gray-200">
//                           <tr>
//                             <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Date</th>
//                             <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Description</th>
//                             <th className="px-8 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wide">Amount</th>
//                             <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Status</th>
//                             <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Payment Method</th>
//                             <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Invoice</th>
//                             <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Actions</th>
//                           </tr>
//                         </thead>
//                         <tbody className="divide-y divide-gray-200">
//                           {transactions.map((transaction, index) => (
//                             <tr key={`${transaction.id || 'no-id'}-${transaction.razorpay_payment_id || 'no-razorpay'}-${index}`} className="hover:bg-gray-50">
//                               <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-medium">
//                                 {formatDate(transaction.payment_date || transaction.transaction_date)}
//                               </td>
//                               <td className="px-8 py-6 text-base text-gray-900 font-semibold">
//                                 {transaction.plan_name || 'Subscription Payment'}
//                               </td>
//                               <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 text-right font-medium">
//                                 {getTransactionAmountDisplay(transaction)}
//                               </td>
//                               <td className="px-8 py-6 whitespace-nowrap text-center">
//                                 <span className={`px-3 py-1 text-sm font-bold rounded ${
//                                   transaction.payment_status === 'captured'
//                                     ? 'bg-green-100 text-green-800'
//                                     : transaction.payment_status === 'pending' || transaction.payment_status === 'authorized'
//                                     ? 'bg-yellow-100 text-yellow-800'
//                                     : 'bg-red-100 text-red-800'
//                                 }`}>
//                                   {transaction.payment_status || 'N/A'}
//                                 </span>
//                               </td>
//                               <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 text-center">
//                                 {transaction.payment_method || 'N/A'}
//                               </td>
//                               <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-mono text-center">
//                                 {transaction.razorpay_payment_id || transaction.payment_id || 'N/A'}
//                               </td>
//                               <td className="px-8 py-6 whitespace-nowrap text-center">
//                                 {transaction.invoice_link && (
//                                   <a
//                                     href={transaction.invoice_link}
//                                     target="_blank"
//                                     rel="noopener noreferrer"
//                                     className="bg-black text-white px-4 py-2 text-sm font-medium rounded hover:bg-gray-800 transition-colors mr-2"
//                                   >
//                                     View Invoice
//                                   </a>
//                                 )}
//                                 <button
//                                   onClick={() => downloadReceipt(transaction)}
//                                   className="border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
//                                 >
//                                   Download Receipt
//                                 </button>
//                               </td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     )}
//                   </div>
//                 )}
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default BillingAndUsagePage;

import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Users, Calendar, TrendingUp, Download, Settings, AlertCircle, RefreshCw } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import api from '../services/api'; // Import the API service

const BillingAndUsagePage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [allPlans, setAllPlans] = useState([]);
  const [userSubscription, setUserSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [latestPayment, setLatestPayment] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch plan details, all available plans, and user's active subscription
  const fetchPlanData = async () => {
    try {
      setLoadingPlans(true);
      setLoadingSubscription(true);
      setError(null);

      console.log('Fetching all plan and resource details...');
      const data = await api.getUserPlanDetails();
      
      console.log('Fetched plan and resource details (all):', data);
      console.log('allPlanConfigurations from API:', data.allPlanConfigurations);
      console.log('activePlan from API:', data.activePlan);
      console.log('resourceUtilization from API:', data.resourceUtilization);
      console.log('latestPayment from API:', data.latestPayment);

      // Validate and set the data with proper fallbacks
      setPlanData(data);
      setAllPlans(Array.isArray(data.allPlanConfigurations) ? data.allPlanConfigurations : []);
      
      // Handle active plan data more robustly
      const activePlan = data.activePlan || data.userSubscription || data.subscription;
      if (activePlan) {
        // Normalize the subscription data structure
        const normalizedSubscription = {
          id: activePlan.id || activePlan.subscription_id,
          plan_name: activePlan.plan_name || activePlan.planName || activePlan.name,
          type: activePlan.type || activePlan.accountType || activePlan.subscription_type,
          interval: activePlan.interval || activePlan.billingCycle || activePlan.billing_cycle || activePlan.billing_interval,
          price: activePlan.price || activePlan.cost || activePlan.amount,
          currency: activePlan.currency || 'INR',
          status: activePlan.subscription_status || activePlan.status || (activePlan.is_active ? 'active' : 'inactive'),
          start_date: activePlan.start_date || activePlan.startDate || activePlan.created_at,
          end_date: activePlan.end_date || activePlan.nextBillingDate || activePlan.next_billing_date || activePlan.expires_at,
          is_active: activePlan.is_active !== undefined ? activePlan.is_active : (activePlan.status === 'active'),
          // Add additional fields that might be present
          ...activePlan
        };
        setUserSubscription(normalizedSubscription);
      } else {
        console.warn('No active subscription found in API response');
        setUserSubscription(null);
      }

      // Handle latest payment data
      const payment = data.latestPayment || data.lastPayment || data.recentPayment;
      if (payment) {
        const normalizedPayment = {
          id: payment.id || payment.payment_id,
          amount: payment.amount || payment.total_amount,
          currency: payment.currency || 'INR',
          status: payment.status || payment.payment_status || payment.state,
          payment_method: payment.payment_method || payment.method,
          payment_date: payment.payment_date || payment.created_at || payment.date,
          razorpay_payment_id: payment.razorpay_payment_id || payment.gateway_payment_id,
          razorpay_order_id: payment.razorpay_order_id || payment.gateway_order_id,
          plan_name: payment.plan_name || payment.description,
          ...payment
        };
        setLatestPayment(normalizedPayment);
      } else {
        setLatestPayment(null);
      }

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch plan data';
      setError(`Failed to fetch plan data: ${errorMessage}`);
      console.error('Error fetching plan data:', err);
      
      // Handle authentication errors
      if (err.response?.status === 401 || errorMessage.includes('Authentication required') || errorMessage.includes('session has expired')) {
        localStorage.clear();
        sessionStorage.clear();
        // Optionally redirect to login
        // window.location.href = '/login'; 
      }
    } finally {
      setLoadingPlans(false);
      setLoadingSubscription(false);
    }
  };

  // Fetch user transactions (payment history)
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      console.log('Fetching user payment history...');
      const data = await api.fetchPaymentHistory();
      
      console.log('Fetched payment history data:', data);
      
      // Handle different response structures
      let paymentArray = [];
      if (data.data && Array.isArray(data.data)) {
        paymentArray = data.data;
      } else if (Array.isArray(data.payments)) {
        paymentArray = data.payments;
      } else if (Array.isArray(data.transactions)) {
        paymentArray = data.transactions;
      } else if (Array.isArray(data)) {
        paymentArray = data;
      } else {
        console.warn('No payment history array found in response:', data);
        paymentArray = [];
      }

      // Normalize transaction data structure
      const normalizedTransactions = paymentArray.map((transaction, index) => {
        console.log(`Processing transaction ${index}:`, transaction);
        return {
          id: transaction.id || transaction.payment_id || transaction.transaction_id || `tx-${index}`,
          amount: transaction.amount || transaction.total_amount || transaction.paid_amount,
          currency: transaction.currency || 'INR',
          payment_status: transaction.payment_status || transaction.status || transaction.state,
          payment_method: transaction.payment_method || transaction.method || transaction.payment_type,
          payment_date: transaction.payment_date || transaction.created_at || transaction.date || transaction.transaction_date,
          plan_name: transaction.plan_name || transaction.description || transaction.plan || 'Subscription Payment',
          razorpay_payment_id: transaction.razorpay_payment_id || transaction.gateway_payment_id || transaction.payment_id,
          razorpay_order_id: transaction.razorpay_order_id || transaction.gateway_order_id || transaction.order_id,
          user_subscription_id: transaction.user_subscription_id || transaction.subscription_id,
          invoice_link: transaction.invoice_link || transaction.invoice_url || transaction.receipt_url,
          // Keep original data for fallback
          ...transaction
        };
      });

      setTransactions(normalizedTransactions);
      console.log('Normalized transactions:', normalizedTransactions);
      
    } catch (err) {
      console.error('Error fetching payment history:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch payment history';
      setError(`Failed to fetch payment history: ${errorMessage}`);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      await Promise.all([
        fetchPlanData(),
        fetchTransactions(),
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getUsagePercentage = (used, limit) => {
    if (!limit || limit === 'Unlimited' || limit === null || limit === undefined || limit === 0) return 0;
    const usedNum = parseFloat(used) || 0;
    const limitNum = parseFloat(limit) || 0;
    if (limitNum === 0) return 0;
    return Math.min((usedNum / limitNum) * 100, 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount, currency = 'INR') => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(numAmount);
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-6 py-3 font-medium transition-colors border rounded-lg ${
        activeTab === id
          ? 'bg-black text-white border-black'
          : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} className="mr-2" />
      {label}
    </button>
  );

  const getTransactionAmountDisplay = (transaction) => {
    if (!transaction.amount) return 'N/A';
    
    let amount = parseFloat(transaction.amount);
    
    // Check if amount is in smallest unit (paise for INR)
    // If amount is greater than 1000 and looks like it's in paise, convert to rupees
    if (amount > 1000 && !transaction.amount_in_rupees) {
      amount = amount / 100;
    }
    
    return formatCurrency(amount, transaction.currency || 'INR');
  };

  const exportTransactionsToCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = [
      'Date', 'Description', 'Amount', 'Currency', 'Status', 'Payment Method', 
      'Invoice Number', 'Transaction Type', 'Razorpay Payment ID', 'Razorpay Order ID', 'Subscription ID'
    ];
    
    const csvRows = transactions.map(transaction => {
      const description = transaction.plan_name || 'Subscription Payment';
      const amountDisplay = getTransactionAmountDisplay(transaction);
      const currency = transaction.currency || 'INR';
      const status = transaction.payment_status || 'N/A';
      const paymentMethod = transaction.payment_method || 'N/A';
      const invoiceNumber = transaction.razorpay_payment_id || transaction.id || 'N/A';
      const type = 'payment';

      return [
        formatDate(transaction.payment_date),
        `"${description.replace(/"/g, '""')}"`,
        amountDisplay,
        currency,
        status,
        paymentMethod,
        invoiceNumber,
        type,
        transaction.razorpay_payment_id || 'N/A',
        transaction.razorpay_order_id || 'N/A',
        transaction.user_subscription_id || 'N/A'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [
      headers.map(header => `"${header}"`).join(','),
      ...csvRows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadReceipt = (transaction) => {
    const amountDisplay = getTransactionAmountDisplay(transaction);
    const paymentMethodDisplay = transaction.payment_method || 'N/A';

    const receiptHtml = `
      <div style="font-family: 'Arial', sans-serif; padding: 40px; max-width: 750px; margin: auto; border: 1px solid #cccccc; border-radius: 10px; background-color: #f9f9f9; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333333;">
          <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="NexintelAI Logo" style="width: 180px; margin-bottom: 20px;"/>
          <h1 style="color: #333333; font-size: 32px; margin: 0;">OFFICIAL PAYMENT RECEIPT</h1>
          <p style="color: #666666; font-size: 16px; margin-top: 10px;">Thank you for your recent payment.</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px 0; color: #555; width: 40%; font-weight: bold;">Receipt Number:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.razorpay_payment_id || transaction.id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Date:</td>
              <td style="padding: 10px 0; color: #333;">${formatDate(transaction.payment_date)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Description:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.plan_name || 'Subscription Payment'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Payment Method:</td>
              <td style="padding: 10px 0; color: #333;">${paymentMethodDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Payment Status:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.payment_status || 'N/A'}</td>
            </tr>
            ${transaction.razorpay_payment_id ? `
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Razorpay Payment ID:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.razorpay_payment_id}</td>
            </tr>
            ` : ''}
            ${transaction.razorpay_order_id ? `
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Razorpay Order ID:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.razorpay_order_id}</td>
            </tr>
            ` : ''}
            ${transaction.user_subscription_id ? `
            <tr>
              <td style="padding: 10px 0; color: #555; font-weight: bold;">Subscription ID:</td>
              <td style="padding: 10px 0; color: #333;">${transaction.user_subscription_id}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="border-top: 2px solid #333333; padding-top: 25px; margin-top: 30px; text-align: right;">
          <p style="font-size: 24px; color: #333333; margin: 0;"><strong>TOTAL PAID:</strong> ${amountDisplay}</p>
          <p style="font-size: 16px; color: #28a745; margin-top: 10px;"><strong>Payment Status:</strong> ${transaction.payment_status || 'N/A'}</p>
        </div>
        
        <p style="text-align: center; margin-top: 50px; color: #888888; font-size: 13px;">This is an electronically generated receipt and does not require a signature.</p>
        <p style="text-align: center; color: #aaaaaa; font-size: 12px;">Generated on ${formatDate(new Date())}</p>
      </div>
    `;

    html2pdf().from(receiptHtml).set({
      margin: 1,
      filename: `receipt_${transaction.id || transaction.razorpay_payment_id || 'unknown'}_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    }).save();
  };

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      <span className="ml-3 text-gray-600">Loading data...</span>
    </div>
  );

  const ErrorMessage = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
      <div className="flex items-center">
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <h3 className="text-red-800 font-medium">Error loading data</h3>
      </div>
      <p className="text-red-700 mt-2">{error}</p>
      {error && (error.includes('Authentication required') || error.includes('session has expired') || error.includes('401')) ? (
        <div className="mt-4">
          <p className="text-sm text-red-600 mb-2">Please ensure you are logged in and try again.</p>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors mr-2"
          >
            Refresh Page
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/login';
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      ) : (
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );

  if (error && !planData && !loading) {
    return (
      <div className="p-8 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage Dashboard</h1>
            <p className="text-gray-600">Comprehensive subscription management and usage analytics</p>
          </div>
          <ErrorMessage />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage Dashboard</h1>
            <p className="text-gray-600">Comprehensive subscription management and usage analytics</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || loadingPlans || loadingSubscription || loadingTransactions}
          >
            <RefreshCw size={18} className="mr-2" />
            Refresh Data
          </button>
        </div>

        {/* Show error if present */}
        {error && <ErrorMessage />}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          <TabButton id="overview" label="Overview" icon={TrendingUp} />
          <TabButton id="usage" label="Usage Analytics" icon={Calendar} />
          <TabButton id="history" label="Billing Records" icon={Download} />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Current Plan Details */}
                {userSubscription && (
                  <div className="bg-white border border-gray-300 rounded-lg p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Subscription</h2>
                        <p className="text-gray-600">Current plan configuration and billing details</p>
                      </div>
                      <button className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center">
                        <Settings size={18} className="mr-2" />
                        Manage Subscription
                      </button>
                    </div>
                    
                    <div className="grid md:grid-cols-4 gap-6">
                      <div className="border border-gray-200 rounded-lg p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">PLAN TIER</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userSubscription.plan_name || 'Basic'}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">ACCOUNT TYPE</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userSubscription.type || 'Individual'}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">BILLING CYCLE</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userSubscription.interval || 'Monthly'}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">MONTHLY COST</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {userSubscription.price ? 
                            formatCurrency(userSubscription.price, userSubscription.currency) : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Next Billing Date:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {formatDate(userSubscription.end_date)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>{' '}
                          <span className={`font-semibold px-2 py-1 rounded text-xs ${
                            userSubscription.status === 'active' || userSubscription.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {userSubscription.status || (userSubscription.is_active ? 'Active' : 'Inactive')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Plan Started:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {formatDate(userSubscription.start_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Latest Payment Details */}
                {latestPayment && (
                  <div className="bg-white border border-gray-300 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Payment</h2>
                    <div className="grid md:grid-cols-4 gap-6">
                      <div className="border border-gray-200 rounded-lg p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">AMOUNT</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {getTransactionAmountDisplay(latestPayment)}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">PAYMENT METHOD</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {latestPayment.payment_method || 'N/A'}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">STATUS</div>
                        <div className={`text-2xl font-bold ${
                          latestPayment.status === 'captured' || latestPayment.status === 'completed'
                            ? 'text-green-600'
                            : latestPayment.status === 'pending'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {latestPayment.status || 'N/A'}
                        </div>
                      </div>
                      <div className="border border-gray-200 p-6">
                        <div className="text-sm text-gray-500 font-medium mb-2">PAYMENT DATE</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatDate(latestPayment.payment_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage Summary */}
                {planData && planData.resourceUtilization && (
                  <div className="bg-white border border-gray-300 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Resource Utilization</h2>
                    <div className="grid md:grid-cols-4 gap-6">
                      {Object.entries(planData.resourceUtilization).map(([key, resourceData]) => {
                        const used = resourceData?.total_used || resourceData?.used_gb || resourceData?.used || 0;
                        const limit = resourceData?.limit || resourceData?.limit_gb;
                        const percentage = parseFloat(resourceData?.percentage_used) || getUsagePercentage(used, limit);
                        
                        return (
                          <div key={key} className="border border-gray-200 rounded-lg p-6">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                              </span>
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-1">
                                {limit === 'Unlimited' || limit === null || limit === undefined ? 'UNLIMITED' : `${percentage.toFixed(0)}% USED`}
                              </span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 mb-2">
                              {key.toLowerCase().includes('storage') ? `${used} GB` : used.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {limit === 'Unlimited' || limit === null || limit === undefined
                                ? 'No restrictions'
                                : `of ${limit.toLocaleString()}${key.toLowerCase().includes('storage') ? ' GB' : ''} limit`
                              }
                            </div>
                            {limit !== 'Unlimited' && limit !== null && limit !== undefined && (
                              <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    percentage >= 90 ? 'bg-red-500' :
                                    percentage >= 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No Subscription Message */}
                {!userSubscription && !loadingSubscription && (
                  <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
                    <CreditCard size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Subscription</h3>
                    <p className="text-gray-600 mb-6">You don't have an active subscription. Choose a plan to get started.</p>
                    <button className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors">
                      View Available Plans
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Usage Analytics Tab */}
            {activeTab === 'usage' && (
              <div className="bg-white border border-gray-300 rounded-lg">
                <div className="p-8 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Detailed Usage Analytics</h2>
                  <p className="text-gray-600">Comprehensive breakdown of feature utilization and consumption metrics</p>
                </div>
                
                {planData && planData.resourceUtilization ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Feature</th>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Current Usage</th>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Plan Allocation</th>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Utilization Rate</th>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Status</th>
                          <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(planData.resourceUtilization).map(([feature, resourceData]) => {
                          const used = resourceData?.total_used || resourceData?.used_gb || resourceData?.used || 0;
                          const limit = resourceData?.limit || resourceData?.limit_gb;
                          const percentage = parseFloat(resourceData?.percentage_used) || getUsagePercentage(used, limit);
                          const status = percentage >= 90 ? 'Critical' : percentage >= 70 ? 'High' : 'Normal';
                          
                          return (
                            <tr key={feature} className="hover:bg-gray-50">
                              <td className="px-8 py-6 whitespace-nowrap">
                                <div className="text-base font-semibold text-gray-900">
                                  {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}
                                </div>
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-medium">
                                {feature.toLowerCase().includes('storage') ? `${used} GB` : used.toLocaleString()}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700">
                                {limit === 'Unlimited' || limit === null || limit === undefined
                                  ? 'Unlimited'
                                  : `${limit.toLocaleString()}${feature.toLowerCase().includes('storage') ? ' GB' : ''}`
                                }
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700">
                                {limit === 'Unlimited' || limit === null || limit === undefined ? 'N/A' : `${percentage.toFixed(1)}%`}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap">
                                <span className={`px-3 py-1 text-sm font-bold rounded ${
                                  status === 'Critical' ? 'bg-red-100 text-red-800' :
                                  status === 'High' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-500">
                                {formatDate(resourceData?.latest_usage_details?.latest_usage_date || resourceData?.last_updated || resourceData?.updated_at) || 'Recently'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Usage Data Available</h3>
                    <p className="text-gray-600">Usage analytics will appear here once you start using our services.</p>
                  </div>
                )}
              </div>
            )}

            {/* Billing Records Tab */}
            {activeTab === 'history' && (
              <div className="bg-white border border-gray-300 rounded-lg">
                <div className="p-8 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Billing Transaction History</h2>
                    <p className="text-gray-600">Complete record of payments, invoices, and subscription changes</p>
                  </div>
                  <button
                    onClick={exportTransactionsToCSV}
                    disabled={transactions.length === 0}
                    className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={18} className="mr-2" />
                    Export Records
                  </button>
                </div>
                
                {loadingTransactions ? (
                  <LoadingSpinner />
                ) : (
                  <div className="overflow-x-auto">
                    {transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Transaction History</h3>
                        <p className="text-gray-600">Your transaction history will appear here once you make your first payment.</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Date</th>
                            <th className="px-8 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wide">Description</th>
                            <th className="px-8 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wide">Amount</th>
                            <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Status</th>
                            <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Payment Method</th>
                            <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Invoice</th>
                            <th className="px-8 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {transactions.map((transaction, index) => (
                            <tr key={`${transaction.id}-${index}`} className="hover:bg-gray-50">
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-medium">
                                {formatDate(transaction.payment_date)}
                              </td>
                              <td className="px-8 py-6 text-base text-gray-900 font-semibold">
                                {transaction.plan_name}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 text-right font-medium">
                                {getTransactionAmountDisplay(transaction)}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-center">
                                <span className={`px-3 py-1 text-sm font-bold rounded ${
                                  transaction.payment_status === 'captured' || transaction.payment_status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : transaction.payment_status === 'pending' || transaction.payment_status === 'authorized'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : transaction.payment_status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.payment_status || 'N/A'}
                                </span>
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 text-center">
                                {transaction.payment_method || 'N/A'}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-base text-gray-700 font-mono text-center">
                                {transaction.razorpay_payment_id || transaction.id || 'N/A'}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-center">
                                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                  {transaction.invoice_link && (
                                    <a
                                      href={transaction.invoice_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-black text-white px-3 py-2 text-sm font-medium rounded hover:bg-gray-800 transition-colors"
                                    >
                                      View Invoice
                                    </a>
                                  )}
                                  <button
                                    onClick={() => downloadReceipt(transaction)}
                                    className="border border-gray-300 text-gray-700 px-3 py-2 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                                  >
                                    Download Receipt
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BillingAndUsagePage;