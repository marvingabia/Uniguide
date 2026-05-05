
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines
*/

import bcrypt from "bcrypt";
import { User, UserProgress, Activity, sequelize, Message, FitnessVideo } from "../models/index.js";

await sequelize.sync({ alter: true });

export const loginPage = (req, res) => {
  // Debug: Log Firebase config (remove in production)
  console.log('🔥 Firebase Config Check:');
  console.log('API Key:', process.env.FIREBASE_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('Auth Domain:', process.env.FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing');
  console.log('Project ID:', process.env.FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing');
  
  res.render("login", { 
    title: "Login", 
    email: '',
    // Pass Firebase config to frontend
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || ''
  });
};
export const registerPage = (req, res) => res.render("register", { title: "Register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });

export const dashboardPage = async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect("/login");
    
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.redirect("/login");
    
    // Redirect based on role
    if (user.role === 'admin') {
      return res.redirect("/admin/dashboard");
    } else if (user.role === 'counselor') {
      return res.redirect("/counselor/dashboard");
    }
    
    const progress = await UserProgress.findOne({ where: { userId: req.session.userId } });
    
    // Get published reading materials (limit 6 for dashboard)
    const { ReadingMaterial } = await import('../models/index.js');
    const materials = await ReadingMaterial.findAll({
      where: { isPublished: true },
      order: [['createdAt', 'DESC']],
      limit: 6
    });
    
    res.render("user/userdashboard", { 
      title: "Dashboard",
      user,
      progress: progress || { totalPoints: 0, level: 'beginner', currentStreak: 0 },
      todayActivities: 0,
      materials
    });
  } catch (error) {
    console.error(error);
    res.redirect("/login");
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    if (!email || !password) {
      return res.status(400).render("login", { 
        title: "Login",
        error_msg: "Email and password are required",
        email: email || '' // Preserve email
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`🔍 User not found: ${email}`);
      return res.status(401).render("login", { 
        title: "Login",
        error_msg: "Email or password is incorrect",
        email: email // Preserve email
      });
    }

    // Check account status
    if (user.accountStatus === 'pending') {
      return res.status(403).render("login", { 
        title: "Login",
        error_msg: "Your account is pending admin approval. Please wait for approval before logging in.",
        email: email // Preserve email
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(403).render("login", { 
        title: "Login",
        error_msg: "Your account has been rejected. Please contact the administrator.",
        email: email // Preserve email
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).render("login", { 
        title: "Login",
        error_msg: "Your account has been suspended. Please contact the administrator.",
        email: email // Preserve email
      });
    }

    console.log(`🔍 User found: ${email}, comparing passwords...`);
    const match = await bcrypt.compare(password, user.password);
    console.log(`✅ Password match result: ${match}`);
    
    if (!match) {
      console.log(`❌ Password mismatch for user: ${email}`);
      return res.status(401).render("login", { 
        title: "Login",
        error_msg: "Email or password is incorrect",
        email: email // Preserve email
      });
    }

    console.log(`✅ Login successful for: ${email} (${user.role})`);
    req.session.userId = user.id;
    
    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error("❌ Session save error:", err);
        return res.status(500).render("login", { 
          title: "Login",
          error_msg: "Session error occurred. Please try again.",
          email: email // Preserve email
        });
      }

      console.log(`✅ Session saved for user: ${user.id}`);

      // Log activity
      Activity.create({
        userId: user.id,
        type: 'login',
        description: `${user.name} logged in`,
        metadata: { ipAddress: req.ip }
      }).catch(err => console.error("Activity log error:", err));

      // Update last active
      user.update({ lastActive: new Date() })
        .catch(err => console.error("Update lastActive error:", err));

      // Redirect based on role
      console.log(`🚀 Redirecting ${user.role} to dashboard...`);
      if (user.role === 'admin') {
        res.redirect("/admin/dashboard");
      } else if (user.role === 'counselor') {
        res.redirect("/counselor/dashboard");
      } else {
        res.redirect("/user/dashboard");
      }
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).render("login", { 
      title: "Login",
      error_msg: "An error occurred during login. Please try again.",
      email: req.body.email || '' // Preserve email
    });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, isFaculty } = req.body;

    console.log('📝 Registration attempt:', { name, email, isFaculty });

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).render("register", { error_msg: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).render("register", { error_msg: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).render("register", { error_msg: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).render("register", { error_msg: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    
    // Determine role and status based on counselor checkbox
    // Checkbox can send 'true', 'on', or be undefined
    const isCounselor = isFaculty === 'true' || isFaculty === 'on' || isFaculty === true;
    const role = isCounselor ? 'counselor' : 'user';
    const accountStatus = isCounselor ? 'pending' : 'active';
    
    console.log('👤 Creating user with:', { role, accountStatus, isFaculty, isCounselor });
    
    const user = await User.create({ 
      name, 
      email, 
      password: hashed,
      role,
      accountStatus
    });
    
    console.log('✅ User created:', { id: user.id, name: user.name, role: user.role, accountStatus: user.accountStatus });
    
    // Only create user progress for regular users (not counselor)
    if (role === 'user') {
      await UserProgress.create({ 
        userId: user.id,
        totalGamesPlayed: 0,
        totalJournalEntries: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 'beginner',
        breathingBubbleStats: {},
        colorTapStats: {},
        gridMemoryStats: {},
        stressBallStats: {},
        achievements: []
      });
      console.log('📊 User progress created for regular user');
    } else {
      console.log('👨‍⚕️ Counselor user - no progress created');
    }

    // Log activity
    await Activity.create({
      userId: user.id,
      type: 'registration',
      description: `${name} registered as ${role}`,
      metadata: { ipAddress: req.ip, role, accountStatus }
    });

    // Different success messages based on role
    if (role === 'counselor') {
      res.render("login", { 
        success_msg: "Counselor account created! Your account is pending admin approval. You will be able to login once approved." 
      });
    } else {
      res.render("login", { 
        success_msg: "Account created successfully! Please log in with your credentials." 
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).render("register", { error_msg: "An error occurred during registration" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (userId) {
      const user = await User.findByPk(userId);
      if (user) {
        await user.update({ lastActive: new Date() });
      }
    }
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.redirect("/login");
  }
};

// Firebase Google Authentication Handler
export const firebaseGoogleAuth = async (req, res) => {
  try {
    const { idToken, email, name, photoURL, uid } = req.body;

    console.log('🔵 Firebase Google Auth request received');
    console.log('📧 Email:', email);
    console.log('👤 Name:', name);
    console.log('🆔 Firebase UID:', uid);

    if (!idToken || !email) {
      console.log('❌ Missing required data');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required authentication data' 
      });
    }

    // Verify the Firebase ID token (optional but recommended for production)
    // For now, we'll trust the token since it came from Firebase client SDK
    
    // Check if user exists in MySQL
    let user = await User.findOne({ where: { email } });

    if (user) {
      // User exists - update Firebase info if needed
      console.log('✅ Existing user found:', user.email);

      // Check account status
      if (user.accountStatus === 'pending') {
        return res.status(403).json({ 
          success: false, 
          error: 'Your account is pending admin approval. Please wait for approval before logging in.' 
        });
      }

      if (user.accountStatus === 'rejected') {
        return res.status(403).json({ 
          success: false, 
          error: 'Your account has been rejected. Please contact the administrator.' 
        });
      }

      if (user.accountStatus === 'suspended') {
        return res.status(403).json({ 
          success: false, 
          error: 'Your account has been suspended. Please contact the administrator.' 
        });
      }

      // Update Firebase UID and profile picture if not set
      if (!user.googleId || user.googleId !== uid) {
        await user.update({
          googleId: uid,
          profilePicture: photoURL || user.profilePicture,
          authProvider: 'firebase-google',
          lastActive: new Date()
        });
        console.log('🔗 Updated Firebase info for existing user');
      } else {
        await user.update({ lastActive: new Date() });
      }
    } else {
      // Create new user
      console.log('🆕 Creating new user from Firebase Google account');

      user = await User.create({
        name,
        email,
        googleId: uid,
        profilePicture: photoURL,
        authProvider: 'firebase-google',
        role: 'user',
        accountStatus: 'active',
        password: null // No password for Google users
      });

      // Create user progress for new user
      await UserProgress.create({ 
        userId: user.id,
        totalGamesPlayed: 0,
        totalJournalEntries: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 'beginner',
        breathingBubbleStats: {},
        colorTapStats: {},
        gridMemoryStats: {},
        stressBallStats: {},
        achievements: []
      });

      console.log('✅ New user created:', user.email);
    }

    // Create session
    req.session.userId = user.id;

    // Save session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Session created for user:', user.id);

    // Log activity
    await Activity.create({
      userId: user.id,
      type: 'login',
      description: `${user.name} logged in via Firebase Google`,
      metadata: { 
        ipAddress: req.ip,
        authProvider: 'firebase-google'
      }
    });

    // Determine redirect URL based on role
    let redirectUrl = '/user/dashboard';
    if (user.role === 'admin') {
      redirectUrl = '/admin/dashboard';
    } else if (user.role === 'counselor') {
      redirectUrl = '/counselor/dashboard';
    }

    console.log(`🚀 Redirecting ${user.role} to: ${redirectUrl}`);

    return res.json({ 
      success: true, 
      redirectUrl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Firebase Google Auth error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Handles profile update requests (name/email/password/profilePicture)
export const updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword, confirmPassword, selectedAvatar } = req.body;
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.redirect("/login");

    let error_msg;

    // if email changed, make sure it's not already taken by another account
    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.id !== user.id) {
        error_msg = "Email is already in use by another account.";
      }
    }

    // handle password change logic
    if (!error_msg && (newPassword || confirmPassword || currentPassword)) {
      if (!currentPassword) {
        error_msg = "You must enter your current password to change your password.";
      } else if (newPassword !== confirmPassword) {
        error_msg = "New password and confirmation do not match.";
      } else {
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
          error_msg = "Current password is incorrect.";
        } else if (newPassword && newPassword.length < 6) {
          error_msg = "New password must be at least 6 characters long.";
        } else if (newPassword) {
          const hashed = await bcrypt.hash(newPassword, 10);
          user.password = hashed;
        }
      }
    }

    if (!error_msg) {
      // apply name/email updates
      if (name) user.name = name;
      if (email) user.email = email;
      
      // Handle profile picture upload
      if (req.file) {
        // File was uploaded
        user.profilePicture = '/uploads/profiles/' + req.file.filename;
      } else if (selectedAvatar) {
        // Avatar emoji was selected
        user.profilePicture = selectedAvatar;
      }
      
      await user.save();
      
      // Update session user object so sidebar reflects changes immediately
      req.user = user;
    }

    const success_msg = error_msg ? null : "Profile updated successfully.";
    
    // Determine which profile page to render based on user role
    const profileView = user.role === 'counselor' ? 'counselor/profile' : 
                        user.role === 'admin' ? 'admin/profile' : 
                        'user/profile';
    
    res.render(profileView, { title: "My Profile", user, error_msg, success_msg });
  } catch (err) {
    console.error("Profile update error:", err);
    const profileView = req.user.role === 'counselor' ? 'counselor/profile' : 
                        req.user.role === 'admin' ? 'admin/profile' : 
                        'user/profile';
    res.status(500).render(profileView, {
      title: "My Profile",
      user: req.user,
      error_msg: "An error occurred while updating your profile."
    });
  }
};
