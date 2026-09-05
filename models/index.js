import { sequelize } from './db.js';

import { User } from './User.js';
import { Application } from './Application.js';
import { Announcement } from './Announcement.js';
import { Appointment } from './Appointment.js';
import { Notification } from './Notification.js';
import { StudentProfile } from './StudentProfile.js';
import { CounselingSession } from './CounselingSession.js';
import { TimeSlot } from './TimeSlot.js';

/*
==================================================
GUIDANCECONNECT MODEL RELATIONSHIPS
==================================================
*/

/*
==================================================
USER ↔ APPLICATION
==================================================
*/

User.hasMany(Application, {
  foreignKey: 'userId',
  as: 'applications',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Application.belongsTo(User, {
  foreignKey: 'userId',
  as: 'student'
});


/*
==================================================
USER ↔ ANNOUNCEMENT
==================================================
*/

User.hasMany(Announcement, {
  foreignKey: 'authorId',
  as: 'announcements',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Announcement.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});


/*
==================================================
USER ↔ APPOINTMENT
==================================================
*/

User.hasMany(Appointment, {
  foreignKey: 'userId',
  as: 'appointments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Appointment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'student'
});


/*
==================================================
USER ↔ NOTIFICATION
==================================================
*/

User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'recipient'
});


/*
==================================================
USER ↔ STUDENT PROFILE
==================================================
*/

User.hasOne(StudentProfile, {
  foreignKey: 'userId',
  as: 'profile',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

StudentProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'student'
});


/*
==================================================
USER ↔ COUNSELING SESSION
==================================================
*/

// Student
User.hasMany(CounselingSession, {
  foreignKey: 'userId',
  as: 'counselingSessions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

CounselingSession.belongsTo(User, {
  foreignKey: 'userId',
  as: 'student'
});


// Guidance counselor
User.hasMany(CounselingSession, {
  foreignKey: 'counselorId',
  as: 'conductedSessions',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

CounselingSession.belongsTo(User, {
  foreignKey: 'counselorId',
  as: 'counselor'
});


/*
==================================================
USER ↔ TIME SLOT
==================================================
*/

User.hasMany(TimeSlot, {
  foreignKey: 'counselorId',
  as: 'timeSlots',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

TimeSlot.belongsTo(User, {
  foreignKey: 'counselorId',
  as: 'counselor'
});


/*
==================================================
TIME SLOT ↔ APPOINTMENT
==================================================
*/

TimeSlot.hasMany(Appointment, {
  foreignKey: 'timeSlotId',
  as: 'appointments',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Appointment.belongsTo(TimeSlot, {
  foreignKey: 'timeSlotId',
  as: 'assignedSlot'
});


/*
==================================================
DATABASE SYNC
==================================================
*/

export const syncDB = async () => {
  try {
    console.log('🔄 Attempting database connection...');

    await sequelize.authenticate();

    console.log('✅ Database connection successful');

    console.log('🔄 Syncing GuidanceConnect database models...');

    /*
     * IMPORTANT:
     * Do NOT use alter:true while migrating the old
     * farmer database schema.
     */

    await sequelize.sync();

    console.log('✅ GuidanceConnect database synced successfully');

    return true;

  } catch (err) {
    console.error('❌ Database Error Details:');

    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Errno:', err.errno);

    if (err.sql) {
      console.error('SQL:', err.sql);
    }

    if (err.message.includes('ECONNREFUSED')) {
      console.error(
        '→ Cannot connect to database host. Check DATABASE_URL and network.'
      );

    } else if (err.message.includes('ENOTFOUND')) {
      console.error(
        '→ Cannot resolve database hostname. Check DATABASE_URL.'
      );

    } else if (err.message.includes('Access denied')) {
      console.error(
        '→ Authentication failed. Check database credentials.'
      );
    }

    return false;
  }
};


export {
  sequelize,
  User,
  Application,
  Announcement,
  Appointment,
  Notification,
  StudentProfile,
  CounselingSession,
  TimeSlot
};