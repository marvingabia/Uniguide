import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const TimeSlot = sequelize.define('TimeSlot', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  counselorId:  { type: DataTypes.INTEGER, allowNull: false }, // guidance staff who created the slot
  date:         { type: DataTypes.DATEONLY, allowNull: false },
  timeSlot:     { type: DataTypes.STRING, allowNull: false }, // e.g., "9:00 AM - 10:00 AM"
  purpose:      { type: DataTypes.STRING, defaultValue: 'General' }, // e.g., "Counseling", "Good Moral Pickup", "General"
  maxSlots:     { type: DataTypes.INTEGER, defaultValue: 1 }, // how many students can book this slot
  bookedCount:  { type: DataTypes.INTEGER, defaultValue: 0 }, // how many have booked
  isAvailable:  { type: DataTypes.BOOLEAN, defaultValue: true },
  notes:        { type: DataTypes.TEXT, allowNull: true }
}, { 
  tableName: 'time_slots', 
  timestamps: true,
  indexes: [
    { fields: ['date', 'timeSlot'] }
  ]
});
