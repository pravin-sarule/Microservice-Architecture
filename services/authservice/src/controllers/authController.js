

// const bcrypt = require('bcryptjs');
// const User = require('../models/User');
// const Session = require('../models/Session');
// const { generateToken } = require('../utils/jwt');
// const { createAndSendOTP, verifyOTP } = require('../services/otpService');
// const admin = require('../config/firebase'); // Import Firebase Admin SDK
// const { OAuth2Client } = require('google-auth-library');
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// /**
//  * @description Registers a new user in the system.
//  * @route POST /api/auth/register
//  */
// const register = async (req, res) => {
//   const { username, email, password } = req.body;

//   try {
//     const existingUser = await User.findByEmail(email);
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       username,
//       email,
//       password: hashedPassword,
//       auth_type: 'manual',
//     });

//     const token = generateToken(user);

//     res.status(201).json({
//       message: 'User registered successfully',
//       token,
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         is_blocked: user.is_blocked,
//       },
//     });
//   } catch (error) {
//     console.error('Error during registration:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Logs in a user with provided email and password.
//  * @route POST /api/auth/login
//  */
// const login = async (req, res) => {
//   const { email, password } = req.body;
//   console.log(`[AuthController] Attempting login for email: ${email}`);

//   try {
//     const user = await User.findByEmail(email);
//     if (!user) {
//       console.log(`[AuthController] User not found for email: ${email}`);
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }
//     console.log(`[AuthController] User found: ${user.email}`);

//     if (user.is_blocked === true) {
//       return res.status(403).json({ message: 'You are blocked for policy violations.' });
//     }

//     if (!user.password || typeof user.password !== 'string' || user.password.trim() === '') {
//       console.log(`[AuthController] User ${user.email} has no password or invalid password format (social login or data issue).`);
//       return res.status(400).json({ message: 'Invalid credentials or account created via social login' });
//     }
//     console.log(`[AuthController] Comparing password for user: ${user.email}`);
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       console.log(`[AuthController] Password mismatch for user: ${user.email}`);
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }
//     console.log(`[AuthController] Password matched for user: ${user.email}`);

//     // Generate and send OTP
//     await createAndSendOTP(user.email);

//     res.status(200).json({
//       message: 'OTP sent to your email. Please verify to complete login.',
//       email: user.email,
//     });
//   } catch (error) {
//     console.error('[AuthController] Error during login:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Verifies OTP and logs in the user.
//  * @route POST /api/auth/verify-otp
//  */
// const verifyOtpAndLogin = async (req, res) => {
//   const { email, otp } = req.body;

//   try {
//     const isOTPValid = await verifyOTP(email, otp);

//     if (!isOTPValid) {
//       return res.status(400).json({ message: 'Invalid or expired OTP.' });
//     }

//     const user = await User.findByEmail(email);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found after OTP verification.' });
//     }

//     const token = generateToken(user);
//     await Session.create({ user_id: user.id, token });

//     res.status(200).json({
//       message: 'Login successful',
//       token,
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         is_blocked: user.is_blocked,
//       },
//     });

//   } catch (error) {
//     console.error('[AuthController] Error during OTP verification and login:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Updates the profile information for the authenticated user.
//  * @route PUT /api/auth/update
//  */
// const updateProfile = async (req, res) => {
//   const { fullname, email, password, phone, location } = req.body;
//   const userId = req.user.id;

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const updateFields = {};
//     if (fullname) updateFields.username = fullname;
//     if (email) {
//       const existingUser = await User.findByEmail(email);
//       if (existingUser && existingUser.id !== userId) {
//         return res.status(400).json({ message: 'Email already in use' });
//       }
//       updateFields.email = email;
//     }
//     if (password) {
//       updateFields.password = await bcrypt.hash(password, 10);
//     }
//     if (phone) updateFields.phone = phone;
//     if (location) updateFields.location = location;

//     const updatedUser = await User.update(userId, updateFields);

//     res.status(200).json({ message: 'Profile updated successfully', user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, role: updatedUser.role, is_blocked: updatedUser.is_blocked, phone: updatedUser.phone, location: updatedUser.location } });
//   } catch (error) {
//     console.error('Error updating profile:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Deletes the authenticated user's account.
//  * @route DELETE /api/auth/delete
//  */
// const deleteAccount = async (req, res) => {
//   const userId = req.user.id;

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     await user.delete();

//     res.status(200).json({ message: 'Account deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting account:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Logs out the authenticated user by deleting their session token.
//  * @route POST /api/auth/logout
//  */
// const logout = async (req, res) => {
//   const token = req.headers.authorization?.split(' ')[1];

//   try {
//     if (token) {
//       await Session.deleteByToken(token);
//     }
//     res.status(200).json({ message: 'Logged out successfully' });
//   } catch (error) {
//     console.error('Error during logout:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Fetches the profile details of the authenticated user.
//  * @route GET /api/auth/profile
//  */
// const fetchProfile = async (req, res) => {
//   const userId = req.user.id;

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     res.status(200).json({
//       message: 'User profile fetched successfully',
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         is_blocked: user.is_blocked,
//         phone: user.phone,
//         location: user.location,
//         created_at: user.created_at,
//         updated_at: user.updated_at,
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching profile:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Fetches a user by their ID.
//  * @route GET /api/users/:userId
//  */
// const getUserById = async (req, res) => {
//   const { userId } = req.params;

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     res.status(200).json({
//       message: 'User fetched successfully',
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         is_blocked: user.is_blocked,
//         phone: user.phone,
//         location: user.location,
//         created_at: user.created_at,
//         updated_at: user.updated_at,
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching user by ID:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

// /**
//  * @description Updates the Razorpay customer ID for a user.
//  * @route PUT /api/users/:id/razorpay-customer-id
//  */
// const updateRazorpayCustomerId = async (req, res) => {
//   const { id } = req.params;
//   const { razorpay_customer_id } = req.body;

//   try {
//     const user = await User.findById(id);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const updatedUser = await User.update(id, { razorpay_customer_id });

//     res.status(200).json({
//       message: 'Razorpay customer ID updated successfully',
//       user: {
//         id: updatedUser.id,
//         username: updatedUser.username,
//         email: updatedUser.email,
//         role: updatedUser.role,
//         is_blocked: updatedUser.is_blocked,
//         phone: updatedUser.phone,
//         location: updatedUser.location,
//         razorpay_customer_id: updatedUser.razorpay_customer_id,
//       },
//     });
//   } catch (error) {
//     console.error('Error updating Razorpay customer ID:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };



// /**
//  * @description Handles Google Sign-In and user creation if not already registered.
//  * @route POST /api/auth/google
//  */

// /**
//  * @description Handles Google Sign-In using Firebase ID Token
//  * @route POST /api/auth/firebase-google
//  */
// const firebaseGoogleSignIn = async (req, res) => {
//   const { idToken } = req.body; // Firebase ID token from frontend

//   try {
//     if (!idToken) {
//       return res.status(400).json({ message: "Firebase ID token is required" });
//     }

//     // Verify Firebase token
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     const { uid: firebase_uid, email, name, picture } = decodedToken;

//     if (!email) {
//       return res.status(400).json({ message: "Email not found in Firebase token" });
//     }

//     // Check if user already exists
//     let user = await User.findByEmail(email);

//     // If user doesn’t exist → create new
//     if (!user) {
//       const username = name || email.split("@")[0]; // fallback if no name

//       user = await User.create({
//         username,
//         email,
//         password: null, // Google users don’t have passwords
//         firebase_uid,
//         auth_type: "google",
//         profile_image: picture || null,
//       });

//       console.log(`[FirebaseSignIn] ✅ New user created: ${email}`);
//     } else {
//       console.log(`[FirebaseSignIn] 🔁 Existing user found: ${email}`);
//     }

//     // Check block status
//     if (user.is_blocked) {
//       return res.status(403).json({ message: "Your account is blocked by admin." });
//     }

//     // Generate app-specific JWT
//     const jwtToken = generateToken(user);

//     // Create new session entry
//     await Session.create({ user_id: user.id, token: jwtToken });

//     res.status(200).json({
//       message: "Firebase Google Sign-In successful",
//       token: jwtToken,
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         is_blocked: user.is_blocked,
//         profile_image: user.profile_image,
//       },
//     });
//   } catch (error) {
//     console.error("[FirebaseSignIn] ❌ Error verifying Firebase token:", error);
//     res.status(401).json({ message: "Invalid or expired Firebase token" });
//   }
// };




// module.exports = { register, login,  firebaseGoogleSignIn, verifyOtpAndLogin, updateProfile, deleteAccount, logout, fetchProfile, getUserById, updateRazorpayCustomerId };


const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const { generateToken } = require('../utils/jwt');
const { createAndSendOTP, verifyOTP } = require('../services/otpService');
const admin = require('../config/firebase'); // Import Firebase Admin SDK
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @description Registers a new user in the system.
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      auth_type: 'manual',
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
      },
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Logs in a user with provided email and password (REQUIRES OTP).
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AuthController] Attempting manual login for email: ${email}`);

  try {
    // 1. Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      console.log(`[AuthController] User not found for email: ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log(`[AuthController] User found: ${user.email}`);

    // 2. Check if user is blocked
    if (user.is_blocked === true) {
      return res.status(403).json({ message: 'You are blocked for policy violations.' });
    }

    // 3. Check if user has a password (manual auth users only)
    if (!user.password || typeof user.password !== 'string' || user.password.trim() === '') {
      console.log(`[AuthController] User ${user.email} has no password (likely Google sign-in user).`);
      return res.status(400).json({ 
        message: 'This account was created using Google Sign-In. Please use "Sign in with Google" button.' 
      });
    }

    // 4. Verify password
    console.log(`[AuthController] Comparing password for user: ${user.email}`);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[AuthController] Password mismatch for user: ${user.email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log(`[AuthController] ✅ Password matched for user: ${user.email}`);

    // 5. Generate and send OTP (REQUIRED for manual login)
    await createAndSendOTP(user.email);
    console.log(`[AuthController] ✅ OTP sent to: ${user.email}`);

    // 6. Return response with requiresOtp flag (tells frontend to show OTP screen)
    res.status(200).json({
      requiresOtp: true,  // ⚠️ CRITICAL: This flag tells frontend to switch to OTP screen
      success: true,
      message: 'OTP sent to your email. Please verify to complete login.',
      email: user.email,
    });
  } catch (error) {
    console.error('[AuthController] ❌ Error during manual login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Verifies OTP and logs in the user (MANUAL LOGIN COMPLETION).
 * @route POST /api/auth/verify-otp
 */
const verifyOtpAndLogin = async (req, res) => {
  const { email, otp } = req.body;
  console.log(`[AuthController] Attempting OTP verification for email: ${email}`);

  try {
    // 1. Verify OTP
    const isOTPValid = await verifyOTP(email, otp);

    if (!isOTPValid) {
      console.log(`[AuthController] ❌ Invalid or expired OTP for: ${email}`);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP. Please try again.' 
      });
    }
    console.log(`[AuthController] ✅ OTP verified successfully for: ${email}`);

    // 2. Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found after OTP verification.' 
      });
    }

    // 3. Generate JWT token
    const token = generateToken(user);

    // 4. Create session
    await Session.create({ user_id: user.id, token });
    console.log(`[AuthController] ✅ Session created for user: ${email}`);

    // 5. Return success response with token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
      },
    });

  } catch (error) {
    console.error('[AuthController] ❌ Error during OTP verification and login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

/**
 * @description Handles Google Sign-In using Firebase ID Token (NO OTP REQUIRED).
 * @route POST /api/auth/google
 */
const firebaseGoogleSignIn = async (req, res) => {
  const { idToken, email, displayName, photoURL, uid } = req.body;
  console.log(`[GoogleSignIn] Attempting Google Sign-In for email: ${email}`);

  try {
    // 1. Validate input
    if (!idToken) {
      return res.status(400).json({ message: "Firebase ID token is required" });
    }

    // 2. Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log(`[GoogleSignIn] ✅ Firebase token verified for: ${decodedToken.email}`);
    } catch (verifyError) {
      console.error('[GoogleSignIn] ❌ Firebase token verification failed:', verifyError);
      return res.status(401).json({ 
        message: 'Invalid or expired Firebase token. Please try signing in again.' 
      });
    }

    // 3. Extract user data from token
    const { 
      uid: firebase_uid, 
      email: tokenEmail, 
      name, 
      picture 
    } = decodedToken;

    const userEmail = tokenEmail || email;

    if (!userEmail) {
      return res.status(400).json({ message: "Email not found in Firebase token" });
    }

    // 4. Check if user already exists
    let user = await User.findByEmail(userEmail);

    // 5. If user doesn't exist → create new user
    if (!user) {
      const username = name || displayName || userEmail.split("@")[0];

      user = await User.create({
        username,
        email: userEmail,
        password: null, // Google users don't have passwords
        firebase_uid: firebase_uid || uid,
        auth_type: "google",
        profile_image: picture || photoURL || null,
      });

      console.log(`[GoogleSignIn] ✅ New Google user created: ${userEmail}`);
    } else {
      console.log(`[GoogleSignIn] ✅ Existing user found: ${userEmail}`);
      
      // Update firebase_uid if not set
      if (!user.firebase_uid && (firebase_uid || uid)) {
        await User.update(user.id, { firebase_uid: firebase_uid || uid });
      }
    }

    // 6. Check if user is blocked
    if (user.is_blocked) {
      return res.status(403).json({ 
        message: "Your account is blocked. Please contact support." 
      });
    }

    // 7. Generate JWT token (NO OTP REQUIRED for Google Sign-In)
    const jwtToken = generateToken(user);

    // 8. Create new session
    await Session.create({ user_id: user.id, token: jwtToken });
    console.log(`[GoogleSignIn] ✅ Session created for: ${userEmail}`);

    // 9. Return success response with token (user can proceed to dashboard immediately)
    res.status(200).json({
      message: "Google Sign-In successful",
      token: jwtToken,  // ⚠️ CRITICAL: Token returned immediately (no OTP required)
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        profile_image: user.profile_image,
      },
    });
  } catch (error) {
    console.error("[GoogleSignIn] ❌ Error during Google Sign-In:", error);
    res.status(500).json({ 
      message: "Internal server error during Google Sign-In" 
    });
  }
};

/**
 * @description Updates the profile information for the authenticated user.
 * @route PUT /api/auth/update
 */
const updateProfile = async (req, res) => {
  const { fullname, email, password, phone, location } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateFields = {};
    if (fullname) updateFields.username = fullname;
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updateFields.email = email;
    }
    if (password) {
      updateFields.password = await bcrypt.hash(password, 10);
    }
    if (phone) updateFields.phone = phone;
    if (location) updateFields.location = location;

    const updatedUser = await User.update(userId, updateFields);

    res.status(200).json({ 
      message: 'Profile updated successfully', 
      user: { 
        id: updatedUser.id, 
        username: updatedUser.username, 
        email: updatedUser.email, 
        role: updatedUser.role, 
        is_blocked: updatedUser.is_blocked, 
        phone: updatedUser.phone, 
        location: updatedUser.location 
      } 
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Deletes the authenticated user's account.
 * @route DELETE /api/auth/delete
 */
const deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.delete();

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Logs out the authenticated user by deleting their session token.
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    if (token) {
      await Session.deleteByToken(token);
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Fetches the profile details of the authenticated user.
 * @route GET /api/auth/profile
 */
const fetchProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User profile fetched successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        phone: user.phone,
        location: user.location,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Fetches a user by their ID.
 * @route GET /api/users/:userId
 */
const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User fetched successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        phone: user.phone,
        location: user.location,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Updates the Razorpay customer ID for a user.
 * @route PUT /api/users/:id/razorpay-customer-id
 */
const updateRazorpayCustomerId = async (req, res) => {
  const { id } = req.params;
  const { razorpay_customer_id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.update(id, { razorpay_customer_id });

    res.status(200).json({
      message: 'Razorpay customer ID updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        is_blocked: updatedUser.is_blocked,
        phone: updatedUser.phone,
        location: updatedUser.location,
        razorpay_customer_id: updatedUser.razorpay_customer_id,
      },
    });
  } catch (error) {
    console.error('Error updating Razorpay customer ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { 
  register, 
  login, 
  firebaseGoogleSignIn, 
  verifyOtpAndLogin, 
  updateProfile, 
  deleteAccount, 
  logout, 
  fetchProfile, 
  getUserById, 
  updateRazorpayCustomerId 
};