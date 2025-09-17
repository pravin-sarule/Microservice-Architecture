// const { verifyToken } = require('../utils/jwt');

// const authenticateToken = async (req, res, next) => {
//   try {
//     console.log("🔐 Checking token...");
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];

//     if (!token) {
//       console.log("❌ No authentication token provided.");
//       console.log("❌ Authentication failed: No token provided.");
//       return res.status(401).json({ message: 'Authentication token required' });
//     }
//     console.log("✅ Token received, attempting to verify...");

//     const decoded = verifyToken(token);
//     if (!decoded) {
//       console.log("❌ Invalid or expired token.");
//       console.log("❌ Authentication failed: Invalid or expired token.");
//       return res.status(403).json({ message: 'Invalid or expired token' });
//     }
//     console.log("✅ Token decoded, userId:", decoded.id || decoded.userId);

//     const userId = decoded.id || decoded.userId;
//     if (!userId) {
//       console.log("❌ User ID missing from token.");
//       console.log("❌ Authentication failed: User ID missing from token payload.");
//       return res.status(400).json({ message: 'User ID missing from token' });
//     }
//     console.log("🔍 Searching for user with ID:", userId);

//     // In a microservice architecture, we trust the JWT payload for user info
//     // Assuming the decoded token contains at least an 'id' and potentially a 'role'
//     const user = {
//       id: userId,
//       role: decoded.role || 'user', // Default role if not present in token
//       // Add other relevant user info from decoded token if available and needed
//     };

//     req.user = user;
//     req.userId = userId; // Ensure userId is also set directly
//     console.log("✅ User authenticated:", user.id);
//     next();
//   } catch (error) {
//     console.error('❌ Error authenticating token:', error.message);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// const authorize = (roles = []) => {
//   if (typeof roles === 'string') roles = [roles];
//   return (req, res, next) => {
//     if (!req.user || (roles.length > 0 && !roles.includes(req.user.role))) {
//       return res
//         .status(403)
//         .json({ message: 'Forbidden: You do not have permission to access this resource.' });
//     }
//     next();
//   };
// };

// module.exports = {
//   protect: authenticateToken,
//   authorize,
// };
// middleware/auth.js
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to authenticate JWT token
 */
const authenticateToken = (req, res, next) => {
  try {
    console.log("🔐 Checking token...");

    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      console.log("❌ No authentication token provided.");
      return res.status(401).json({ message: 'Authentication token required' });
    }

    console.log("✅ Token received, verifying...");
    const decoded = verifyToken(token);

    if (!decoded) {
      console.log("❌ Invalid or expired token.");
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    const userId = decoded.id || decoded.userId;
    if (!userId) {
      console.log("❌ User ID missing in token payload.");
      return res.status(400).json({ message: 'User ID missing from token' });
    }

    // Attach user info from token payload to req
    req.user = {
      id: userId,
      email: decoded.email || null,
      role: decoded.role || 'user', // Default to "user" if not provided
    };
    req.userId = userId;

    console.log("✅ User authenticated:", req.user);
    next();
  } catch (error) {
    console.error("❌ Error authenticating token:", error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Middleware to authorize roles
 * @param {string|string[]} roles - Allowed roles
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Forbidden: You do not have permission to access this resource.',
      });
    }

    next();
  };
};

module.exports = {
  protect: authenticateToken,
  authorize,
};
