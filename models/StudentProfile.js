import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const StudentProfile = sequelize.define('StudentProfile', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:         { type: DataTypes.INTEGER, allowNull: false }, // ref to User
  
  // Personal Information
  birthdate:      { type: DataTypes.DATEONLY, allowNull: true },
  address:        { type: DataTypes.TEXT, allowNull: true },
  guardianName:   { type: DataTypes.STRING, allowNull: true },
  guardianContact: { type: DataTypes.STRING, allowNull: true },
  emergencyContact: { type: DataTypes.STRING, allowNull: true },
  
  // Academic Background
  previousSchool: { type: DataTypes.STRING, allowNull: true },
  scholarshipInfo: { type: DataTypes.TEXT, allowNull: true },
  
  // Behavioral & Case Notes
  behavioralNotes: { type: DataTypes.TEXT, allowNull: true },
  caseType:        { type: DataTypes.ENUM('none', 'academic', 'behavioral', 'personal', 'family', 'health', 'other'), defaultValue: 'none' },
  riskLevel:       { type: DataTypes.ENUM('low', 'moderate', 'high'), defaultValue: 'low' },
  
  // Counseling Summary
  totalSessions:   { type: DataTypes.INTEGER, defaultValue: 0 },
  lastSessionDate: { type: DataTypes.DATE, allowNull: true },
  lastSessionNotes: { type: DataTypes.TEXT, allowNull: true },
  
  // Status
  isActive:        { type: DataTypes.BOOLEAN, defaultValue: true },
  remarks:         { type: DataTypes.TEXT, allowNull: true }
}, { 
  tableName: 'student_profiles', 
  timestamps: true 
});
