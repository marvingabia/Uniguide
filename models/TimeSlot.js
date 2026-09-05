import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const TimeSlot = sequelize.define(
  'TimeSlot',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // Guidance officer who created the slot
    counselorId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    timeSlot: {
      type: DataTypes.STRING,
      allowNull: false
    },

    purpose: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'General'
    },

    maxSlots: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },

    bookedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'time_slots',
    timestamps: true,

    indexes: [
      {
        fields: ['date', 'timeSlot']
      }
    ]
  }
);