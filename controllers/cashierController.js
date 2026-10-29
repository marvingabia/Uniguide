import { Application, User, Notification } from '../models/index.js';
import { FirestoreAdapter } from '../models/firestore-adapter.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';

// Dashboard
export const dashboard = async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('💳 CASHIER DASHBOARD');
    console.log('========================================');

    let manualPayments = [];
    let pendingPayments = [];
    let receipted = [];
    let notifications = [];
    let dailyTotal = 0;

    // Get manual payment requests (waiting_for_cashier status)
    try {
      manualPayments = await FirestoreAdapter.getAllApplications({ 
        status: 'waiting_for_cashier' 
      });
      console.log(`📋 Manual payments waiting: ${manualPayments.length}`);
    } catch (e) {
      console.error('Error fetching manual payments:', e.message);
    }

    // Get online payment submissions (payment_submitted status)
    try {
      pendingPayments = await FirestoreAdapter.getAllApplications({ 
        status: 'payment_submitted' 
      });
      console.log(`💳 Online payments submitted: ${pendingPayments.length}`);
    } catch (e) {
      console.error('Error fetching pending payments:', e.message);
    }

    // Get receipted applications (receipt_issued status)
    try {
      receipted = await FirestoreAdapter.getAllApplications({ 
        status: 'receipt_issued' 
      });
      console.log(`🧾 Receipts issued: ${receipted.length}`);
    } catch (e) {
      console.error('Error fetching receipted:', e.message);
    }

    // Get cashier notifications
    try {
      notifications = await FirestoreAdapter.getUserNotifications(req.session.user.id);
      console.log(`🔔 Notifications: ${notifications.length}`);
    } catch (e) {
      console.error('Error fetching notifications:', e.message);
    }

    // Calculate daily total — use PH timezone (UTC+8) for "today"
    const nowPH = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const todayPH = nowPH.toISOString().split('T')[0]; // e.g. "2026-10-29"

    // Combine all application arrays
    const allApplications = [...manualPayments, ...pendingPayments, ...receipted];

    dailyTotal = allApplications
      .filter(app => {
        // Convert stored date to PH time for comparison
        const rawDate = app.paymentDate || app.updatedAt || app.createdAt;
        if (!rawDate) return false;
        const datePH = new Date(new Date(rawDate).getTime() + 8 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        return datePH === todayPH;
      })
      .reduce((sum, app) => sum + parseFloat(app.totalAmount || 0), 0);

    const unreadNotifCount = notifications.filter(n => !n.isRead).length;

    console.log(`✅ Dashboard ready: ${manualPayments.length} manual + ${pendingPayments.length} online`);

    res.render('cashier/dashboard', {
      title: 'Cashier Dashboard — GuidanceConnect',
      user: req.session.user,
      manualPayments,
      pendingPayments,
      receipted,
      notifications,
      unreadNotifCount,
      dailyTotal,
      manualCount: manualPayments.length,
      pendingCount: pendingPayments.length,
      receiptedCount: receipted.length,
      awaitingActionCount: manualPayments.length + pendingPayments.length,
      testMode: false
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error.message);
    res.render('cashier/dashboard', {
      title: 'Cashier Dashboard — GuidanceConnect',
      user: req.session.user,
      manualPayments: [],
      pendingPayments: [],
      receipted: [],
      notifications: [],
      unreadNotifCount: 0,
      dailyTotal: 0,
      manualCount: 0,
      pendingCount: 0,
      receiptedCount: 0,
      awaitingActionCount: 0,
      testMode: true,
      error: 'Error loading dashboard'
    });
  }
};

// View application
export const viewApplication = async (req, res) => {
  try {
    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    
    if (!app) {
      return res.redirect('/cashier/dashboard');
    }

    let purposes = [];
    try { 
      purposes = Array.isArray(app.purposes) ? app.purposes : JSON.parse(app.purposes || '[]');
    } catch (e) {
      purposes = [];
    }

    console.log(`📋 Viewing application ${req.params.id}: ${app.givenName} ${app.surname} - Status: ${app.status}`);

    res.render('cashier/view-application', {
      title: 'Review Application — GuidanceConnect',
      user: req.session.user,
      app,
      purposes
    });
  } catch (error) {
    console.error('View application error:', error.message);
    res.render('cashier/view-application', {
      title: 'Review Application — GuidanceConnect',
      user: req.session.user,
      app: null,
      purposes: [],
      testMode: true,
      error: 'Test mode - Database disabled'
    });
  }
};

// Verify payment and issue receipt (combined) - also handles forward to guidance
export const verifyAndIssueReceipt = async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('🧾 VERIFY & ISSUE RECEIPT');
    console.log('========================================');
    console.log('Application ID:', req.params.id);

    const { orNumber, action } = req.body;
    
    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    if (!app) {
      return res.redirect('/cashier/dashboard');
    }

    // Handle two actions: "issue" (create receipt) and "forward" (send to guidance)
    if (action === 'forward') {
      console.log('📨 Forwarding to Guidance Office');
      
      // Update status to payment_verified (ready for guidance)
      // Also set paymentDate since payment has been collected
      await FirestoreAdapter.updateApplication(req.params.id, {
        status: 'payment_verified',
        paymentDate: new Date().toISOString()
      });

      // Notify student
      await FirestoreAdapter.createNotification({
        userId: app.userId,
        type: 'payment_verified',
        title: 'Payment Verified',
        message: `✅ Your payment for request #${req.params.id} has been verified (₱${app.totalAmount}). Your request has been forwarded to the Guidance Office.`,
        applicationId: req.params.id,
        isRead: false
      });

      // Notify guidance staff (look up real Firestore ID)
      try {
        const guidanceUser = await FirestoreAdapter.findUserByEmail('guidance@minsu.edu.ph');
        const guidanceUserId = guidanceUser?.id || 'guidance@minsu.edu.ph';
        await FirestoreAdapter.createNotification({
          userId: guidanceUserId,
          type: 'new_verified_application',
          title: 'Payment Verified - Ready for Processing',
          message: `Payment verified for request #${req.params.id} (${app.surname}, ${app.givenName}). Ready for processing.`,
          applicationId: req.params.id,
          isRead: false
        });
      } catch (notifErr) {
        console.error('⚠️ Could not notify guidance:', notifErr.message);
      }

      console.log('✅ Application forwarded to guidance');
      req.flash('success', 'Application forwarded to Guidance Office');
      return res.redirect('/cashier/dashboard');
    }

    // Default action: Issue receipt
    const receiptFile = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const orNum = orNumber && orNumber.trim() ? orNumber.trim() : null;

    console.log('📝 Issuing receipt with OR:', orNum);

    // Update to receipt_issued status
    await FirestoreAdapter.updateApplication(req.params.id, {
      orNumber: orNum,
      receiptFile,
      status: 'receipt_issued',
      paymentDate: new Date().toISOString()
    });

    // Notify student
    const orText = orNum ? ` Official Receipt #${orNum} issued.` : '';
    await FirestoreAdapter.createNotification({
      userId: app.userId,
      type: 'receipt_issued',
      title: 'Receipt Issued',
      message: `✅ Your payment for request #${req.params.id} has been verified (₱${app.totalAmount}).${orText} Your request is ready for processing.`,
      applicationId: req.params.id,
      isRead: false
    });

    console.log('✅ Receipt issued');
    req.flash('success', `Receipt issued! OR: ${orNum || 'Manual entry'}`);
    res.redirect(`/cashier/application/${req.params.id}`);
  } catch (error) {
    console.error('❌ Verify receipt error:', error.message);
    req.flash('error', `Error: ${error.message}`);
    res.redirect('/cashier/dashboard');
  }
};

// Issue receipt (move from payment_verified to receipt_issued)
export const issueReceipt = async (req, res) => {
  try {
    const { orNumber } = req.body;
    
    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    if (!app) {
      return res.redirect('/cashier/dashboard');
    }

    const receiptFile = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const orNum = orNumber && orNumber.trim() ? orNumber.trim() : (app.orNumber || null);

    console.log('🧾 Issuing receipt for application', req.params.id);

    // Update to receipt_issued status
    await FirestoreAdapter.updateApplication(req.params.id, {
      orNumber: orNum,
      receiptFile: receiptFile || app.receiptFile,
      status: 'receipt_issued'
    });

    req.flash('success', 'Receipt issued successfully.');
    res.redirect('/cashier/dashboard');
  } catch (error) {
    console.error('Issue receipt error:', error.message);
    req.flash('error', `Error: ${error.message}`);
    res.redirect('/cashier/dashboard');
  }
};

// Reject application (cashier)
export const rejectApplication = async (req, res) => {
  try {
    const { remarks } = req.body;
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    if (!app) return res.redirect('/cashier/dashboard');

    await FirestoreAdapter.updateApplication(req.params.id, {
      status: 'rejected',
      remarks: remarks || '',
      rejectedAt: new Date().toISOString()
    });

    await FirestoreAdapter.createNotification({
      userId: app.userId,
      type: 'danger',
      title: 'Application Rejected',
      message: `❌ Your payment for request #${req.params.id} was rejected. Reason: ${remarks || 'No reason provided'}`,
      applicationId: req.params.id,
      isRead: false
    });

    req.flash('success', 'Application rejected and student notified.');
    res.redirect('/cashier/dashboard');
  } catch (error) {
    console.error('Reject application error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/cashier/dashboard');
  }
};

// Re-issue receipt
export const reissueReceipt = async (req, res) => {
  try {
    const { orNumber, reissueReason } = req.body;
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    if (!app) return res.redirect('/cashier/dashboard');

    const updates = {};
    if (orNumber && orNumber.trim()) updates.orNumber = orNumber.trim();
    if (req.file) updates.receiptFile = `/uploads/receipts/${req.file.filename}`;

    await FirestoreAdapter.updateApplication(req.params.id, updates);

    // Notify student
    const orText = updates.orNumber ? ` OR Number: ${updates.orNumber}.` : '';
    await FirestoreAdapter.createNotification({
      userId: app.userId,
      type: 'info',
      title: 'Receipt Updated',
      message: `📝 Your receipt has been updated.${orText} Reason: ${reissueReason || 'Updated by cashier'}`,
      applicationId: req.params.id,
      isRead: false
    });

    req.flash('success', 'Receipt information updated successfully.');
    res.redirect(`/cashier/application/${req.params.id}`);
  } catch (error) {
    console.error('Reissue receipt error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect(`/cashier/application/${req.params.id}`);
  }
};

// Payment history
// Payment History
export const paymentHistory = async (req, res) => {
  try {
    let payments = [];
    let totalCollected = 0;

    try {
      // Fetch applications that have been processed and forwarded
      const allPayments = await FirestoreAdapter.getAllApplications();
      
      // Include: payment_verified (forwarded), receipt_issued, approved, released
      payments = allPayments.filter(app =>
        app.status === 'payment_verified' ||
        app.status === 'receipt_issued' ||
        app.status === 'approved' ||
        app.status === 'released'
      );

      // Calculate total collected
      totalCollected = payments.reduce((sum, app) => {
        return sum + (parseFloat(app.totalAmount) || 0);
      }, 0);

      console.log(`💰 Payment history: ${payments.length} payments, Total: ₱${totalCollected}`);
    } catch (e) {
      console.error('Error fetching payment history:', e.message);
    }

    res.render('cashier/payment-history', {
      title: 'Payment History — GuidanceConnect',
      user: req.session.user,
      payments,
      totalCollected
    });
  } catch (error) {
    console.error('Payment history error:', error.message);
    res.render('cashier/payment-history', {
      title: 'Payment History — GuidanceConnect',
      user: req.session.user,
      payments: [],
      totalCollected: 0,
      testMode: true,
      error: 'Test mode'
    });
  }
};;

// Daily collections report
// Daily Collections
export const dailyCollections = async (req, res) => {
  try {
    let payments = [];
    let total = 0;

    // Use PH timezone (UTC+8) for "today"
    const nowPH = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const today = nowPH.toISOString().split('T')[0];

    try {
      const allPayments = await FirestoreAdapter.getAllApplications();

      payments = allPayments.filter(app => {
        const isProcessed =
          app.status === 'receipt_issued' ||
          app.status === 'payment_verified' ||
          app.status === 'approved' ||
          app.status === 'released' ||
          app.status === 'waiting_for_cashier';
        const rawDate = app.paymentDate || app.updatedAt || app.createdAt;
        if (!rawDate) return false;
        const datePH = new Date(new Date(rawDate).getTime() + 8 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        return isProcessed && datePH === today;
      });

      total = payments.reduce((sum, app) => sum + parseFloat(app.totalAmount || 0), 0);
      console.log(`💰 Daily collections (${today} PH): ${payments.length} payments, Total: ₱${total}`);
    } catch (e) {
      console.error('Error fetching daily collections:', e.message);
    }

    res.render('cashier/daily-collections', {
      title: 'Daily Collections — GuidanceConnect',
      user: req.session.user,
      payments,
      total,
      date: today
    });
  } catch (error) {
    console.error('Daily collections error:', error.message);
    const today = new Date().toISOString().split('T')[0];
    res.render('cashier/daily-collections', {
      title: 'Daily Collections — GuidanceConnect',
      user: req.session.user,
      payments: [],
      total: 0,
      date: today,
      testMode: true,
      error: 'Test mode'
    });
  }
};;

// View notifications
// View Notifications
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
      
      console.log(`📬 Loaded ${notifications.length} notifications for cashier`);
    } catch (e) {
      console.error('Error fetching notifications:', e.message);
    }
    
    const unreadNotifCount = notifications.filter(n => !n.isRead).length;
    
    res.render('cashier/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      notifications,
      unreadNotifCount,
      activePage: 'notifications'
    });
  } catch (error) {
    console.error('View notifications error:', error.message);
    res.render('cashier/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      notifications: [],
      unreadNotifCount: 0,
      activePage: 'notifications',
      testMode: true,
      error: 'Test mode'
    });
  }
};

// Mark notifications as read
export const markNotificationsRead = async (req, res) => {
  try {
    const notifications = await FirestoreAdapter.getUserNotifications(req.session.user.id);
    for (const notif of notifications) {
      if (!notif.isRead) {
        await FirestoreAdapter.markNotificationAsRead(notif.id);
      }
    }
    res.redirect('/cashier/notifications');
  } catch (error) {
    console.error('Mark notifications read error:', error.message);
    res.redirect('/cashier/notifications');
  }
};
