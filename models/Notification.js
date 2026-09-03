import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Notification = sequelize.define('Notification', {
  id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:  { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type:    { type: DataTypes.STRING, defaultValue: 'info' }, // info | success | warning | danger
  isRead:  { type: DataTypes.BOOLEAN, defaultValue: false },
  link:    { type: DataTypes.STRING, allowNull: true }
}, { tableName: 'notifications', timestamps: true });
