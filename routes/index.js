import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from '../config/passport.js';
import * as auth     from '../controllers/authController.js';
import * as student  from '../controllers/studentController.js';
import * as cashier  from '../controllers/cashierController.js';
import * as guidance from '../controllers/guidanceController.js';
import { requireRole } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// ── Multer storage ──────────────────────────────────────────────
const storage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, `../public/uploads/${folder}`)),
  filename:    (req, file, cb) => cb(null, `${folder}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadPayment = multer({ storage: storage('payments'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadReceipt = multer({ storage: storage('receipts'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatar  = multer({ storage: storage('avatars'),  limits: { fileSize: 3 * 1024 * 1024 } });

// ── Public ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student')  return res.redirect('/student/dashboard');
    if (role === 'cashier')  return res.redirect('/cashier/dashboard');
    if (role === 'guidance') return res.redirect('/guidance/dashboard');
  }
  res.redirect('/login');
});
router.get('/login',     auth.showLogin);
router.post('/login',    auth.login);
router.get('/register',  auth.showRegister);
router.post('/register', auth.register);
router.post('/logout',   auth.logout);

// ── Google OAuth ─────────────────────────────────────────────────
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true, session: false }),
  auth.googleCallback
);

// ── Student ──────────────────────────────────────────────────────
router.get('/student/home',                     requireRole('student'), student.dashboard);
router.get('/student/dashboard',                requireRole('student'), student.dashboard);
router.get('/student/history',                  requireRole('student'), student.applicationHistory);
router.get('/student/apply',                    requireRole('student'), student.showApplyForm);
router.post('/student/apply',                   requireRole('student'), student.submitApplication);
router.get('/student/application/:id',          requireRole('student'), student.viewApplication);
router.post('/student/application/:id/delete',  requireRole('student'), student.deleteApplication);
router.get('/student/application/:id/payment',  requireRole('student'), student.showPaymentForm);
router.post('/student/application/:id/payment', requireRole('student'), uploadPayment.single('screenshot'), student.submitPayment);
router.get('/student/notifications',            requireRole('student'), student.viewNotifications);
router.get('/student/announcements',            requireRole('student'), student.viewAnnouncements);
router.get('/student/appointments',             requireRole('student'), student.showAppointmentForm);
router.post('/student/appointments',            requireRole('student'), student.bookAppointment);
router.get('/student/profile',                  requireRole('student'), student.showProfile);
router.post('/student/profile',                 requireRole('student'), uploadAvatar.single('profileImage'), student.updateProfile);

// ── Cashier ──────────────────────────────────────────────────────
router.get('/cashier/home',                                 requireRole('cashier'), cashier.dashboard);
router.get('/cashier/dashboard',                            requireRole('cashier'), cashier.dashboard);
router.get('/cashier/application/:id',                      requireRole('cashier'), cashier.viewApplication);
router.post('/cashier/application/:id/verify-and-issue',    requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.verifyAndIssueReceipt);
router.post('/cashier/application/:id/issue-receipt',       requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.issueReceipt);
router.post('/cashier/application/:id/reissue-receipt',     requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.reissueReceipt);
router.post('/cashier/application/:id/reject',              requireRole('cashier'), cashier.rejectApplication);
router.get('/cashier/history',                              requireRole('cashier'), cashier.paymentHistory);
router.get('/cashier/notifications',                        requireRole('cashier'), cashier.viewNotifications);
router.post('/cashier/notifications/mark-read',             requireRole('cashier'), cashier.markNotificationsRead);

// ── Guidance ─────────────────────────────────────────────────────
router.get('/guidance/home',                                requireRole('guidance'), guidance.dashboard);
router.get('/guidance/dashboard',                           requireRole('guidance'), guidance.dashboard);
router.get('/guidance/applications',                        requireRole('guidance'), guidance.allApplications);
router.get('/guidance/application/:id',                     requireRole('guidance'), guidance.viewApplication);
router.post('/guidance/application/:id/approve',            requireRole('guidance'), guidance.approveApplication);
router.post('/guidance/application/:id/release',            requireRole('guidance'), guidance.releaseCertificate);
router.post('/guidance/application/:id/reject',             requireRole('guidance'), guidance.rejectApplication);
router.post('/guidance/application/:id/claim',              requireRole('guidance'), guidance.markClaimed);
router.get('/guidance/announcements/new',                   requireRole('guidance'), guidance.showAnnouncementForm);
router.post('/guidance/announcements',                      requireRole('guidance'), guidance.createAnnouncement);
router.post('/guidance/announcements/:id/delete',           requireRole('guidance'), guidance.deleteAnnouncement);
router.get('/guidance/users',                               requireRole('guidance'), guidance.manageUsers);
router.post('/guidance/users',                              requireRole('guidance'), guidance.createStaffAccount);
router.get('/guidance/appointments',                        requireRole('guidance'), guidance.manageAppointments);
router.post('/guidance/appointments/:id/update',            requireRole('guidance'), guidance.updateAppointment);
router.post('/guidance/appointments/:id/reschedule',        requireRole('guidance'), guidance.rescheduleAppointment);
router.get('/guidance/time-slots',                          requireRole('guidance'), guidance.manageTimeSlots);
router.post('/guidance/time-slots',                         requireRole('guidance'), guidance.createTimeSlots);
router.post('/guidance/time-slots/:id/delete',              requireRole('guidance'), guidance.deleteTimeSlot);
router.post('/guidance/time-slots/:id/toggle',              requireRole('guidance'), guidance.toggleTimeSlot);
router.get('/guidance/reports',                             requireRole('guidance'), guidance.reports);
router.get('/guidance/notifications',                       requireRole('guidance'), guidance.viewNotifications);
router.post('/guidance/notifications/mark-read',            requireRole('guidance'), guidance.markNotificationsRead);
router.get('/guidance/profiling',                           requireRole('guidance'), guidance.studentProfiling);
router.get('/guidance/profiling/student/:id',               requireRole('guidance'), guidance.viewStudentProfile);
router.post('/guidance/profiling/student/:id',              requireRole('guidance'), guidance.updateStudentProfile);
router.post('/guidance/profiling/student/:id/session',      requireRole('guidance'), guidance.addCounselingSession);

export default router;
