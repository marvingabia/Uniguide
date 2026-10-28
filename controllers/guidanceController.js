import { Application, User, Announcement, Appointment, Notification, StudentProfile, CounselingSession, TimeSlot } from '../models/index.js';
import { FirestoreAdapter } from '../models/firestore-adapter.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';

// Shared helper — fetch notifications for the sidebar on every page
const getSidebarNotifs = async (userId) => {
  try {
    const notifications = await FirestoreAdapter.getUserNotifications(userId);
    // Get only first 10 for sidebar
    const sidebarNotifications = notifications.slice(0, 10);
    const unreadNotifCount = sidebarNotifications.filter(n => !n.isRead).length;
    return { notifications: sidebarNotifications, unreadNotifCount };
  } catch (error) {
    console.error('getSidebarNotifs error:', error.message);
    return { notifications: [], unreadNotifCount: 0 };
  }
};

// Dashboard
export const dashboard = async (req, res) => {
  try {
    let toProcess = [];
    let approved = [];
    let released = [];
    let announcements = [];
    let appointments = [];
    let totalApps = 0;
    let pendingCount = 0;
    let verifiedCount = 0;
    let readyCount = 0;
    let releasedCount = 0;

    // Fetch from Firestore
    try {
      // Fetch applications that are ready for guidance to process
      // This includes both: verified but not receipted, and receipted applications
      const verified = await FirestoreAdapter.getAllApplications({ status: 'payment_verified' });
      const receipted = await FirestoreAdapter.getAllApplications({ status: 'receipt_issued' });
      toProcess = [...verified, ...receipted];
      approved = await FirestoreAdapter.getAllApplications({ status: 'approved' });
      released = await FirestoreAdapter.getAllApplications({ status: 'released' });

      // Get all applications for counts
      const allApps = await FirestoreAdapter.getAllApplications();
      totalApps = allApps.length;
      pendingCount = allApps.filter(a => a.status === 'pending').length;
      verifiedCount = allApps.filter(a => a.status === 'payment_verified' || a.status === 'receipt_issued').length;
      readyCount = allApps.filter(a => a.status === 'receipt_issued').length;
      releasedCount = allApps.filter(a => a.status === 'released').length;

      console.log(`📊 Guidance Dashboard: ${totalApps} total, ${readyCount} ready to process, ${releasedCount} released`);
    } catch (e) {
      console.error('Error fetching applications from Firestore:', e.message);
    }

    // Fetch announcements from Firestore
    try {
      announcements = await FirestoreAdapter.getAllAnnouncements() || [];
      console.log(`📢 Announcements: Found ${announcements.length} announcements`);
    } catch (e) {
      console.error('Error fetching announcements from Firestore:', e.message);
    }

    if (Appointment) {
      appointments = await Appointment.findAll({
        where: {
          status: 'pending',
          date: { [Op.ne]: null },
          timeSlot: { [Op.ne]: null }
        },
        include: [{ model: User, as: 'student' }],
        order: [['date', 'ASC']],
        limit: 5
      });
    }

    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);

    res.render('guidance/dashboard', {
      title: 'Guidance Home— UniGuide',
      user: req.session.user,
      toProcess, approved, released, announcements, appointments,
      notifications, unreadNotifCount,
      totalApps, pendingCount, verifiedCount, readyCount, releasedCount,
      testMode: !Application
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/dashboard', {
      title: 'Guidance Home— UniGuide',
      user: req.session.user,
      toProcess: [], approved: [], released: [], announcements: [], appointments: [],
      notifications, unreadNotifCount,
      totalApps: 0, pendingCount: 0, verifiedCount: 0, readyCount: 0, releasedCount: 0,
      testMode: true,
      error: 'Test mode - Database disabled'
    });
  }
};

// All applications
// All Applications
export const allApplications = async (req, res) => {
  try {
    let applications = [];
    const { status, search } = req.query;

    try {
      // Fetch all applications from Firestore
      applications = await FirestoreAdapter.getAllApplications();

      // Filter by status if provided
      if (status) {
        applications = applications.filter(app => app.status === status);
      }

      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        applications = applications.filter(app =>
          (app.surname && app.surname.toLowerCase().includes(searchLower)) ||
          (app.givenName && app.givenName.toLowerCase().includes(searchLower)) ||
          (app.course && app.course.toLowerCase().includes(searchLower))
        );
      }

      console.log(`📊 Guidance all-applications: ${applications.length} applications found`);
    } catch (e) {
      console.error('Error fetching applications:', e.message);
    }

    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/all-applications', {
      title: 'All Applications — GuidanceConnect',
      user: req.session.user,
      applications,
      filterStatus: status || '',
      search: search || '',
      notifications,
      unreadNotifCount
    });
  } catch (error) {
    console.error('All applications error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/all-applications', {
      title: 'All Applications — GuidanceConnect',
      user: req.session.user,
      applications: [],
      filterStatus: '',
      search: '',
      notifications,
      unreadNotifCount,
      testMode: true,
      error: 'Test mode'
    });
  }
};;

// View single application
export const viewApplication = async (req, res) => {
  try {
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    
    // Fetch application from Firestore
    const applications = await FirestoreAdapter.getAllApplications();
    const appIndex = applications.findIndex(a => a.id === req.params.id);
    const app = applications[appIndex];
    
    if (!app) {
      req.flash('error', 'Application not found');
      return res.redirect('/guidance/applications');
    }
    
    // Parse purposes
    let purposes = [];
    try { 
      if (app.purposes) {
        purposes = typeof app.purposes === 'string' 
          ? JSON.parse(app.purposes) 
          : app.purposes;
      }
    } catch {}

    res.render('guidance/view-application', {
      title: `Application #${appIndex} — Uniguide`,
      user: req.session.user,
      app,
      appIndex: appIndex >= 0 ? appIndex : 0,
      purposes,
      notifications,
      unreadNotifCount
    });
  } catch (error) {
    console.error('View application error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/view-application', {
      title: 'Application — Uniguide',
      user: req.session.user,
      app: null,
      appIndex: 0,
      purposes: [],
      notifications,
      unreadNotifCount,
      error: 'Error loading application'
    });
  }
};

// Approve request
export const approveApplication = async (req, res) => {
  try {
    // Fetch and update application in Firestore
    const applications = await FirestoreAdapter.getAllApplications();
    const app = applications.find(a => a.id === req.params.id);
    
    if (!app) {
      req.flash('error', 'Application not found');
      return res.redirect('/guidance/applications');
    }

    // Update status to approved
    await FirestoreAdapter.updateApplication(req.params.id, { 
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: req.session.user.email
    });

    // Notify student
    await FirestoreAdapter.createNotification({
      userId: app.userId,
      type: 'success',
      title: 'Application Approved',
      message: `✓ Your Good Moral Certificate request #${app.id} has been approved and is being prepared.`,
      applicationId: app.id,
      isRead: false
    });

    req.flash('success', 'Request approved. Certificate is being prepared.');
    res.redirect(`/guidance/application/${app.id}`);
  } catch (error) {
    console.error('Approve application error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/applications');
  }
};

// Reject application
export const rejectApplication = async (req, res) => {
  try {
    if (!Application) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/applications');
    }

    const { remarks } = req.body;
    const app = await Application.findByPk(req.params.id, {
      include: [{ model: User, as: 'student' }]
    });
    if (!app) return res.redirect('/guidance/applications');

    await app.update({ status: 'rejected', remarks });
    if (Notification) {
      await createNotification(
        app.userId,
        `Your Good Moral Certificate request #${app.id} was rejected. Reason: ${remarks}`,
        'danger',
        `/student/application/${app.id}`
      );
    }

    req.flash('success', 'Application rejected.');
    res.redirect('/guidance/applications');
  } catch (error) {
    console.error('Reject application error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/applications');
  }
};

// Release certificate
// Release Certificate
export const releaseCertificate = async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('🎓 RELEASE CERTIFICATE');
    console.log('========================================');
    console.log('Application ID:', req.params.id);

    // Get application from Firestore
    const app = await FirestoreAdapter.getApplicationById(req.params.id);
    if (!app) {
      return res.redirect('/guidance/applications');
    }

    // Update application status to released
    await FirestoreAdapter.updateApplication(req.params.id, {
      status: 'released',
      releasedAt: new Date().toISOString(),
      releasedBy: `${req.session.user.firstName} ${req.session.user.lastName}`,
      claimStatus: 'unclaimed'
    });

    // Send notification to student that certificate is ready for claim
    await FirestoreAdapter.createNotification({
      userId: app.userId,
      type: 'success',
      title: 'Certificate Ready for Claim',
      message: `🎓 Your Good Moral Certificate (Request #${req.params.id}) is ready for release at the Guidance Office! Please present your Official Receipt to claim it.`,
      applicationId: req.params.id,
      isRead: false
    });

    console.log('✅ Certificate released and student notified');
    req.flash('success', 'Certificate marked as released. Student has been notified.');
    res.redirect('/guidance/dashboard');
  } catch (error) {
    console.error('❌ Release certificate error:', error.message);
    req.flash('error', `Error: ${error.message}`);
    res.redirect('/guidance/applications');
  }
};

// Mark as claimed
export const markClaimed = async (req, res) => {
  try {
    if (!Application) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/applications');
    }

    const app = await Application.findByPk(req.params.id, {
      include: [{ model: User, as: 'student' }]
    });
    if (!app) return res.redirect('/guidance/applications');
    
    await app.update({ claimStatus: 'claimed' });
    
    if (Notification) {
      // Notify student
      await createNotification(
        app.userId,
        `✅ Your Good Moral Certificate (Request #${app.id}) has been successfully claimed. Thank you!`,
        'success',
        `/student/application/${app.id}`
      );
      
      // Notify counselor who handled it
      await createNotification(
        req.session.user.id,
        `Certificate for request #${app.id} (${app.surname}, ${app.givenName}) has been claimed.`,
        'info',
        `/guidance/application/${app.id}`
      );
    }
    
    req.flash('success', 'Certificate marked as claimed. Student has been notified.');
    res.redirect(`/guidance/application/${app.id}`);
  } catch (error) {
    console.error('Mark claimed error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect(`/guidance/application/${req.params.id}`);
  }
};

// Announcements
export const showAnnouncementForm = async (req, res) => {
  try {
    let announcements = [];
    
    try {
      announcements = await FirestoreAdapter.getAllAnnouncements();
    } catch (e) {
      console.error('Error fetching announcements:', e.message);
    }
    
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/new-announcement', {
      title: 'New Announcement — Uniguide',
      user: req.session.user,
      announcements,
      notifications, unreadNotifCount
    });
  } catch (error) {
    console.error('Show announcement form error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/new-announcement', {
      title: 'New Announcement — Uniguide',
      user: req.session.user,
      announcements: [],
      notifications, unreadNotifCount,
      error: 'Error loading announcements'
    });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, eventDate } = req.body;
    
    // Create announcement in Firestore
    const announcement = await FirestoreAdapter.createAnnouncement({
      title,
      content,
      type: type || 'general',
      eventDate: eventDate || null,
      authorId: req.session.user.id,
      authorEmail: req.session.user.email,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Send notification to all students
    try {
      // Get ALL students (not just those with applications)
      const allStudents = await FirestoreAdapter.getAllUsers({ role: 'student' });
      
      // Send notification to each student
      for (const student of allStudents) {
        await FirestoreAdapter.createNotification({
          userId: student.id,
          type: 'info',
          title: `📢 New Announcement: ${title}`,
          message: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
          announcementId: announcement.id,
          isRead: false
        });
      }
      
      console.log(`📢 Announcement created and ${allStudents.length} notifications sent to all students`);
    } catch (notifErr) {
      console.error('Error sending notifications:', notifErr.message);
      // Don't fail the announcement creation if notifications fail
    }

    req.flash('success', 'Announcement posted and notifications sent to all students.');
    res.redirect('/guidance/announcements/new');
  } catch (error) {
    console.error('Create announcement error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/announcements/new');
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    if (Announcement) {
      await Announcement.update({ isActive: false }, { where: { id: req.params.id } });
      req.flash('success', 'Announcement removed.');
    } else {
      req.flash('warning', 'Test mode - Database disabled');
    }
    res.redirect('/guidance/Home');
  } catch (error) {
    console.error('Delete announcement error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/Home');
  }
};

// User management
export const manageUsers = async (req, res) => {
  try {
    let users = [];
    if (User) {
      users = await User.findAll({ order: [['role', 'ASC'], ['createdAt', 'DESC']] });
    }
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/users', {
      title: 'Manage Users — GuidanceConnect',
      user: req.session.user,
      users,
      notifications, unreadNotifCount,
      testMode: !User
    });
  } catch (error) {
    console.error('Manage users error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/users', {
      title: 'Manage Users — GuidanceConnect',
      user: req.session.user,
      users: [],
      notifications, unreadNotifCount,
      testMode: true,
      error: 'Test mode - Database disabled'
    });
  }
};

export const createStaffAccount = async (req, res) => {
  try {
    if (!User) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/users');
    }

    const bcrypt = await import('bcrypt');
    const { firstName, lastName, email, password, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash('error', 'Email already exists.');
      return res.redirect('/guidance/users');
    }
    const hashed = await bcrypt.default.hash(password, 10);
    await User.create({ firstName, lastName, email, password: hashed, role });
    req.flash('success', `${role.charAt(0).toUpperCase() + role.slice(1)} account created.`);
    res.redirect('/guidance/users');
  } catch (error) {
    console.error('Create staff account error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/users');
  }
};

// Appointments management
export const manageAppointments = async (req, res) => {
  try {
    let appointments = [];
    let timeSlots = [];
    
    // Fetch from Firestore
    try {
      // Only show PENDING appointments in the current appointments list
      // Approved appointments are moved to available slots
      appointments = await FirestoreAdapter.getAppointmentRequests({ status: 'pending' }) || [];
      console.log(`📅 Guidance appointments: Found ${appointments.length} pending appointment requests`);
      timeSlots = await FirestoreAdapter.getCollectionData('timeSlots') || [];
      console.log(`⏰ Time slots: Found ${timeSlots.length} time slots`);
    } catch (e) {
      console.error('Error fetching appointments/timeSlots from Firestore:', e.message);
    }

    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/appointments', {
      title: 'Appointments & Time Slots — Uniguide',
      user: req.session.user,
      appointments,
      timeSlots,
      notifications, unreadNotifCount
    });
  } catch (error) {
    console.error('Manage appointments error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/appointments', {
      title: 'Appointments & Time Slots — Uniguide',
      user: req.session.user,
      appointments: [],
      timeSlots: [],
      notifications, unreadNotifCount,
      error: 'Error loading appointments'
    });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    if (!Appointment) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/appointments');
    }

    const { status, cancelReason } = req.body;
    const appt = await Appointment.findByPk(req.params.id);
    if (!appt) return res.redirect('/guidance/appointments');

    await appt.update({ status, cancelReason: cancelReason || null });

    if (Notification) {
      const messages = {
        approved:  'Your appointment has been approved.',
        cancelled: `Your appointment was cancelled. Reason: ${cancelReason || 'N/A'}`,
        done:      'Your appointment has been marked as completed.'
      };
      if (messages[status]) {
        await createNotification(appt.userId, messages[status],
          status === 'cancelled' ? 'danger' : 'success', '/student/appointments');
      }
    }

    req.flash('success', `Appointment ${status}.`);
    res.redirect('/guidance/appointments');
  } catch (error) {
    console.error('Update appointment error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/appointments');
  }
};

// Reschedule appointment
export const rescheduleAppointment = async (req, res) => {
  try {
    if (!Appointment) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/appointments');
    }

    const { newDate, newTimeSlot } = req.body;
    const appt = await Appointment.findByPk(req.params.id, {
      include: [{ model: User, as: 'student' }]
    });
    if (!appt) return res.redirect('/guidance/appointments');

    const oldDate     = appt.date;
    const oldTimeSlot = appt.timeSlot;

    await appt.update({ date: newDate, timeSlot: newTimeSlot });
    if (Notification) {
      await createNotification(
        appt.userId,
        `📅 Your appointment has been rescheduled by the Guidance Office.\n` +
        `Old schedule: ${oldDate} at ${oldTimeSlot}\n` +
        `New schedule: ${newDate} at ${newTimeSlot}`,
        'warning',
        '/student/appointments'
      );
    }

    req.flash('success', `Appointment rescheduled to ${newDate} at ${newTimeSlot}. Student has been notified.`);
    res.redirect('/guidance/appointments');
  } catch (error) {
    console.error('Reschedule appointment error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/guidance/appointments');
  }
};

// Notifications page
// View Notifications
export const viewNotifications = async (req, res) => {
  try {
    let allNotifications = [];
    
    try {
      // Get notifications from Firestore
      allNotifications = await FirestoreAdapter.getUserNotifications(req.session.user.id);
      
      // Mark all as read
      for (const notif of allNotifications) {
        if (!notif.isRead) {
          await FirestoreAdapter.markNotificationAsRead(notif.id);
        }
      }
      
      console.log(`📬 Loaded ${allNotifications.length} notifications for guidance`);
    } catch (e) {
      console.error('Error fetching notifications:', e.message);
    }

    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      allNotifications,
      notifications,
      unreadNotifCount
    });
  } catch (error) {
    console.error('View notifications error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/notifications', {
      title: 'Notifications — UniGuide',
      user: req.session.user,
      allNotifications: [],
      notifications,
      unreadNotifCount,
      testMode: true,
      error: 'Test mode'
    });
  }
};

export const markNotificationsRead = async (req, res) => {
  try {
    if (Notification) {
      await Notification.update(
        { isRead: true },
        { where: { userId: req.session.user.id, isRead: false } }
      );
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark notifications read error:', error.message);
    res.json({ ok: false });
  }
};

// Reports
export const reports = async (req, res) => {
  try {
    const { type = 'monthly', month, year } = req.query;
    const now = new Date();
    const selectedYear  = parseInt(year)  || now.getFullYear();
    const selectedMonth = parseInt(month) || (now.getMonth() + 1);

    let applications = [];
    let totalCollection = 0;

    if (Application) {
      if (type === 'daily') {
        const today = new Date().toISOString().split('T')[0];
        applications = await Application.findAll({
          where: { createdAt: { [Op.gte]: new Date(today) } },
          include: [{ model: User, as: 'student' }],
          order: [['createdAt', 'DESC']]
        });
      } else if (type === 'monthly') {
        applications = await Application.findAll({
          include: [{ model: User, as: 'student' }],
          order: [['createdAt', 'DESC']]
        });
        applications = applications.filter(a => {
          const d = new Date(a.createdAt);
          return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
        });
      } else {
        applications = await Application.findAll({
          include: [{ model: User, as: 'student' }],
          order: [['createdAt', 'DESC']]
        });
      }

      totalCollection = applications
        .filter(a => ['receipt_issued', 'approved', 'released'].includes(a.status))
        .reduce((s, a) => s + parseFloat(a.totalAmount || 0), 0);
    }

    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/reports', {
      title: 'Reports — GuidanceConnect',
      user: req.session.user,
      applications, totalCollection,
      reportType: type, selectedYear, selectedMonth,
      notifications, unreadNotifCount,
      testMode: !Application
    });
  } catch (error) {
    console.error('Reports error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/reports', {
      title: 'Reports — GuidanceConnect',
      user: req.session.user,
      applications: [], totalCollection: 0,
      reportType: 'monthly', selectedYear: new Date().getFullYear(), selectedMonth: new Date().getMonth() + 1,
      notifications, unreadNotifCount,
      testMode: true,
      error: 'Test mode - Database disabled'
    });
  }
};


// Student Profiling - List all students
export const studentProfiling = async (req, res) => {
  try {
    const { search, status } = req.query;
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    
    // Get all applications from Firestore to build student list
    const applications = await FirestoreAdapter.getAllApplications();
    console.log(`📚 Student Profiling: Found ${applications.length} total applications`);
    
    let students = [];
    const seenStudents = new Set();
    
    // Group applications by userId
    for (const app of applications) {
      if (seenStudents.has(app.userId)) continue;
      seenStudents.add(app.userId);
      
      const student = {
        id: app.userId,
        firstName: app.givenName || '',
        lastName: app.surname || '',
        email: app.email || '',
        studentId: app.studentId || '',
        course: app.course || '',
        yearLevel: app.yearLevel || '',
        section: app.section || '',
        contactNo: app.contactNumber || '',
        enrollmentStatus: app.enrollmentStatus || '',
        status: app.status || 'pending',
        profile: null
      };
      
      // Apply status filter
      if (status && student.status !== status) {
        console.log(`  ⏭️ Skipped ${student.firstName} ${student.lastName} - status ${student.status} != ${status}`);
        continue;
      }
      
      // Apply search filter
      let matchesSearch = true;
      if (search) {
        const searchLower = search.toLowerCase();
        matchesSearch = 
          student.firstName.toLowerCase().includes(searchLower) ||
          student.lastName.toLowerCase().includes(searchLower) ||
          student.studentId.toLowerCase().includes(searchLower) ||
          student.course.toLowerCase().includes(searchLower);
      }
      
      if (matchesSearch) {
        console.log(`  ✓ Added ${student.firstName} ${student.lastName} - status: ${student.status}`);
        students.push(student);
      }
    }
    
    // Sort by lastName, firstName
    students.sort((a, b) => {
      if (a.lastName !== b.lastName) return a.lastName.localeCompare(b.lastName);
      return a.firstName.localeCompare(b.firstName);
    });
    
    console.log(`📊 Student Profiling: Showing ${students.length} students after filters`);
    
    res.render('guidance/profiling', {
      title: 'Student Profiling — Uniguide',
      user: req.session.user,
      students,
      searchQuery: search || '',
      filterStatus: status || '',
      notifications, unreadNotifCount
    });
  } catch (error) {
    console.error('Student profiling error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/profiling', {
      title: 'Student Profiling — Uniguide',
      user: req.session.user,
      students: [],
      searchQuery: '',
      filterStatus: '',
      notifications, unreadNotifCount,
      error: 'Error loading students'
    });
  }
};

// View single student profile
export const viewStudentProfile = async (req, res) => {
  try {
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    
    // Get student from their applications (to get their details)
    const applications = await FirestoreAdapter.getAllApplications();
    
    // Find the student by their application ID (req.params.id is the student user ID)
    const studentApps = applications.filter(app => app.userId === req.params.id);
    
    if (studentApps.length === 0) {
      req.flash('error', 'Student not found.');
      return res.redirect('/guidance/profiling');
    }
    
    // Get first application to get student details
    const studentData = studentApps[0];
    
    res.render('guidance/student-profile', {
      title: `${studentData.surname} ${studentData.givenName} — Student Profile`,
      user: req.session.user,
      student: {
        id: req.params.id,
        firstName: studentData.givenName,
        lastName: studentData.surname,
        email: studentData.email || '',
        studentId: studentData.studentId || '',
        course: studentData.course || '',
        yearLevel: studentData.yearLevel || '',
        section: studentData.section || '',
        contactNo: studentData.contactNumber || '',
        enrollmentStatus: studentData.enrollmentStatus || ''
      },
      applications: studentApps,
      notifications, unreadNotifCount
    });
  } catch (error) {
    console.error('View student profile error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/student-profile', {
      title: 'Student Profile — UniGuide',
      user: req.session.user,
      student: null,
      applications: [],
      notifications, unreadNotifCount,
      error: 'Error loading student profile'
    });
  }
};

// Update student profile
export const updateStudentProfile = async (req, res) => {
  try {
    if (!User || !StudentProfile) {
      return res.status(400).json({ error: 'Test mode - Database disabled' });
    }

    const { 
      birthdate, address, guardianName, guardianContact, emergencyContact,
      previousSchool, scholarshipInfo, behavioralNotes, caseType, riskLevel, remarks
    } = req.body;
    
    const student = await User.findByPk(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    let profile = await StudentProfile.findOne({ where: { userId: student.id } });
    
    const data = {
      userId: student.id,
      birthdate, address, guardianName, guardianContact, emergencyContact,
      previousSchool, scholarshipInfo, behavioralNotes, caseType, riskLevel, remarks
    };
    
    if (profile) {
      await profile.update(data);
    } else {
      profile = await StudentProfile.create(data);
    }
    
    req.flash('success', 'Student profile updated successfully.');
    res.redirect(`/guidance/profiling/student/${student.id}`);
  } catch (error) {
    console.error('Update student profile error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect(`/guidance/profiling/student/${req.params.id}`);
  }
};

// Add counseling session
export const addCounselingSession = async (req, res) => {
  try {
    if (!User || !CounselingSession || !StudentProfile) {
      return res.status(400).json({ error: 'Test mode - Database disabled' });
    }

    const { sessionDate, duration, sessionType, topic, notes, actionPlan, followUpDate, status } = req.body;
    
    const student = await User.findByPk(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    await CounselingSession.create({
      userId: student.id,
      counselorId: req.session.user.id,
      sessionDate: sessionDate || new Date(),
      duration: duration || null,
      sessionType: sessionType || 'individual',
      topic, notes, actionPlan,
      followUpDate: followUpDate || null,
      status: status || 'completed'
    });
    
    // Update profile session count and last session
    let profile = await StudentProfile.findOne({ where: { userId: student.id } });
    if (profile) {
      await profile.update({
        totalSessions: profile.totalSessions + 1,
        lastSessionDate: sessionDate || new Date(),
        lastSessionNotes: notes
      });
    } else {
      await StudentProfile.create({
        userId: student.id,
        totalSessions: 1,
        lastSessionDate: sessionDate || new Date(),
        lastSessionNotes: notes
      });
    }
    
    req.flash('success', 'Counseling session recorded.');
    res.redirect(`/guidance/profiling/student/${student.id}`);
  } catch (error) {
    console.error('Add counseling session error:', error.message);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect(`/guidance/profiling/student/${req.params.id}`);
  }
};

// ── Time Slot Management (Auto-scheduling) ──────────────────────

// View and manage available time slots
export const manageTimeSlots = async (req, res) => {
  try {
    let timeSlots = [];
    if (TimeSlot) {
      timeSlots = await TimeSlot.findAll({
        include: [{ model: User, as: 'counselor' }],
        order: [['date', 'ASC'], ['timeSlot', 'ASC']]
      });
    }
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/time-slots', {
      title: 'Manage Time Slots — UniGuide',
      user: req.session.user,
      timeSlots,
      notifications, unreadNotifCount,
      testMode: !TimeSlot
    });
  } catch (error) {
    console.error('Manage time slots error:', error.message);
    const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
    res.render('guidance/time-slots', {
      title: 'Manage Time Slots — UniGuide',
      user: req.session.user,
      timeSlots: [],
      notifications, unreadNotifCount,
      testMode: true,
      error: 'Test mode - Database disabled'
    });
  }
};

// Create new time slots
export const createTimeSlots = async (req, res) => {
  try {
    const { dates, timeSlots, maxSlots, notes, purpose } = req.body;
    
    // Normalize dates and timeSlots to arrays
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const slotArray = Array.isArray(timeSlots) ? timeSlots : [timeSlots];
    const maxSlotsPerTime = parseInt(maxSlots) || 1;
    const slotPurpose = purpose || 'General';
    
    console.log(`📅 Creating time slots for ${dateArray.length} dates × ${slotArray.length} times with purpose: ${slotPurpose}`);
    
    // Create time slots in Firestore
    const createdSlots = [];
    for (const date of dateArray) {
      for (const time of slotArray) {
        try {
          const timeSlotData = {
            counselorId: req.session.user.id,
            counselorName: req.session.user.firstName + ' ' + req.session.user.lastName,
            date,
            time, // Changed from timeSlot to time
            purpose: slotPurpose,
            maxSlots: maxSlotsPerTime,
            bookedCount: 0,
            isAvailable: true,
            notes: notes || '',
            createdAt: new Date().toISOString()
          };
          
          const slot = await FirestoreAdapter.createTimeSlot(timeSlotData);
          createdSlots.push(slot);
          console.log(`  ✓ Created slot: ${date} @ ${time}`);
        } catch (slotErr) {
          console.error(`  ✗ Failed to create slot ${date} @ ${time}:`, slotErr.message);
        }
      }
    }

    // AUTO-MATCH: Find pending appointments with matching purpose and assign them
    let assignedCount = 0;
    if (createdSlots.length > 0) {
      try {
        // Get all pending appointment requests
        const pendingRequests = await FirestoreAdapter.getAppointmentRequests({ status: 'pending' });
        console.log(`🔍 Found ${pendingRequests.length} pending appointment requests`);
        
        // Match and assign
        for (const slot of createdSlots) {
          if (slot.bookedCount >= slot.maxSlots) continue; // Slot full
          
          // Find matching requests (same purpose)
          const matchingRequests = pendingRequests.filter(req => 
            req.purpose && req.purpose.toLowerCase().includes(slotPurpose.toLowerCase())
          );
          
          console.log(`  🎯 Found ${matchingRequests.length} requests matching purpose "${slotPurpose}"`);
          
          // Assign students to this slot (FIFO - first come, first served)
          const slotsAvailable = slot.maxSlots - slot.bookedCount;
          const toAssign = matchingRequests.slice(0, slotsAvailable);
          
          for (const apptRequest of toAssign) {
            try {
              // Update appointment request with assigned schedule
              await FirestoreAdapter.updateAppointmentRequest(apptRequest.id, {
                status: 'approved',
                assignedDate: slot.date,
                assignedTime: slot.time,
                assignedSlotId: slot.id,
                counselorId: slot.counselorId,
                counselorName: slot.counselorName
              });
              
              // Get student info
              const student = await FirestoreAdapter.findUserById(apptRequest.userId);
              
              // Send notification to student
              await FirestoreAdapter.createNotification({
                userId: apptRequest.userId,
                type: 'success',
                title: '✅ Appointment Scheduled!',
                message: `Your ${slotPurpose} appointment is confirmed for ${slot.date} at ${slot.time} with ${slot.counselorName}`,
                appointmentId: apptRequest.id,
                isRead: false
              });
              
              console.log(`    ✓ Assigned ${student?.firstName} to slot`);
              assignedCount++;
              
              // Remove from matchingRequests so we don't assign twice
              const idx = matchingRequests.indexOf(apptRequest);
              if (idx > -1) matchingRequests.splice(idx, 1);
            } catch (assignErr) {
              console.error(`    ✗ Failed to assign appointment:`, assignErr.message);
            }
          }
        }
      } catch (matchErr) {
        console.error('Error during auto-matching:', matchErr.message);
      }
    }

    const message = `✅ Created ${createdSlots.length} time slot(s) for "${slotPurpose}". ${assignedCount} student(s) auto-assigned and notified.`;
    req.flash('success', message);
    console.log(`\n${message}\n`);
    res.redirect('/guidance/appointments');
    
  } catch (err) {
    console.error('Create time slots error:', err.message);
    req.flash('error', `Failed: ${err.message}`);
    res.redirect('/guidance/appointments');
  }
};

// Delete time slot
export const deleteTimeSlot = async (req, res) => {
  try {
    if (!TimeSlot) {
      req.flash('warning', 'Test mode - Database disabled');
      return res.redirect('/guidance/time-slots');
    }

    const slot = await TimeSlot.findByPk(req.params.id);
    if (!slot) {
      req.flash('error', 'Time slot not found.');
      return res.redirect('/guidance/time-slots');
    }
    
    // Check if any appointments are using this slot
    if (Appointment) {
      const hasAppointments = await Appointment.count({ where: { timeSlotId: slot.id } });
      if (hasAppointments > 0) {
        req.flash('error', 'Cannot delete time slot with existing appointments.');
        return res.redirect('/guidance/time-slots');
      }
    }
    
    await slot.destroy();
    req.flash('success', 'Time slot deleted.');
    res.redirect('/guidance/time-slots');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete time slot.');
    res.redirect('/guidance/time-slots');
  }
};

// Toggle time slot availability
export const toggleTimeSlot = async (req, res) => {
  try {
    if (!TimeSlot) {
      return res.status(400).json({ error: 'Test mode - Database disabled' });
    }

    const slot = await TimeSlot.findByPk(req.params.id);
    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }
    
    await slot.update({ isAvailable: !slot.isAvailable });
    req.flash('success', `Time slot ${slot.isAvailable ? 'enabled' : 'disabled'}.`);
    res.redirect('/guidance/time-slots');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update time slot.');
    res.redirect('/guidance/time-slots');
  }
};
