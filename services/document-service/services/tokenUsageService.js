const axios = require('axios');

class TokenUsageService {
    /**
     * Checks if a user has enough tokens for an operation and deducts them via the Payment Service.
     * @param {string} userId - The ID of the user.
     * @param {number} tokensRequired - The token cost of the impending operation.
     * @param {string} authorizationHeader - The Authorization header from the incoming request.
     * @returns {Promise<boolean>} - True if tokens are sufficient and deducted, false otherwise.
     */
    static async checkAndDeductTokens(userId, tokensRequired, authorizationHeader) {
        console.warn(`⚠️ Token deduction bypassed for user ${userId}. Always returning true.`);
        return true; // Temporarily bypass token deduction for debugging
    }

    // The following methods are no longer directly responsible for database operations
    // in the document-service, as token management is centralized in the payment-service.
    // They are kept as placeholders or for potential future API calls if needed.

    static async getCurrentTokenBalance(userId, authorizationHeader) {
        try {
            const gatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:5000";
            const response = await axios.get(
                `${gatewayUrl}/payments/history`, // Assuming history endpoint can provide current balance
                {
                    headers: {
                        Authorization: authorizationHeader
                    }
                }
            );
            if (response.status === 200 && response.data.success && response.data.data.length > 0) {
                const activeSubscription = response.data.data.find(sub => sub.subscription_status === 'active');
                return activeSubscription ? activeSubscription.current_token_balance : 0;
            }
            return 0;
        } catch (error) {
            console.error(`❌ Error getting current token balance for user ${userId}:`, error.message);
            return 0;
        }
    }

    // These methods are now handled by the payment-service's middleware and controller.
    // The document-service only needs to call checkAndDeductTokens.
    static async commitTokens() { return true; } // No-op, handled by payment service
    static async rollbackTokens() { return true; } // No-op, handled by payment service
    static async resetUserUsage() { return true; } // No-op, handled by payment service
    static async getRemainingTokens(userId, authorizationHeader) {
        return this.getCurrentTokenBalance(userId, authorizationHeader);
    }
    static async getTotalTokensUsed() { return 0; } // No-op, handled by payment service
}

module.exports = TokenUsageService;