'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, Phone, User, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from '@/components/UI/Toast';

const DEMO_USERS = [
  { username: 'moxie', name: 'Moxie Marlinspike', role: 'Signal Founder', phone: '+15551234567' },
  { username: 'edward', name: 'Edward Snowden', role: 'Privacy Advocate', phone: '+15559876543' },
  { username: 'alex', name: 'Alex Rivera', role: 'Scaler Security Lead', phone: '+15553456789' },
  { username: 'sarah', name: 'Sarah Connor', role: 'Defense Lead', phone: '+15552345678' },
];

export function AuthModal() {
  const { user, login, register, sendOtp, verifyOtp, switchDemoUser, isLoading } = useAuth();

  const [mode, setMode] = useState<'otp' | 'password' | 'register'>('otp');
  const [phoneNumber, setPhoneNumber] = useState('+15551234567');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('password123');

  // If already authenticated, do not render modal
  if (user) return null;

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    try {
      const res = await sendOtp(phoneNumber);
      setOtpSent(true);
      setOtpCode(res.mock_otp || '123456');
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification code');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }
    try {
      await verifyOtp(phoneNumber, otpCode, username || undefined, displayName || undefined);
      toast.success('Welcome to Signal!');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    }
  };

  const handlePasswordLogin = async () => {
    if (!username.trim()) {
      toast.error('Please enter a username or phone number');
      return;
    }
    try {
      await login(username, password);
      toast.success('Logged in successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

  const handleRegister = async () => {
    if (!phoneNumber.trim() || !username.trim() || !displayName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await register(phoneNumber, username, displayName, password);
      toast.success('Account created!');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    }
  };

  const handleQuickDemoLogin = async (uname: string) => {
    try {
      await switchDemoUser(uname);
      toast.success(`Logged in as ${uname}!`);
    } catch (err: any) {
      toast.error(err.message || 'Demo login failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-neutral-100 dark:bg-[#1f2023] border border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100">
        {/* Brand Header */}
        <div className="p-6 text-center border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-200/50 dark:bg-neutral-900/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Lock className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Signal Messenger</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Privacy that fits in your pocket. Speak freely.
          </p>
        </div>

        {/* 1-Click Demo Accounts for Scaler Evaluators */}
        <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-b border-neutral-200 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Demo Accounts (Scaler Lab AI)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.username}
                disabled={isLoading}
                onClick={() => handleQuickDemoLogin(demo.username)}
                className="text-left p-2 rounded-xl bg-white dark:bg-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700 transition-all hover:scale-[1.02] shadow-xs"
              >
                <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                  {demo.name}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{demo.role}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Auth Body */}
        <div className="p-6">
          {mode === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="space-y-3 animate-in fade-in">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Verification Code
                      </label>
                      <span className="text-[11px] text-blue-500 cursor-pointer" onClick={handleSendOtp}>
                        Resend code
                      </span>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full pl-9 pr-3 py-2 text-sm tracking-widest font-mono rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Demo OTP is auto-filled to <code className="font-bold">123456</code>.
                    </p>
                  </div>

                  <button
                    onClick={handleVerifyOtp}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Enter Signal'}
                  </button>
                </div>
              )}

              <div className="pt-2 text-center text-xs text-neutral-500">
                <span>Prefer username/password? </span>
                <button
                  onClick={() => setMode('password')}
                  className="text-blue-500 hover:underline font-medium"
                >
                  Log In
                </button>
              </div>
            </div>
          )}

          {mode === 'password' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Username or Phone
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="moxie"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-transparent focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handlePasswordLogin}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-neutral-500">
                <button onClick={() => setMode('otp')} className="text-blue-500 hover:underline">
                  Phone OTP login
                </button>
                <button onClick={() => setMode('register')} className="text-blue-500 hover:underline font-medium">
                  Register new account
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alan Turing"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alan"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+15550001111"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-neutral-200/60 dark:bg-neutral-800 focus:outline-none"
                />
              </div>

              <button
                onClick={handleRegister}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all mt-2"
              >
                {isLoading ? 'Registering...' : 'Create Account'}
              </button>

              <div className="text-center pt-2 text-xs text-neutral-500">
                <span>Already have an account? </span>
                <button onClick={() => setMode('password')} className="text-blue-500 hover:underline">
                  Log in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
