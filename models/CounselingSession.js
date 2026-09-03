import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const CounselingSession = sequelize.define('CounselingSession', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:        { type: DataTypes.INTEGER, allowNull: false }, // student
  counselorId:   { type: DataTypes.INTEGER, allowNull: true }, // guidance officer
  
  sessionDate:   { type: DataTypes.DATE, allowNull: false },
  duration:      { type: DataTypes.INTEGER, allowNull: true }, // in minutes
  sessionType:   { type: DataTypes.ENUM('individual', 'group', 'crisis', 'follow-up'), defaultValue: 'individual' },
  topic:         { type: DataTypes.STRING, allowNull: true },
  notes:         { type: DataTypes.TEXT, allowNull: true },
  actionPlan:    { type: DataTypes.TEXT, allowNull: true },
  followUpDate:  { type: DataTypes.DATE, allowNull: true },
  status:        { type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'no-show'), defaultValue: 'completed' }
}, { 
  tableName: 'counseling_sessions', 
  timestamps: true 
});
