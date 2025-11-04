
const pool = require('../config/db');
const axios = require('axios');
const moment = require('moment-timezone');

const TIMEZONE = 'Asia/Calcutta'; // IST
const DEFAULT_TOKEN_RENEWAL_INTERVAL_HOURS = 9.5; // fallback cooldown

class TokenUsageService {

    // --- Fetch user's usage and real plan ---
    static async getUserUsageAndPlan(userId, authorizationHeader) {
        let client;
        try {
            client = await pool.connect();

            // 1️⃣ Fetch usage from DB
            const usageRes = await client.query(
                'SELECT * FROM user_usage WHERE user_id = $1',
                [userId]
            );
            let userUsage = usageRes.rows[0];

            // 2️⃣ Fetch real plan from API (no Free Plan fallback)
            const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
            let userPlan;
            try {
                const planResp = await axios.get(
                    `${gatewayUrl}/user-resources/user-plan/${userId}`,
                    { headers: { Authorization: authorizationHeader } }
                );
                userPlan = planResp.data?.data;

                if (!userPlan) {
                    throw new Error(`User plan not found for user ${userId}`);
                }
            } catch (err) {
                throw new Error(`Failed to retrieve user plan: ${err.response?.status} ${err.message}`);
            }

            // 3️⃣ Map interval
            const intervalMap = { 'day': 'daily', 'week': 'weekly', 'month': 'monthly', 'year': 'yearly' };
            const planInterval = intervalMap[userPlan.interval] || 'monthly';

            const nowUTC = moment.utc();
            const nowIST = nowUTC.clone().tz(TIMEZONE);
            let periodStart, periodEnd;

            switch (planInterval) {
                case 'daily':
                    periodStart = nowIST.clone().startOf('day').utc();
                    periodEnd = nowIST.clone().endOf('day').utc();
                    break;
                case 'weekly':
                    periodStart = nowIST.clone().startOf('isoWeek').utc();
                    periodEnd = nowIST.clone().endOf('isoWeek').utc();
                    break;
                case 'monthly':
                    periodStart = nowIST.clone().startOf('month').utc();
                    periodEnd = nowIST.clone().endOf('month').utc();
                    break;
                case 'yearly':
                    periodStart = nowIST.clone().startOf('year').utc();
                    periodEnd = nowIST.clone().endOf('year').utc();
                    break;
                default:
                    periodStart = nowIST.clone().startOf('month').utc();
                    periodEnd = nowIST.clone().endOf('month').utc();
            }

            // 4️⃣ Initialize usage record if not exist
            if (!userUsage) {
                await client.query(
                    `INSERT INTO user_usage (
                        user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
                        storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant
                    ) VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
                    [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
                );

                userUsage = {
                    user_id: userId,
                    plan_id: userPlan.id,
                    tokens_used: 0,
                    documents_used: 0,
                    ai_analysis_used: 0,
                    storage_used_gb: 0,
                    carry_over_tokens: 0,
                    period_start: periodStart.toISOString(),
                    period_end: periodEnd.toISOString(),
                    last_token_grant: null
                };
            }

            return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

        } catch (err) {
            console.error('❌ getUserUsageAndPlan Error:', err.message);
            throw err;
        } finally {
            if (client) client.release();
        }
    }

    // --- Enforce token limits: block only if tokens exhausted ---
    static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
        const nowUTC = moment.utc();
        const nowIST = nowUTC.clone().tz(TIMEZONE);

        const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
        const usedTokens = userUsage.tokens_used || 0;
        const availableTokens = totalTokens - usedTokens;
        const requestedTokens = requestedResources.tokens || 0;

        const tokenRenewInterval = userPlan.token_renew_interval_hours || DEFAULT_TOKEN_RENEWAL_INTERVAL_HOURS;

        if (userUsage.last_token_grant) {
            const lastGrantUTC = moment.utc(userUsage.last_token_grant);
            const nextRenewUTC = lastGrantUTC.clone().add(tokenRenewInterval, 'hours');

            if (nowUTC.isSameOrAfter(nextRenewUTC)) {
                await this.resetTokens(userId);
                // After resetting, we need to re-fetch the usage to get the correct available tokens
                const refreshedUsageRes = await pool.query('SELECT * FROM user_usage WHERE user_id = $1', [userId]);
                const refreshedUsage = refreshedUsageRes.rows[0];
                const refreshedAvailableTokens = userPlan.token_limit + (refreshedUsage.carry_over_tokens || 0) - refreshedUsage.tokens_used;

                if (requestedTokens > refreshedAvailableTokens) {
                    return {
                        allowed: false,
                        message: `Tokens just renewed, but you still don't have enough for this action.`,
                        remainingTokens: refreshedAvailableTokens
                    };
                }

                return {
                    allowed: true,
                    message: `Tokens renewed at ${nowIST.format('DD-MM-YYYY hh:mm A')} IST`
                };
            } else {
                const remaining = moment.duration(nextRenewUTC.diff(nowUTC));
                return {
                    allowed: false,
                    message: `Tokens exhausted. Wait ${Math.floor(remaining.asHours())}h ${remaining.minutes()}m ${remaining.seconds()}s for renewal at ${nextRenewUTC.clone().tz(TIMEZONE).format('DD-MM-YYYY hh:mm A')} IST`,
                    nextRenewalTime: nextRenewUTC.clone().tz(TIMEZONE).format('DD-MM-YYYY hh:mm A'),
                    remainingTime: {
                        hours: Math.floor(remaining.asHours()),
                        minutes: remaining.minutes(),
                        seconds: remaining.seconds()
                    }
                };
            }
        }

        // 1️⃣ If requested tokens exceed available → start cooldown
        if (requestedTokens > availableTokens) {
            const exhaustionUTC = nowUTC.toISOString();
            await this.updateLastGrant(userId, exhaustionUTC);

            const nextRenewUTC = nowUTC.clone().add(tokenRenewInterval, 'hours');
            return {
                allowed: false,
                message: `Tokens exhausted! Next renewal at ${nextRenewUTC.clone().tz(TIMEZONE).format('DD-MM-YYYY hh:mm A')} IST`,
                nextRenewalTime: nextRenewUTC.clone().tz(TIMEZONE).format('DD-MM-YYYY hh:mm A'),
                remainingTokens: 0
            };
        }

        // 2️⃣ Allow usage if tokens remain
        return {
            allowed: true,
            message: `Tokens available: ${availableTokens - requestedTokens}`,
            remainingTokens: availableTokens - requestedTokens
        };
    }

    // --- Increment usage after upload ---
    static async incrementUsage(userId, requestedResources = {}) {
        const client = await pool.connect();
        try {
            const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
            if (tokens < 0 || documents < 0 || ai_analysis < 0 || storage_gb < 0) {
                throw new Error("Requested resources must be positive.");
            }

            await client.query(
                `UPDATE user_usage SET
                    tokens_used = tokens_used + $1,
                    documents_used = documents_used + $2,
                    ai_analysis_used = ai_analysis_used + $3,
                    storage_used_gb = storage_used_gb + $4,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $5`,
                [tokens, documents, ai_analysis, storage_gb, userId]
            );
        } finally {
            client.release();
        }
    }

    static async resetTokens(userId) {
        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE user_usage SET
                    tokens_used = 0,
                    last_token_grant = NULL,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        } finally {
            client.release();
        }
    }

    static async updateLastGrant(userId, exhaustionTimestamp) {
        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE user_usage SET
                    last_token_grant = $1,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $2`,
                [exhaustionTimestamp, userId]
            );
        } finally {
            client.release();
        }
    }
}

module.exports = TokenUsageService;
