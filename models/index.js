import { sequelize } from './db.js';
import { User } from './User.js';
import { Application } from './Application.js';
import { Announcement } from './Announcement.js';
import { Appointment } from './Appointment.js';
import { Notification } from './Notification.js';
import { StudentProfile } from './StudentProfile.js';
import { CounselingSession } from './CounselingSession.js';
import { TimeSlot } from './TimeSlot.js';

// Application ↔ User
User.hasMany(Application,   { foreignKey: 'userId',  as: 'applications',  onDelete: 'CASCADE' });
Application.belongsTo(User, { foreignKey: 'userId',  as: 'student' });

// Announcement ↔ User
User.hasMany(Announcement,    { foreignKey: 'authorId', as: 'announcements', onDelete: 'CASCADE' });
Announcement.belongsTo(User,  { foreignKey: 'authorId', as: 'author' });

// Appointment ↔ User
User.hasMany(Appointment,   { foreignKey: 'userId',  as: 'appointments',  onDelete: 'CASCADE' });
Appointment.belongsTo(User, { foreignKey: 'userId',  as: 'student' });

// Notification ↔ User
User.hasMany(Notification,   { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });

// StudentProfile ↔ User (one-to-one)
User.hasOne(StudentProfile,   { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
StudentProfile.belongsTo(User, { foreignKey: 'userId', as: 'student' });

// CounselingSession ↔ User (many-to-one for student)
User.hasMany(CounselingSession,   { foreignKey: 'userId', as: 'counselingSessions', onDelete: 'CASCADE' });
CounselingSession.belongsTo(User, { foreignKey: 'userId', as: 'student' });

// CounselingSession ↔ User (many-to-one for counselor)
User.hasMany(CounselingSession,    { foreignKey: 'counselorId', as: 'conductedSessions', onDelete: 'SET NULL' });
CounselingSession.belongsTo(User,  { foreignKey: 'counselorId', as: 'counselor' });

// TimeSlot ↔ User (many-to-one for counselor who creates slots)
User.hasMany(TimeSlot,    { foreignKey: 'counselorId', as: 'timeSlots', onDelete: 'CASCADE' });
TimeSlot.belongsTo(User,  { foreignKey: 'counselorId', as: 'counselor' });

// Appointment ↔ TimeSlot (many-to-one)
TimeSlot.hasMany(Appointment,   { foreignKey: 'timeSlotId', as: 'appointments', onDelete: 'SET NULL' });
Appointment.belongsTo(TimeSlot, { foreignKey: 'timeSlotId', as: 'assignedSlot' });

export const syncDB = async () => {
  try {
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Then sync models
    await sequelize.sync({ alter: { drop: false } });
    console.log('✅ Database synced successfully');
  } catch (err) {
    console.error('❌ Database error:', err.message);
    console.error('   Full error:', err);
    // Don't exit - let the app start anyway so we can debug
    // In production, you may want to fail here
  }
};

export { sequelize, User, Application, Announcement, Appointment, Notification, StudentProfile, CounselingSession, TimeSlot };
