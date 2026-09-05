import bcrypt from 'bcrypt';
import { User } from '../models/index.js';

/* =========================================================
   HELPERS
========================================================= */

const setSession = (req, user) => {
  req.session.user = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null
  };
};

const redirectByRole = (res, role) => {
  switch (role) {
    case 'student':
      return res.redirect('/student/dashboard');

    case 'cashier':
      return res.redirect('/cashier/dashboard');

    case 'guidance':
      return res.redirect('/guidance/dashboard');

    default:
      return res.redirect('/');
  }
};

/* =========================================================
   LOGIN PAGE
========================================================= */

export const showLogin = (req, res) => {
  if (req.session?.user) {
    return redirectByRole(res, req.session.user.role);
  }

  return res.render('login', {
    title: 'Sign In — UniGuide'
  });
};

/* =========================================================
   LOGIN
========================================================= */

export const login = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  console.log('');
  console.log('========================================');
  console.log('LOGIN DEBUG');
  console.log('========================================');
  console.log('Email:', email);
  console.log('Password received:', !!password);
  console.log('Password length:', password.length);
  console.log('Current Session ID:', req.sessionID);
  console.log('========================================');

  try {
    if (!email || !password) {
      req.flash(
        'error',
        'Email and password are required.'
      );

      return res.redirect('/login');
    }

    const user = await User.findOne({
      where: {
        email
      }
    });

    if (!user) {
      console.log('❌ USER NOT FOUND:', email);

      req.flash(
        'error',
        'Invalid email or password.'
      );

      return res.redirect('/login');
    }

    console.log('✅ USER FOUND');
    console.log('ID:', user.id);
    console.log('Name:', user.firstName, user.lastName);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Auth Method:', user.authMethod);
    console.log('Has Password:', !!user.password);
    console.log('Is Approved:', user.isApproved);

    /*
     * Google-only account
     */
    if (
      user.authMethod === 'google' &&
      !user.password
    ) {
      console.log('❌ GOOGLE-ONLY ACCOUNT');

      req.flash(
        'error',
        'This account uses Google Sign-In. Please click "Continue with Google".'
      );

      return res.redirect('/login');
    }

    /*
     * No password
     */
    if (!user.password) {
      console.log('❌ USER HAS NO PASSWORD');

      req.flash(
        'error',
        'This account cannot use password login.'
      );

      return res.redirect('/login');
    }

    console.log('----------------------------------------');
    console.log('Testing password comparison...');

    const match = await bcrypt.compare(
      password,
      user.password
    );

    console.log('Password match:', match);

    if (!match) {
      console.log('❌ PASSWORD MISMATCH');

      req.flash(
        'error',
        'Invalid email or password.'
      );

      return res.redirect('/login');
    }

    /*
     * LOGIN SUCCESS
     */
    console.log('');
    console.log('========================================');
    console.log('✅ LOGIN SUCCESSFUL');
    console.log('========================================');

    setSession(req, user);

    console.log('SESSION BEFORE SAVE:');
    console.log({
      sessionID: req.sessionID,
      user: req.session.user
    });

    /*
     * Save session before redirect
     */
    req.session.save((err) => {
      if (err) {
        console.error(
          '❌ SESSION SAVE ERROR:',
          err
        );

        req.flash(
          'error',
          'Unable to save login session. Please try again.'
        );

        return res.redirect('/login');
      }

      console.log('');
      console.log('========================================');
      console.log('✅ SESSION SAVED SUCCESSFULLY');
      console.log('========================================');
      console.log('Session ID:', req.sessionID);
      console.log('Session User:', req.session.user);
      console.log('Redirecting as role:', user.role);
      console.log('========================================');

      return redirectByRole(
        res,
        user.role
      );
    });

  } catch (err) {
    console.error('');
    console.error('========================================');
    console.error('❌ LOGIN ERROR');
    console.error('========================================');
    console.error(err.message);
    console.error(err.stack);

    req.flash(
      'error',
      'Server error: ' + err.message
    );

    return res.redirect('/login');
  }
};

/* =========================================================
   REGISTER PAGE
========================================================= */

export const showRegister = (req, res) => {
  if (req.session?.user) {
    return redirectByRole(
      res,
      req.session.user.role
    );
  }

  return res.render('register', {
    title: 'Register — UniGuide'
  });
};

/* =========================================================
   REGISTER
========================================================= */

export const register = async (req, res) => {
  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const confirmPassword = String(
    req.body?.confirmPassword || ''
  );

  const studentId = String(
    req.body?.studentId || ''
  ).trim();

  const course = String(
    req.body?.course || ''
  ).trim();

  const contactNo = String(
    req.body?.contactNo || ''
  ).trim();

  const yearLevel = String(
    req.body?.yearLevel || ''
  ).trim();

  const section = String(
    req.body?.section || ''
  ).trim();

  /*
   * Required fields
   */
  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !confirmPassword
  ) {
    req.flash(
      'error',
      'Please complete all required fields.'
    );

    return res.redirect('/register');
  }

  /*
   * Password confirmation
   */
  if (password !== confirmPassword) {
    req.flash(
      'error',
      'Passwords do not match.'
    );

    return res.redirect('/register');
  }

  /*
   * Password length
   */
  if (password.length < 8) {
    req.flash(
      'error',
      'Password must be at least 8 characters.'
    );

    return res.redirect('/register');
  }

  try {
    /*
     * Check existing account
     */
    const existing = await User.findOne({
      where: {
        email
      }
    });

    if (existing) {
      req.flash(
        'error',
        'Email is already registered. Please use a different email or sign in.'
      );

      return res.redirect('/register');
    }

    /*
     * Hash password
     */
    const hashed = await bcrypt.hash(
      password,
      10
    );

    /*
     * Create student account
     */
    await User.create({
      firstName,
      lastName,
      email,
      password: hashed,
      authMethod: 'local',
      role: 'student',
      studentId: studentId || null,
      course: course || null,
      contactNo: contactNo || null,
      yearLevel: yearLevel || null,
      section: section || null
    });

    console.log(
      '✅ STUDENT ACCOUNT CREATED:',
      email
    );

    req.flash(
      'success',
      'Account created successfully! Please sign in with your email and password.'
    );

    return res.redirect('/login');

  } catch (err) {
    console.error(
      'REGISTRATION ERROR:',
      err
    );

    req.flash(
      'error',
      'Registration failed. Please try again.'
    );

    return res.redirect('/register');
  }
};

/* =========================================================
   GOOGLE OAUTH CALLBACK
========================================================= */

export const googleCallback = async (req, res) => {
  try {
    /*
     * Passport already verified the user.
     */
    if (!req.user) {
      req.flash(
        'error',
        req.authInfo?.message ||
          'Google sign-in failed.'
      );

      return res.redirect('/login');
    }

    console.log('');
    console.log('========================================');
    console.log('GOOGLE LOGIN SUCCESS');
    console.log('========================================');
    console.log('User:', req.user.email);
    console.log('Role:', req.user.role);

    /*
     * Create normal application session
     */
    setSession(
      req,
      req.user
    );

    console.log(
      'Google session before save:',
      req.session.user
    );

    /*
     * Save session before redirect
     */
    req.session.save((err) => {
      if (err) {
        console.error(
          '❌ GOOGLE SESSION SAVE ERROR:',
          err
        );

        req.flash(
          'error',
          'Unable to save Google login session. Please try again.'
        );

        return res.redirect('/login');
      }

      console.log(
        '✅ GOOGLE SESSION SAVED:',
        req.sessionID
      );

      return redirectByRole(
        res,
        req.user.role
      );
    });

  } catch (err) {
    console.error(
      'GOOGLE LOGIN ERROR:',
      err
    );

    req.flash(
      'error',
      'Google sign-in error. Please try again.'
    );

    return res.redirect('/login');
  }
};

/* =========================================================
   LOGOUT
========================================================= */

export const logout = (req, res) => {
  console.log('');
  console.log('========================================');
  console.log('LOGOUT REQUEST');
  console.log('========================================');

  console.log(
    'Session ID:',
    req.sessionID
  );

  console.log(
    'User:',
    req.session?.user || null
  );

  /*
   * Destroy session
   */
  req.session.destroy((err) => {
    if (err) {
      console.error(
        '❌ LOGOUT ERROR:',
        err
      );

      return res.redirect('/login');
    }

    /*
     * Clear session cookie
     */
    res.clearCookie(
      'uniguide.sid',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
      }
    );

    console.log(
      '✅ SESSION DESTROYED'
    );

    return res.redirect('/login');
  });
};