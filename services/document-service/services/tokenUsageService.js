// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      * Reset usage if billing period expired
//      * Handles token renewal based on plan's token_renew_interval_hours
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             // 1️⃣ Fetch user usage
//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // 2️⃣ Fetch user plan details from Payment Service
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             // Fallback free plan
//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5, // default
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5; // default if missing
//             }

//             // 3️⃣ Determine billing period
//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');

//                 // Period expired → reset usage
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage.tokens_used = 0;
//                     userUsage.documents_used = 0;
//                     userUsage.ai_analysis_used = 0;
//                     userUsage.storage_used_gb = 0;
//                     userUsage.carry_over_tokens = carryOverTokens;
//                     userUsage.period_start = periodStart.toISOString();
//                     userUsage.period_end = periodEnd.toISOString();
//                     userUsage.last_token_grant = null;

//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 // Create new usage record
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal based on plan
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const availableTokens = userPlan.token_limit + userUsage.carry_over_tokens - userUsage.tokens_used;
//         const renewInterval = userPlan.token_renew_interval_hours || 5; // default 5 hours

//         // Token exhausted
//         if (availableTokens <= 0) {
//             let shouldReset = false;
//             let remainingHours = renewInterval;

//             if (!userUsage.last_token_grant) {
//                 // If last_token_grant is null, it means tokens were never granted since the last billing cycle reset or user creation.
//                 // In this case, we should grant tokens immediately if exhausted.
//                 shouldReset = true;
//             } else {
//                 const lastGrantMoment = moment(userUsage.last_token_grant);
//                 const hoursSinceLastGrant = now.diff(lastGrantMoment, 'hours', true);
//                 remainingHours = renewInterval - hoursSinceLastGrant;

//                 if (hoursSinceLastGrant >= renewInterval) {
//                     shouldReset = true;
//                 }
//             }

//             if (shouldReset) {
//                 await this.resetTokens(userId); // This will set last_token_grant to now
//                 return { allowed: true };
//             } else {
//                 return {
//                     allowed: false,
//                     message: `❌ Token exhausted. Wait ${remainingHours.toFixed(2)} hours for renewal.`
//                 };
//             }
//         }

//         // Check if requested tokens exceed available
//         if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//             return {
//                 allowed: false,
//                 message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//             };
//         }

//         return { allowed: true };
//     }

//     /**
//      * Increment usage after operation
//      */
//     static async incrementUsage(userId, requestedResources) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Reset tokens for a user
//      */
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta').toISOString();
//             await client.query(
//                 `UPDATE user_usage SET tokens_used = 0, last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [now, userId]
//             );
//             console.log(`✅ Tokens reset for user ${userId}`);
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      * Reset usage if billing period expired
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             // 1️⃣ Fetch user usage
//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // 2️⃣ Fetch plan details from Payment Service
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             // Fallback Free Plan
//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5;
//             }

//             // 3️⃣ Determine billing period
//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;
//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');

//                 // Period expired → reset usage
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage.tokens_used = 0;
//                     userUsage.documents_used = 0;
//                     userUsage.ai_analysis_used = 0;
//                     userUsage.storage_used_gb = 0;
//                     userUsage.carry_over_tokens = carryOverTokens;
//                     userUsage.period_start = periodStart.toISOString();
//                     userUsage.period_end = periodEnd.toISOString();
//                     userUsage.last_token_grant = null;

//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 // Create new usage record
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal based on plan
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = userPlan.token_renew_interval_hours || 5;

//         let availableTokens = userPlan.token_limit + userUsage.carry_over_tokens - userUsage.tokens_used;

//         // Token exhausted
//         if (availableTokens <= 0) {
//             let shouldReset = false;
//             let remainingHours = renewInterval;

//             if (!userUsage.last_token_grant) {
//                 // If last_token_grant is null, it means tokens were never granted since the last billing cycle reset or user creation.
//                 // In this case, we should set last_token_grant to now and deny the request, informing the user to wait.
//                 await this.updateLastGrant(userId, now.toISOString());
//                 return {
//                     allowed: false,
//                     message: `❌ Token exhausted. Wait ${renewInterval} hours for renewal.`
//                 };
//             } else {
//                 const lastGrantMoment = moment(userUsage.last_token_grant);
//                 const hoursSinceLastGrant = now.diff(lastGrantMoment, 'hours', true);
//                 remainingHours = renewInterval - hoursSinceLastGrant;

//                 if (hoursSinceLastGrant >= renewInterval) {
//                     shouldReset = true;
//                 }
//             }

//             if (shouldReset) {
//                 await this.resetTokens(userId); // This will set last_token_grant to now and reset tokens_used
//                 return { allowed: true };
//             } else {
//                 return {
//                     allowed: false,
//                     message: `❌ Token exhausted. Wait ${remainingHours.toFixed(2)} hours for renewal.`
//                 };
//             }
//         }

//         // Check if requested tokens exceed available
//         if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//             return {
//                 allowed: false,
//                 message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//             };
//         }

//         return { allowed: true };
//     }

//     /**
//      * Increment usage after operation
//      */
//     static async incrementUsage(userId, requestedResources) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Reset tokens for a user
//      */
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta').toISOString();
//             await client.query(
//                 `UPDATE user_usage SET tokens_used = 0, last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [now, userId]
//             );
//             console.log(`✅ Tokens reset for user ${userId}`);
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Update last_token_grant without resetting tokens
//      */
//     static async updateLastGrant(userId, timestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [timestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5;
//             }

//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;
//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = userPlan.token_renew_interval_hours || 5;
//         const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//         const availableTokens = totalLimit - userUsage.tokens_used;

//         // No tokens left
//         if (availableTokens <= 0) {
//             if (!userUsage.last_token_grant) {
//                 await this.updateLastGrant(userId, now.toISOString());
//                 return { allowed: false, message: `❌ Tokens exhausted. Will renew after ${renewInterval} hours.` };
//             }

//             const nextRenewal = moment(userUsage.last_token_grant).add(renewInterval, 'hours');
//             if (now.isSameOrAfter(nextRenewal)) {
//                 await this.resetTokens(userId);
//                 return { allowed: true };
//             } else {
//                 const remainingHours = nextRenewal.diff(now, 'hours', true);
//                 return { allowed: false, message: `❌ Tokens exhausted. Wait ${remainingHours.toFixed(2)} hours for renewal.` };
//             }
//         }

//         // Prevent requesting more than available
//         if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//             return {
//                 allowed: false,
//                 message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//             };
//         }

//         return { allowed: true };
//     }

//     /**
//      * Increment usage strictly without exceeding plan limit
//      */
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;

//             // Calculate available tokens
//             const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} tokens available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta').toISOString();
//             await client.query(
//                 `UPDATE user_usage SET tokens_used = 0, last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [now, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async updateLastGrant(userId, timestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [timestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;



// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5;
//             }

//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;
//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal
//      * Logs renewal time in India timezone (12-hour format)
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = userPlan.token_renew_interval_hours || 5;
//         const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//         const availableTokens = totalLimit - userUsage.tokens_used;

//         if (availableTokens <= 0) {
//             if (!userUsage.last_token_grant) {
//                 await this.updateLastGrant(userId, now.toISOString());
//                 const nextRenewal = now.clone().add(renewInterval, 'hours');
//                 console.log(`⏳ Tokens exhausted. Will renew at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST`);
//                 return { allowed: false, message: `❌ Tokens exhausted. Will renew after ${renewInterval} hours.` };
//             }

//             const nextRenewal = moment(userUsage.last_token_grant).tz('Asia/Calcutta').add(renewInterval, 'hours');
//             console.log(`⏳ Tokens exhausted. Next renewal: ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST`);

//             if (now.isSameOrAfter(nextRenewal)) {
//                 await this.resetTokens(userId);
//                 return { allowed: true };
//             } else {
//                 const remainingHours = nextRenewal.diff(now, 'hours', true);
//                 return { allowed: false, message: `❌ Tokens exhausted. Wait ${remainingHours.toFixed(2)} hours for renewal.` };
//             }
//         }

//         if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//             return {
//                 allowed: false,
//                 message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//             };
//         }

//         return { allowed: true };
//     }

//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} tokens available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta').toISOString();
//             await client.query(
//                 `UPDATE user_usage SET tokens_used = 0, last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [now, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async updateLastGrant(userId, timestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [timestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             // Fetch user usage
//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // Fetch plan details
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             // Default Free Plan
//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5;
//             }

//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');

//                 // Reset usage if period expired
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 // Create new usage record
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal
//      * Logs next renewal in IST 12-hour format
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = userPlan.token_renew_interval_hours || 5;
//         const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//         const availableTokens = totalLimit - userUsage.tokens_used;

//         if (availableTokens <= 0) {
//             if (!userUsage.last_token_grant) {
//                 await this.updateLastGrant(userId, now.toISOString());
//                 const nextRenewal = now.clone().add(renewInterval, 'hours');
//                 console.log(`⏳ Tokens exhausted. Will renew at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST`);
//                 return { allowed: false, message: `❌ Tokens exhausted. Will renew after ${renewInterval} hours.` };
//             }

//             const nextRenewal = moment(userUsage.last_token_grant).tz('Asia/Calcutta').add(renewInterval, 'hours');
//             console.log(`⏳ Tokens exhausted. Next renewal: ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST`);

//             if (now.isSameOrAfter(nextRenewal)) {
//                 await this.resetTokens(userId);
//                 return { allowed: true };
//             } else {
//                 const remainingHours = nextRenewal.diff(now, 'hours', true);
//                 return { allowed: false, message: `❌ Tokens exhausted. Wait ${remainingHours.toFixed(2)} hours for renewal.` };
//             }
//         }

//         if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//             return {
//                 allowed: false,
//                 message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//             };
//         }

//         return { allowed: true };
//     }

//     /**
//      * Increment usage strictly without exceeding plan limit
//      */
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         if (!userPlan) throw new Error('User plan is undefined');

//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} tokens available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta').toISOString();
//             await client.query(
//                 `UPDATE user_usage SET tokens_used = 0, last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [now, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     static async updateLastGrant(userId, timestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET last_token_grant = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
//                 [timestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db'); // PostgreSQL pool for user_usage
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     /**
//      * Fetch user's usage and plan
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             // Fetch user usage
//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // Fetch plan details
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             // Default Free Plan
//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 5000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 5
//                 };
//             } else if (!userPlan.token_renew_interval_hours) {
//                 userPlan.token_renew_interval_hours = 5;
//             }

//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');

//                 // Reset usage if period expired (monthly/yearly cycle)
//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens;
//                 }
//             } else {
//                 // Create new usage record
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error(err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Enforce limits and handle token renewal based on EXHAUSTION TIME
//      * Tokens renew ONLY after the exact interval from when they were exhausted
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources) {
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = userPlan.token_renew_interval_hours || 5;
//         const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//         const availableTokens = totalLimit - userUsage.tokens_used;

//         console.log(`\n🔍 Token Check for User ${userId}:`);
//         console.log(`   Total Limit: ${totalLimit} (Plan: ${userPlan.token_limit} + Carryover: ${userUsage.carry_over_tokens})`);
//         console.log(`   Tokens Used: ${userUsage.tokens_used}`);
//         console.log(`   Available: ${availableTokens}`);
//         console.log(`   Current Time: ${now.format('DD-MM-YYYY hh:mm:ss A')} IST`);

//         // CASE 1: Tokens are still available
//         if (availableTokens > 0) {
//             if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//                 console.log(`❌ Requested ${requestedResources.tokens} tokens, but only ${availableTokens} available\n`);
//                 return {
//                     allowed: false,
//                     message: `❌ Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//                 };
//             }
//             console.log(`✅ Sufficient tokens available\n`);
//             return { allowed: true };
//         }

//         // CASE 2: Tokens are EXHAUSTED (tokens_used >= totalLimit)
//         console.log(`⚠️  ALL TOKENS EXHAUSTED!`);

//         // Check if this is the FIRST TIME tokens got exhausted
//         if (!userUsage.last_token_grant) {
//             // Record the EXHAUSTION TIME
//             const exhaustionTime = now.toISOString();
//             await this.updateLastGrant(userId, exhaustionTime);
            
//             const nextRenewal = now.clone().add(renewInterval, 'hours');
//             console.log(`   🚨 FIRST EXHAUSTION at: ${now.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//             console.log(`   ⏰ Tokens will renew at: ${nextRenewal.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//             console.log(`   ⏱️  Renewal interval: ${renewInterval} hours from exhaustion time\n`);
            
//             return { 
//                 allowed: false, 
//                 message: `❌ All tokens exhausted! Renewal at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST (after ${renewInterval} hours from now).`,
//                 nextRenewalTime: nextRenewal.format('DD-MM-YYYY hh:mm A'),
//                 exhaustedAt: now.format('DD-MM-YYYY hh:mm A'),
//                 renewInterval: renewInterval
//             };
//         }

//         // CASE 3: Tokens were already exhausted - check if renewal time has arrived
//         const exhaustionTime = moment(userUsage.last_token_grant).tz('Asia/Calcutta');
//         const nextRenewal = exhaustionTime.clone().add(renewInterval, 'hours');
        
//         console.log(`   🚨 Exhausted at: ${exhaustionTime.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//         console.log(`   ⏰ Renewal time: ${nextRenewal.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//         console.log(`   ⏱️  Interval: ${renewInterval} hours from exhaustion`);

//         // Check if the renewal time has been reached
//         if (now.isSameOrAfter(nextRenewal)) {
//             console.log(`   ✅ RENEWAL TIME REACHED! Resetting tokens now...\n`);
//             await this.resetTokens(userId, now.toISOString());
//             return { 
//                 allowed: true,
//                 message: `✅ Tokens renewed successfully at ${now.format('DD-MM-YYYY hh:mm A')} IST!`,
//                 renewed: true,
//                 renewedAt: now.format('DD-MM-YYYY hh:mm A')
//             };
//         }

//         // CASE 4: Still waiting for renewal time
//         const remainingMs = nextRenewal.diff(now);
//         const duration = moment.duration(remainingMs);
//         const remainingHours = Math.floor(duration.asHours());
//         const remainingMinutes = duration.minutes();
//         const remainingSeconds = duration.seconds();
        
//         const timeRemaining = remainingHours > 0 
//             ? `${remainingHours} hour(s), ${remainingMinutes} minute(s), ${remainingSeconds} second(s)`
//             : remainingMinutes > 0
//             ? `${remainingMinutes} minute(s), ${remainingSeconds} second(s)`
//             : `${remainingSeconds} second(s)`;
        
//         console.log(`   ⏳ Time remaining until renewal: ${timeRemaining}`);
//         console.log(`   ❌ ACCESS BLOCKED - Must wait for renewal time\n`);
        
//         return { 
//             allowed: false, 
//             message: `❌ Tokens exhausted. Renewal at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST. Wait ${timeRemaining} more.`,
//             nextRenewalTime: nextRenewal.format('DD-MM-YYYY hh:mm:ss A'),
//             exhaustedAt: exhaustionTime.format('DD-MM-YYYY hh:mm A'),
//             timeRemaining: timeRemaining,
//             remainingMs: remainingMs,
//             hoursRemaining: duration.asHours().toFixed(2)
//         };
//     }

//     /**
//      * Increment usage - will trigger exhaustion tracking when limit is reached
//      */
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         if (!userPlan) throw new Error('User plan is undefined');

//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalLimit = userPlan.token_limit + userUsage.carry_over_tokens;
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} tokens available.`);
//             }

//             const newTokensUsed = userUsage.tokens_used + tokens;

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//             console.log(`📊 Usage incremented for user ${userId}: +${tokens} tokens (Total used: ${newTokensUsed}/${totalLimit})`);
            
//             // Check if tokens just got exhausted
//             if (newTokensUsed >= totalLimit) {
//                 console.log(`🚨 TOKENS JUST EXHAUSTED! Will be blocked until renewal.`);
//             }
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Reset tokens to 0 and update last_token_grant to current renewal time
//      * This marks a NEW cycle, so next exhaustion will have a NEW renewal time
//      */
//     static async resetTokens(userId, renewalTimestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $1`,
//                 [userId]
//             );
//             const renewalTime = moment(renewalTimestamp).tz('Asia/Calcutta');
//             console.log(`✅ Tokens reset to 0 for user ${userId} at ${renewalTime.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//             console.log(`   last_token_grant cleared - ready for next cycle\n`);
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Mark the EXHAUSTION TIME - this is when tokens ran out
//      * Renewal will happen exactly after 'token_renew_interval_hours' from this time
//      */
//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET 
//                     last_token_grant = $1, 
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
//             const exhaustionTime = moment(exhaustionTimestamp).tz('Asia/Calcutta');
//             console.log(`📝 Exhaustion time recorded for user ${userId}: ${exhaustionTime.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;



// const pool = require('../config/db');
// const axios = require('axios');
// const moment = require('moment-timezone');

// class TokenUsageService {

//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await pool.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             console.log(`\n📥 RAW DATABASE RESULT for user ${userId}:`);
//             console.log(JSON.stringify(userUsage, null, 2));

//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 25000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                     token_renew_interval_hours: 4 // Manually set to 4 hours
//                 };
//             } else {
//                 userPlan.token_renew_interval_hours = 4; // Manually set to 4 hours
//             }

//             const now = moment().tz('Asia/Calcutta');
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('week');
//                     periodEnd = now.clone().endOf('week');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz('Asia/Calcutta');

//                 if (now.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await pool.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens || 0;
//                 }
//             } else {
//                 await pool.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error('Error in getUserUsageAndPlan:', err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
//         console.log('\n' + '='.repeat(120));
//         console.log('🔍 ENFORCE LIMITS - DETAILED DIAGNOSTIC');
//         console.log('='.repeat(120));
        
//         const now = moment().tz('Asia/Calcutta');
//         const renewInterval = 4; // Manually set to 4 hours as per user request
//         const totalLimit = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//         const currentUsed = userUsage.tokens_used || 0;
//         const availableTokens = totalLimit - currentUsed;

//         console.log(`\n📊 INPUTS RECEIVED:`);
//         console.log(`   userId: ${userId}`);
//         console.log(`   userUsage.tokens_used: ${userUsage.tokens_used}`);
//         console.log(`   userUsage.last_token_grant: ${userUsage.last_token_grant}`);
//         console.log(`   userUsage.last_token_grant type: ${typeof userUsage.last_token_grant}`);
//         console.log(`   userUsage.last_token_grant === null: ${userUsage.last_token_grant === null}`);
//         console.log(`   userUsage.last_token_grant === undefined: ${userUsage.last_token_grant === undefined}`);
//         console.log(`   userPlan.token_limit: ${userPlan.token_limit}`);
//         console.log(`   userPlan.token_renew_interval_hours: ${userPlan.token_renew_interval_hours}`);

//         console.log(`\n⏰ TIME INFORMATION:`);
//         console.log(`   Current Time (IST): ${now.format('DD-MM-YYYY hh:mm:ss A')}`);
//         console.log(`   Current Time (ISO): ${now.toISOString()}`);
//         console.log(`   Renew Interval: ${renewInterval} hours`);

//         console.log(`\n📈 USAGE CALCULATIONS:`);
//         console.log(`   Total Limit: ${totalLimit}`);
//         console.log(`   Tokens Used: ${currentUsed}`);
//         console.log(`   Available: ${availableTokens}`);
//         console.log(`   Requested: ${requestedResources.tokens || 0}`);

//         // CRITICAL CHECK
//         console.log(`\n🔍 CRITICAL CHECK - last_token_grant existence:`);
//         const hasLastTokenGrant = userUsage.last_token_grant !== null && userUsage.last_token_grant !== undefined;
//         console.log(`   Has last_token_grant: ${hasLastTokenGrant}`);
        
//         if (hasLastTokenGrant) {
//             console.log(`\n⚠️ PENDING RENEWAL PATH`);
            
//             const exhaustionTime = moment(userUsage.last_token_grant).tz('Asia/Calcutta');
//             const nextRenewal = exhaustionTime.clone().add(renewInterval, 'hours');
            
//             console.log(`   Exhaustion Time (RAW): ${userUsage.last_token_grant}`);
//             console.log(`   Exhaustion Time (IST): ${exhaustionTime.format('DD-MM-YYYY hh:mm:ss A')}`);
//             console.log(`   Exhaustion Time (ISO): ${exhaustionTime.toISOString()}`);
//             console.log(`   Next Renewal (IST): ${nextRenewal.format('DD-MM-YYYY hh:mm:ss A')}`);
//             console.log(`   Next Renewal (ISO): ${nextRenewal.toISOString()}`);
            
//             const nowMs = now.valueOf();
//             const renewalMs = nextRenewal.valueOf();
//             const diffMs = renewalMs - nowMs;
            
//             console.log(`\n   Now (ms): ${nowMs}`);
//             console.log(`   Renewal (ms): ${renewalMs}`);
//             console.log(`   Difference (ms): ${diffMs}`);
//             console.log(`   Difference (hours): ${(diffMs / 3600000).toFixed(4)}`);
//             console.log(`   Difference (minutes): ${(diffMs / 60000).toFixed(2)}`);
            
//             const isRenewalTime = now.isSameOrAfter(nextRenewal);
//             console.log(`\n   now.isSameOrAfter(nextRenewal): ${isRenewalTime}`);
//             console.log(`   Should renew: ${isRenewalTime}`);

//             if (isRenewalTime) {
//                 console.log(`\n✅✅✅ RENEWAL TRIGGERED ✅✅✅`);
//                 console.log(`=`.repeat(120) + '\n');
                
//                 await this.resetTokens(userId);
                
//                 return { 
//                     allowed: true,
//                     message: `Tokens renewed at ${now.format('DD-MM-YYYY hh:mm A')} IST`,
//                     renewed: true,
//                     renewedAt: now.format('DD-MM-YYYY hh:mm:ss A')
//                 };
//             } else {
//                 const duration = moment.duration(diffMs);
//                 const h = Math.floor(duration.asHours());
//                 const m = duration.minutes();
//                 const s = duration.seconds();
                
//                 console.log(`\n❌❌❌ BLOCKED - RENEWAL TIME NOT REACHED ❌❌❌`);
//                 console.log(`   Must wait: ${h}h ${m}m ${s}s`);
//                 console.log(`=`.repeat(120) + '\n');
                
//                 return { 
//                     allowed: false, 
//                     message: `Tokens exhausted. Renewal at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST. Wait ${h}h ${m}m ${s}s`,
//                     nextRenewalTime: nextRenewal.format('DD-MM-YYYY hh:mm A'),
//                     exhaustedAt: exhaustionTime.format('DD-MM-YYYY hh:mm A')
//                 };
//             }
//         }

//         // NO PENDING RENEWAL
//         console.log(`\n✅ NO PENDING RENEWAL PATH`);
        
//         if (availableTokens > 0) {
//             if (requestedResources.tokens && requestedResources.tokens > availableTokens) {
//                 console.log(`❌ Insufficient tokens`);
//                 console.log(`=`.repeat(120) + '\n');
//                 return {
//                     allowed: false,
//                     message: `Insufficient tokens. Requested: ${requestedResources.tokens}, Available: ${availableTokens}`
//                 };
//             }
//             console.log(`✅ Tokens available - ACCESS GRANTED`);
//             console.log(`=`.repeat(120) + '\n');
//             return { allowed: true };
//         }

//         // JUST EXHAUSTED
//         console.log(`\n🚨🚨🚨 TOKENS JUST EXHAUSTED 🚨🚨🚨`);
        
//         const exhaustionTime = now.toISOString();
//         const nextRenewal = now.clone().add(renewInterval, 'hours');
        
//         console.log(`   Recording exhaustion at: ${now.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//         console.log(`   Next renewal will be: ${nextRenewal.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//         console.log(`=`.repeat(120) + '\n');
        
//         await this.updateLastGrant(userId, exhaustionTime);
        
//         return { 
//             allowed: false, 
//             message: `All tokens exhausted! Renewal at ${nextRenewal.format('DD-MM-YYYY hh:mm A')} IST`,
//             nextRenewalTime: nextRenewal.format('DD-MM-YYYY hh:mm A'),
//             exhaustedAt: now.format('DD-MM-YYYY hh:mm A')
//         };
//     }

//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         if (!userPlan) {
//             throw new Error('User plan is undefined');
//         }

//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalLimit = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             console.log('\n📝 INCREMENT USAGE');
//             console.log(`   User: ${userId}`);
//             console.log(`   Before: ${userUsage.tokens_used}/${totalLimit}`);
//             console.log(`   Adding: ${tokens} tokens`);
//             console.log(`   After: ${userUsage.tokens_used + tokens}/${totalLimit}`);

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//             console.log(`   ✅ Updated\n`);

//         } finally {
//             client.release();
//         }
//     }

//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             const now = moment().tz('Asia/Calcutta');
            
//             console.log('\n🔄🔄🔄 RESETTING TOKENS 🔄🔄🔄');
//             console.log(`   User: ${userId}`);
//             console.log(`   Time: ${now.format('DD-MM-YYYY hh:mm:ss A')} IST`);
            
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $1`,
//                 [userId]
//             );
            
//             console.log(`   ✅ tokens_used = 0`);
//             console.log(`   ✅ last_token_grant = NULL\n`);
            
//         } finally {
//             client.release();
//         }
//     }

//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             const exhaustionTime = moment(exhaustionTimestamp).tz('Asia/Calcutta');
            
//             console.log('\n📝📝📝 RECORDING EXHAUSTION 📝📝📝');
//             console.log(`   User: ${userId}`);
//             console.log(`   Time: ${exhaustionTime.format('DD-MM-YYYY hh:mm:ss A')} IST`);
//             console.log(`   ISO: ${exhaustionTimestamp}`);
            
//             await client.query(
//                 `UPDATE user_usage SET 
//                     last_token_grant = $1, 
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
            
//             console.log(`   ✅ Recorded\n`);
            
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db');
// const axios = require('axios');
// const moment = require('moment-timezone');

// // Set the timezone globally for consistency as per the original code
// const TIMEZONE = 'Asia/Calcutta';
// const TOKEN_RENEWAL_INTERVAL_HOURS = 4; // Constant for the required 4-hour renewal period

// class TokenUsageService {

//     /**
//      * Fetches the user's current usage data from the database and their plan from the gateway.
//      * Also handles end-of-period (e.g., end of month) renewal.
//      */
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             // 1. Fetch usage data
//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             console.log(`\n📥 RAW DATABASE RESULT for user ${userId}:`);
//             console.log(JSON.stringify(userUsage, null, 2));

//             // 2. Fetch plan data
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             // Apply default plan if fetching fails
//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 25000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly',
//                 };
//             }
//             // Note: We don't need to manually set token_renew_interval_hours here,
//             // as enforceLimits uses the hardcoded constant as required.

//             // 3. Determine current usage period boundaries based on plan interval
//             const now = moment().tz(TIMEZONE);
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = now.clone().startOf('day');
//                     periodEnd = now.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = now.clone().startOf('isoWeek'); // ISO week starts Monday
//                     periodEnd = now.clone().endOf('isoWeek');
//                     break;
//                 case 'monthly':
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = now.clone().startOf('year');
//                     periodEnd = now.clone().endOf('year');
//                     break;
//                 default:
//                     // Default to monthly if interval is unknown
//                     periodStart = now.clone().startOf('month');
//                     periodEnd = now.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             // 4. Handle end-of-period renewal (e.g., end of the month)
//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz(TIMEZONE);

//                 if (now.isAfter(usagePeriodEnd)) {
//                     // Calculate carry-over tokens
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     // Reset usage for the new period
//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0, documents_used = 0, ai_analysis_used = 0,
//                             storage_used_gb = 0, carry_over_tokens = $1,
//                             period_start = $2, period_end = $3,
//                             last_token_grant = NULL, -- IMPORTANT: Reset 4-hour cooldown timer on full period renewal
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     // Update local usage object
//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null // Reset last grant here
//                     };
//                     console.log(`🔄 Full usage period renewed for user ${userId}.`);
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens || 0;
//                 }
//             } else {
//                 // Insert new usage record if none exists
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//                 console.log(`➕ New user usage record created for ${userId}.`);
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error('❌ Error in getUserUsageAndPlan:', err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     /**
//      * Checks if a user has sufficient resources and handles the 4-hour token renewal logic.
//      */
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
//         console.log('\n' + '='.repeat(100));
//         console.log(`🔍 ENFORCE LIMITS FOR USER ${userId}`);
//         console.log('='.repeat(100));
        
//         // Use TIMEZONE for reporting/logging, but use UTC for the core duration calculation
//         const now = moment().tz(TIMEZONE);
//         const nowUtc = moment.utc(); 
//         const renewInterval = TOKEN_RENEWAL_INTERVAL_HOURS; // 4 hours
//         const totalLimit = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//         const currentUsed = userUsage.tokens_used || 0;
//         const availableTokens = totalLimit - currentUsed;
//         const requestedTokens = requestedResources.tokens || 0;

//         // --- 1. Check for pending 4-hour renewal ---
//         const hasLastTokenGrant = userUsage.last_token_grant !== null && userUsage.last_token_grant !== undefined;
        
//         if (hasLastTokenGrant) {
//             console.log(`⚠️ Checking 4-hour cooldown (last_token_grant: ${userUsage.last_token_grant})`);

//             // DEFENSIVE CHECK: If the cooldown flag is set, but the user is not currently exhausted 
//             // and has enough tokens for the request (e.g., tokens were manually topped up), 
//             // we clear the cooldown flag and allow the request.
//             if (availableTokens >= requestedTokens) {
//                 console.log(`✅ Tokens available despite cooldown flag. Clearing flag and granting access.`);
//                 await this.clearLastGrant(userId); 
//                 return { allowed: true };
//             }

//             // CRITICAL FIX: Perform duration calculation purely in UTC for stability.
//             // 1. Interpret DB timestamp (which is UTC) as pure UTC time.
//             const exhaustionTimeUtc = moment.utc(userUsage.last_token_grant);
//             // 2. Calculate next renewal time by adding the interval directly to the UTC timestamp.
//             const nextRenewalUtc = exhaustionTimeUtc.clone().add(renewInterval, 'hours');
            
//             // === DEBUG LOGGING FOR TIME CALCULATION ===
//             // These logs will show us if the DB timestamp is being misinterpreted.
//             console.log(`DEBUG: Last Grant Time (UTC): ${exhaustionTimeUtc.toISOString()}`);
//             console.log(`DEBUG: Current Server Time (UTC): ${nowUtc.toISOString()}`);
//             console.log(`DEBUG: Next Renewal Time (UTC): ${nextRenewalUtc.toISOString()}`);
//             // ==========================================

//             // 3. Comparison is done between two UTC moments.
//             const isRenewalTime = nowUtc.isSameOrAfter(nextRenewalUtc);

//             // Timezone moments for accurate user reporting (IST)
//             const exhaustionTimeIST = exhaustionTimeUtc.clone().tz(TIMEZONE);
//             const nextRenewalIST = nextRenewalUtc.clone().tz(TIMEZONE);

//             if (isRenewalTime) {
//                 // RENEWAL TIME REACHED: Reset tokens and allow the current request
//                 console.log(`✅✅✅ 4-HOUR RENEWAL TRIGGERED ✅✅✅`);
                
//                 await this.resetTokens(userId); // Resets tokens_used to 0 and last_token_grant to NULL
                
//                 // Use IST time for the user message
//                 return { 
//                     allowed: true,
//                     message: `Tokens renewed at ${now.format('DD-MM-YYYY hh:mm A')} ${TIMEZONE}`,
//                     renewed: true, // Signal middleware to refetch usage
//                 };
//             } else {
//                 // NOT RENEWAL TIME: Block request and indicate wait time
                
//                 // Calculate difference using UTC moments for precision
//                 const diffMs = nextRenewalUtc.valueOf() - nowUtc.valueOf();
//                 const duration = moment.duration(diffMs);
//                 const h = Math.floor(duration.asHours());
//                 const m = duration.minutes();
//                 const s = duration.seconds();
                
//                 const waitTime = `${h}h ${m}m ${s}s`;
                
//                 console.log(`❌❌❌ BLOCKED - RENEWAL TIME NOT REACHED. Wait ${waitTime}. ❌❌❌`);
                
//                 return { 
//                     allowed: false, 
//                     // Use IST moment for formatted message
//                     message: `Tokens exhausted. Renewal at ${nextRenewalIST.format('DD-MM-YYYY hh:mm A')} ${TIMEZONE}. Wait ${waitTime}`,
//                     nextRenewalTime: nextRenewalIST.format('DD-MM-YYYY hh:mm A'),
//                     exhaustedAt: exhaustionTimeIST.format('DD-MM-YYYY hh:mm A')
//                 };
//             }
//         }

//         // --- 2. Check general token limits ---
        
//         if (requestedTokens > availableTokens) {
//             // TOKENS JUST EXHAUSTED (or insufficient tokens to fulfill request)
            
//             if (availableTokens <= 0) {
//                  // The user has exactly 0 tokens or less and this is the first block,
//                  // or they had tokens but this request pushes them to negative.
//                  // We only record the grant time if we are blocking the request because the tokens ran out.
                
//                 console.log(`🚨🚨🚨 TOKENS EXHAUSTED. RECORDING COOLDOWN START. 🚨🚨🚨`);
                
//                 // CRITICAL: Ensure the saved time is explicitly an ISO 8601 string referenced in UTC ('Z')
//                 const exhaustionTimeISO = now.utc().toISOString();
//                 // Calculate next renewal time for the user message (based on current IST time + 4 hours)
//                 const nextRenewalIST = now.clone().add(renewInterval, 'hours');
                
//                 await this.updateLastGrant(userId, exhaustionTimeISO); // Sets last_token_grant to NOW (UTC)
                
//                 return { 
//                     allowed: false, 
//                     message: `All tokens exhausted! Renewal at ${nextRenewalIST.format('DD-MM-YYYY hh:mm A')} ${TIMEZONE}`,
//                     nextRenewalTime: nextRenewalIST.format('DD-MM-YYYY hh:mm A'),
//                     exhaustedAt: now.format('DD-MM-YYYY hh:mm A')
//                 };

//             } else {
//                 // Insufficient tokens for the request, but not completely exhausted yet (availableTokens > 0)
//                 console.log(`❌ Insufficient tokens. Requested: ${requestedTokens}, Available: ${availableTokens}`);
//                 return {
//                     allowed: false,
//                     message: `Insufficient tokens. Requested: ${requestedTokens}, Available: ${availableTokens}`
//                 };
//             }
//         }

//         // --- 3. Access Granted ---
//         console.log(`✅ Tokens available - ACCESS GRANTED`);
//         console.log('='.repeat(100) + '\n');
//         return { allowed: true };
//     }

//     /**
//      * Updates the user's usage counts after a successful operation.
//      */
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         if (!userPlan) {
//             throw new Error('User plan is undefined');
//         }

//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalLimit = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//             const availableTokens = totalLimit - userUsage.tokens_used;

//             console.log('\n📝 INCREMENT USAGE');

//             // Sanity check (should be caught by enforceLimits, but good to double-check)
//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//             console.log(`   ✅ Updated usage for user ${userId}.`);

//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Resets tokens after the 4-hour cooldown period.
//      */
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             console.log('\n🔄 RESETTING TOKENS (4-HOUR COOLDOWN COMPLETE) 🔄');
            
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $1`,
//                 [userId]
//             );
            
//             console.log(`   ✅ Tokens reset and cooldown timer cleared for user ${userId}.\n`);
            
//         } finally {
//             client.release();
//         }
//     }
    
//     /**
//      * Clears the last_token_grant flag, allowing usage to resume if tokens are available, 
//      * without resetting the tokens_used count. Used when a user is topped up manually 
//      * during a cooldown.
//      */
//     static async clearLastGrant(userId) {
//         const client = await pool.connect();
//         try {
//             console.log('\n🗑️ CLEARING LAST GRANT 🗑️');
            
//             await client.query(
//                 `UPDATE user_usage SET 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $1`,
//                 [userId]
//             );
            
//             console.log(`   ✅ Cooldown flag cleared for user ${userId}.\n`);
            
//         } finally {
//             client.release();
//         }
//     }

//     /**
//      * Records the current timestamp as the start of the 4-hour token cooldown.
//      */
//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             // FIX: Use moment.utc() to correctly interpret the incoming ISO string before converting to TIMEZONE for logging
//             const exhaustionTime = moment.utc(exhaustionTimestamp).tz(TIMEZONE);
            
//             console.log('\n📝 RECORDING EXHAUSTION (STARTING 4-HOUR COOLDOWN) 📝');
//             console.log(`   Time recorded: ${exhaustionTime.format('DD-MM-YYYY hh:mm:ss A')} ${TIMEZONE}`);
            
//             await client.query(
//                 `UPDATE user_usage SET 
//                     last_token_grant = $1, 
//                     updated_at = CURRENT_TIMESTAMP 
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
            
//             console.log(`   ✅ Cooldown recorded for user ${userId}.\n`);
            
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;



// const pool = require('../config/db');
// const axios = require('axios');
// const moment = require('moment-timezone');

// const TIMEZONE = 'Asia/Calcutta';       // IST for logs and messages
// const TOKEN_RENEWAL_INTERVAL_HOURS = 4; // Default cooldown (change to reduce/increase)

// class TokenUsageService {

//     // --- Fetch user's usage and plan ---
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // Fetch plan
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 25000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly'
//                 };
//             }

//             const nowIST = moment().tz(TIMEZONE);
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = nowIST.clone().startOf('day');
//                     periodEnd = nowIST.clone().endOf('day');
//                     break;
//                 case 'weekly':
//                     periodStart = nowIST.clone().startOf('isoWeek');
//                     periodEnd = nowIST.clone().endOf('isoWeek');
//                     break;
//                 case 'monthly':
//                     periodStart = nowIST.clone().startOf('month');
//                     periodEnd = nowIST.clone().endOf('month');
//                     break;
//                 case 'yearly':
//                     periodStart = nowIST.clone().startOf('year');
//                     periodEnd = nowIST.clone().endOf('year');
//                     break;
//                 default:
//                     periodStart = nowIST.clone().startOf('month');
//                     periodEnd = nowIST.clone().endOf('month');
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 const usagePeriodEnd = moment(userUsage.period_end).tz(TIMEZONE);
//                 if (nowIST.isAfter(usagePeriodEnd)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0,
//                             documents_used = 0,
//                             ai_analysis_used = 0,
//                             storage_used_gb = 0,
//                             carry_over_tokens = $1,
//                             period_start = $2,
//                             period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens || 0;
//                 }
//             } else {
//                 // Insert new record if none exists
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error('❌ Error in getUserUsageAndPlan:', err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     // --- Enforce token limits and 4-hour cooldown ---
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
//         const nowUTC = moment.utc();
//         const nowIST = nowUTC.clone().tz(TIMEZONE);

//         const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//         const usedTokens = userUsage.tokens_used || 0;
//         const availableTokens = totalTokens - usedTokens;
//         const requestedTokens = requestedResources.tokens || 0;

//         // --- Tokens exhausted ---
//         if (requestedTokens > availableTokens) {
//             if (!userUsage.last_token_grant) {
//                 // First exhaustion → start cooldown
//                 const exhaustionUTC = nowUTC.toISOString();
//                 await this.updateLastGrant(userId, exhaustionUTC);

//                 const nextRenewIST = nowIST.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');
//                 return {
//                     allowed: false,
//                     message: `Tokens exhausted! Next renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                     nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A')
//                 };
//             } else {
//                 // Already in cooldown
//                 const lastGrantUTC = moment.utc(userUsage.last_token_grant);
//                 const nextRenewUTC = lastGrantUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');

//                 if (nowUTC.isSameOrAfter(nextRenewUTC)) {
//                     // Cooldown finished → reset tokens
//                     await this.resetTokens(userId);
//                     return {
//                         allowed: true,
//                         message: `Tokens renewed at ${nowIST.format('DD-MM-YYYY hh:mm A')} IST`
//                     };
//                 } else {
//                     const remaining = moment.duration(nextRenewUTC.diff(nowUTC));
//                     const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);

//                     return {
//                         allowed: false,
//                         message: `Tokens exhausted. Wait ${Math.floor(remaining.asHours())}h ${remaining.minutes()}m for renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                         nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
//                         exhaustedAt: lastGrantUTC.clone().tz(TIMEZONE).format('DD-MM-YYYY hh:mm A')
//                     };
//                 }
//             }
//         }

//         // --- Enough tokens ---
//         return { allowed: true };
//     }

//     // --- Increment usage after operation ---
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//             const availableTokens = totalTokens - (userUsage.tokens_used || 0);

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//         } finally {
//             client.release();
//         }
//     }

//     // --- Reset tokens after cooldown ---
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $1`,
//                 [userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     // --- Record cooldown start timestamp (UTC) ---
//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET
//                     last_token_grant = $1,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db');
// const axios = require('axios');
// const moment = require('moment-timezone');

// const TIMEZONE = 'Asia/Calcutta';       // IST for logs and messages
// const TOKEN_RENEWAL_INTERVAL_HOURS = 4; // Cooldown period in hours

// class TokenUsageService {

//     // --- Fetch user's usage and plan ---
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // Fetch plan
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 25000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly'
//                 };
//             }

//             // Work with UTC for database, convert to IST only for display
//             const nowUTC = moment.utc();
//             const nowIST = nowUTC.clone().tz(TIMEZONE);
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = nowIST.clone().startOf('day').utc();
//                     periodEnd = nowIST.clone().endOf('day').utc();
//                     break;
//                 case 'weekly':
//                     periodStart = nowIST.clone().startOf('isoWeek').utc();
//                     periodEnd = nowIST.clone().endOf('isoWeek').utc();
//                     break;
//                 case 'monthly':
//                     periodStart = nowIST.clone().startOf('month').utc();
//                     periodEnd = nowIST.clone().endOf('month').utc();
//                     break;
//                 case 'yearly':
//                     periodStart = nowIST.clone().startOf('year').utc();
//                     periodEnd = nowIST.clone().endOf('year').utc();
//                     break;
//                 default:
//                     periodStart = nowIST.clone().startOf('month').utc();
//                     periodEnd = nowIST.clone().endOf('month').utc();
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 // Database has UTC, compare in UTC
//                 const usagePeriodEndUTC = moment.utc(userUsage.period_end);
                
//                 if (nowUTC.isAfter(usagePeriodEndUTC)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0,
//                             documents_used = 0,
//                             ai_analysis_used = 0,
//                             storage_used_gb = 0,
//                             carry_over_tokens = $1,
//                             period_start = $2,
//                             period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens || 0;
//                 }
//             } else {
//                 // Insert new record if none exists
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error('❌ Error in getUserUsageAndPlan:', err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     // --- Enforce token limits and 4-hour cooldown ---
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
//         // CRITICAL: All time calculations must be in UTC for database consistency
//         const nowUTC = moment.utc();
//         const nowIST = nowUTC.clone().tz(TIMEZONE);

//         const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//         const usedTokens = userUsage.tokens_used || 0;
//         const availableTokens = totalTokens - usedTokens;
//         const requestedTokens = requestedResources.tokens || 0;

//         // --- Tokens exhausted ---
//         if (requestedTokens > availableTokens) {
//             if (!userUsage.last_token_grant) {
//                 // First exhaustion → start cooldown (store in UTC)
//                 const exhaustionUTC = nowUTC.toISOString();
//                 await this.updateLastGrant(userId, exhaustionUTC);

//                 // Calculate next renewal in UTC, then convert to IST for display
//                 const nextRenewUTC = nowUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');
//                 const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);

//                 return {
//                     allowed: false,
//                     message: `Tokens exhausted! Next renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                     nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
//                     exhaustedAt: nowIST.format('DD-MM-YYYY hh:mm A')
//                 };
//             } else {
//                 // Already in cooldown - database has UTC timestamp
//                 const lastGrantUTC = moment.utc(userUsage.last_token_grant);
//                 const nextRenewUTC = lastGrantUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');

//                 // Compare in UTC to ensure accurate cooldown period
//                 if (nowUTC.isSameOrAfter(nextRenewUTC)) {
//                     // Cooldown finished → reset tokens
//                     await this.resetTokens(userId);
//                     return {
//                         allowed: true,
//                         message: `Tokens renewed at ${nowIST.format('DD-MM-YYYY hh:mm A')} IST`
//                     };
//                 } else {
//                     // Still in cooldown - calculate remaining time in UTC
//                     const remaining = moment.duration(nextRenewUTC.diff(nowUTC));
//                     const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);
//                     const exhaustedAtIST = lastGrantUTC.clone().tz(TIMEZONE);

//                     return {
//                         allowed: false,
//                         message: `Tokens exhausted. Wait ${Math.floor(remaining.asHours())}h ${remaining.minutes()}m for renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                         nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
//                         exhaustedAt: exhaustedAtIST.format('DD-MM-YYYY hh:mm A'),
//                         remainingTime: {
//                             hours: Math.floor(remaining.asHours()),
//                             minutes: remaining.minutes()
//                         }
//                     };
//                 }
//             }
//         }

//         // --- Enough tokens ---
//         return { allowed: true };
//     }

//     // --- Increment usage after operation ---
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//             const availableTokens = totalTokens - (userUsage.tokens_used || 0);

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//         } finally {
//             client.release();
//         }
//     }

//     // --- Reset tokens after cooldown ---
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $1`,
//                 [userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     // --- Record cooldown start timestamp (store in UTC) ---
//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET
//                     last_token_grant = $1,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;


// const pool = require('../config/db');
// const axios = require('axios');
// const moment = require('moment-timezone');

// const TIMEZONE = 'Asia/Calcutta';       // IST for logs and messages
// const TOKEN_RENEWAL_INTERVAL_HOURS = 4; // Cooldown period in hours

// class TokenUsageService {

//     // --- Fetch user's usage and plan ---
//     static async getUserUsageAndPlan(userId, authorizationHeader) {
//         let client;
//         try {
//             client = await pool.connect();

//             const usageRes = await client.query(
//                 'SELECT * FROM user_usage WHERE user_id = $1',
//                 [userId]
//             );
//             let userUsage = usageRes.rows[0];

//             // Fetch plan
//             const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
//             const planResp = await axios.get(
//                 `${gatewayUrl}/user-resources/user-plan/${userId}`,
//                 { headers: { Authorization: authorizationHeader } }
//             );
//             let userPlan = planResp.data?.data;

//             if (!userPlan) {
//                 userPlan = {
//                     id: 'default-free-plan',
//                     name: 'Free Plan',
//                     token_limit: 25000,
//                     document_limit: 5,
//                     ai_analysis_limit: 10,
//                     storage_limit_gb: 0.1,
//                     carry_over_limit: 0,
//                     interval: 'monthly'
//                 };
//             }

//             // Work with UTC for database, convert to IST only for display
//             const nowUTC = moment.utc();
//             const nowIST = nowUTC.clone().tz(TIMEZONE);
//             let periodStart, periodEnd;

//             switch (userPlan.interval) {
//                 case 'daily':
//                     periodStart = nowIST.clone().startOf('day').utc();
//                     periodEnd = nowIST.clone().endOf('day').utc();
//                     break;
//                 case 'weekly':
//                     periodStart = nowIST.clone().startOf('isoWeek').utc();
//                     periodEnd = nowIST.clone().endOf('isoWeek').utc();
//                     break;
//                 case 'monthly':
//                     periodStart = nowIST.clone().startOf('month').utc();
//                     periodEnd = nowIST.clone().endOf('month').utc();
//                     break;
//                 case 'yearly':
//                     periodStart = nowIST.clone().startOf('year').utc();
//                     periodEnd = nowIST.clone().endOf('year').utc();
//                     break;
//                 default:
//                     periodStart = nowIST.clone().startOf('month').utc();
//                     periodEnd = nowIST.clone().endOf('month').utc();
//             }

//             let carryOverTokens = 0;

//             if (userUsage) {
//                 // Database has UTC, compare in UTC
//                 const usagePeriodEndUTC = moment.utc(userUsage.period_end);
                
//                 if (nowUTC.isAfter(usagePeriodEndUTC)) {
//                     const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
//                     carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

//                     await client.query(
//                         `UPDATE user_usage SET
//                             tokens_used = 0,
//                             documents_used = 0,
//                             ai_analysis_used = 0,
//                             storage_used_gb = 0,
//                             carry_over_tokens = $1,
//                             period_start = $2,
//                             period_end = $3,
//                             last_token_grant = NULL,
//                             updated_at = CURRENT_TIMESTAMP
//                          WHERE user_id = $4`,
//                         [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
//                     );

//                     userUsage = {
//                         ...userUsage,
//                         tokens_used: 0,
//                         documents_used: 0,
//                         ai_analysis_used: 0,
//                         storage_used_gb: 0,
//                         carry_over_tokens: carryOverTokens,
//                         period_start: periodStart.toISOString(),
//                         period_end: periodEnd.toISOString(),
//                         last_token_grant: null
//                     };
//                 } else {
//                     carryOverTokens = userUsage.carry_over_tokens || 0;
//                 }
//             } else {
//                 // Insert new record if none exists
//                 await client.query(
//                     `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
//                                              storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
//                      VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
//                     [userId, userPlan.id, periodStart.toISOString(), periodEnd.toISOString()]
//                 );

//                 userUsage = {
//                     user_id: userId,
//                     plan_id: userPlan.id,
//                     tokens_used: 0,
//                     documents_used: 0,
//                     ai_analysis_used: 0,
//                     storage_used_gb: 0,
//                     carry_over_tokens: 0,
//                     period_start: periodStart.toISOString(),
//                     period_end: periodEnd.toISOString(),
//                     last_token_grant: null
//                 };
//             }

//             return { usage: userUsage, plan: userPlan, periodStart, periodEnd };

//         } catch (err) {
//             console.error('❌ Error in getUserUsageAndPlan:', err);
//             throw err;
//         } finally {
//             if (client) client.release();
//         }
//     }

//     // --- Enforce token limits and 4-hour cooldown ---
//     static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
//         // CRITICAL: All time calculations must be in UTC for database consistency
//         const nowUTC = moment.utc();
//         const nowIST = nowUTC.clone().tz(TIMEZONE);

//         console.log('🕐 Current Time (UTC):', nowUTC.format('YYYY-MM-DD HH:mm:ss'));
//         console.log('🕐 Current Time (IST):', nowIST.format('YYYY-MM-DD HH:mm:ss'));

//         const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//         const usedTokens = userUsage.tokens_used || 0;
//         const availableTokens = totalTokens - usedTokens;
//         const requestedTokens = requestedResources.tokens || 0;

//         console.log(`📊 Tokens: Used=${usedTokens}, Available=${availableTokens}, Requested=${requestedTokens}`);

//         // --- Tokens exhausted ---
//         if (requestedTokens > availableTokens) {
//             if (!userUsage.last_token_grant) {
//                 // First exhaustion → start cooldown (store in UTC)
//                 const exhaustionUTC = nowUTC.toISOString();
//                 await this.updateLastGrant(userId, exhaustionUTC);

//                 // Calculate next renewal in UTC, then convert to IST for display
//                 const nextRenewUTC = nowUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');
//                 const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);

//                 console.log('⛔ TOKENS EXHAUSTED - Starting cooldown');
//                 console.log('⏰ Renewal at (UTC):', nextRenewUTC.format('YYYY-MM-DD HH:mm:ss'));
//                 console.log('⏰ Renewal at (IST):', nextRenewIST.format('YYYY-MM-DD HH:mm:ss'));

//                 return {
//                     allowed: false,
//                     message: `Tokens exhausted! Next renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                     nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
//                     exhaustedAt: nowIST.format('DD-MM-YYYY hh:mm A')
//                 };
//             } else {
//                 // Already in cooldown - database has UTC timestamp
//                 const lastGrantUTC = moment.utc(userUsage.last_token_grant);
//                 const nextRenewUTC = lastGrantUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');

//                 console.log('⏳ IN COOLDOWN');
//                 console.log('📅 Exhausted at (UTC):', lastGrantUTC.format('YYYY-MM-DD HH:mm:ss'));
//                 console.log('📅 Renewal at (UTC):', nextRenewUTC.format('YYYY-MM-DD HH:mm:ss'));
//                 console.log('🕐 Current time (UTC):', nowUTC.format('YYYY-MM-DD HH:mm:ss'));

//                 // Compare in UTC to ensure accurate cooldown period
//                 if (nowUTC.isSameOrAfter(nextRenewUTC)) {
//                     // Cooldown finished → reset tokens
//                     console.log('✅ COOLDOWN COMPLETE - Resetting tokens');
//                     await this.resetTokens(userId);
//                     return {
//                         allowed: true,
//                         message: `Tokens renewed at ${nowIST.format('DD-MM-YYYY hh:mm A')} IST`
//                     };
//                 } else {
//                     // Still in cooldown - calculate remaining time in UTC
//                     const remaining = moment.duration(nextRenewUTC.diff(nowUTC));
//                     const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);
//                     const exhaustedAtIST = lastGrantUTC.clone().tz(TIMEZONE);

//                     const hoursLeft = Math.floor(remaining.asHours());
//                     const minutesLeft = remaining.minutes();

//                     console.log(`⏱️  Time remaining: ${hoursLeft}h ${minutesLeft}m`);

//                     return {
//                         allowed: false,
//                         message: `Tokens exhausted. Wait ${hoursLeft}h ${minutesLeft}m for renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
//                         nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
//                         exhaustedAt: exhaustedAtIST.format('DD-MM-YYYY hh:mm A'),
//                         remainingTime: {
//                             hours: hoursLeft,
//                             minutes: minutesLeft
//                         }
//                     };
//                 }
//             }
//         }

//         // --- Enough tokens ---
//         console.log('✅ TOKENS AVAILABLE');
//         return { allowed: true };
//     }

//     // --- Increment usage after operation ---
//     static async incrementUsage(userId, requestedResources, userUsage, userPlan) {
//         const client = await pool.connect();
//         try {
//             const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;
//             const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
//             const availableTokens = totalTokens - (userUsage.tokens_used || 0);

//             if (tokens > availableTokens) {
//                 throw new Error(`Cannot use ${tokens} tokens. Only ${availableTokens} available.`);
//             }

//             await client.query(
//                 `UPDATE user_usage SET
//                     tokens_used = tokens_used + $1,
//                     documents_used = documents_used + $2,
//                     ai_analysis_used = ai_analysis_used + $3,
//                     storage_used_gb = storage_used_gb + $4,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $5`,
//                 [tokens, documents, ai_analysis, storage_gb, userId]
//             );

//         } finally {
//             client.release();
//         }
//     }

//     // --- Reset tokens after cooldown ---
//     static async resetTokens(userId) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET 
//                     tokens_used = 0, 
//                     last_token_grant = NULL,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $1`,
//                 [userId]
//             );
//         } finally {
//             client.release();
//         }
//     }

//     // --- Record cooldown start timestamp (store in UTC) ---
//     static async updateLastGrant(userId, exhaustionTimestamp) {
//         const client = await pool.connect();
//         try {
//             await client.query(
//                 `UPDATE user_usage SET
//                     last_token_grant = $1,
//                     updated_at = CURRENT_TIMESTAMP
//                  WHERE user_id = $2`,
//                 [exhaustionTimestamp, userId]
//             );
//         } finally {
//             client.release();
//         }
//     }
// }

// module.exports = TokenUsageService;



const pool = require('../config/db');
const axios = require('axios');
const moment = require('moment-timezone');

const TIMEZONE = 'Asia/Calcutta';       // IST for logs and messages
const TOKEN_RENEWAL_INTERVAL_HOURS = 9.5; // Cooldown period set to 9.5 hours

class TokenUsageService {

    // --- Fetch user's usage and plan ---
    static async getUserUsageAndPlan(userId, authorizationHeader) {
        let client;
        try {
            client = await pool.connect();

            // 1. Fetch usage data
            const usageRes = await client.query(
                'SELECT * FROM user_usage WHERE user_id = $1',
                [userId]
            );
            let userUsage = usageRes.rows[0];

            console.log(`\n📥 RAW DATABASE RESULT for user ${userId}:`);
            console.log(JSON.stringify(userUsage, null, 2));

            // 2. Fetch plan
            const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:5000';
            const planResp = await axios.get(
                `${gatewayUrl}/user-resources/user-plan/${userId}`,
                { headers: { Authorization: authorizationHeader } }
            );
            let userPlan = planResp.data?.data;

            if (!userPlan) {
                userPlan = {
                    id: 'default-free-plan',
                    name: 'Free Plan',
                    token_limit: 25000,
                    document_limit: 5,
                    ai_analysis_limit: 10,
                    storage_limit_gb: 0.1,
                    carry_over_limit: 0,
                    interval: 'monthly'
                };
            }

            // CRITICAL: Use UTC for consistency and IST only for period calculation alignment
            const nowUTC = moment.utc();
            const nowIST = nowUTC.clone().tz(TIMEZONE);
            let periodStart, periodEnd;

            switch (userPlan.interval) {
                case 'daily':
                    // Calculate start/end of day aligned with IST, then get the UTC equivalent
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

            let carryOverTokens = 0;

            if (userUsage) {
                // Database stores UTC, so we compare current UTC time against the DB's UTC period end time
                const usagePeriodEndUTC = moment.utc(userUsage.period_end);
                
                if (nowUTC.isAfter(usagePeriodEndUTC)) {
                    const unusedTokens = Math.max(0, userPlan.token_limit - userUsage.tokens_used);
                    carryOverTokens = Math.min(unusedTokens, userPlan.carry_over_limit);

                    await client.query(
                        `UPDATE user_usage SET
                            tokens_used = 0,
                            documents_used = 0,
                            ai_analysis_used = 0,
                            storage_used_gb = 0,
                            carry_over_tokens = $1,
                            period_start = $2,
                            period_end = $3,
                            last_token_grant = NULL, // Reset cooldown on full renewal
                            updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = $4`,
                        [carryOverTokens, periodStart.toISOString(), periodEnd.toISOString(), userId]
                    );

                    userUsage = {
                        ...userUsage,
                        tokens_used: 0,
                        documents_used: 0,
                        ai_analysis_used: 0,
                        storage_used_gb: 0,
                        carry_over_tokens: carryOverTokens,
                        period_start: periodStart.toISOString(),
                        period_end: periodEnd.toISOString(),
                        last_token_grant: null
                    };
                } else {
                    carryOverTokens = userUsage.carry_over_tokens || 0;
                }
            } else {
                // Insert new record if none exists
                await client.query(
                    `INSERT INTO user_usage (user_id, plan_id, tokens_used, documents_used, ai_analysis_used,
                                             storage_used_gb, carry_over_tokens, period_start, period_end, last_token_grant)
                     VALUES ($1,$2,0,0,0,0,0,$3,$4,NULL)`,
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
            console.error('❌ Error in getUserUsageAndPlan:', err);
            throw err;
        } finally {
            if (client) client.release();
        }
    }

    // --- Enforce token limits and 9.5-hour cooldown ---
    static async enforceLimits(userId, userUsage, userPlan, requestedResources = {}) {
        // CRITICAL: All time calculations must be in UTC for database consistency
        const nowUTC = moment.utc();
        const nowIST = nowUTC.clone().tz(TIMEZONE);

        console.log('--- ENFORCE LIMITS ---');
        console.log('🕐 Current Time (UTC):', nowUTC.format('YYYY-MM-DD HH:mm:ss'));
        console.log('🕐 Current Time (IST):', nowIST.format('YYYY-MM-DD HH:mm:ss'));

        const totalTokens = userPlan.token_limit + (userUsage.carry_over_tokens || 0);
        const usedTokens = userUsage.tokens_used || 0;
        const availableTokens = totalTokens - usedTokens;
        const requestedTokens = requestedResources.tokens || 0;

        console.log(`📊 Tokens: Total=${totalTokens}, Used=${usedTokens}, Available=${availableTokens}, Requested=${requestedTokens}`);

        // --- Check if user is currently in cooldown ---
        if (userUsage.last_token_grant) {
            // Interpret DB timestamp (which should be UTC) as pure UTC time.
            const lastGrantUTC = moment.utc(userUsage.last_token_grant);
            const nextRenewUTC = lastGrantUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');

            // --- DEBUG LOGGING FOR COOLDOWN CHECK ---
            console.log('⏳ IN COOLDOWN CHECK');
            console.log('📅 Exhausted at (UTC):', lastGrantUTC.format('YYYY-MM-DD HH:mm:ss'));
            console.log('📅 Renewal at (UTC):', nextRenewUTC.format('YYYY-MM-DD HH:mm:ss'));
            // ----------------------------------------

            // Compare in UTC to ensure accurate cooldown period
            if (nowUTC.isSameOrAfter(nextRenewUTC)) {
                // Cooldown finished → reset tokens
                console.log('✅ COOLDOWN COMPLETE - Resetting tokens');
                await this.resetTokens(userId);
                
                return {
                    allowed: true,
                    message: `Tokens renewed at ${nowIST.format('DD-MM-YYYY hh:mm A')} IST`
                };
            } else {
                // Still in cooldown - calculate remaining time in UTC
                const remaining = moment.duration(nextRenewUTC.diff(nowUTC));
                const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);
                const exhaustedAtIST = lastGrantUTC.clone().tz(TIMEZONE);

                const h = Math.floor(remaining.asHours());
                const m = remaining.minutes();
                const s = remaining.seconds();
                
                console.log(`⏱️  Time remaining: ${h}h ${m}m ${s}s`);

                return {
                    allowed: false,
                    message: `Tokens exhausted. Wait ${h}h ${m}m ${s}s for renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
                    nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
                    exhaustedAt: exhaustedAtIST.format('DD-MM-YYYY hh:mm A'),
                    remainingTime: {
                        hours: h,
                        minutes: m,
                        seconds: s
                    }
                };
            }
        }

        // --- Check general token limits ---
        if (requestedTokens > availableTokens) {
            // First exhaustion → start cooldown (store in UTC)
            const exhaustionUTC = nowUTC.toISOString();
            await this.updateLastGrant(userId, exhaustionUTC);

            // Calculate next renewal in UTC, then convert to IST for display
            const nextRenewUTC = nowUTC.clone().add(TOKEN_RENEWAL_INTERVAL_HOURS, 'hours');
            const nextRenewIST = nextRenewUTC.clone().tz(TIMEZONE);

            console.log('⛔ TOKENS EXHAUSTED - Starting cooldown');
            console.log('⏰ Renewal at (UTC):', nextRenewUTC.format('YYYY-MM-DD HH:mm:ss'));
            console.log('⏰ Renewal at (IST):', nextRenewIST.format('YYYY-MM-DD HH:mm:ss'));

            return {
                allowed: false,
                message: `Tokens exhausted! Next renewal at ${nextRenewIST.format('DD-MM-YYYY hh:mm A')} IST`,
                nextRenewalTime: nextRenewIST.format('DD-MM-YYYY hh:mm A'),
                exhaustedAt: nowIST.format('DD-MM-YYYY hh:mm A')
            };
        }

        // --- Enough tokens ---
        console.log('✅ TOKENS AVAILABLE');
        return { allowed: true };
    }

    // --- Increment usage after operation ---
    static async incrementUsage(userId, requestedResources, userPlan) {
        const client = await pool.connect();
        try {
            const { tokens = 0, documents = 0, ai_analysis = 0, storage_gb = 0 } = requestedResources;

            // Note: This function assumes enforceLimits has already checked availability.
            // Simplified error check for safety.
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

    // --- Reset tokens after cooldown ---
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

    // --- Record cooldown start timestamp (store UTC ISO string) ---
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
