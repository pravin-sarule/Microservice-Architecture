import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { registerUser } from '../../api';
import { Eye, EyeOff, Shield, User, Mail, Lock, Check, X } from 'lucide-react';
import PublicLayout from '../../layouts/PublicLayout';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const validateUsername = (username) => {
    if (!username) return 'Username is required.';
    if (username.length < 3) return 'Username must be at least 3 characters.';
    return '';
  };

  const validateEmail = (email) => {
    if (!email) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Email address is invalid.';
    return '';
  };

  const getPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++; // Minimum length
    if (/[a-z]/.test(password)) score++; // Lowercase
    if (/[A-Z]/.test(password)) score++; // Uppercase
    if (/[0-9]/.test(password)) score++; // Numbers
    if (/[^A-Za-z0-9]/.test(password)) score++; // Special characters
    return score;
  };

  const validatePassword = (password) => {
    if (!password) return 'Password is required.';
    const strength = getPasswordStrength(password);
    if (strength < 4) return 'Password is too weak. Must include at least 8 characters, mixed case, numbers, and special characters.';
    return '';
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return 'Confirm Password is required.';
    if (confirmPassword !== password) return 'Passwords do not match.';
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Real-time validation feedback
    if (name === 'username') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        username: validateUsername(value),
      }));
    } else if (name === 'email') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        email: validateEmail(value),
      }));
    } else if (name === 'password') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        password: validatePassword(value),
      }));
      setErrors((prevErrors) => ({
        ...prevErrors,
        confirmPassword: validateConfirmPassword(formData.confirmPassword, value),
      }));
    } else if (name === 'confirmPassword') {
      setErrors((prevErrors) => ({
        ...prevErrors,
        confirmPassword: validateConfirmPassword(value, formData.password),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const usernameError = validateUsername(formData.username);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password);

    setErrors({
      username: usernameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
    });

    if (usernameError || emailError || passwordError || confirmPasswordError) {
      return;
    }

    try {
      const res = await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if (res.status === 201) {
        toast.success('Registration successful!');
        navigate('/login');
      } else {
        toast.error(res.data.message || 'Registration failed.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Network error. Please try again later.');
    }
  };

  const getStrengthColor = () => {
    const strength = getPasswordStrength(formData.password);
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    const strength = getPasswordStrength(formData.password);
    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    return 'Strong';
  };

  return (
    <PublicLayout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg z-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-xl mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-semibold text-gray-800">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Or <Link to="/login" className="font-medium text-gray-700 hover:text-gray-800">log in to your existing account</Link>
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${errors.username ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-sm`}
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                />
                {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username}</p>}
              </div>
              {/* Email Field */}
              <div className="mt-4">
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-sm`}
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
              </div>
              {/* Password Field */}
              <div className="mt-4">
                <label htmlFor="password" className="sr-only">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-sm`}
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <span
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </span>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                          style={{ width: `${(getPasswordStrength(formData.password) / 5) * 100}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-medium ${
                        getPasswordStrength(formData.password) <= 2 ? 'text-red-600' :
                        getPasswordStrength(formData.password) <= 3 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {getStrengthText()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center space-x-2">
                        {formData.password.length >= 8 ?
                          <Check className="w-3 h-3 text-green-500" /> :
                          <X className="w-3 h-3 text-red-500" />
                        }
                        <span>At least 8 characters</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password) ?
                          <Check className="w-3 h-3 text-green-500" /> :
                          <X className="w-3 h-3 text-red-500" />
                        }
                        <span>Mixed case letters</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/[0-9]/.test(formData.password) ?
                          <Check className="w-3 h-3 text-green-500" /> :
                          <X className="w-3 h-3 text-red-500" />
                        }
                        <span>Contains numbers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/[^A-Za-z0-9]/.test(formData.password) ?
                          <Check className="w-3 h-3 text-green-500" /> :
                          <X className="w-3 h-3 text-red-500" />
                        }
                        <span>Contains special characters</span>
                      </div>
                    </div>
                  </div>
                )}
                {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
              </div>
              {/* Confirm Password Field */}
              <div className="mt-4">
                <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-gray-500 focus:border-gray-500 focus:z-10 sm:text-sm`}
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  <span
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </span>
                </div>
                {errors.confirmPassword && <p className="mt-2 text-sm text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default RegisterPage;