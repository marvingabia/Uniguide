import { Application, Announcement, Notification, Appointment, User, TimeSlot } from '../models/index.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';

// Dashboard
export const dashboard = async (req, res) => {
  const applications  = await Application.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });
  const announcements = await Announcement.findAll({
    where: { isActive: true },
    order: [['createdAt', 'DESC']],
    limit: 5
  });
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
    limit: 10
  });
  const appointments = await Appointment.findAll({
    where: { userId: req.session.user.id },
    order: [['date', 'DESC']],
    limit: 5
  });

  const activeStatuses = ['pending', 'payment_submitted', 'payment_verified', 'receipt_issued', 'approved'];
  const activeCount    = applications.filter(a => activeStatuses.includes(a.status)).length;
  const releasedCount  = applications.filter(a => a.status === 'released').length;
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  res.render('student/dashboard', {
    title: 'Student Dashboard — GuidanceConnect',
    user: req.session.user,
    applications, announcements, notifications, appointments,
    activeCount, releasedCount, unreadNotifCount
  });
};

// Application History (detailed timeline view)
export const applicationHistory = async (req, res) => {
  const applications = await Application.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });
  res.render('student/history', {
    title: 'Application History — GuidanceConnect',
    user: req.session.user,
    applications
  });
};

// Show apply form
export const showApplyForm = (req, res) => {
  res.render('student/apply', {
    title: 'Apply for Good Moral — UniGuide',
    user: req.session.user
  });
};

// Submit application
export const submitApplication = async (req, res) => {
  const {
    surname, givenName, middleName, gender, contactNumber,
    course, major, yearLevel, section,
    enrollmentStatus, academicYear, semester, monthYearGraduated,
    purposes, otherPurpose,
    qtyGoodMoral, qtyCTC
  } = req.body;

  try {
    const purposeArray = Array.isArray(purposes) ? purposes : (purposes ? [purposes] : []);
    // Ensure scalar values — if somehow arrays slip through, take first element
    const toStr = (v) => Array.isArray(v) ? (v.find(x => x && x.trim()) || '') : (v || '');

    // Calculate total amount
    const goodMoralQty = parseInt(qtyGoodMoral) || 0;
    const ctcQty = parseInt(qtyCTC) || 0;
    const totalAmount = (goodMoralQty * 70) + (ctcQty * 10);

    // Validate: At least one item must be selected
    if (goodMoralQty === 0 && ctcQty === 0) {
      req.flash('error', 'Please select at least one item: Good Moral Certificate or CTC/Authentication.');
      return res.redirect('/student/apply');
    }

    const app = await Application.create({
      userId: req.session.user.id,
      surname, givenName, middleName, gender, contactNumber,
      course, major: toStr(major), yearLevel: toStr(yearLevel), section: toStr(section),
      enrollmentStatus: toStr(enrollmentStatus),
      academicYear: toStr(academicYear),
      semester: toStr(semester) || null,
      monthYearGraduated: toStr(monthYearGraduated),
      purposes: JSON.stringify(purposeArray),
      otherPurpose,
      qtyGoodMoral: goodMoralQty,
      qtyCTC: ctcQty,
      totalAmount: totalAmount,
      status: 'pending'
    });

    // Update user info with application data (for profiling)
    const user = await User.findByPk(req.session.user.id);
    if (!user) {
      throw new Error('User not found in session');
    }
    await user.update({
      contactNo: contactNumber,
      course: course,
      yearLevel: yearLevel,
      section: section
    });

    // Auto-create or update StudentProfile for guidance office access
    const { StudentProfile } = await import('../models/index.js');
    let profile = await StudentProfile.findOne({ where: { userId: req.session.user.id } });
    if (!profile) {
      await StudentProfile.create({
        userId: req.session.user.id,
        emergencyContact: contactNumber,
        caseType: 'none',
        riskLevel: 'low',
        totalSessions: 0,
        isActive: true,
        remarks: `Profile auto-created from application #${app.id}`
      });
    } else {
      // Update emergency contact if not set
      if (!profile.emergencyContact) {
        await profile.update({ emergencyContact: contactNumber });
      }
    }

    // Notify student
    await createNotification(
      req.session.user.id,
      `Your Good Moral request (#${app.id}) has been submitted. Please proceed to payment.`,
      'success',
      `/student/application/${app.id}`
    );

    // Notify all cashiers
    await notifyAllRole(
      'cashier',
      `New Good Moral request (#${app.id}) submitted by ${surname}, ${givenName}. Waiting for payment.`,
      'info',
      `/cashier/application/${app.id}`
    );

    req.flash('success', 'Application submitted! Please proceed to payment.');
    res.redirect(`/student/application/${app.id}/payment`);
  } catch (err) {
    console.error('❌ Application submission error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    req.flash('error', `Failed to submit application: ${err.message}`);
    res.redirect('/student/apply');
  }
};

// Show payment form
export const showPaymentForm = async (req, res) => {
  const app = await Application.findOne({
    where: { id: req.params.id, userId: req.session.user.id }
  });
  if (!app) return res.redirect('/student/dashboard');
  res.render('student/payment', {
    title: 'Submit Payment — UniGuide',
    user: req.session.user,
    app
  });
};

// Submit payment
export const submitPayment = async (req, res) => {
  const { referenceNumber, paymentMethod, paymentDate } = req.body;
  const app = await Application.findOne({
    where: { id: req.params.id, userId: req.session.user.id }
  });
  if (!app) return res.redirect('/student/dashboard');

  const screenshot = req.file ? `/uploads/payments/${req.file.filename}` : null;

  await app.update({
    referenceNumber,
    paymentMethod,
    paymentDate,
    paymentScreenshot: screenshot,
    status: 'payment_submitted'
  });

  // Notify student
  await createNotification(
    req.session.user.id,
    `Payment proof for request #${app.id} submitted. Waiting for cashier verification.`,
    'info',
    `/student/application/${app.id}`
  );

  // Notify all cashiers
  await notifyAllRole(
    'cashier',
    `Payment received for request #${app.id} (${app.surname}, ${app.givenName}). Please verify.`,
    'warning',
    `/cashier/application/${app.id}`
  );

  req.flash('success', 'Payment proof submitted! Waiting for cashier verification.');
  res.redirect('/student/dashboard');
};

// View application
export const viewApplication = async (req, res) => {
  const app = await Application.findOne({
    where: { id: req.params.id, userId: req.session.user.id }
  });
  if (!app) return res.redirect('/student/dashboard');
  let purposes = [];
  try { purposes = JSON.parse(app.purposes); } catch {}
  res.render('student/view-application', {
    title: 'Application Details — UniGuide',
    user: req.session.user,
    app,
    purposes
  });
};

// Notifications page
export const viewNotifications = async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });
  // Mark all as read
  await Notification.update({ isRead: true }, { where: { userId: req.session.user.id } });
  res.render('student/notifications', {
    title: 'Notifications — UniGuide',
    user: req.session.user,
    notifications
  });
};

// View announcements
export const viewAnnouncements = async (req, res) => {
  const announcements = await Announcement.findAll({
    where: { isActive: true },
    order: [['createdAt', 'DESC']]
  });
  res.render('student/announcements', {
    title: 'Announcements — UniGuide',
    user: req.session.user,
    announcements
  });
};

// Book appointment
export const showAppointmentForm = async (req, res) => {
  // Get student's existing appointment requests
  const myAppointments = await Appointment.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });
  
  res.render('student/appointments', {
    title: 'Request Appointment — UniGuide',
    user: req.session.user,
    myAppointments
  });
};

export const bookAppointment = async (req, res) => {
  const { purpose, notes, otherPurpose } = req.body;
  
  try {
    // Use otherPurpose if purpose is "Other"
    const finalPurpose = purpose === 'Other' && otherPurpose ? otherPurpose : purpose;
    
    // Create appointment request (no schedule yet - status: pending)
    const appointment = await Appointment.create({
      userId: req.session.user.id,
      timeSlotId: null, // No time slot assigned yet
      purpose: finalPurpose,
      date: null, // Will be assigned when guidance creates matching time slot
      timeSlot: null, // Will be assigned when guidance creates matching time slot
      notes,
      status: 'pending' // Waiting for guidance to create time slots
    });

    // Notify student
    await createNotification(
      req.session.user.id,
      `Your appointment request for "${finalPurpose}" has been submitted. You'll be notified once a schedule is assigned.`,
      'info',
      '/student/appointments'
    );

    // Notify guidance
    await notifyAllRole(
      'guidance',
      `New appointment request from ${req.session.user.firstName} ${req.session.user.lastName} - Purpose: ${finalPurpose}`,
      'warning',
      '/guidance/appointments'
    );

    req.flash('success', `Appointment request submitted! You'll be notified once a schedule is assigned.`);
    res.redirect('/student/appointments');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to submit appointment request.');
    res.redirect('/student/appointments');
  }
};

// Show profile page
export const showProfile = async (req, res) => {
  const user = await User.findByPk(req.session.user.id);
  res.render('student/profile', {
    title: 'My Profile — UniGuide',
    user: req.session.user,
    profileUser: user
  });
};

// Update profile
export const updateProfile = async (req, res) => {
  const { 
    firstName, lastName, contactNo, course, yearLevel, section, studentId, bio,
    birthdate, address, emergencyContact, guardianName, guardianContact, 
    previousSchool, scholarshipInfo 
  } = req.body;
  
  try {
    const user = await User.findByPk(req.session.user.id);
    const updates = { 
      firstName, lastName, contactNo, course, yearLevel, section, studentId, bio,
      birthdate, address, emergencyContact, guardianName, guardianContact,
      previousSchool, scholarshipInfo
    };
    
    if (req.file) {
      updates.profileImage = `/uploads/avatars/${req.file.filename}`;
    }
    
    await user.update(updates);
    
    // Auto-update or create StudentProfile for guidance office access
    const { StudentProfile } = await import('../models/index.js');
    let profile = await StudentProfile.findOne({ where: { userId: user.id } });
    if (profile) {
      // Update profile with student's data
      await profile.update({
        birthdate,
        address,
        guardianName,
        guardianContact,
        emergencyContact,
        previousSchool,
        scholarshipInfo,
        updatedAt: new Date()
      });
    } else {
      // Create new profile with student's info
      await StudentProfile.create({
        userId: user.id,
        birthdate,
        address,
        guardianName,
        guardianContact,
        emergencyContact,
        previousSchool,
        scholarshipInfo,
        caseType: 'none',
        riskLevel: 'low',
        totalSessions: 0,
        isActive: true,
        remarks: 'Profile auto-created from student profile update'
      });
    }
    
    // Refresh session user data
    Object.assign(req.session.user, updates);
    if (req.file) req.session.user.profileImage = updates.profileImage;
    
    req.flash('success', 'Profile updated successfully!');
    res.redirect('/student/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update profile.');
    res.redirect('/student/profile');
  }
};

// Delete application
export const deleteApplication = async (req, res) => {
  try {
    const app = await Application.findOne({
      where: { 
        id: req.params.id, 
        userId: req.session.user.id 
      }
    });
    
    if (!app) {
      req.flash('error', 'Application not found.');
      return res.redirect('/student/history');
    }
    
    // Only allow deletion of pending or rejected applications
    if (app.status !== 'pending' && app.status !== 'rejected') {
      req.flash('error', 'You can only delete pending or rejected applications.');
      return res.redirect('/student/history');
    }
    
    await app.destroy();
    
    req.flash('success', 'Application deleted successfully.');
    res.redirect('/student/history');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete application.');
    res.redirect('/student/history');
  }
};




