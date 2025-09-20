import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Upload, Cpu, CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import PublicLayout from '../layouts/PublicLayout';

const LandingPage = () => {
  const { scrollY } = useScroll();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: true });
  const isFeaturesInView = useInView(featuresRef, { once: true });
  
  // Parallax effects
  const heroY = useTransform(scrollY, [0, 500], [0, -50]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.8]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
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

  const cardVariants = {
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
        duration: 0.7,
        ease: [0.25, 0.46, 0.45, 0.94]
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
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-3xl opacity-30"
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
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-gray-100 to-blue-100 rounded-full blur-3xl opacity-30"
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

      {/* Hero Section */}
      <motion.header 
        ref={heroRef}
        className="relative bg-gradient-to-br from-gray-50 via-white to-gray-50 py-20 shadow-xl border-b border-gray-200 overflow-hidden"
        style={{ y: heroY, opacity: heroOpacity }}
      >
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23374151' fill-opacity='0.3'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <motion.div 
          className="container mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate={isHeroInView ? "visible" : "hidden"}
        >
          {/* Logo with glow effect */}
          <motion.div 
            className="relative inline-flex items-center justify-center mb-8"
            variants={itemVariants}
          >
            <motion.div 
              className="absolute w-24 h-24 bg-gray-700 rounded-xl blur-md opacity-20"
              variants={glowVariants}
              initial="initial"
              animate="animate"
            />
            <motion.div 
              className="relative w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-2xl flex items-center justify-center"
              whileHover={{ 
                scale: 1.05,
                rotate: [0, -5, 5, 0],
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Shield className="w-10 h-10 text-white" />
              <motion.div 
                className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"
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

          <motion.h1 
            className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-clip-text text-transparent mb-6 leading-tight"
            variants={itemVariants}
          >
            <motion.span 
              className="inline-block"
              whileHover={{ scale: 1.05 }}
            >
              Nexintel AI
            </motion.span>
            <br />
            <motion.span 
              className="inline-block text-4xl sm:text-5xl lg:text-6xl"
              whileHover={{ scale: 1.05 }}
            >
              Legal Summarizer
            </motion.span>
          </motion.h1>

          <motion.p 
            className="text-xl sm:text-2xl text-gray-600 mb-10 font-medium max-w-3xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Transform complex legal documents into clear, actionable insights with the power of{' '}
            <motion.span 
              className="inline-flex items-center text-gray-800 font-semibold"
              whileHover={{ scale: 1.05 }}
            >
              <Sparkles className="w-5 h-5 mx-1" />
              AI intelligence
            </motion.span>
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row justify-center gap-6 items-center"
            variants={itemVariants}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link 
                to="/register" 
                className="group relative bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold py-4 px-10 rounded-xl text-lg shadow-2xl inline-flex items-center overflow-hidden transition-all duration-300"
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
                <FileText className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link 
                to="/about-nexintel" 
                className="group bg-white/80 backdrop-blur-sm hover:bg-white text-gray-800 font-bold py-4 px-10 rounded-xl text-lg shadow-xl border border-gray-200 hover:border-gray-300 inline-flex items-center transition-all duration-300"
              >
                <span>Learn More</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating elements */}
          <motion.div 
            className="absolute top-10 left-10 w-4 h-4 bg-gray-400 rounded-full opacity-30"
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div 
            className="absolute top-32 right-20 w-6 h-6 bg-gray-300 rounded-full opacity-20"
            animate={{
              y: [0, -30, 0],
              x: [0, -15, 0]
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </motion.div>
      </motion.header>

      {/* How it Works Section */}
      <motion.section 
        ref={featuresRef}
        className="py-20 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden"
      >
        <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <motion.h2 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-800 mb-4"
              whileHover={{ scale: 1.02 }}
            >
              How It{' '}
              <motion.span 
                className="inline-block bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                Works
              </motion.span>
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 mb-16 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={isFeaturesInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Three simple steps to transform your legal documents
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12"
            variants={containerVariants}
            initial="hidden"
            animate={isFeaturesInView ? "visible" : "hidden"}
          >
            {/* Step 1 */}
            <motion.div 
              className="group relative"
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.3 }
              }}
            >
              <motion.div 
                className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                animate={{
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              <div className="relative p-8 lg:p-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 group-hover:shadow-2xl transition-all duration-500">
                <motion.div 
                  className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-6 shadow-2xl group-hover:shadow-gray-400/50"
                  whileHover={{ 
                    rotate: [0, -10, 10, 0],
                    scale: 1.1
                  }}
                  transition={{ duration: 0.4 }}
                >
                  <Upload className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-2xl"
                    animate={{
                      opacity: [0, 0.5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0
                    }}
                  />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-4 group-hover:text-gray-900 transition-colors duration-300">
                  Upload Document
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  Securely upload your legal documents in various formats like PDF, DOCX, or TXT with enterprise-grade encryption.
                </p>

                {/* Step indicator */}
                <motion.div 
                  className="absolute -top-4 -right-4 w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isFeaturesInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  1
                </motion.div>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              className="group relative"
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.3 }
              }}
            >
              <motion.div 
                className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                animate={{
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.7
                }}
              />
              
              <div className="relative p-8 lg:p-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 group-hover:shadow-2xl transition-all duration-500">
                <motion.div 
                  className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-6 shadow-2xl group-hover:shadow-gray-400/50"
                  whileHover={{ 
                    rotate: [0, 180, 360],
                    scale: 1.1
                  }}
                  transition={{ duration: 0.8 }}
                >
                  <Cpu className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-2xl"
                    animate={{
                      opacity: [0, 0.5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.7
                    }}
                  />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-4 group-hover:text-gray-900 transition-colors duration-300">
                  AI-Powered Analysis
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  Advanced machine learning algorithms analyze content, identifying key legal points, clauses, and critical insights.
                </p>

                {/* Step indicator */}
                <motion.div 
                  className="absolute -top-4 -right-4 w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isFeaturesInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  2
                </motion.div>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              className="group relative"
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.3 }
              }}
            >
              <motion.div 
                className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                animate={{
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.4
                }}
              />
              
              <div className="relative p-8 lg:p-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 group-hover:shadow-2xl transition-all duration-500">
                <motion.div 
                  className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-6 shadow-2xl group-hover:shadow-gray-400/50"
                  whileHover={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ duration: 0.6 }}
                >
                  <CheckCircle className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-2xl"
                    animate={{
                      opacity: [0, 0.5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1.4
                    }}
                  />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-4 group-hover:text-gray-900 transition-colors duration-300">
                  Receive Summary
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  Get comprehensive, easy-to-understand summaries with actionable insights, saving hours of manual review.
                </p>

                {/* Step indicator */}
                <motion.div 
                  className="absolute -top-4 -right-4 w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isFeaturesInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  3
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Connection lines between steps (visible on larger screens) */}
          <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <motion.svg 
              width="600" 
              height="2" 
              viewBox="0 0 600 2" 
              className="absolute"
              initial={{ opacity: 0 }}
              animate={isFeaturesInView ? { opacity: 1 } : {}}
              transition={{ delay: 1.2, duration: 1 }}
            >
              <motion.line 
                x1="0" 
                y1="1" 
                x2="600" 
                y2="1" 
                stroke="url(#gradient)" 
                strokeWidth="2"
                strokeDasharray="10,5"
                initial={{ pathLength: 0 }}
                animate={isFeaturesInView ? { pathLength: 1 } : {}}
                transition={{ delay: 1.2, duration: 2 }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#374151" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#374151" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#374151" stopOpacity="0.3" />
                </linearGradient>
              </defs>
            </motion.svg>
          </div>
        </div>

        {/* Background decoration */}
        <motion.div 
          className="absolute top-20 right-10 w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full opacity-10 blur-2xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.section>
    </PublicLayout>
  );
};

export default LandingPage;