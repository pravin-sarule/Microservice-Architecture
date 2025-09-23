const pool = require('../config/db');
const axios = require('axios'); // Import axios for HTTP requests
const TokenUsageService = require('../services/tokenUsageService');

const DOCUMENT_SERVICE_URL = process.env.DOCUMENT_SERVICE_URL || 'http://localhost:5002';

/**
 * @description Retrieves detailed plan and resource information for the authenticated user.
 * @route GET /api/user-resources/plan-details
 */
exports.getPlanAndResourceDetails = async (req, res) => {
    console.log("DEBUG: getPlanAndResourceDetails - Controller entered.");
    try {
        const userId = req.user.id;
        console.log(`DEBUG: getPlanAndResourceDetails - User ID: ${userId}`);
        if (!userId) {
            console.log("DEBUG: getPlanAndResourceDetails - Unauthorized: No user ID.");
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { service } = req.query;

        // Get the active subscription for the user
        const subscriptionQuery = `
            SELECT
                sp.id AS plan_id,
                sp.name AS plan_name,
                sp.description,
                sp.price,
                sp.currency,
                sp.interval,
                sp.type,
                sp.token_limit,
                sp.carry_over_limit,
                sp.document_limit,
                sp.ai_analysis_limit,
                sp.template_access,
                sp.storage_limit_gb,
                sp.drafting_type,
                sp.limits,
                us.start_date,
                us.end_date,
                us.status AS subscription_status
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = $1
            ORDER BY us.start_date DESC
            LIMIT 1;
        `;
        const subscriptionResult = await pool.query(subscriptionQuery, [userId]);
        const activePlan = subscriptionResult.rows[0] || null;

        // Get all plan configurations
        const allPlansResult = await pool.query(`SELECT * FROM subscription_plans ORDER BY price ASC;`);
        const allPlanConfigurations = allPlansResult.rows;

        // Latest payment for the user
        const latestPaymentQuery = `
            SELECT
                id,
                amount,
                currency,
                status,
                payment_method,
                razorpay_payment_id,
                razorpay_order_id,
                subscription_id,
                TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS payment_date
            FROM payments
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1;
        `;
        const latestPaymentResult = await pool.query(latestPaymentQuery, [userId]);
        const latestPayment = latestPaymentResult.rows[0] || null;

        // If no active subscription, return zeroed resource usage
        if (!activePlan) {
            return res.status(200).json({
                activePlan: null,
                resourceUtilization: {
                    tokens: { remaining: 0, limit: 0, total_used: 0, percentage_used: 0, status: 'no_plan' },
                    queries: { remaining: 0, limit: 0, total_used: 0, percentage_used: 0, status: 'no_plan' },
                    documents: { used: 0, limit: 0, percentage_used: 0, status: 'no_plan' },
                    storage: { used_gb: 0, limit_gb: 0, percentage_used: 0, status: 'no_plan', note: "No active subscription found." }
                },
                allPlanConfigurations: allPlanConfigurations.map(plan => ({ ...plan, is_active_plan: false })),
                latestPayment
            });
        }

        // Get current token balance
        const currentTokenBalance = await TokenUsageService.getRemainingTokens(userId);

        // Fetch storage and document count from Document Service
        const apiGatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:5000";
        let totalStorageUsedBytes = 0;
        let totalStorageUsedGB = 0;
        let currentDocumentCount = 0;

        try {
            const storageResponse = await axios.get(`${apiGatewayUrl}/files/user-storage-utilization`, {
                headers: { Authorization: req.headers.authorization },
                timeout: 10000 // 10 seconds
            });
            totalStorageUsedBytes = storageResponse.data.storage.used_bytes || 0;
            totalStorageUsedGB = storageResponse.data.storage.used_gb || 0;
            currentDocumentCount = storageResponse.data.storage.document_count || 0;
        } catch (err) {
            console.error('❌ Error fetching storage and document utilization from Document Service:', err.message);
        }

        const planStorageLimitGB = activePlan.storage_limit_gb || 0;

        const calculateUtilization = (used, limit) => {
            if (limit === 0) return { used, limit, percentage_used: 0, status: 'unlimited' };
            const percentage = ((used / limit) * 100).toFixed(0);
            const status = used >= limit ? 'exceeded' : 'within_limit';
            return { used, limit, percentage_used: percentage, status };
        };

        const resourceUtilization = {
            tokens: calculateUtilization(activePlan.token_limit - currentTokenBalance, activePlan.token_limit),
            queries: calculateUtilization(activePlan.ai_analysis_limit - currentTokenBalance, activePlan.ai_analysis_limit),
            documents: calculateUtilization(currentDocumentCount, activePlan.document_limit),
            storage: {
                used_gb: totalStorageUsedGB,
                limit_gb: planStorageLimitGB,
                percentage_used: planStorageLimitGB > 0 ? ((totalStorageUsedBytes / (planStorageLimitGB * 1024 * 1024 * 1024)) * 100).toFixed(0) : 0,
                status: planStorageLimitGB > 0 && totalStorageUsedBytes >= (planStorageLimitGB * 1024 * 1024 * 1024) ? 'exceeded' : 'within_limit',
                note: planStorageLimitGB === 0 ? "No storage limit defined for this plan." : undefined
            }
        };

        const allPlanConfigurationsWithActiveFlag = allPlanConfigurations.map(plan => ({
            ...plan,
            is_active_plan: plan.id === activePlan.plan_id
        }));

        res.status(200).json({
            activePlan,
            resourceUtilization,
            allPlanConfigurations: allPlanConfigurationsWithActiveFlag,
            latestPayment
        });

    } catch (error) {
        console.error('❌ Error fetching plan and resource details:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

/**
 * @description Retrieves all transaction history (token usage and payments) for the authenticated user.
 * @route GET /api/user-resources/transactions
 */
exports.getUserTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`DEBUG: getUserTransactions - User ID: ${userId}`);
        if (!userId) {
            console.log("DEBUG: getUserTransactions - Unauthorized: No user ID.");
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const tokenLogsQuery = `
            SELECT
                id,
                tokens_used,
                action_description,
                used_at AS transaction_date,
                'token_usage' AS type
            FROM
                token_usage_logs
            WHERE
                user_id = $1
            ORDER BY
                used_at DESC;
        `;
        const tokenLogsResult = await pool.query(tokenLogsQuery, [userId]);

        const paymentsQuery = `
            SELECT
                id,
                amount,
                currency,
                status,
                payment_method,
                TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS transaction_date,
                'payment' AS type,
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature,
                TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS payment_date,
                subscription_id
            FROM
                payments
            WHERE
                user_id = $1
            ORDER BY
                created_at DESC;
        `;
        const paymentsResult = await pool.query(paymentsQuery, [userId]);

        const RAZORPAY_INVOICE_BASE_URL = process.env.RAZORPAY_INVOICE_BASE_URL || 'https://dashboard.razorpay.com/app/payments/';
        const paymentsWithInvoiceLinks = paymentsResult.rows.map(payment => ({
            ...payment,
            invoice_link: payment.razorpay_payment_id ? `${RAZORPAY_INVOICE_BASE_URL}${payment.razorpay_payment_id}` : null
        }));

        const allTransactions = [...tokenLogsResult.rows, ...paymentsWithInvoiceLinks];
        allTransactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        res.status(200).json({
            transactions: allTransactions
        });

    } catch (error) {
        console.error('❌ Error fetching user transactions:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

/**
 * @description Retrieves the resource utilization details for the authenticated user, including token, document, query, and storage usage.
 * @route GET /api/user-resources/resource-utilization
 */
exports.getUserResourceUtilization = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const subscriptionQuery = `
            SELECT
                sp.name AS plan_name,
                sp.token_limit,
                sp.ai_analysis_limit,
                sp.document_limit,
                sp.template_access,
                us.end_date
            FROM
                user_subscriptions us
            JOIN
                subscription_plans sp ON us.plan_id = sp.id
            WHERE
                us.user_id = $1 AND us.status = 'active';
        `;
        const subscriptionResult = await pool.query(subscriptionQuery, [userId]);

        if (subscriptionResult.rows.length === 0) {
            return res.status(404).json({ message: 'No active subscription found for this user.' });
        }

        const {
            plan_name,
            token_limit,
            ai_analysis_limit,
            document_limit,
            template_access,
            end_date
        } = subscriptionResult.rows[0];

        const tokenUsageQuery = `
            SELECT id, user_id, tokens_used, action_description, used_at, remaining_tokens
            FROM token_usage_logs
            WHERE user_id = $1
            ORDER BY used_at DESC;
        `;
        const tokenUsageResult = await pool.query(tokenUsageQuery, [userId]);
        const tokenUsageLogs = tokenUsageResult.rows;

        const currentTokenBalance = tokenUsageLogs.length > 0 ? tokenUsageLogs[0].remaining_tokens : token_limit;
        const totalTokensUsed = tokenUsageLogs.reduce((acc, row) => acc + row.tokens_used, 0);

        // Fetch storage and document utilization from the Document Service via API Gateway
        const apiGatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:5000";
        let totalStorageUsedBytes = 0;
        let totalStorageUsedGB = 0;
        let currentDocumentCount = 0;

        try {
            const storageResponse = await axios.get(`${apiGatewayUrl}/files/user-storage-utilization`, {
                headers: {
                    Authorization: req.headers.authorization,
                },
            });
            totalStorageUsedBytes = storageResponse.data.storage.used_bytes;
            totalStorageUsedGB = storageResponse.data.storage.used_gb;
            currentDocumentCount = storageResponse.data.storage.document_count; // Assuming document_count is also returned
        } catch (storageError) {
            console.error('❌ Error fetching storage and document utilization from Document Service:', storageError.message);
            // Proceed with default values if Document Service is unavailable
        }
        const maxStorageGB = (15 * 1024 * 1024 * 1024 / (1024 * 1024 * 1024)).toFixed(2); // Assuming 15GB global limit

        const tokenUsagePercentage = token_limit > 0 ? (((token_limit - currentTokenBalance) / token_limit) * 100).toFixed(0) : 0;
        const documentUsagePercentage = document_limit > 0 ? ((currentDocumentCount / document_limit) * 100).toFixed(0) : 0;
        const storageUsagePercentage = (maxStorageGB > 0 && totalStorageUsedBytes > 0) ? ((totalStorageUsedBytes / (maxStorageGB * 1024 * 1024 * 1024)) * 100).toFixed(0) : 0;

        res.status(200).json({
            planDetails: {
                plan_name,
                token_limit,
                ai_analysis_limit,
                document_limit,
                template_access,
                expiration_date: end_date
            },
            resourceUtilization: {
                tokens: {
                    remaining: currentTokenBalance,
                    total_allocated: token_limit,
                    total_used: totalTokensUsed,
                    percentage_used: tokenUsagePercentage,
                    expiration_date: end_date,
                    usage_history: tokenUsageLogs
                },
                documents: {
                    used: currentDocumentCount,
                    limit: document_limit,
                    percentage_used: documentUsagePercentage
                },
                queries: {
                    used: (token_limit - currentTokenBalance),
                    limit: ai_analysis_limit,
                    percentage_used: tokenUsagePercentage
                },
                storage: {
                    used_gb: totalStorageUsedGB,
                    limit_gb: maxStorageGB,
                    percentage_used: storageUsagePercentage,
                    note: "Storage limit is currently global (15GB). Per-plan storage limits require a 'storage_limit_gb' column in subscription_plans."
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching user resource utilization:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
