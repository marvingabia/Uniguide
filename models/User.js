import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const User = sequelize.define('User', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firstName:   { type: DataTypes.STRING, allowNull: false },
  lastName:    { type: DataTypes.STRING, allowNull: false },
  email:       { type: DataTypes.STRING, allowNull: false, unique: true },
  password:    { type: DataTypes.STRING, allowNull: true },   // null for Google-only accounts
  googleId:    { type: DataTypes.STRING, allowNull: true, unique: true },
  avatar:      { type: DataTypes.STRING, allowNull: true },   // Google profile picture
  authMethod:  { type: DataTypes.ENUM('local', 'google'), defaultValue: 'local' },
  role:        { type: DataTypes.ENUM('student', 'cashier', 'guidance'), defaultValue: 'student' },
  
  // Student Info
  studentId:   { type: DataTypes.STRING, allowNull: true },
  course:      { type: DataTypes.STRING, allowNull: true },
  yearLevel:   { type: DataTypes.STRING, allowNull: true },
  section:     { type: DataTypes.STRING, allowNull: true },
  contactNo:   { type: DataTypes.STRING, allowNull: true },
  
  // Additional Profile Info
  birthdate:        { type: DataTypes.DATEONLY, allowNull: true },
  address:          { type: DataTypes.TEXT, allowNull: true },
  emergencyContact: { type: DataTypes.STRING, allowNull: true },
  guardianName:     { type: DataTypes.STRING, allowNull: true },
  guardianContact:  { type: DataTypes.STRING, allowNull: true },
  previousSchool:   { type: DataTypes.STRING, allowNull: true },
  scholarshipInfo:  { type: DataTypes.STRING, allowNull: true },
  
  profileImage: { type: DataTypes.STRING, allowNull: true },  // uploaded profile photo
  bio:          { type: DataTypes.TEXT,   allowNull: true },   // short bio / notes
  isApproved:   { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'users', timestamps: true });
