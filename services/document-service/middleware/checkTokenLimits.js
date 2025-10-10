// const TokenUsageService = require('../services/tokenUsageService');

// // Define costs for document upload and storage
// const DOCUMENT_UPLOAD_COST_TOKENS = 10; // Example: 10 tokens per document upload
// const DOCUMENT_STORAGE_COST_GB = 0.01; // Example: 0.01 GB per document (10 MB)

// /**
//  * Middleware to check token and resource limits before allowing document upload.
//  */
// const checkDocumentUploadLimits = async (req, res, next) => {
//     try {
//         const userId = req.userId; // Assuming userId is set by the auth middleware
//         if (!userId) {
//             return res.status(401).json({ message: 'Unauthorized: User ID not found.' });
//         }

//         const authorizationHeader = req.headers.authorization;
//         if (!authorizationHeader) {
//             return res.status(401).json({ message: 'Authorization header missing.' });
//         }

//         // Fetch user usage and plan details from the Document Service's TokenUsageService
//         const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

//         // Define resources requested for this operation
//         const requestedResources = {
//             tokens: DOCUMENT_UPLOAD_COST_TOKENS,
//             documents: 1, // One document being uploaded
//             storage_gb: DOCUMENT_STORAGE_COST_GB,
//         };

//         // Enforce limits using the TokenUsageService
//         const { allowed, message } = await TokenUsageService.enforceLimits(usage, plan, requestedResources);

//         if (!allowed) {
//             console.log(`❌ Document upload blocked for user ${userId}: ${message}`);
//             return res.status(403).json({ message: `Document upload failed: ${message}` });
//         }

//         // Attach usage details to the request for subsequent middleware/controllers
//         req.userUsage = usage;
//         req.userPlan = plan;
//         req.requestedResources = requestedResources; // Store for incrementing later

//         console.log(`✅ User ${userId} has sufficient resources for document upload.`);
//         next();

//     } catch (error) {
//         console.error('❌ Error in checkDocumentUploadLimits middleware:', error);
//         res.status(500).json({ message: 'Internal server error during limit check.' });
//     }
// };

// module.exports = {
//     checkDocumentUploadLimits,
//     DOCUMENT_UPLOAD_COST_TOKENS,
//     DOCUMENT_STORAGE_COST_GB
// };


// const TokenUsageService = require('../services/tokenUsageService');

// // Define costs for document upload and storage
// const DOCUMENT_UPLOAD_COST_TOKENS = 10; // 10 tokens per document upload
// const DOCUMENT_STORAGE_COST_GB = 0.01;  // 0.01 GB per document (10 MB)

// /**
//  * Middleware to check token and resource limits before allowing document upload.
//  */
// const checkDocumentUploadLimits = async (req, res, next) => {
//     try {
//         const userId = req.user?.id || req.userId; // Get from auth middleware
//         if (!userId) {
//             return res.status(401).json({ message: 'Unauthorized: User ID not found.' });
//         }

//         const authorizationHeader = req.headers.authorization;
//         if (!authorizationHeader) {
//             return res.status(401).json({ message: 'Authorization header missing.' });
//         }

//         // 1️⃣ Fetch user usage and plan
//         let { usage, plan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

//         // 2️⃣ Define resources required for this upload
//         const requestedResources = {
//             tokens: DOCUMENT_UPLOAD_COST_TOKENS,
//             documents: 1,
//             storage_gb: DOCUMENT_STORAGE_COST_GB,
//         };

//         // 3️⃣ Enforce limits
//         const limitCheck = await TokenUsageService.enforceLimits(userId, usage, plan, requestedResources);

//         if (!limitCheck.allowed) {
//             console.log(`❌ Document upload blocked for user ${userId}: ${limitCheck.message}`);
//             return res.status(403).json({ success: false, message: limitCheck.message, nextRenewalTime: limitCheck.nextRenewalTime });
//         }

//         // If tokens were just renewed by enforceLimits, refetch usage to get the updated state
//         if (limitCheck.renewed) {
//             console.log(`🔄 Tokens renewed for user ${userId} by middleware. Refetching usage.`);
//             const refreshed = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);
//             usage = refreshed.usage; // Update usage with renewed state
//             plan = refreshed.plan; // Plan might also be refreshed, though less likely to change
//         }

//         // Attach usage info for the controller to increment after upload
//         req.userUsage = usage;
//         req.userPlan = plan;
//         req.requestedResources = requestedResources;

//         console.log(`✅ User ${userId} has sufficient resources for document upload.`);
//         next();

//     } catch (error) {
//         console.error('❌ Error in checkDocumentUploadLimits middleware:', error);
//         res.status(500).json({ success: false, message: 'Internal server error during limit check.' });
//     }
// };

// module.exports = {
//     checkDocumentUploadLimits,
//     DOCUMENT_UPLOAD_COST_TOKENS,
//     DOCUMENT_STORAGE_COST_GB
// };


const TokenUsageService = require('../services/tokenUsageService');

// Define costs for document upload and storage
const DOCUMENT_UPLOAD_COST_TOKENS = 10; // 10 tokens per document upload
const DOCUMENT_STORAGE_COST_GB = 0.01;  // 0.01 GB per document (10 MB)

/**
 * Middleware to check token and resource limits before allowing document upload.
 */
const checkDocumentUploadLimits = async (req, res, next) => {
    try {
        // NOTE: Assuming req.user?.id or req.userId is correctly set by preceding auth middleware
        const userId = req.user?.id || req.userId; 
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User ID not found.' });
        }

        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            return res.status(401).json({ message: 'Authorization header missing.' });
        }

        // 1️⃣ Fetch user usage and plan
        let { usage, plan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

        // 2️⃣ Define resources required for this upload
        const requestedResources = {
            tokens: DOCUMENT_UPLOAD_COST_TOKENS,
            documents: 1,
            storage_gb: DOCUMENT_STORAGE_COST_GB,
        };

        // 3️⃣ Enforce limits, which includes the 4-hour token renewal logic
        const limitCheck = await TokenUsageService.enforceLimits(userId, usage, plan, requestedResources);

        if (!limitCheck.allowed) {
            console.log(`❌ Document upload blocked for user ${userId}: ${limitCheck.message}`);
            return res.status(403).json({ success: false, message: limitCheck.message, nextRenewalTime: limitCheck.nextRenewalTime });
        }

        // If tokens were just renewed by enforceLimits, we must refetch usage
        // to get the updated tokens_used (which is now 0) from the database.
        if (limitCheck.renewed) {
            console.log(`🔄 Tokens renewed for user ${userId} by middleware. Refetching usage.`);
            const refreshed = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);
            usage = refreshed.usage; // Update usage with renewed state
            plan = refreshed.plan; // Update plan
        }

        // Attach usage info for the controller to increment after successful upload
        req.userUsage = usage;
        req.userPlan = plan;
        req.requestedResources = requestedResources;

        console.log(`✅ User ${userId} has sufficient resources for document upload.`);
        next();

    } catch (error) {
        console.error('❌ Error in checkDocumentUploadLimits middleware:', error);
        // Log the full error but return a generic 500 status to the client
        res.status(500).json({ success: false, message: 'Internal server error during limit check.' });
    }
};

module.exports = {
    checkDocumentUploadLimits,
    DOCUMENT_UPLOAD_COST_TOKENS,
    DOCUMENT_STORAGE_COST_GB
};
