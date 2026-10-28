import { Application, Announcement, Notification, Appointment, User, TimeSlot } from '../models/index.js';
import { FirestoreAdapter } from '../models/firestore-adapter.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';

// Helper to safely get empty defaults for test mode
const safeRender = (res, template, data) => {
  res.render(template, {
    ...data,
    testMode: !Application
  });
};

// Dashboard
export const dashboard = async (req, res) => {
  try {
    let applications = [];
    let announcements = [];
    let notifications = [];
    let appointments = [];
    let activeCount = 0;
    let releasedCount = 0;

    // Fetch from Firestore
    try {
      applications = await FirestoreAdapter.getAllApplications({ userId: req.session.user.id });
      
      const activeStatuses = ['pending', 'payment_submitted', 'payment_verified', 'receipt_issued', 'approved', 'waiting_for_cashier'];
      activeCount = applications.filter(a => activeStatuses.includes(a.status)).length;
      releasedCount = applications.filter(a => a.status === 'released').length;
      
      console.log(`📊 Student Dashboard: ${applications.length} total, ${activeCount} active, ${releasedCount} released`);
    } catch (e) {
      console.error('Error fetching applications from Firestore:', e.message);
    }

    // Fetch announcements from Firestore
    try {
      announcements = await FirestoreAdapter.getAllAnnouncements();
      console.log(`📢 Dashboard: Found ${announcements.length} announcements`);
    } catch (e) {
      console.error('Error fetching announcements:', e.message);
      announcements = [];
    }

    // Fetch notifications from Firestore
    try {
      notifications = await FirestoreAdapter.getNotifications(req.session.user.id);
      console.log(`🔔 Dashboard: Found ${notifications.length} notifications`);
    } catch (e) {
      console.error('Error fetching notifications:', e.message);
      notifications = [];
    }

    const unreadNotifCount = notifications.filter(n => !n.isRead).length;

    safeRender(res, 'student/dashboard', {
      title: 'Student Dashboard — GuidanceConnect',
      user: req.session.user,
      applications,
      announcements,
      notifications,
      appointments,
      activeCount,
      releasedCount,
      unreadNotifCount
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    safeRender(res, 'student/dashboard', {
      title: 'Student Dashboard — GuidanceConnect',
      user: req.session.user,
      applications: [],
      announcements: [],
      notifications: [],
      appointments: [],
      activeCount: 0,
      releasedCount: 0,
      unreadNotifCount: 0,
      error: 'Test mode - Database disabled'
    });
  }
};

// Application History
// Application History
export const applicationHistory = async (req, res) => {
  try {
    let applications = [];
    
    // Fetch all applications for this student from Firestore
    try {
      applications = await FirestoreAdapter.getAllApplications({ userId: req.session.user.id });
      console.log(`📊 Student history: ${applications.length} applications`);
    } catch (e) {
      console.error('Error fetching history from Firestore:', e.message);
    }

    safeRender(res, 'student/history', {
      title: 'Application History — GuidanceConnect',
      user: req.session.user,
      applications
    });
  } catch (error) {
    console.error('History error:', error.message);
    safeRender(res, 'student/history', {
      title: 'Application History — GuidanceConnect',
      user: req.session.user,
      applications: [],
      error: 'Test mode'
    });
  }
};

// Show apply form
export const showApplyForm = (req, res) => {
  safeRender(res, 'student/apply', {
    title: 'Apply for Good Moral — UniGuide',
    user: req.session.user
  });
};

// Submit application
export const submitApplication = async (req, res) => {
  console.log('');
  console.log('========================================');
  console.log('📝 SUBMIT APPLICATION');
  console.log('========================================');
  console.log('Session User:', req.session?.user?.email);

  try {
    const { surname, givenName, middleName, gender, contactNumber, course, major, yearLevel, section,
      enrollmentStatus, academicYear, semester, monthYearGraduated, purposes, otherPurpose,
      qtyGoodMoral, qtyCTC } = req.body;

    const purposeArray = Array.isArray(purposes) ? purposes : (purposes ? [purposes] : []);
    const toStr = (v) => {
      if (!v) return null;
      if (Array.isArray(v)) return v.find(x => x && x.trim()) || null;
      return v || null;
    };

    const goodMoralQty = parseInt(qtyGoodMoral) || 0;
    const ctcQty = parseInt(qtyCTC) || 0;
    const totalAmount = (goodMoralQty * 70) + (ctcQty * 10);

    if (goodMoralQty === 0 && ctcQty === 0) {
      req.flash('error', 'Please select at least one item');
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err.message);
        res.redirect('/student/apply');
      });
    }

    // Create application object with all fields, replacing undefined with null
    const applicationData = {
      userId: req.session.user.id || '',
      surname: surname || '',
      givenName: givenName || '',
      middleName: middleName || '',
      gender: gender || '',
      contactNumber: contactNumber || '',
      course: course || '',
      major: toStr(major),
      yearLevel: toStr(yearLevel),
      section: toStr(section),
      enrollmentStatus: toStr(enrollmentStatus),
      academicYear: toStr(academicYear),
      semester: toStr(semester),
      monthYearGraduated: toStr(monthYearGraduated),
      purposes: JSON.stringify(purposeArray),
      otherPurpose: otherPurpose || '',
      qtyGoodMoral: goodMoralQty,
      qtyCTC: ctcQty,
      totalAmount: totalAmount,
      status: 'pending',
      paymentStatus: 'unpaid'
    };

    console.log('📋 Application data:', applicationData);

    // Create application in Firestore
    const application = await FirestoreAdapter.createApplication(applicationData);

    // Send notification to student that application was submitted
    await FirestoreAdapter.createNotification({
      userId: req.session.user.id,
      type: 'success',
      title: 'Application Submitted',
      message: `📝 Your Good Moral Certificate request #${application.id} has been submitted successfully. Please proceed to payment.`,
      applicationId: application.id,
      isRead: false
    });

    // Notify guidance that a new application was submitted
    await notifyAllRole(
      'guidance',
      `📝 New application #${application.id} from ${givenName || ''} ${surname || ''}. Waiting for payment.`,
      'info',
      `/guidance/application/${application.id}`
    );

    console.log('✅ Application created successfully:', application.id);
    req.flash('success', 'Application submitted! Please proceed to payment.');
    
    return req.session.save((err) => {
      if (err) console.error('❌ Session save error:', err.message);
      // Redirect to payment page with application ID
      res.redirect(`/student/application/${application.id}/payment`);
    });

  } catch (err) {
    console.error('❌ Submit error:', err.message);
    console.error('Full error:', err);
    req.flash('error', `Failed: ${err.message}`);
    return req.session.save((err) => {
      if (err) console.error('Session save error:', err.message);
      res.redirect('/student/apply');
    });
  }
};

// Show payment form
export const showPaymentForm = async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('📋 SHOW PAYMENT FORM');
    console.log('========================================');
    console.log('Application ID:', req.params.id);
    console.log('User ID:', req.session.user.id);

    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);

    if (!app || app.userId !== req.session.user.id) {
      console.log('❌ Application not found or unauthorized');
      return res.redirect('/student/dashboard');
    }

    console.log('✅ Application found:', app.surname);

    res.render('student/payment', {
      title: 'Submit Payment — UniGuide',
      user: req.session.user,
      app
    });
  } catch (error) {
    console.error('❌ Payment form error:', error.message);
    res.redirect('/student/dashboard');
  }
};

// Submit payment
export const submitPayment = async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('💳 SUBMIT PAYMENT');
    console.log('========================================');
    console.log('Application ID:', req.params.id);
    console.log('Payment Method:', req.body.paymentMethod);

    const { referenceNumber, paymentMethod, paymentDate, paymentType } = req.body;
    
    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    
    if (!app || app.userId !== req.session.user.id) {
      console.log('❌ Application not found or unauthorized');
      return res.redirect('/student/dashboard');
    }

    // MANUAL PAYMENT: Send to cashier, don't require screenshot
    if (paymentMethod === 'Manual Transfer' || paymentType === 'manual') {
      console.log('📋 MANUAL PAYMENT - Sending to cashier');

      // Update application status to waiting_for_cashier
      await FirestoreAdapter.updateApplication(req.params.id, {
        paymentMethod: 'Manual Transfer',
        status: 'waiting_for_cashier',
        paymentStatus: 'pending_manual'
      });

      // Send notification to cashier (use email-based ID for staff accounts)
      // Cashier staff accounts use email as their ID in session
      await FirestoreAdapter.createNotification({
        userId: 'cashier@minsu.edu.ph',  // Use cashier staff account email
        type: 'manual_payment',
        title: 'Manual Payment Pending',
        message: `${app.givenName} ${app.surname} needs to pay ₱${app.totalAmount} in person`,
        applicationId: req.params.id,
        relatedUserId: req.session.user.id,
        isRead: false
      });

      console.log('✅ Application sent to cashier for manual payment');
      req.flash('success', 'Application sent to cashier. Please proceed to pay in person.');
      return res.redirect('/student/dashboard');
    }

    // ONLINE PAYMENT: Require screenshot and reference
    if (!referenceNumber) {
      req.flash('error', 'Reference number is required');
      return res.redirect(`/student/application/${req.params.id}/payment`);
    }

    const screenshot = req.file ? `/uploads/payments/${req.file.filename}` : null;

    if (!screenshot) {
      req.flash('error', 'Payment screenshot is required');
      return res.redirect(`/student/application/${req.params.id}/payment`);
    }

    // Set paymentDate to current date/time when payment is submitted
    const currentPaymentDate = new Date().toISOString();

    // Update application in Firestore
    await FirestoreAdapter.updateApplication(req.params.id, {
      referenceNumber,
      paymentMethod,
      paymentDate: currentPaymentDate,
      paymentScreenshot: screenshot,
      status: 'payment_submitted'
    });

    // Send notification to cashier about online payment submission
    await FirestoreAdapter.createNotification({
      userId: 'cashier@minsu.edu.ph',  // Use cashier staff account email
      type: 'online_payment_submitted',
      title: 'Online Payment Submitted',
      message: `${app.givenName} ${app.surname} submitted payment proof for ₱${app.totalAmount}. Reference: ${referenceNumber}`,
      applicationId: req.params.id,
      relatedUserId: req.session.user.id,
      isRead: false
    });

    console.log('✅ Payment proof submitted');
    req.flash('success', 'Payment proof submitted! Waiting for cashier verification.');
    res.redirect('/student/dashboard');
  } catch (err) {
    console.error('❌ Payment error:', err.message);
    req.flash('error', `Failed: ${err.message}`);
    res.redirect('/student/dashboard');
  }
};

// View application
export const viewApplication = async (req, res) => {
  try {
    const app = Application ?
      await Application.findOne({
        where: { id: req.params.id, userId: req.session.user.id }
      }) : null;

    if (!app) return res.redirect('/student/dashboard');

    let purposes = [];
    try { purposes = JSON.parse(app.purposes); } catch {}

    safeRender(res, 'student/view-application', {
      title: 'Application Details — UniGuide',
      user: req.session.user,
      app,
      purposes
    });
  } catch (error) {
    res.redirect('/student/dashboard');
  }
};

// View notifications
export const viewNotifications = async (req, res) => {
  try {
    let notifications = [];
    
    try {
      // Get notifications from Firestore
      notifications = await FirestoreAdapter.getUserNotifications(req.session.user.id);
      
      // Mark all as read
      for (const notif of notifications) {
        if (!notif.isRead) {
          await FirestoreAdapter.markNotificationAsRead(notif.id);
        }
      }
      
      console.log(`📬 Loaded ${notifications.length} notifications for student`);
    } catch (e) {
      console.error('Error fetching notifications:', e.message);
    }

    safeRender(res, 'student/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      notifications
    });
  } catch (error) {
    console.error('Notifications error:', error.message);
    safeRender(res, 'student/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      notifications: []
    });
  }
};

// View announcements
export const viewAnnouncements = async (req, res) => {
  try {
    // Fetch active announcements from Firebase
    const announcements = await FirestoreAdapter.getAllAnnouncements();

    safeRender(res, 'student/announcements', {
      title: 'Announcements — UniGuide',
      user: req.session.user,
      announcements: announcements || []
    });
  } catch (error) {
    console.error('Announcements error:', error.message);
    safeRender(res, 'student/announcements', {
      title: 'Announcements — UniGuide',
      user: req.session.user,
      announcements: []
    });
  }
};

// Show appointment form
export const showAppointmentForm = async (req, res) => {
  try {
    // Fetch student's appointment requests from Firestore
    let myAppointments = [];
    try {
      myAppointments = await FirestoreAdapter.getAppointmentRequests({ 
        userId: req.session.user.id 
      });
    } catch (e) {
      console.error('Error fetching appointments:', e.message);
    }

    safeRender(res, 'student/appointments', {
      title: 'Request Appointment — Uniguide',
      user: req.session.user,
      myAppointments
    });
  } catch (error) {
    console.error('Appointment form error:', error.message);
    safeRender(res, 'student/appointments', {
      title: 'Request Appointment — Uniguide',
      user: req.session.user,
      myAppointments: []
    });
  }
};

// Book appointment
export const bookAppointment = async (req, res) => {
  try {
    const { purpose, notes, otherPurpose } = req.body;
    
    // Validate purpose
    if (!purpose || purpose === 'Select purpose') {
      req.flash('error', 'Please select a purpose');
      return res.redirect('/student/appointments');
    }

    const finalPurpose = purpose === 'Other' && otherPurpose ? otherPurpose : purpose;

    // Create appointment request in Firestore
    const appointmentRequest = await FirestoreAdapter.createAppointmentRequest({
      userId: req.session.user.id,
      purpose: finalPurpose,
      notes: notes || '',
      status: 'pending', // waiting for guidance to review
      createdAt: new Date().toISOString()
    });

    // Get student info for notification
    const student = await FirestoreAdapter.findUserById(req.session.user.id);

    // Send notification to guidance that new appointment request came in
    await FirestoreAdapter.createNotification({
      userId: 'guidance@minsu.edu.ph',
      type: 'info',
      title: '📅 New Appointment Request',
      message: `${student?.firstName || 'A student'} requested a counselling appointment for: ${finalPurpose}`,
      appointmentId: appointmentRequest.id,
      isRead: false
    });

    req.flash('success', '✓ Appointment request submitted! Guidance will review and assign a schedule.');
    res.redirect('/student/appointments');
  } catch (err) {
    console.error('Booking error:', err.message);
    req.flash('error', `Failed: ${err.message}`);
    res.redirect('/student/appointments');
  }
};

// Show profile
export const showProfile = async (req, res) => {
  try {
    const profileUser = User ?
      await User.findByPk(req.session.user.id) :
      req.session.user;

    safeRender(res, 'student/profile', {
      title: 'My Profile — UniGuide',
      user: req.session.user,
      profileUser
    });
  } catch (error) {
    console.error('Profile error:', error.message);
    safeRender(res, 'student/profile', {
      title: 'My Profile — UniGuide',
      user: req.session.user,
      profileUser: req.session.user
    });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  if (!User) {
    req.flash('error', 'Profile update disabled in test mode');
    return res.redirect('/student/profile');
  }

  try {
    const { firstName, lastName, contactNo, course, yearLevel, section, studentId, bio,
      birthdate, address, emergencyContact, guardianName, guardianContact,
      previousSchool, scholarshipInfo } = req.body;

    const user = await User.findByPk(req.session.user.id);
    const updates = { firstName, lastName, contactNo, course, yearLevel, section, studentId, bio,
      birthdate, address, emergencyContact, guardianName, guardianContact,
      previousSchool, scholarshipInfo };

    if (req.file) {
      updates.profileImage = `/uploads/avatars/${req.file.filename}`;
    }

    await user.update(updates);

    Object.assign(req.session.user, updates);
    if (req.file) req.session.user.profileImage = updates.profileImage;

    req.flash('success', 'Profile updated!');
    res.redirect('/student/profile');
  } catch (err) {
    console.error('Update error:', err.message);
    req.flash('error', `Failed: ${err.message}`);
    res.redirect('/student/profile');
  }
};

// Delete application
export const deleteApplication = async (req, res) => {
  if (!Application) {
    req.flash('error', 'Delete disabled in test mode');
    return res.redirect('/student/history');
  }

  try {
    const app = await Application.findOne({
      where: { id: req.params.id, userId: req.session.user.id }
    });

    if (!app) {
      req.flash('error', 'Application not found');
      return res.redirect('/student/history');
    }

    if (app.status !== 'pending' && app.status !== 'rejected') {
      req.flash('error', 'Can only delete pending or rejected applications');
      return res.redirect('/student/history');
    }

    await app.destroy();
    req.flash('success', 'Application deleted');
    res.redirect('/student/history');
  } catch (err) {
    console.error('Delete error:', err.message);
    req.flash('error', `Failed: ${err.message}`);
    res.redirect('/student/history');
  }
};
