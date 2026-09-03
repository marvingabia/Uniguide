import { Application, User, Announcement, Appointment, Notification, StudentProfile, CounselingSession, TimeSlot } from '../models/index.js';
import { createNotification, notifyAllRole } from '../utils/notifications.js';
import { Op } from 'sequelize';

// Shared helper — fetch notifications for the sidebar on every page
const getSidebarNotifs = async (userId) => {
  const notifications = await Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 10
  });
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;
  return { notifications, unreadNotifCount };
};

// Dashboard
export const dashboard = async (req, res) => {
  const toProcess = await Application.findAll({
    where: { status: 'receipt_issued' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']]
  });
  const approved = await Application.findAll({
    where: { status: 'approved' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']]
  });
  const released = await Application.findAll({
    where: { status: 'released' },
    include: [{ model: User, as: 'student' }],
    order: [['updatedAt', 'DESC']],
    limit: 10
  });
  const announcements = await Announcement.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5
  });
  const appointments = await Appointment.findAll({
    where: {
      status: 'pending',
      date: { [Op.ne]: null },
      timeSlot: { [Op.ne]: null }
    },
    include: [{ model: User, as: 'student' }],
    order: [['date', 'ASC']],
    limit: 5
  });

  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);

  const totalApps     = await Application.count();
  const pendingCount  = await Application.count({ where: { status: 'pending' } });
  const verifiedCount = await Application.count({ where: { status: ['payment_verified', 'receipt_issued'] } });
  const readyCount    = await Application.count({ where: { status: 'receipt_issued' } });
  const releasedCount = await Application.count({ where: { status: 'released' } });

  res.render('guidance/dashboard', {
    title: 'Guidance Home— UniGuide',
    user: req.session.user,
    toProcess, approved, released, announcements, appointments,
    notifications, unreadNotifCount,
    totalApps, pendingCount, verifiedCount, readyCount, releasedCount
  });
};

// All applications
export const allApplications = async (req, res) => {
  const { status, search } = req.query;
  const where = {};
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { surname:   { [Op.like]: `%${search}%` } },
      { givenName: { [Op.like]: `%${search}%` } },
      { course:    { [Op.like]: `%${search}%` } }
    ];
  }
  const applications = await Application.findAll({
    where,
    include: [{ model: User, as: 'student' }],
    order: [['createdAt', 'DESC']]
  });
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/all-applications', {
    title: 'All Applications — GuidanceConnect',
    user: req.session.user,
    applications,
    filterStatus: status || '',
    search: search || '',
    notifications, unreadNotifCount
  });
};

// View single application
export const viewApplication = async (req, res) => {
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/guidance/applications');
  let purposes = [];
  try { purposes = JSON.parse(app.purposes); } catch {}
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/view-application', {
    title: `Application #${app.id} — UniGuide`,
    user: req.session.user,
    app, purposes,
    notifications, unreadNotifCount
  });
};

// Approve request
export const approveApplication = async (req, res) => {
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/guidance/applications');

  await app.update({ status: 'approved' });
  await createNotification(
    app.userId,
    `Your Good Moral Certificate request #${app.id} has been approved and is being prepared.`,
    'success',
    `/student/application/${app.id}`
  );

  req.flash('success', 'Request approved. Certificate is being prepared.');
  res.redirect(`/guidance/application/${app.id}`);
};

// Reject application
export const rejectApplication = async (req, res) => {
  const { remarks } = req.body;
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/guidance/applications');

  await app.update({ status: 'rejected', remarks });
  await createNotification(
    app.userId,
    `Your Good Moral Certificate request #${app.id} was rejected. Reason: ${remarks}`,
    'danger',
    `/student/application/${app.id}`
  );

  req.flash('success', 'Application rejected.');
  res.redirect('/guidance/applications');
};

// Release certificate
export const releaseCertificate = async (req, res) => {
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/guidance/applications');

  await app.update({
    status: 'released',
    releasedAt: new Date(),
    releasedBy: `${req.session.user.firstName} ${req.session.user.lastName}`,
    claimStatus: 'unclaimed'
  });
  await createNotification(
    app.userId,
    `🎓 Your Good Moral Certificate is ready for release at the Guidance Office! Please present your OR to claim it.`,
    'success',
    `/student/application/${app.id}`
  );

  req.flash('success', 'Certificate marked as released. Student has been notified.');
  res.redirect('/guidance/dashboard');
};

// Mark as claimed
export const markClaimed = async (req, res) => {
  const app = await Application.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!app) return res.redirect('/guidance/applications');
  
  await app.update({ claimStatus: 'claimed' });
  
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
  
  req.flash('success', 'Certificate marked as claimed. Student has been notified.');
  res.redirect(`/guidance/application/${app.id}`);
};

// Announcements
export const showAnnouncementForm = async (req, res) => {
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/new-announcement', {
    title: 'New Announcement — UniGuide',
    user: req.session.user,
    notifications, unreadNotifCount
  });
};

export const createAnnouncement = async (req, res) => {
  const { title, content, type, eventDate } = req.body;
  await Announcement.create({
    title, content, type,
    eventDate: eventDate || null,
    authorId: req.session.user.id
  });
  req.flash('success', 'Announcement posted.');
  res.redirect('/guidance/dashboard');
};

export const deleteAnnouncement = async (req, res) => {
  await Announcement.update({ isActive: false }, { where: { id: req.params.id } });
  req.flash('success', 'Announcement removed.');
  res.redirect('/guidance/Home');
};

// User management
export const manageUsers = async (req, res) => {
  const users = await User.findAll({ order: [['role', 'ASC'], ['createdAt', 'DESC']] });
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/users', {
    title: 'Manage Users — GuidanceConnect',
    user: req.session.user,
    users,
    notifications, unreadNotifCount
  });
};

export const createStaffAccount = async (req, res) => {
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
};

// Appointments management
export const manageAppointments = async (req, res) => {
  const appointments = await Appointment.findAll({
    include: [{ model: User, as: 'student' }],
    order: [['date', 'ASC'], ['timeSlot', 'ASC']]
  });
  
  // Also fetch time slots for the merged view
  const timeSlots = await TimeSlot.findAll({
    include: [{ model: User, as: 'counselor' }],
    order: [['date', 'ASC'], ['timeSlot', 'ASC']]
  });
  
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/appointments', {
    title: 'Appointments & Time Slots — UniGuide',
    user: req.session.user,
    appointments,
    timeSlots,
    notifications, unreadNotifCount
  });
};

export const updateAppointment = async (req, res) => {
  const { status, cancelReason } = req.body;
  const appt = await Appointment.findByPk(req.params.id);
  if (!appt) return res.redirect('/guidance/appointments');

  await appt.update({ status, cancelReason: cancelReason || null });

  const messages = {
    approved:  'Your appointment has been approved.',
    cancelled: `Your appointment was cancelled. Reason: ${cancelReason || 'N/A'}`,
    done:      'Your appointment has been marked as completed.'
  };
  if (messages[status]) {
    await createNotification(appt.userId, messages[status],
      status === 'cancelled' ? 'danger' : 'success', '/student/appointments');
  }

  req.flash('success', `Appointment ${status}.`);
  res.redirect('/guidance/appointments');
};

// Reschedule appointment
export const rescheduleAppointment = async (req, res) => {
  const { newDate, newTimeSlot } = req.body;
  const appt = await Appointment.findByPk(req.params.id, {
    include: [{ model: User, as: 'student' }]
  });
  if (!appt) return res.redirect('/guidance/appointments');

  const oldDate     = appt.date;
  const oldTimeSlot = appt.timeSlot;

  await appt.update({ date: newDate, timeSlot: newTimeSlot });
  await createNotification(
    appt.userId,
    `📅 Your appointment has been rescheduled by the Guidance Office.\n` +
    `Old schedule: ${oldDate} at ${oldTimeSlot}\n` +
    `New schedule: ${newDate} at ${newTimeSlot}`,
    'warning',
    '/student/appointments'
  );

  req.flash('success', `Appointment rescheduled to ${newDate} at ${newTimeSlot}. Student has been notified.`);
  res.redirect('/guidance/appointments');
};

// Notifications page
export const viewNotifications = async (req, res) => {
  const allNotifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });
  // Mark all as read
  await Notification.update(
    { isRead: true },
    { where: { userId: req.session.user.id, isRead: false } }
  );
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/notifications', {
    title: 'Notifications — UniGuide',
    user: req.session.user,
    allNotifications,
    notifications,
    unreadNotifCount
  });
};

export const markNotificationsRead = async (req, res) => {
  await Notification.update(
    { isRead: true },
    { where: { userId: req.session.user.id, isRead: false } }
  );
  res.json({ ok: true });
};

// Reports
export const reports = async (req, res) => {
  const { type = 'monthly', month, year } = req.query;
  const now = new Date();
  const selectedYear  = parseInt(year)  || now.getFullYear();
  const selectedMonth = parseInt(month) || (now.getMonth() + 1);

  let applications = [];

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

  const totalCollection = applications
    .filter(a => ['receipt_issued', 'approved', 'released'].includes(a.status))
    .reduce((s, a) => s + parseFloat(a.totalAmount || 0), 0);

  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/reports', {
    title: 'Reports — GuidanceConnect',
    user: req.session.user,
    applications, totalCollection,
    reportType: type, selectedYear, selectedMonth,
    notifications, unreadNotifCount
  });
};


// Student Profiling - List all students
export const studentProfiling = async (req, res) => {
  const { search, caseType, riskLevel } = req.query;
  const where = { role: 'student' };
  
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName:  { [Op.like]: `%${search}%` } },
      { studentId: { [Op.like]: `%${search}%` } },
      { course:    { [Op.like]: `%${search}%` } }
    ];
  }
  
  const students = await User.findAll({
    where,
    include: [{ 
      model: StudentProfile, 
      as: 'profile',
      where: caseType || riskLevel ? {
        ...(caseType ? { caseType } : {}),
        ...(riskLevel ? { riskLevel } : {})
      } : undefined,
      required: false
    }],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']]
  });
  
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/profiling', {
    title: 'Student Profiling — UniGuide',
    user: req.session.user,
    students,
    searchQuery: search || '',
    filterCase: caseType || '',
    filterRisk: riskLevel || '',
    notifications, unreadNotifCount
  });
};

// View single student profile
export const viewStudentProfile = async (req, res) => {
  const student = await User.findByPk(req.params.id, {
    include: [
      { model: StudentProfile, as: 'profile' },
      { model: Application, as: 'applications', limit: 5, order: [['createdAt', 'DESC']] }
    ]
  });
  
  if (!student || student.role !== 'student') {
    req.flash('error', 'Student not found.');
    return res.redirect('/guidance/profiling');
  }
  
  const sessions = await CounselingSession.findAll({
    where: { userId: student.id },
    include: [{ model: User, as: 'counselor', attributes: ['firstName', 'lastName'] }],
    order: [['sessionDate', 'DESC']]
  });
  
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/student-profile', {
    title: `${student.firstName} ${student.lastName} — Student Profile`,
    user: req.session.user,
    student,
    sessions,
    notifications, unreadNotifCount
  });
};

// Update student profile
export const updateStudentProfile = async (req, res) => {
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
};

// Add counseling session
export const addCounselingSession = async (req, res) => {
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
};

// ── Time Slot Management (Auto-scheduling) ──────────────────────

// View and manage available time slots
export const manageTimeSlots = async (req, res) => {
  const timeSlots = await TimeSlot.findAll({
    include: [{ model: User, as: 'counselor' }],
    order: [['date', 'ASC'], ['timeSlot', 'ASC']]
  });
  const { notifications, unreadNotifCount } = await getSidebarNotifs(req.session.user.id);
  res.render('guidance/time-slots', {
    title: 'Manage Time Slots — UniGuide',
    user: req.session.user,
    timeSlots,
    notifications, unreadNotifCount
  });
};

// Create new time slots
export const createTimeSlots = async (req, res) => {
  const { dates, timeSlots, maxSlots, notes, purpose } = req.body;
  
  try {
    // dates and timeSlots can be arrays or single values
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const slotArray = Array.isArray(timeSlots) ? timeSlots : [timeSlots];
    
    // Create a time slot for each date-time combination
    const created = [];
    for (const date of dateArray) {
      for (const time of slotArray) {
        // Check if slot already exists
        const existing = await TimeSlot.findOne({
          where: { date, timeSlot: time }
        });
        
        if (!existing) {
          const slot = await TimeSlot.create({
            counselorId: req.session.user.id,
            date,
            timeSlot: time,
            purpose: purpose || 'General',
            maxSlots: parseInt(maxSlots) || 1,
            bookedCount: 0,
            isAvailable: true,
            notes
          });
          created.push(slot);
        }
      }
    }
    
    // AUTO-ASSIGN matching pending appointments
    if (created.length > 0) {
      const slotPurpose = purpose || 'General';
      let assignedCount = 0;
      
      // Find pending appointments that match this purpose (no schedule yet)
      const pendingAppointments = await Appointment.findAll({
        where: { 
          status: 'pending',
          date: null, // Not yet assigned
          ...(slotPurpose !== 'General' && { purpose: slotPurpose })
        },
        include: [{ model: User, as: 'student' }],
        order: [['createdAt', 'ASC']] // First come, first served
      });
      
      // Auto-assign appointments to created slots
      for (const slot of created) {
        if (slot.bookedCount >= slot.maxSlots) continue; // Slot full
        
        // Get appointments that can fit in this slot
        const toAssign = pendingAppointments.slice(assignedCount, assignedCount + (slot.maxSlots - slot.bookedCount));
        
        for (const appt of toAssign) {
          // Assign the slot to this appointment
          await appt.update({
            timeSlotId: slot.id,
            date: slot.date,
            timeSlot: slot.timeSlot,
            status: 'approved' // Auto-approved since system assigned it
          });
          
          // Increment booked count
          await slot.update({ bookedCount: slot.bookedCount + 1 });
          
          // Notify student about their assigned schedule
          await createNotification(
            appt.userId,
            `✅ Your ${slotPurpose} appointment has been scheduled! Date: ${slot.date}, Time: ${slot.timeSlot}`,
            'success',
            '/student/appointments'
          );
          
          assignedCount++;
        }
      }
      
      req.flash('success', `Created ${created.length} time slot(s) for "${slotPurpose}". ${assignedCount} student(s) auto-assigned and notified.`);
    } else {
      req.flash('warning', 'No new time slots created (may already exist).');
    }
    
    res.redirect('/guidance/appointments');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create time slots.');
    res.redirect('/guidance/appointments');
  }
};

// Delete time slot
export const deleteTimeSlot = async (req, res) => {
  try {
    const slot = await TimeSlot.findByPk(req.params.id);
    if (!slot) {
      req.flash('error', 'Time slot not found.');
      return res.redirect('/guidance/time-slots');
    }
    
    // Check if any appointments are using this slot
    const hasAppointments = await Appointment.count({ where: { timeSlotId: slot.id } });
    if (hasAppointments > 0) {
      req.flash('error', 'Cannot delete time slot with existing appointments.');
      return res.redirect('/guidance/time-slots');
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
