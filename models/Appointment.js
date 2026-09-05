import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Appointment = sequelize.define(
  'Appointment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    timeSlotId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    purpose: {
      type: DataTypes.STRING,
      allowNull: false
    },

    date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    timeSlot: {
      type: DataTypes.STRING,
      allowNull: true
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    status: {
      type: DataTypes.ENUM(
        'pending',
        'approved',
        'cancelled',
        'done'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },

    cancelReason: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    tableName: 'appointments',
    timestamps: true
  }
);