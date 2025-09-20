
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Eye, EyeOff, Shield, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import PublicLayout from '../../layouts/PublicLayout';
import { useAuth } from '../../context/AuthContext';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const formRef = useRef(null);
  const isInView = useInView(formRef, { once: true });

  const validateEmail = (email) => {
    if (!email) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Email address is invalid.';
    return '';
  };

  const validatePassword = (password) => {
    if (!password) return 'Password is required.';
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Real-time validation feedback
    if (name === 'email') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        email: validateEmail(value),
      }));
    } else if (name === 'password') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        password: validatePassword(value),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    setErrors({
      email: emailError,
      password: passwordError,
    });

    if (emailError || passwordError) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        toast.success('Login successful!');
        setLoginSuccess(true);
        navigate('/dashboard');
      } else {
        toast.error(result.message || 'Login failed.');
      }
    } catch (error) {
      if (loginSuccess) {
        return;
      }
      toast.error(error.message || 'An unexpected error occurred. Please try again.');
      console.error('Unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const formVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      rotateX: -15
    },
    visible: { 
      opacity: 1, 
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const glowVariants = {
    initial: { scale: 1, opacity: 0.7 },
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <PublicLayout>
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-3xl opacity-20"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-gray-100 to-blue-100 rounded-full blur-3xl opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [360, 180, 0]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23374151' fill-opacity='0.3'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <motion.div 
          ref={formRef}
          className="max-w-md w-full space-y-8 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Form container with glassmorphism effect */}
          <motion.div 
            className="relative p-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden"
            variants={formVariants}
          >
            {/* Animated border glow */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-2xl blur-sm opacity-0"
              animate={{
                opacity: [0, 0.3, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Header section */}
            <motion.div 
              className="text-center"
              variants={itemVariants}
            >
              {/* Logo with glow effect */}
              <motion.div 
                className="relative inline-flex items-center justify-center mb-6"
                variants={itemVariants}
              >
                <motion.div 
                  className="absolute w-20 h-20 bg-gray-700 rounded-2xl blur-md opacity-20"
                  variants={glowVariants}
                  initial="initial"
                  animate="animate"
                />
                <motion.div 
                  className="relative w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl shadow-2xl flex items-center justify-center"
                  whileHover={{ 
                    scale: 1.05,
                    rotate: [0, -5, 5, 0],
                    transition: { duration: 0.3 }
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Shield className="w-8 h-8 text-white" />
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"
                    animate={{
                      opacity: [0, 0.3, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </motion.div>
              </motion.div>

              <motion.h2 
                className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-clip-text text-transparent mb-2"
                variants={itemVariants}
              >
                Welcome Back
              </motion.h2>
              
              <motion.p 
                className="text-gray-600 mb-8"
                variants={itemVariants}
              >
                Or{' '}
                <Link 
                  to="/register" 
                  className="font-medium text-gray-700 hover:text-gray-800 relative group"
                >
                  <span className="relative z-10">create a new account</span>
                  <motion.div 
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-gray-600 to-gray-700 group-hover:w-full transition-all duration-300"
                  />
                </Link>
              </motion.p>
            </motion.div>

            {/* Form */}
            <motion.form 
              className="space-y-6" 
              onSubmit={handleSubmit}
              variants={containerVariants}
            >
              {/* Email field */}
              <motion.div variants={inputVariants}>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <motion.div 
                    className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
                  </motion.div>
                  <motion.input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    } rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm`}
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    whileFocus={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  />
                  {errors.email && (
                    <motion.p 
                      className="mt-2 text-sm text-red-600"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </div>
              </motion.div>

              {/* Password field */}
              <motion.div variants={inputVariants}>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative group">
                  <motion.div 
                    className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
                  </motion.div>
                  <motion.input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className={`block w-full pl-10 pr-12 py-3 border ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    } rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm`}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    whileFocus={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  />
                  <motion.button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      animate={{ rotate: showPassword ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </motion.div>
                  </motion.button>
                  {errors.password && (
                    <motion.p 
                      className="mt-2 text-sm text-red-600"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </div>
              </motion.div>

              {/* Forgot password link */}
              <motion.div 
                className="flex items-center justify-end"
                variants={inputVariants}
              >
                <Link 
                  to="#" 
                  className="text-sm font-medium text-gray-700 hover:text-gray-800 relative group"
                >
                  <span className="relative z-10">Forgot your password?</span>
                  <motion.div 
                    className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-gray-600 to-gray-700 group-hover:w-full transition-all duration-300"
                  />
                </Link>
              </motion.div>

              {/* Submit button */}
              <motion.div variants={inputVariants}>
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  
                  <span className="relative z-10 flex items-center">
                    {isLoading ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                      </>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            </motion.form>

            {/* Floating elements */}
            <motion.div 
              className="absolute top-4 right-4 w-2 h-2 bg-gray-400 rounded-full opacity-30"
              animate={{
                y: [0, -10, 0],
                x: [0, 5, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="absolute bottom-4 left-4 w-3 h-3 bg-gray-300 rounded-full opacity-20"
              animate={{
                y: [0, -15, 0],
                x: [0, -8, 0]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </motion.div>

          {/* Additional features hint */}
          <motion.div 
            className="text-center"
            variants={itemVariants}
          >
            <motion.p 
              className="text-sm text-gray-500 flex items-center justify-center"
              whileHover={{ scale: 1.02 }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Secure login with enterprise-grade encryption
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </PublicLayout>
  );
};

export default LoginPage;