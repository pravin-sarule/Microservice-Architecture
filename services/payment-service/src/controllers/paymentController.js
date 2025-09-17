const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db");
const TokenUsageService = require("../services/tokenUsageService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    return value;
  };
};

/**
 * @description Initiates a new subscription process with Razorpay for a user.
 * @route POST /api/payments/subscription/start
 */
const startSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { plan_id } = req.body;
    
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized user" });
    if (!plan_id) return res.status(400).json({ success: false, message: "Missing plan_id" });

    const planQuery = await db.query("SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true", [plan_id]);
    if (planQuery.rows.length === 0) return res.status(404).json({ success: false, message: "Plan not found or inactive" });
    
    const plan = planQuery.rows[0];
    if (!plan.razorpay_plan_id) {
      return res.status(500).json({ 
        success: false, 
        message: `Plan '${plan.name}' is not properly configured with Razorpay` 
      });
    }

    const userQuery = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userQuery.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    
    const user = userQuery.rows[0];

    let customerId = user.razorpay_customer_id;
    if (!customerId) {
      try {
        const customerData = { 
          name: user.name || user.username || `User ${user.id}`, 
          email: user.email, 
          fail_existing: 0 
        };
        
        if (user.phone || user.contact) {
          customerData.contact = user.phone || user.contact;
        }
        
        const customer = await razorpay.customers.create(customerData);
        customerId = customer.id;
        
        await db.query("UPDATE users SET razorpay_customer_id = $1 WHERE id = $2", [customerId, userId]);
      } catch (customerError) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create customer profile", 
          error: customerError?.message || "Unknown customer creation error" 
        });
      }
    }

    let subscription;
    try {
      const subscriptionData = {
        plan_id: plan.razorpay_plan_id,
        customer_notify: 1,
        quantity: 1,
        customer_id: String(customerId)
      };

      if (plan.interval !== 'lifetime') {
        subscriptionData.total_count = 12;
      } else {
        subscriptionData.total_count = 1;
      }

      console.log("Creating Razorpay subscription with data:", subscriptionData);
      subscription = await razorpay.subscriptions.create(subscriptionData);

      if (!subscription || !subscription.id) {
        throw new Error("Invalid subscription response from Razorpay");
      }

    } catch (err) {
      const safeError = {
        name: err?.name || "UnknownError",
        message: err?.message || "Subscription creation failed",
        razorpay_error: err?.error || null
      };

      console.error("Razorpay Subscription Error:", JSON.stringify(safeError, getCircularReplacer(), 2));

      return res.status(500).json({
        success: false,
        message: "Failed to create subscription",
        error: safeError.message,
        raw_error: JSON.stringify(safeError, getCircularReplacer())
      });
    }

    await db.query(
      `INSERT INTO user_subscriptions
        (user_id, plan_id, razorpay_subscription_id, status, current_token_balance, last_reset_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
         status = EXCLUDED.status,
         current_token_balance = EXCLUDED.current_token_balance,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, plan.id, subscription.id, subscription.status, plan.token_limit || 0]
    );

    if (plan.token_limit !== undefined && plan.token_limit !== null) {
      await TokenUsageService.resetUserUsage(userId, plan.token_limit, 'Initial Subscription Token Allocation');
    }

    return res.status(200).json({
      success: true,
      subscription_id: subscription.id,
      key: process.env.RAZORPAY_KEY_ID,
      customer_id: customerId,
      plan
    });

  } catch (err) {
    console.error("Unexpected error in startSubscription:", err);
    return res.status(500).json({
      success: false,
      message: "Subscription initiation failed due to an unexpected error.",
      error: err?.message || "Unknown error",
      raw_error: JSON.stringify(err, getCircularReplacer())
    });
  }
};

/**
 * @description Verifies a Razorpay subscription payment and updates the user's subscription status.
 * @route POST /api/payments/subscription/verify
 */
const verifySubscription = async (req, res) => {
  try {
    await db.query('BEGIN');
    
    const userId = req.user?.id;
    const { 
      razorpay_payment_id, 
      razorpay_subscription_id, 
      razorpay_signature,
      razorpay_order_id
    } = req.body;
    
    console.log(`Verifying subscription - User: ${userId}, Payment: ${razorpay_payment_id}, Subscription: ${razorpay_subscription_id}`);
    
    if (!userId || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing verification data" });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      console.log(`Invalid signature - Expected: ${expectedSignature}, Received: ${razorpay_signature}`);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log("Fetched payment details from Razorpay:", {
        id: paymentDetails.id,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: paymentDetails.status,
        method: paymentDetails.method,
        order_id: paymentDetails.order_id
      });
    } catch (fetchError) {
      console.error("Failed to fetch payment details:", fetchError);
      paymentDetails = {
        id: razorpay_payment_id,
        amount: 0,
        currency: 'INR',
        status: 'captured',
        method: 'unknown',
        order_id: razorpay_order_id || null
      };
    }

    const updateResult = await db.query(
      `UPDATE user_subscriptions 
       SET status = 'active', 
           razorpay_payment_id = $1, 
           activated_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP,
           last_reset_date = CURRENT_DATE
       WHERE user_id = $2 AND razorpay_subscription_id = $3 
       RETURNING *`,
      [razorpay_payment_id, userId, razorpay_subscription_id]
    );
    
    if (updateResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    const userSubscription = updateResult.rows[0];
    
    const planQuery = await db.query(
      "SELECT token_limit FROM subscription_plans WHERE id = $1", 
      [userSubscription.plan_id]
    );
    
    const tokenLimit = planQuery.rows.length > 0 ? planQuery.rows[0].token_limit : 0;

    await db.query(
      `INSERT INTO payments (
        user_id,
        subscription_id,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        amount,
        currency,
        status,
        payment_method,
        created_at,
        transaction_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_DATE)`,
      [
        userId,
        userSubscription.id,
        paymentDetails.id,
        paymentDetails.order_id || razorpay_order_id,
        razorpay_signature,
        paymentDetails.amount ? paymentDetails.amount / 100 : 0,
        paymentDetails.currency || 'INR',
        paymentDetails.status || 'captured',
        paymentDetails.method || 'unknown'
      ]
    );

    await TokenUsageService.resetUserUsage(userId, tokenLimit, 'Subscription Verified and Activated');

    await db.query('COMMIT');
    
    console.log(`Subscription verified successfully for user ${userId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: "Subscription verified successfully", 
      subscription: userSubscription 
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Subscription verification failed:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Subscription verification failed", 
      error: err.message 
    });
  }
};

/**
 * @description Handles incoming Razorpay webhook events to update subscription and payment statuses.
 * @route POST /api/webhook/razorpay
 */
const handleWebhook = async (req, res) => {
  try {
    await db.query('BEGIN');
    
    const signature = req.headers['x-razorpay-signature'];
    const payload = JSON.stringify(req.body);
    console.log(`Webhook received - Event: ${req.body.event}`);
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.log("Invalid webhook signature");
      return res.status(400).json({ message: "Invalid signature" });
    }
    
    const { event, payload: eventPayload } = req.body;
    console.log(`Processing webhook event: ${event}`);
    
    switch (event) {
      case 'subscription.activated':
        await handleSubscriptionActivated(eventPayload.subscription.entity);
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(eventPayload.payment.entity, eventPayload.subscription.entity);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(eventPayload.subscription.entity);
        break;
      case 'subscription.completed':
        await handleSubscriptionCompleted(eventPayload.subscription.entity);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }
    
    await db.query('COMMIT');
    return res.status(200).json({ status: 'ok' });
    
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Webhook handling failed:", err);
    return res.status(500).json({ message: "Webhook handling failed" });
  }
};

/**
 * @description Internal function to handle Razorpay `subscription.activated` webhook event.
 */
const handleSubscriptionActivated = async (subscription) => {
  try {
    console.log(`Activating subscription: ${subscription.id}`);
    
    const result = await db.query(
      `UPDATE user_subscriptions
       SET status = 'active', activated_at = CURRENT_TIMESTAMP, last_reset_date = CURRENT_DATE
       WHERE razorpay_subscription_id = $1 RETURNING user_id, plan_id`,
      [subscription.id]
    );
    
    if (result.rows.length > 0) {
      const { user_id, plan_id } = result.rows[0];
      console.log(`Subscription ${subscription.id} activated for user ${user_id}`);

      const planResult = await db.query(
        `SELECT token_limit FROM subscription_plans WHERE id = $1`,
        [plan_id]
      );
      
      if (planResult.rows.length > 0) {
        const tokenLimit = planResult.rows[0].token_limit;
        await TokenUsageService.resetUserUsage(user_id, tokenLimit, 'Subscription Activated');
        console.log(`User ${user_id} tokens reset to ${tokenLimit}`);
      }
    } else {
      console.warn(`No subscription found for Razorpay ID: ${subscription.id}`);
    }
  } catch (err) {
    console.error(`Error handling subscription activation for ${subscription.id}:`, err);
    throw err;
  }
};

/**
 * @description Internal function to handle Razorpay `subscription.charged` webhook event.
 */
const handleSubscriptionCharged = async (payment, subscription) => {
  try {
    console.log(`Handling charge for subscription: ${subscription.id}, payment: ${payment.id}`);
    
    const updateResult = await db.query(
      `UPDATE user_subscriptions
       SET razorpay_payment_id = $1,
           last_charged_at = CURRENT_TIMESTAMP,
           last_reset_date = CURRENT_DATE
       WHERE razorpay_subscription_id = $2 RETURNING id, user_id, plan_id`,
      [payment.id, subscription.id]
    );

    if (updateResult.rows.length > 0) {
      const { id: user_subscription_id, user_id, plan_id } = updateResult.rows[0];
      console.log(`Subscription ${subscription.id} charged for user ${user_id}`);

      const planResult = await db.query(
        `SELECT token_limit FROM subscription_plans WHERE id = $1`,
        [plan_id]
      );
      
      if (planResult.rows.length > 0) {
        const tokenLimit = planResult.rows[0].token_limit;
        await TokenUsageService.resetUserUsage(user_id, tokenLimit, 'Subscription Charged/Renewed');
        console.log(`User ${user_id} tokens reset to ${tokenLimit}`);
      }

      await db.query(
        `INSERT INTO payments (
          user_id,
          subscription_id,
          razorpay_payment_id,
          razorpay_order_id,
          amount,
          currency,
          status,
          payment_method,
          created_at,
          transaction_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_DATE)`,
        [
          user_id,
          user_subscription_id,
          payment.id,
          payment.order_id,
          payment.amount / 100,
          payment.currency,
          payment.status,
          payment.method
        ]
      );
      
      console.log(`Payment ${payment.id} recorded for user ${user_id}`);
    } else {
      console.warn(`No subscription found for Razorpay ID: ${subscription.id}`);
    }
  } catch (err) {
    console.error(`Error handling subscription charge for ${subscription.id}:`, err);
    throw err;
  }
};

/**
 * @description Internal function to handle Razorpay `subscription.cancelled` webhook event.
 */
const handleSubscriptionCancelled = async (subscription) => {
  try {
    await db.query(
      `UPDATE user_subscriptions
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE razorpay_subscription_id = $1`,
      [subscription.id]
    );
    console.log(`Subscription ${subscription.id} cancelled`);
  } catch (err) {
    console.error(`Error handling subscription cancellation for ${subscription.id}:`, err);
    throw err;
  }
};

/**
 * @description Internal function to handle Razorpay `subscription.completed` webhook event.
 */
const handleSubscriptionCompleted = async (subscription) => {
  try {
    await db.query(
      `UPDATE user_subscriptions
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE razorpay_subscription_id = $1`,
      [subscription.id]
    );
    console.log(`Subscription ${subscription.id} completed`);
  } catch (err) {
    console.error(`Error handling subscription completion for ${subscription.id}:`, err);
    throw err;
  }
};

/**
 * @description Retrieves the payment history for the authenticated user.
 * @route GET /api/payments/history
 */
const getUserPaymentHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const paymentHistory = await db.query(
      `SELECT
        p.id AS payment_id,
        p.razorpay_payment_id,
        p.razorpay_order_id,
        p.amount,
        p.currency,
        p.status AS payment_status,
        p.payment_method,
        p.created_at AS payment_date,
        p.transaction_date,
        
        us.id AS user_subscription_id,
        us.status AS subscription_status,
        us.start_date,
        us.end_date,

        sp.id AS plan_id,
        sp.name AS plan_name,
        sp.description AS plan_description,
        sp.price AS plan_price,
        sp.interval AS plan_interval,
        sp.token_limit AS plan_token_limit
      FROM payments p
      LEFT JOIN user_subscriptions us ON p.subscription_id = us.id
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC, p.id DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: paymentHistory.rows,
    });
  } catch (err) {
    console.error("Error fetching user payment history:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: err.message,
    });
  }
};

/**
 * @description Tests the configuration of subscription plans in the database and Razorpay.
 * @route GET /api/payments/test-config
 */
const testPlans = async (req, res) => {
  try {
    const dbPlans = await db.query("SELECT id, name, razorpay_plan_id, price, interval, is_active FROM subscription_plans ORDER BY id");
    const rzpPlans = await razorpay.plans.all({ count: 10 });
    
    return res.json({
      success: true,
      database_plans: dbPlans.rows,
      razorpay_plans: rzpPlans.items?.length || 0,
      razorpay_plan_details: rzpPlans.items?.map(p => ({ 
        id: p.id, 
        name: p.item?.name, 
        amount: p.item?.amount, 
        currency: p.item?.currency, 
        period: p.period 
      }))
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Plan test failed", 
      error: error.message 
    });
  }
};

/**
 * @description Tests the connection to the Razorpay API.
 * @route GET /api/payments/test-razorpay-connection
 */
const testRazorpayConnection = async (req, res) => {
  try {
    const plans = await razorpay.plans.all({ count: 1 });
    return res.status(200).json({
      success: true,
      message: "Successfully connected to Razorpay API",
      plans_count: plans.items.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to connect to Razorpay API",
      error: error.error?.description || error.message,
      raw_error: JSON.stringify(error)
    });
  }
};

/**
 * @description Controller to handle token usage check and deduction.
 *              The actual logic is handled by the checkTokenUsage middleware.
 * @route POST /api/payments/token-usage
 */
const checkAndDeductTokens = async (req, res) => {
  // If we reach here, the checkTokenUsage middleware has successfully
  // verified tokens and deducted them.
  return res.status(200).json({
    success: true,
    message: "Tokens checked and deducted successfully.",
    currentTokenBalance: req.user.current_token_balance // Provide updated balance
  });
};

/**
 * @description API endpoint to check and reserve tokens for a user.
 * @route POST /api/payments/token/check-reserve
 */
const checkAndReserveTokensApi = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { operationCost } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized user" });
    if (typeof operationCost === 'undefined' || operationCost <= 0) {
      return res.status(400).json({ success: false, message: "Bad Request: operationCost is missing or invalid." });
    }

    const tokensReserved = await TokenUsageService.checkAndReserveTokens(userId, operationCost);

    if (tokensReserved) {
      return res.status(200).json({ success: true, message: "Tokens checked and reserved successfully." });
    } else {
      return res.status(403).json({ success: false, message: "Insufficient tokens." });
    }
  } catch (error) {
    console.error("Error in checkAndReserveTokensApi:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * @description API endpoint to commit tokens for a user.
 * @route POST /api/payments/token/commit
 */
const commitTokensApi = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tokensUsed, actionDescription } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized user" });
    if (typeof tokensUsed === 'undefined' || tokensUsed <= 0) {
      return res.status(400).json({ success: false, message: "Bad Request: tokensUsed is missing or invalid." });
    }

    const committed = await TokenUsageService.commitTokens(userId, tokensUsed, actionDescription);

    if (committed) {
      return res.status(200).json({ success: true, message: "Tokens committed successfully." });
    } else {
      return res.status(400).json({ success: false, message: "Failed to commit tokens. Check balance or logs." });
    }
  } catch (error) {
    console.error("Error in commitTokensApi:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * @description API endpoint to rollback tokens for a user.
 * @route POST /api/payments/token/rollback
 */
const rollbackTokensApi = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tokensToRollback, actionDescription } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized user" });
    if (typeof tokensToRollback === 'undefined' || tokensToRollback <= 0) {
      return res.status(400).json({ success: false, message: "Bad Request: tokensToRollback is missing or invalid." });
    }

    const rolledBack = await TokenUsageService.rollbackTokens(userId, tokensToRollback, actionDescription);

    if (rolledBack) {
      return res.status(200).json({ success: true, message: "Tokens rolled back successfully." });
    } else {
      return res.status(400).json({ success: false, message: "Failed to rollback tokens. Check logs." });
    }
  } catch (error) {
    console.error("Error in rollbackTokensApi:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  startSubscription,
  verifySubscription,
  testPlans,
  testRazorpayConnection,
  handleWebhook,
  getUserPaymentHistory,
  checkAndDeductTokens,
  checkAndReserveTokensApi,
  commitTokensApi,
  rollbackTokensApi,
};