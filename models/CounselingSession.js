import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const CounselingSession = sequelize.define(
  'CounselingSession',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // Student
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    // Guidance officer
    counselorId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    sessionDate: {
      type: DataTypes.DATE,
      allowNull: false
    },

    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    sessionType: {
      type: DataTypes.ENUM(
        'individual',
        'group',
        'crisis',
        'follow-up'
      ),
      allowNull: false,
      defaultValue: 'individual'
    },

    topic: {
      type: DataTypes.STRING,
      allowNull: true
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    actionPlan: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    followUpDate: {
      type: DataTypes.DATE,
      allowNull: true
    },

    status: {
      type: DataTypes.ENUM(
        'scheduled',
        'completed',
        'cancelled',
        'no-show'
      ),
      allowNull: false,
      defaultValue: 'completed'
    }
  },
  {
    tableName: 'counseling_sessions',
    timestamps: true
  }
);