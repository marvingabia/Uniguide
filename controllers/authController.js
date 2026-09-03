import bcrypt from 'bcrypt';
import { User } from '../models/index.js';

// ── Helpers ─────────────────────────────────────────────────────
const setSession = (req, user) => {
  req.session.user = {
    id:        user.id,
    firstName: user.firstName,
    lastName:  user.lastName,
    email:     user.email,
    role:      user.role,
    avatar:    user.avatar || null
  };
};

const redirectByRole = (res, role) => {
  if (role === 'student')  return res.redirect('/student/dashboard');
  if (role === 'cashier')  return res.redirect('/cashier/dashboard');
  if (role === 'guidance') return res.redirect('/guidance/dashboard');
  res.redirect('/');
};

// ── Login ────────────────────────────────────────────────────────
export const showLogin = (req, res) => {
  if (req.session.user) return redirectByRole(res, req.session.user.role);
  res.render('login', { title: 'Sign In — UniGuide' });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  
  console.log('========================================');
  console.log('LOGIN DEBUG');
  console.log('========================================');
  console.log('Email sent:', JSON.stringify(email));
  console.log('Password sent:', JSON.stringify(password));
  console.log('Password length:', password?.length);
  
  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log('❌ User NOT found for email:', email);
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    console.log('✅ User found:');
    console.log('   ID:', user.id);
    console.log('   Name:', user.firstName, user.lastName);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Auth Method:', user.authMethod);
    console.log('   Has Password:', !!user.password);
    if (user.password) {
      console.log('   Password hash (first 30 chars):', user.password.substring(0, 30) + '...');
    }
    console.log('   Is Approved:', user.isApproved);

    // Google-only account trying to use password login
    if (user.authMethod === 'google' && !user.password) {
      console.log('❌ Google-only account detected');
      req.flash('error', 'This account uses Google Sign-In. Please click "Continue with Google".');
      return res.redirect('/login');
    }

    console.log('----------------------------------------');
    console.log('Testing password comparison...');
    
    if (!password) {
      console.log('❌ NO PASSWORD SENT');
      req.flash('error', 'Password is required.');
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, user.password);
    console.log('Password match result:', match);
    
    if (!match) {
      console.log('❌ Password MISMATCH');
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    console.log('✅ LOGIN SUCCESSFUL!');
    setSession(req, user);
    return redirectByRole(res, user.role);
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err.message);
    console.error(err.stack);
    req.flash('error', 'Server error: ' + err.message);
    res.redirect('/login');
  }
};

// ── Register ─────────────────────────────────────────────────────
export const showRegister = (req, res) => {
  if (req.session.user) return redirectByRole(res, req.session.user.role);
  res.render('register', { title: 'Register — UniGuide' });
};

export const register = async (req, res) => {
  const {
    firstName, lastName, email, password, confirmPassword,
    studentId, course, contactNo, yearLevel, section
  } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/register');
  }
  if (password.length < 8) {
    req.flash('error', 'Password must be at least 8 characters.');
    return res.redirect('/register');
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash('error', 'Email is already registered. Please use a different email or sign in.');
      return res.redirect('/register');
    }
    
    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      firstName, lastName, email,
      password: hashed,
      authMethod: 'local',
      role: 'student',
      studentId, course, contactNo, yearLevel, section
    });
    req.flash('success', 'Account created successfully! Please sign in with your email and password.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/register');
  }
};

// ── Google OAuth callback ─────────────────────────────────────────
export const googleCallback = async (req, res) => {
  try {
    // passport already verified & returned user via req.user
    if (!req.user) {
      req.flash('error', req.authInfo?.message || 'Google sign-in failed.');
      return res.redirect('/login');
    }
    setSession(req, req.user);
    return redirectByRole(res, req.user.role);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Google sign-in error. Please try again.');
    res.redirect('/login');
  }
};

// ── Logout ───────────────────────────────────────────────────────
export const logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
