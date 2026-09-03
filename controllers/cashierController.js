import { Application, User, Notification } from '../models/index.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';

// Dashboard
export const dashboard = async (req, res) => {
  const pending   = await Application.findAll({
    where: { status: 'payment_submitted' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']]
  });
  const verified  = await Application.findAll({
    where: { status: 'payment_verified' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']]
  });
  const receipted = await Application.findAll({
    where: { status: 'receipt_issued' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']]
  });

  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
    limit: 10
  });
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  // Daily collections
  const today = new Date().toISOString().split('T')[0];
  const dailyPayments = await Application.findAll({
    where: { status: ['receipt_issued', 'approved', 'released'], paymentDate: today }
  });
  const dailyTotal = dailyPayments.reduce((sum, app) => sum + parseFloat(app.totalAmount || 0), 0);

  res.render('cashier/dashboard', {
    title: 'Cashier Dashboard — GuidanceConnect',
    user: req.session.user,
    pending,
    verified,
    receipted,
    notifications,
    unreadNotifCount,
    dailyTotal,
    pendingCount: pending.length,
    verifiedCount: verified.length,
    receiptedCount: receipted.length,
    awaitingActionCount: pending.length + verified.length
  });
};

// View application
export const viewApplication = async (req, res) => {
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/cashier/dashboard');
  
  // If payment just submitted and not yet seen, notify student that cashier is reviewing
  if (app.status === 'payment_submitted') {
    // Check if we already sent "reviewing" notification
    const existingNotif = await Notification.findOne({
      where: {
        userId: app.userId,
        message: { [Op.like]: `%Cashier is reviewing your payment%${app.id}%` }
      }
    });
    
    if (!existingNotif) {
      await createNotification(
        app.userId,
        `💼 Cashier is reviewing your payment for request #${app.id}.`,
        'info',
        `/student/application/${app.id}`
      );
    }
  }
  
  let purposes = [];
  try { purposes = JSON.parse(app.purposes); } catch {}
  res.render('cashier/view-application', {
    title: 'Review Application — GuidanceConnect',
    user: req.session.user,
    app,
    purposes
  });
};

// Verify payment and issue receipt (combined)
export const verifyAndIssueReceipt = async (req, res) => {
  const { orNumber } = req.body;
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/cashier/dashboard');

  const receiptFile = req.file ? `/uploads/receipts/${req.file.filename}` : null;

  // OR number is optional - can be blank
  const orNum = orNumber && orNumber.trim() ? orNumber.trim() : null;

  // Update to payment_verified status first
  await app.update({
    orNumber: orNum,
    receiptFile,
    status: 'payment_verified'
  });

  // Notify student
  const orText = orNum ? ` Official Receipt #${orNum} issued.` : '';
  await createNotification(
    app.userId,
    `✅ Your payment for request #${app.id} has been verified (₱${app.totalAmount}).${orText} Your request has been forwarded to the Guidance Office.`,
    'success',
    `/student/application/${app.id}`
  );

  // Notify guidance
  await notifyAllRole(
    'guidance',
    `Payment verified for request #${app.id} (${app.surname}, ${app.givenName}). Ready for processing.`,
    'info',
    `/guidance/application/${app.id}`
  );

  req.flash('success', 'Payment verified and forwarded to Guidance Office.');
  res.redirect('/cashier/dashboard');
};

// Issue receipt (move from payment_verified to receipt_issued)
export const issueReceipt = async (req, res) => {
  const { orNumber } = req.body;
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/cashier/dashboard');

  const receiptFile = req.file ? `/uploads/receipts/${req.file.filename}` : null;
  const orNum = orNumber && orNumber.trim() ? orNumber.trim() : null;

  // Update to receipt_issued status
  await app.update({
    orNumber: orNum || app.orNumber,
    receiptFile: receiptFile || app.receiptFile,
    status: 'receipt_issued'
  });

  req.flash('success', 'Receipt issued successfully.');
  res.redirect('/cashier/dashboard');
};

// Reject application
export const rejectApplication = async (req, res) => {
  const { remarks } = req.body;
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/cashier/dashboard');

  await app.update({ status: 'rejected', remarks });

  // Notify student
  await createNotification(
    app.userId,
    `Your payment for request #${app.id} was rejected. Reason: ${remarks}`,
    'danger',
    `/student/application/${app.id}`
  );

  req.flash('success', 'Application rejected.');
  res.redirect('/cashier/dashboard');
};

// Re-issue receipt
export const reissueReceipt = async (req, res) => {
  const { orNumber, reissueReason } = req.body;
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  
  if (!app) return res.redirect('/cashier/dashboard');

  const updates = {};
  
  // OR number is optional
  if (orNumber && orNumber.trim()) {
    updates.orNumber = orNumber.trim();
  }
  
  // Update receipt file if new one uploaded
  if (req.file) {
    updates.receiptFile = `/uploads/receipts/${req.file.filename}`;
  }
  
  await app.update(updates);

  // Notify student about receipt update
  const orText = updates.orNumber ? ` OR Number: ${updates.orNumber}.` : '';
  await createNotification(
    app.userId,
    `📝 Your receipt information has been updated.${orText} Reason: ${reissueReason}`,
    'info',
    `/student/application/${app.id}`
  );

  // Notify guidance about the update
  await notifyAllRole(
    'guidance',
    `Receipt updated for request #${app.id} (${app.surname}, ${app.givenName}). Reason: ${reissueReason}`,
    'warning',
    `/guidance/application/${app.id}`
  );

  req.flash('success', `Receipt information updated successfully.`);
  res.redirect(`/cashier/application/${app.id}`);
};

// Payment history
export const paymentHistory = async (req, res) => {
  const payments = await Application.findAll({
    where: { status: ['receipt_issued', 'approved', 'released'] },
    include: [{ model: User, as: 'student' }],
    order: [['paymentDate', 'DESC']]
  });
  res.render('cashier/payment-history', {
    title: 'Payment History — GuidanceConnect',
    user: req.session.user,
    payments
  });
};

// Daily collections report
export const dailyCollections = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const payments = await Application.findAll({
    where: { status: ['receipt_issued', 'approved', 'released'], paymentDate: today },
    include: [{ model: User, as: 'student' }],
    order: [['createdAt', 'DESC']]
  });
  const total = payments.reduce((sum, app) => sum + parseFloat(app.totalAmount || 0), 0);
  res.render('cashier/daily-collections', {
    title: 'Daily Collections — GuidanceConnect',
    user: req.session.user,
    payments,
    total,
    date: today
  });
};

// View notifications
export const viewNotifications = async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50
  });
  
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;
  
  res.render('cashier/notifications', {
    title: 'Notifications — UniGuide',
    user: req.session.user,
    notifications,
    unreadNotifCount,
    activePage: 'notifications'
  });
};

// Mark notifications as read
export const markNotificationsRead = async (req, res) => {
  await Notification.update(
    { isRead: true },
    { where: { userId: req.session.user.id, isRead: false } }
  );
  res.redirect('/cashier/notifications');
};
