/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines
*/

import express from "express";
import { Op } from "sequelize";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from 'fs';
import * as authController from "../controllers/authController.js";
import { isAuthenticated } from "../middleware/auth.js";
import { isAdmin } from "../middleware/adminAuth.js";
import passport from "../config/passport.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed!'));
    }
  }
});

// Configure multer for profile picture uploads
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profiles/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadProfilePicture = multer({ 
  storage: profilePictureStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for images
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed!'));
    }
  }
});

// ==================== PUBLIC ROUTES ====================
router.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/user/dashboard");
  }
  res.render("home", { title: "Welcome to Tellngrow" });
});

router.get("/login", authController.loginPage);
router.post("/login", authController.loginUser);

// Firebase Google Authentication Route
router.post("/auth/firebase/google", authController.firebaseGoogleAuth);

// Google OAuth Routes (Legacy - Passport.js)
router.get("/auth/google", 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

router.get("/auth/google/callback",
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    console.log('✅ Google authentication successful');
    console.log('👤 User:', req.user.email);
    res.redirect('/user/dashboard');
  }
);

router.get("/register", authController.registerPage);
router.post("/register", authController.registerUser);

router.get("/forgot-password", authController.forgotPasswordPage);

router.get("/logout", authController.logoutUser);

// ==================== USER ROUTES (Protected) ====================
router.get("/dashboard", isAuthenticated, authController.dashboardPage);
router.get("/user/dashboard", isAuthenticated, authController.dashboardPage);

// User Profile Routes
router.get("/user/profile", isAuthenticated, (req, res) => {
  res.render("user/profile", { title: "My Profile", user: req.user });
});

// save profile changes
router.post("/user/profile", isAuthenticated, uploadProfilePicture.single('profilePicture'), authController.updateProfile);

router.get("/user/progress", isAuthenticated, (req, res) => {
  res.render("user/progress", { title: "My Progress", user: req.user });
});

// ==================== GAME ROUTES (Protected) ====================
router.get("/games", isAuthenticated, (req, res) => {
  res.render("games/game-select", { title: "Select a Game", user: req.user });
});

router.get("/games/breathing-bubble", isAuthenticated, (req, res) => {
  res.render("games/breathing-bubble", { title: "Breathing Bubble", user: req.user });
});

router.get("/games/color-tap", isAuthenticated, (req, res) => {
  res.render("games/color-tap", { title: "Color Tap", user: req.user });
});

router.get("/games/grid-memory", isAuthenticated, (req, res) => {
  res.render("games/grid-memory", { title: "Grid Memory", user: req.user });
});

router.get("/games/stress-ball", isAuthenticated, (req, res) => {
  res.render("games/stress-ball", { title: "Stress Ball", user: req.user });
});

router.get("/games/gratitude-jar", isAuthenticated, (req, res) => {
  res.render("games/gratitude-jar", { title: "Gratitude Jar", user: req.user });
});

router.get("/games/affirmation-cards", isAuthenticated, (req, res) => {
  res.render("games/affirmation-cards", { title: "Affirmation Cards", user: req.user });
});

router.get("/games/zen-garden", isAuthenticated, (req, res) => {
  res.render("games/zen-garden", { title: "Zen Garden", user: req.user });
});

router.get("/games/puzzle-therapy", isAuthenticated, (req, res) => {
  res.render("games/puzzle-therapy", { title: "Puzzle Therapy", user: req.user });
});

// ==================== QUIZ ROUTES (Protected) ====================
// Quiz feature removed - routes deprecated

// ==================== JOURNAL ROUTES (Protected) ====================
router.get("/journal", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    const entries = await JournalEntry.findAll({
      where: { userId: req.session.userId },
      order: [['createdAt', 'DESC']]
    });
    res.render("journal/entries", { title: "My Journal", user: req.user, entries });
  } catch (error) {
    console.error('Journal fetch error:', error);
    res.render("journal/entries", { title: "My Journal", user: req.user, entries: [] });
  }
});

router.get("/journal/new", isAuthenticated, (req, res) => {
  res.render("journal/new-entry", { title: "New Journal Entry", user: req.user });
});

router.post("/journal/new", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    const { title, mood, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).render("journal/new-entry", { 
        title: "New Journal Entry", 
        user: req.user,
        error_msg: "Title and content are required" 
      });
    }
    
    await JournalEntry.create({
      userId: req.session.userId,
      title,
      mood: mood || 'neutral',
      content
    });
    
    // Render the form again with success message instead of redirecting
    res.render("journal/new-entry", { 
      title: "New Journal Entry", 
      user: req.user,
      success_msg: "Journal entry saved successfully! You can write another entry or view your Journal Library." 
    });
  } catch (error) {
    console.error('Journal save error:', error);
    res.status(500).render("journal/new-entry", { 
      title: "New Journal Entry", 
      user: req.user,
      error_msg: "An error occurred while saving your entry" 
    });
  }
});

router.get("/journal/:id", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    const entry = await JournalEntry.findOne({
      where: { 
        id: req.params.id,
        userId: req.session.userId 
      }
    });
    
    if (!entry) {
      return res.redirect('/journal');
    }
    
    res.render("journal/view-entry", { title: "View Entry", user: req.user, entry });
  } catch (error) {
    console.error('Journal view error:', error);
    res.redirect('/journal');
  }
});

router.get("/journal/edit/:id", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    const entry = await JournalEntry.findOne({
      where: { 
        id: req.params.id,
        userId: req.session.userId 
      }
    });
    
    if (!entry) {
      return res.redirect('/journal');
    }
    
    res.render("journal/edit-entry", { title: "Edit Entry", user: req.user, entry });
  } catch (error) {
    console.error('Journal edit error:', error);
    res.redirect('/journal');
  }
});

router.post("/journal/edit/:id", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    const { title, mood, content } = req.body;
    
    const entry = await JournalEntry.findOne({
      where: { 
        id: req.params.id,
        userId: req.session.userId 
      }
    });
    
    if (!entry) {
      return res.redirect('/journal');
    }
    
    if (!title || !content) {
      return res.status(400).render("journal/edit-entry", { 
        title: "Edit Entry", 
        user: req.user,
        entry,
        error_msg: "Title and content are required" 
      });
    }
    
    await entry.update({
      title,
      mood: mood || 'neutral',
      content
    });
    
    res.redirect(`/journal/${entry.id}`);
  } catch (error) {
    console.error('Journal update error:', error);
    res.redirect('/journal');
  }
});

router.post("/journal/delete/:id", isAuthenticated, async (req, res) => {
  try {
    const { JournalEntry } = await import('../models/index.js');
    
    const entry = await JournalEntry.findOne({
      where: { 
        id: req.params.id,
        userId: req.session.userId 
      }
    });
    
    if (!entry) {
      return res.redirect('/journal');
    }
    
    await entry.destroy();
    
    req.flash('success_msg', 'Journal entry deleted successfully.');
    res.redirect('/journal');
  } catch (error) {
    console.error('Journal delete error:', error);
    res.redirect('/journal');
  }
});

// ==================== READING MATERIAL ROUTES (Protected) ====================
router.get("/reading", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial, User } = await import('../models/index.js');
    
    console.log('📚 Fetching reading materials...');
    
    // Get all published materials
    const materials = await ReadingMaterial.findAll({
      where: { isPublished: true },
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['name']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`✅ Found ${materials.length} published materials`);
    if (materials.length > 0) {
      console.log('📋 Materials:', materials.map(m => ({ 
        id: m.id, 
        title: m.title, 
        fileType: m.fileType,
        isPublished: m.isPublished 
      })));
    }
    
    res.render("reading/materials", { 
      title: "Reading Materials", 
      user: req.user,
      materials
    });
  } catch (error) {
    console.error('❌ Reading materials error:', error);
    res.render("reading/materials", { 
      title: "Reading Materials", 
      user: req.user,
      materials: []
    });
  }
});

// Library view with sidebar (all books)
router.get("/reading/library", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial, User } = await import('../models/index.js');
    
    const materials = await ReadingMaterial.findAll({
      where: { isPublished: true },
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['name']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // If no materials, redirect back
    if (materials.length === 0) {
      return res.redirect('/reading');
    }
    
    // Redirect to first material with library sidebar
    res.redirect(`/reading/view/${materials[0].id}`);
  } catch (error) {
    console.error('Library error:', error);
    res.redirect('/reading');
  }
});

// API endpoint for library sidebar
router.get("/api/reading/materials", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial, User } = await import('../models/index.js');
    
    const materials = await ReadingMaterial.findAll({
      where: { isPublished: true },
      attributes: ['id', 'title', 'category', 'fileType', 'readingTime', 'views'],
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['name']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(materials);
  } catch (error) {
    console.error('API materials error:', error);
    res.status(500).json([]);
  }
});

// Download/View uploaded file
router.get("/reading/file/:id", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial } = await import('../models/index.js');
    const path = await import('path');
    const fs = await import('fs');
    
    const material = await ReadingMaterial.findByPk(req.params.id);
    
    if (!material || !material.isPublished) {
      return res.status(404).send('Material not found');
    }
    
    if (material.fileType === 'article') {
      return res.redirect(`/reading/${material.slug}`);
    }
    
    // Increment view count
    await material.increment('views');
    
    // Convert path back to filesystem path
    const filePath = material.filePath.startsWith('/') 
      ? 'public' + material.filePath 
      : material.filePath;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found on server');
    }
    
    // Set headers for inline display (not download)
    const ext = path.extname(material.fileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    }
    
    // Add CORS headers for Office Online Viewer
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Send file with inline disposition (display in browser, not download)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${material.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('File view error:', error);
    res.status(500).send('Error loading file');
  }
});

// View uploaded file in browser
router.get("/reading/view/:id", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial, User, SavedMaterial } = await import('../models/index.js');
    
    const material = await ReadingMaterial.findOne({
      where: { id: req.params.id, isPublished: true },
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['name']
      }]
    });
    
    if (!material) {
      return res.status(404).render("404", { title: "Material Not Found" });
    }
    
    if (material.fileType === 'article') {
      return res.redirect(`/reading/${material.slug}`);
    }
    
    // Check if user has saved this material
    const isSaved = await SavedMaterial.findOne({
      where: { userId: req.user.id, materialId: material.id }
    });
    
    // Increment view count
    await material.increment('views');
    
    res.render("reading/viewer", { 
      title: material.title, 
      user: req.user,
      material,
      isSaved: !!isSaved
    });
  } catch (error) {
    console.error('File view error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// Save/Bookmark material
router.post("/reading/save/:id", isAuthenticated, async (req, res) => {
  try {
    const { SavedMaterial } = await import('../models/index.js');
    
    // Check if already saved
    const existing = await SavedMaterial.findOne({
      where: { userId: req.user.id, materialId: req.params.id }
    });
    
    if (existing) {
      return res.json({ success: false, message: 'Already saved' });
    }
    
    await SavedMaterial.create({
      userId: req.user.id,
      materialId: req.params.id
    });
    
    console.log('✅ Material saved:', req.user.id, req.params.id);
    res.json({ success: true, message: 'Material saved successfully' });
  } catch (error) {
    console.error('Save material error:', error);
    res.status(500).json({ success: false, message: 'Error saving material' });
  }
});

// Unsave/Remove bookmark
router.post("/reading/unsave/:id", isAuthenticated, async (req, res) => {
  try {
    const { SavedMaterial } = await import('../models/index.js');
    
    const saved = await SavedMaterial.findOne({
      where: { userId: req.user.id, materialId: req.params.id }
    });
    
    if (!saved) {
      return res.json({ success: false, message: 'Not saved' });
    }
    
    await saved.destroy();
    
    console.log('✅ Material unsaved:', req.user.id, req.params.id);
    res.json({ success: true, message: 'Material removed from saved' });
  } catch (error) {
    console.error('Unsave material error:', error);
    res.status(500).json({ success: false, message: 'Error removing material' });
  }
});

// Track reading activity
router.post("/api/reading/track", isAuthenticated, async (req, res) => {
  try {
    const { ReadingSession } = await import('../models/index.js');
    const { materialId, duration } = req.body;
    
    if (!materialId || !duration) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }
    
    // Find or create reading session for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let session = await ReadingSession.findOne({
      where: {
        userId: req.user.id,
        materialId: materialId,
        startTime: { [Op.gte]: today }
      }
    });
    
    if (session) {
      // Update existing session
      await session.update({
        duration: duration,
        endTime: new Date()
      });
    } else {
      // Create new session
      session = await ReadingSession.create({
        userId: req.user.id,
        materialId: materialId,
        duration: duration,
        endTime: new Date()
      });
    }
    
    console.log('📊 Reading tracked:', req.user.id, 'material:', materialId, 'duration:', duration, 'sec');
    res.json({ success: true });
  } catch (error) {
    console.error('Track reading error:', error);
    res.status(500).json({ success: false, message: 'Error tracking reading' });
  }
});

// View saved materials page
router.get("/reading/saved", isAuthenticated, async (req, res) => {
  try {
    const { SavedMaterial, ReadingMaterial, User } = await import('../models/index.js');
    
    const savedMaterials = await SavedMaterial.findAll({
      where: { userId: req.user.id },
      include: [{
        model: ReadingMaterial,
        as: 'material',
        where: { isPublished: true },
        include: [{
          model: User,
          as: 'counselor',
          attributes: ['name']
        }]
      }],
      order: [['savedAt', 'DESC']]
    });
    
    console.log(`📚 User ${req.user.id} has ${savedMaterials.length} saved materials`);
    
    res.render("reading/saved", { 
      title: "Saved Materials", 
      user: req.user,
      savedMaterials
    });
  } catch (error) {
    console.error('Saved materials error:', error);
    res.render("reading/saved", { 
      title: "Saved Materials", 
      user: req.user,
      savedMaterials: []
    });
  }
});

router.get("/reading/:slug", isAuthenticated, async (req, res) => {
  try {
    const { ReadingMaterial, User } = await import('../models/index.js');
    
    const material = await ReadingMaterial.findOne({
      where: { slug: req.params.slug, isPublished: true },
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['name']
      }]
    });
    
    if (!material) {
      return res.status(404).render("404", { title: "Material Not Found" });
    }
    
    // Increment view count
    await material.increment('views');
    
    res.render("reading/article", { 
      title: material.title, 
      user: req.user,
      material
    });
  } catch (error) {
    console.error('Article view error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// ==================== COUNSELOR ROUTES (Protected + Counselor Only) ====================
router.get("/counselor/dashboard", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).render("403", { title: "Access Denied" });
    }
    
    const { ReadingMaterial, Message } = await import('../models/index.js');
    
    // Get counselor's materials
    const materials = await ReadingMaterial.findAll({
      where: { counselorId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    // Calculate stats
    const totalMaterials = await ReadingMaterial.count({ where: { counselorId: req.user.id } });
    const publishedMaterials = await ReadingMaterial.count({ 
      where: { counselorId: req.user.id, isPublished: true } 
    });
    const totalViews = await ReadingMaterial.sum('views', { where: { counselorId: req.user.id } }) || 0;
    const unreadMessages = await Message.count({ where: { receiverId: req.user.id, isRead: false } });
    
    res.render("counselor/dashboard", { 
      title: "Counselor Dashboard", 
      user: req.user,
      stats: {
        totalMaterials,
        publishedMaterials,
        totalViews,
        totalReaders: 0,
        unreadMessages
      },
      materials
    });
  } catch (error) {
    console.error('Counselor dashboard error:', error);
    res.status(500).render("404", { title: "Error Loading Dashboard" });
  }
});

// Counselor Profile Routes
router.get("/counselor/profile", isAuthenticated, (req, res) => {
  if (req.user.role !== 'counselor') {
    return res.status(403).render("403", { title: "Access Denied" });
  }
  res.render("counselor/profile", { title: "My Profile", user: req.user });
});

router.post("/counselor/profile", isAuthenticated, uploadProfilePicture.single('profilePicture'), authController.updateProfile);

// Counselor Materials List
router.get("/counselor/materials", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).render("403", { title: "Access Denied" });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    
    const materials = await ReadingMaterial.findAll({
      where: { counselorId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.render("counselor/materials", { 
      title: "Manage Materials", 
      user: req.user,
      materials
    });
  } catch (error) {
    console.error('Counselor materials error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// New Material Form
router.get("/counselor/materials/new", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).render("403", { title: "Access Denied" });
    }
    
    res.render("counselor/new-material", { 
      title: "Add New Material", 
      user: req.user
    });
  } catch (error) {
    console.error('New material error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// Create Material (with file upload support)
router.post("/counselor/materials/create", isAuthenticated, upload.single('materialFile'), async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    const { title, category, excerpt, content, readingTime, isPublished, fileType } = req.body;
    
    // Create slug from title
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Prepare material data
    const materialData = {
      counselorId: req.user.id,
      title,
      slug,
      category,
      excerpt,
      content: content || '',
      fileType: fileType || 'article',
      readingTime: parseInt(readingTime) || 5,
      isPublished: isPublished === 'true' || isPublished === 'on'
    };
    
    // If file was uploaded, add file info
    if (req.file) {
      materialData.fileName = req.file.filename; // Actual saved filename (multer generated)
      // Remove 'public/' from path since Express serves public folder as static
      materialData.filePath = req.file.path.replace(/^public[\\/]/, '/');
      materialData.fileSize = req.file.size;
    }
    
    const material = await ReadingMaterial.create(materialData);
    
    console.log('✅ Material created:', material.id, material.title, fileType === 'article' ? '(Article)' : `(File: ${req.file?.originalname})`);
    res.redirect('/counselor/materials');
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).send('Error creating material: ' + error.message);
  }
});

// Edit Material Form
router.get("/counselor/materials/edit/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).render("403", { title: "Access Denied" });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    
    const material = await ReadingMaterial.findOne({
      where: { id: req.params.id, counselorId: req.user.id }
    });
    
    if (!material) {
      return res.status(404).render("404", { title: "Material Not Found" });
    }
    
    res.render("counselor/edit-material", { 
      title: "Edit Material", 
      user: req.user,
      material
    });
  } catch (error) {
    console.error('Edit material error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// Update Material
router.post("/counselor/materials/update/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    const { title, category, excerpt, content, readingTime, isPublished } = req.body;
    
    const material = await ReadingMaterial.findOne({
      where: { id: req.params.id, counselorId: req.user.id }
    });
    
    if (!material) {
      return res.status(404).send('Material not found');
    }
    
    // Update slug if title changed
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    await material.update({
      title,
      slug,
      category,
      excerpt,
      content,
      readingTime: parseInt(readingTime) || 5,
      isPublished: isPublished === 'true' || isPublished === 'on'
    });
    
    console.log('✅ Material updated:', material.id, material.title);
    res.redirect('/counselor/materials');
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).send('Error updating material');
  }
});

// Publish Material (Quick Action)
router.post("/counselor/materials/publish/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    
    const material = await ReadingMaterial.findOne({
      where: { id: req.params.id, counselorId: req.user.id }
    });
    
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    await material.update({ isPublished: true });
    
    console.log('✅ Material published:', material.id, material.title);
    res.json({ success: true, message: 'Material published successfully' });
  } catch (error) {
    console.error('Publish material error:', error);
    res.status(500).json({ error: 'Error publishing material' });
  }
});

// Delete Material
router.post("/counselor/materials/delete/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { ReadingMaterial, SavedMaterial, ReadingSession } = await import('../models/index.js');
    const fs = await import('fs');
    const path = await import('path');
    
    const material = await ReadingMaterial.findOne({
      where: { id: req.params.id, counselorId: req.user.id }
    });
    
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    // Delete related records first
    try {
      await SavedMaterial.destroy({ where: { materialId: req.params.id } });
      await ReadingSession.destroy({ where: { materialId: req.params.id } });
      console.log('🗑️ Related records deleted');
    } catch (relatedError) {
      console.error('Related records deletion error:', relatedError);
    }
    
    // Delete physical file if it exists
    if (material.filePath && material.fileType !== 'article') {
      try {
        const filePath = material.filePath.startsWith('/') 
          ? 'public' + material.filePath 
          : material.filePath;
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('🗑️ File deleted:', filePath);
        }
      } catch (fileError) {
        console.error('File deletion error:', fileError);
      }
    }
    
    // Delete the material from database
    await material.destroy();
    
    console.log('✅ Material deleted from database:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Error deleting material', message: error.message });
  }
});

// Analytics
router.get("/counselor/analytics", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') {
      return res.status(403).render("403", { title: "Access Denied" });
    }
    
    const { ReadingMaterial } = await import('../models/index.js');
    
    const totalMaterials = await ReadingMaterial.count({ where: { counselorId: req.user.id } });
    const publishedMaterials = await ReadingMaterial.count({ 
      where: { counselorId: req.user.id, isPublished: true } 
    });
    const totalViews = await ReadingMaterial.sum('views', { where: { counselorId: req.user.id } }) || 0;
    
    res.render("counselor/analytics", { 
      title: "Analytics", 
      user: req.user,
      stats: {
        totalMaterials,
        publishedMaterials,
        totalViews,
        avgRating: 0
      }
    });
  } catch (error) {
    console.error('Counselor analytics error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// ==================== ADMIN ROUTES (Protected + Admin Only) ====================
// Admin Profile Routes
router.get("/admin/profile", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/profile", { title: "Admin Profile", user: req.user });
});

router.post("/admin/profile", isAuthenticated, isAdmin, uploadProfilePicture.single('profilePicture'), authController.updateProfile);

router.get("/admin/dashboard", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User, UserProgress, Activity, GameSession, JournalEntry, ReadingSession, ReadingMaterial } = await import('../models/index.js');
    
    // Get pending counselor accounts (exclude current admin)
    const pendingCounselors = await User.findAll({
      where: {
        role: 'counselor',
        accountStatus: 'pending',
        id: { [Op.ne]: req.user.id }
      },
      order: [['createdAt', 'ASC']]
    });
    
    // Get all approved counselors (exclude current admin)
    const approvedCounselors = await User.findAll({
      where: {
        role: 'counselor',
        accountStatus: 'active',
        id: { [Op.ne]: req.user.id }
      },
      include: [{
        model: UserProgress,
        as: 'progress'
      }],
      order: [['lastActive', 'DESC']]
    });
    
    // Get detailed stats for each counselor
    const counselorsWithStats = await Promise.all(approvedCounselors.map(async (counselor) => {
      const gameSessions = await GameSession.findAll({
        where: { userId: counselor.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      const journalEntries = await JournalEntry.findAll({
        where: { userId: counselor.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      const readingSessions = await ReadingSession.findAll({
        where: { userId: counselor.id },
        include: [{
          model: ReadingMaterial,
          as: 'material',
          attributes: ['title', 'fileType']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      const totalGameTime = gameSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const totalReadingTime = readingSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      
      return {
        ...counselor.toJSON(),
        gameSessions,
        journalEntries,
        readingSessions,
        totalGameTime,
        totalReadingTime,
        totalActivities: gameSessions.length + journalEntries.length + readingSessions.length
      };
    }));
    
    // Get all regular users (exclude current admin)
    const users = await User.findAll({
      where: {
        role: 'user',
        id: { [Op.ne]: req.user.id }
      },
      include: [{
        model: UserProgress,
        as: 'progress'
      }],
      order: [['lastActive', 'DESC']]
    });
    
    // Get recent users (last 7 days) for notifications
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = await User.findAll({
      where: {
        role: 'user',
        createdAt: {
          [Op.gte]: sevenDaysAgo
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    const newUsersCount = recentUsers.length;
    
    // Get detailed stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const gameSessions = await GameSession.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      const journalEntries = await JournalEntry.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      const readingSessions = await ReadingSession.findAll({
        where: { userId: user.id },
        include: [{
          model: ReadingMaterial,
          as: 'material',
          attributes: ['title', 'fileType']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Calculate total time spent
      const totalGameTime = gameSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const totalReadingTime = readingSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      
      return {
        ...user.toJSON(),
        gameSessions,
        journalEntries,
        readingSessions,
        totalGameTime,
        totalReadingTime,
        totalActivities: gameSessions.length + journalEntries.length + readingSessions.length
      };
    }));
    
    // Get recent activities across all users
    const recentGameSessions = await GameSession.findAll({
      include: [{
        model: User,
        attributes: ['name', 'email'],
        where: { role: 'user' }
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    const recentJournals = await JournalEntry.findAll({
      include: [{
        model: User,
        attributes: ['name', 'email'],
        where: { role: 'user' }
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    const recentReading = await ReadingSession.findAll({
      include: [
        {
          model: User,
          attributes: ['name', 'email'],
          where: { role: 'user' }
        },
        {
          model: ReadingMaterial,
          as: 'material',
          attributes: ['title', 'fileType']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Get recent fitness activities
    let recentFitness = [];
    try {
      const { Activity } = await import('../models/index.js');
      recentFitness = await Activity.findAll({
        where: { type: 'fitness' },
        include: [{ model: User, attributes: ['name', 'email'] }],
        order: [['createdAt', 'DESC']],
        limit: 20
      });
    } catch (e) { console.error('Fitness activity fetch error:', e.message); }
    
    // Calculate statistics
    const totalUsers = await User.count({ where: { role: 'user' } });
    const totalGames = await GameSession.count();
    const totalJournals = await JournalEntry.count();
    const totalReadingSessions = await ReadingSession.count();
    const totalMaterials = await ReadingMaterial.count();
    const publishedMaterials = await ReadingMaterial.count({ where: { isPublished: true } });
    
    // Get all reading materials with counselor info
    const materials = await ReadingMaterial.findAll({
      include: [{
        model: User,
        as: 'counselor',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Get today's active users
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = await User.count({
      where: {
        role: 'user',
        lastActive: {
          [Op.gte]: today
        }
      }
    });
    
    // Game type statistics
    const gameStats = await GameSession.findAll({
      attributes: [
        'gameType',
        [GameSession.sequelize.fn('COUNT', GameSession.sequelize.col('id')), 'count'],
        [GameSession.sequelize.fn('SUM', GameSession.sequelize.col('duration')), 'totalDuration']
      ],
      group: ['gameType']
    });
    
    res.render("admin/admindashboard", { 
      title: "Admin Dashboard", 
      user: req.user,
      users: usersWithStats,
      counselors: counselorsWithStats,
      approvedCounselors,
      pendingCounselors,
      materials,
      recentGameSessions,
      recentJournals,
      recentFitness,
      recentReading,
      gameStats,
      recentUsers,
      newUsersCount,
      stats: {
        totalUsers,
        totalGames,
        totalJournals,
        totalReadingSessions,
        totalMaterials,
        publishedMaterials,
        activeToday,
        unreadAdminMessages: await (async () => {
          try {
            const { Message } = await import('../models/index.js');
            return await Message.count({ where: { receiverId: req.user.id, isRead: false } });
          } catch { return 0; }
        })()
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render("admin/admindashboard", { 
      title: "Admin Dashboard", 
      user: req.user,
      users: [],
      counselors: [],
      approvedCounselors: [],
      pendingCounselors: [],
      materials: [],
      recentGameSessions: [],
      recentJournals: [],
      recentFitness: [],
      recentReading: [],
      gameStats: [],
      recentUsers: [],
      newUsersCount: 0,
      stats: {
        totalUsers: 0,
        totalGames: 0,
        totalJournals: 0,
        totalReadingSessions: 0,
        totalMaterials: 0,
        publishedMaterials: 0,
        activeToday: 0
      }
    });
  }
});

router.get("/admin/analytics", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/analytics", { title: "Analytics", user: req.user });
});

router.get("/admin/settings", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/settings", { title: "Settings", user: req.user });
});

router.get("/admin/users", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin/users", { title: "User Management", user: req.user });
});

router.get("/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User, UserProgress, Activity, GameSession, JournalEntry, ReadingSession, ReadingMaterial } = await import('../models/index.js');
    const userId = req.params.id;
    
    // Get user with all their data
    const user = await User.findByPk(userId, {
      include: [{
        model: UserProgress,
        as: 'progress'
      }]
    });

    if (!user) {
      return res.status(404).render("404", { title: "User Not Found" });
    }

    // Get user's activities
    const activities = await Activity.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Get user's game sessions
    const gameSessions = await GameSession.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Get user's journal entries
    const journalEntries = await JournalEntry.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Get user's reading sessions
    const readingSessions = await ReadingSession.findAll({
      where: { userId },
      include: [{
        model: ReadingMaterial,
        as: 'material',
        attributes: ['title', 'fileType']
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.render("admin/user-detail", { 
      title: `User Details - ${user.name}`,
      user: req.user,
      targetUser: user,
      activities,
      gameSessions,
      journalEntries,
      readingSessions
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).render("404", { title: "Error Loading User" });
  }
});

// ==================== COUNSELOR APPROVAL ROUTES (Admin Only) ====================
router.post("/admin/counselor/approve/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User } = await import('../models/index.js');
    const counselor = await User.findByPk(req.params.id);
    
    if (!counselor || counselor.role !== 'counselor') {
      return res.status(404).json({ message: 'Counselor not found' });
    }
    
    await counselor.update({
      accountStatus: 'active',
      approvedBy: req.user.id,
      approvedAt: new Date()
    });
    
    res.json({ success: true, message: 'Counselor approved successfully' });
  } catch (error) {
    console.error('Approve counselor error:', error);
    res.status(500).json({ message: 'Failed to approve counselor' });
  }
});

router.post("/admin/counselor/reject/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User } = await import('../models/index.js');
    const { reason } = req.body;
    const counselor = await User.findByPk(req.params.id);
    
    if (!counselor || counselor.role !== 'counselor') {
      return res.status(404).json({ message: 'Counselor not found' });
    }
    
    await counselor.update({
      accountStatus: 'rejected',
      rejectionReason: reason || 'No reason provided'
    });
    
    res.json({ success: true, message: 'Counselor rejected' });
  } catch (error) {
    console.error('Reject counselor error:', error);
    res.status(500).json({ message: 'Failed to reject counselor' });
  }
});

// ==================== CERTIFICATE ROUTES (Admin Only) ====================
router.post("/admin/generate-certificate", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User, GameSession, Certificate } = await import('../models/index.js');
    const { generateCertificate } = await import('../utils/certificateGenerator.js');
    const { userId, type, activityName, sessionId } = req.body;

    // Get user details
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get session details to verify perfect score
    let score, maxScore;
    if (type === 'game') {
      const session = await GameSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Game session not found' });
      }
      score = session.score;
      maxScore = 100; // Default max score for games
    }

    // Check if certificate already exists
    const existing = await Certificate.findOne({
      where: {
        userId,
        type,
        activityName,
        score,
        maxScore
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Certificate already exists for this achievement' });
    }

    // Generate certificate PDF
    const certificateData = await generateCertificate({
      userName: user.name,
      activityName,
      type,
      score,
      maxScore,
      date: new Date()
    });

    // Save certificate to database
    const certificate = await Certificate.create({
      userId,
      certificateId: certificateData.certificateId,
      type,
      activityName,
      score,
      maxScore,
      fileName: certificateData.fileName,
      filePath: certificateData.filePath,
      url: certificateData.url,
      sentByAdmin: false
    });

    res.json({ 
      success: true, 
      message: 'Certificate generated successfully',
      certificate 
    });
  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).json({ message: 'Failed to generate certificate', error: error.message });
  }
});

router.post("/admin/certificates/send/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { Certificate } = await import('../models/index.js');
    const certificate = await Certificate.findByPk(req.params.id);

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    // Mark certificate as sent
    certificate.sentByAdmin = true;
    certificate.sentAt = new Date();
    await certificate.save();

    res.json({ 
      success: true, 
      message: 'Certificate marked as sent to user' 
    });
  } catch (error) {
    console.error('Send certificate error:', error);
    res.status(500).json({ message: 'Failed to send certificate' });
  }
});

router.get("/admin/certificates/download/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { Certificate } = await import('../models/index.js');
    const path = await import('path');
    
    const certificate = await Certificate.findByPk(req.params.id);

    if (!certificate) {
      return res.status(404).send('Certificate not found');
    }

    // Send file for download
    res.download(certificate.filePath, certificate.fileName);
  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).send('Failed to download certificate');
  }
});

// ==================== MESSAGING ROUTES ====================

// Counselor: View messages inbox
router.get("/counselor/messages", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).render("403", { title: "Access Denied" });
    const { User, Message } = await import('../models/index.js');

    // Get ALL students
    const students = await User.findAll({
      where: { role: 'user' },
      attributes: ['id', 'name', 'email'],
      order: [['name', 'ASC']]
    });

    // Get ALL admins so counselor can message them too
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['id', 'name', 'email'],
      order: [['name', 'ASC']]
    });

    console.log(`💬 Counselor ${req.user.id} - found ${students.length} students, ${admins.length} admins`);

    const addUnread = async (list, label) =>
      Promise.all(list.map(async (u) => {
        try {
          const unreadCount = await Message.count({
            where: { senderId: u.id, receiverId: req.user.id, isRead: false }
          });
          return { ...u.toJSON(), unreadCount, label };
        } catch {
          return { ...u.toJSON(), unreadCount: 0, label };
        }
      }));

    const studentsWithUnread = await addUnread(students, 'Student');
    const adminsWithUnread  = await addUnread(admins,   'Admin');

    res.render("counselor/messages", {
      title: "Messages",
      user: req.user,
      students: studentsWithUnread,
      admins: adminsWithUnread
    });
  } catch (error) {
    console.error('Counselor messages error:', error);
    res.status(500).render("404", { title: "Error: " + error.message });
  }
});

// Counselor: Get messages with a specific student (JSON)
router.get("/counselor/messages/:userId/json", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).json([]);
    const { Message } = await import('../models/index.js');
    const { Op } = await import('sequelize');

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: req.params.userId },
          { senderId: req.params.userId, receiverId: req.user.id }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    // Mark received messages as read
    await Message.update(
      { isRead: true },
      { where: { senderId: req.params.userId, receiverId: req.user.id, isRead: false } }
    );

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json([]);
  }
});

// Counselor: Send message to student
router.post("/counselor/messages/:userId/send", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).json({ error: 'Access denied' });
    const { Message } = await import('../models/index.js');
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const message = await Message.create({
      senderId: req.user.id,
      receiverId: parseInt(req.params.userId),
      content: content.trim()
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// User: View messages page
router.get("/user/messages", isAuthenticated, async (req, res) => {
  try {
    const { User, Message } = await import('../models/index.js');

    // Get ALL counselors regardless of accountStatus
    const counselors = await User.findAll({
      where: { role: 'counselor' },
      attributes: ['id', 'name', 'email'],
      order: [['name', 'ASC']]
    });

    console.log(`💬 User ${req.user.id} - found ${counselors.length} counselors`);

    const counselorsWithUnread = await Promise.all(counselors.map(async (c) => {
      try {
        const unreadCount = await Message.count({
          where: { senderId: c.id, receiverId: req.user.id, isRead: false }
        });
        return { ...c.toJSON(), unreadCount };
      } catch {
        return { ...c.toJSON(), unreadCount: 0 };
      }
    }));

    res.render("user/messages", { title: "Messages", user: req.user, counselors: counselorsWithUnread });
  } catch (error) {
    console.error('User messages error:', error);
    res.status(500).render("404", { title: "Error: " + error.message });
  }
});

// User: Get messages with a specific counselor (JSON)
router.get("/user/messages/:counselorId/json", isAuthenticated, async (req, res) => {
  try {
    const { Message } = await import('../models/index.js');
    const { Op } = await import('sequelize');

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: req.params.counselorId },
          { senderId: req.params.counselorId, receiverId: req.user.id }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    // Mark received messages as read
    await Message.update(
      { isRead: true },
      { where: { senderId: req.params.counselorId, receiverId: req.user.id, isRead: false } }
    );

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json([]);
  }
});

// User: Send message to counselor
router.post("/user/messages/:counselorId/send", isAuthenticated, async (req, res) => {
  try {
    const { Message } = await import('../models/index.js');
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const message = await Message.create({
      senderId: req.user.id,
      receiverId: parseInt(req.params.counselorId),
      content: content.trim()
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ==================== FITNESS VIDEO ROUTES ====================

// Configure multer for video uploads
// Ensure fitness upload directory exists at startup
if (!existsSync('public/uploads/fitness')) {
  mkdirSync('public/uploads/fitness', { recursive: true });
  console.log('📁 Created fitness uploads directory');
}

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/fitness/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'fitness-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — supports up to ~5 min video
  fileFilter: function (req, file, cb) {
    console.log('📹 Upload attempt - mimetype:', file.mimetype, 'originalname:', file.originalname);
    // Accept any video file or common video extensions
    const allowedMimes = [
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/x-ms-wmv', 'video/webm', 'video/ogg', 'application/octet-stream'
    ];
    const allowedExts = /\.(mp4|mov|avi|wmv|webm|ogv|mkv)$/i;
    const extOk = allowedExts.test(file.originalname);
    const mimeOk = allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('video/');
    if (extOk || mimeOk) return cb(null, true);
    console.log('❌ Rejected file:', file.mimetype, file.originalname);
    cb(new Error('Only video files (MP4, MOV, AVI) are allowed!'));
  }
});

// Counselor: Fitness videos page
router.get("/counselor/fitness", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).render("403", { title: "Access Denied" });
    const { FitnessVideo } = await import('../models/index.js');

    let videos = [];
    try {
      videos = await FitnessVideo.findAll({
        where: { counselorId: req.user.id },
        order: [['createdAt', 'DESC']]
      });
      console.log(`🎬 Counselor ${req.user.id} has ${videos.length} fitness videos`);
    } catch (dbErr) {
      console.error('FitnessVideo DB error:', dbErr.message);
    }

    res.render("counselor/fitness", { title: "Fitness Videos", user: req.user, videos });
  } catch (error) {
    console.error('Fitness page error:', error);
    res.status(500).render("404", { title: "Error: " + error.message });
  }
});

// Counselor: Upload fitness video
router.post("/counselor/fitness/upload", isAuthenticated, (req, res, next) => {
  uploadVideo.single('videoFile')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      return res.redirect('/counselor/fitness?error=' + encodeURIComponent(err.message));
    }
    next();
  });
}, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).render("403", { title: "Access Denied" });
    const { FitnessVideo } = await import('../models/index.js');

    if (!req.file) {
      console.log('❌ No file received in req.file');
      const videos = await FitnessVideo.findAll({ where: { counselorId: req.user.id }, order: [['createdAt', 'DESC']] });
      return res.render("counselor/fitness", { title: "Fitness Videos", user: req.user, videos, error_msg: 'Please select a video file.' });
    }

    const { title, description, category } = req.body;
    // Normalize path: replace backslashes, strip leading 'public'
    const normalizedPath = req.file.path.replace(/\\/g, '/');
    const filePath = '/' + normalizedPath.replace(/^public\//, '');

    console.log('📁 Storing filePath:', filePath);
    console.log('📹 File info:', req.file.filename, req.file.size, 'bytes');

    await FitnessVideo.create({
      counselorId: req.user.id,
      title,
      description: description || '',
      category: category || 'other',
      fileName: req.file.filename,
      filePath,
      fileSize: req.file.size
    });

    console.log('✅ Fitness video uploaded:', title);
    const videos = await FitnessVideo.findAll({ where: { counselorId: req.user.id }, order: [['createdAt', 'DESC']] });
    res.render("counselor/fitness", { title: "Fitness Videos", user: req.user, videos, success_msg: 'Video uploaded successfully!' });
  } catch (error) {
    console.error('Upload fitness video error:', error);
    res.status(500).render("404", { title: "Error: " + error.message });
  }
});

// Counselor: Delete fitness video
router.post("/counselor/fitness/delete/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== 'counselor') return res.status(403).render("403", { title: "Access Denied" });
    const { FitnessVideo } = await import('../models/index.js');
    const fs = await import('fs');

    const video = await FitnessVideo.findOne({ where: { id: req.params.id, counselorId: req.user.id } });
    if (!video) return res.redirect('/counselor/fitness');

    // Delete physical file
    const filePath = 'public' + video.filePath;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await video.destroy();
    res.redirect('/counselor/fitness');
  } catch (error) {
    console.error('Delete fitness video error:', error);
    res.redirect('/counselor/fitness');
  }
});

// User: View fitness videos
router.get("/user/fitness", isAuthenticated, async (req, res) => {
  try {
    const { FitnessVideo, User } = await import('../models/index.js');

    let videos = [];
    try {
      videos = await FitnessVideo.findAll({
        where: { isPublished: true },
        include: [{ model: User, as: 'counselor', attributes: ['name'] }],
        order: [['createdAt', 'DESC']]
      });
    } catch (dbErr) {
      console.error('FitnessVideo DB error (table may not exist yet):', dbErr.message);
    }

    console.log(`🏃 Found ${videos.length} fitness videos for user`);
    res.render("user/fitness", { title: "Fitness & Exercise", user: req.user, videos });
  } catch (error) {
    console.error('User fitness error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// User: Track fitness video view
router.post("/user/fitness/:id/view", isAuthenticated, async (req, res) => {
  try {
    const { FitnessVideo, Activity } = await import('../models/index.js');

    const video = await FitnessVideo.findByPk(req.params.id);
    if (!video) return res.json({ success: false });

    // Increment view count
    await FitnessVideo.increment('views', { where: { id: req.params.id } });

    // Log as activity so admin can see it
    await Activity.create({
      userId: req.user.id,
      type: 'fitness',
      subType: video.title,
      description: `Watched fitness video: "${video.title}" (${video.category})`,
      metadata: { videoId: video.id, category: video.category, counselorId: video.counselorId }
    });

    console.log(`🏃 User ${req.user.id} watched fitness video: ${video.title}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Track fitness view error:', error.message);
    res.json({ success: false });
  }
});

// ==================== ADMIN FITNESS & MESSAGES ROUTES ====================

// Admin: View all fitness videos
router.get("/admin/fitness", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { FitnessVideo, User } = await import('../models/index.js');

    let videos = [];
    try {
      videos = await FitnessVideo.findAll({
        include: [{ model: User, as: 'counselor', attributes: ['name'] }],
        order: [['createdAt', 'DESC']]
      });
    } catch (e) { console.error('FitnessVideo fetch error:', e.message); }

    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const counselorIds = [...new Set(videos.map(v => v.counselorId))];
    const categories = [...new Set(videos.map(v => v.category))];

    res.render("admin/fitness", {
      title: "Fitness Videos",
      user: req.user,
      videos,
      totalVideos: videos.length,
      totalViews,
      totalCounselors: counselorIds.length,
      categories
    });
  } catch (error) {
    console.error('Admin fitness error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// Admin: Delete any fitness video
router.post("/admin/fitness/delete/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { FitnessVideo } = await import('../models/index.js');
    const { existsSync, unlinkSync } = await import('fs');

    const video = await FitnessVideo.findByPk(req.params.id);
    if (video) {
      const filePath = 'public' + video.filePath;
      if (existsSync(filePath)) unlinkSync(filePath);
      await video.destroy();
    }
    res.redirect('/admin/fitness');
  } catch (error) {
    console.error('Admin delete fitness error:', error);
    res.redirect('/admin/fitness');
  }
});

// Admin: Messages page (counselors only)
router.get("/admin/messages", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { User, Message } = await import('../models/index.js');

    const counselors = await User.findAll({
      where: { role: 'counselor' },
      attributes: ['id', 'name', 'email'],
      order: [['name', 'ASC']]
    });

    const counselorsWithUnread = await Promise.all(counselors.map(async (c) => {
      try {
        const unreadCount = await Message.count({
          where: { senderId: c.id, receiverId: req.user.id, isRead: false }
        });
        return { ...c.toJSON(), unreadCount };
      } catch { return { ...c.toJSON(), unreadCount: 0 }; }
    }));

    res.render("admin/messages", { title: "Messages", user: req.user, counselors: counselorsWithUnread });
  } catch (error) {
    console.error('Admin messages error:', error);
    res.status(500).render("404", { title: "Error" });
  }
});

// Admin: Get messages with a counselor (JSON)
router.get("/admin/messages/:counselorId/json", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { Message } = await import('../models/index.js');
    const { Op } = await import('sequelize');

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: req.params.counselorId },
          { senderId: req.params.counselorId, receiverId: req.user.id }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    await Message.update(
      { isRead: true },
      { where: { senderId: req.params.counselorId, receiverId: req.user.id, isRead: false } }
    );

    res.json(messages);
  } catch (error) {
    console.error('Admin get messages error:', error);
    res.status(500).json([]);
  }
});

// Admin: Send message to counselor
router.post("/admin/messages/:counselorId/send", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { Message } = await import('../models/index.js');
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });

    const message = await Message.create({
      senderId: req.user.id,
      receiverId: parseInt(req.params.counselorId),
      content: content.trim()
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// ==================== 404 HANDLER ====================
router.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

export default router;
