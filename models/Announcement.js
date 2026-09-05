import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Announcement = sequelize.define(
  'Announcement',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    type: {
      type: DataTypes.ENUM('announcement', 'event'),
      allowNull: false,
      defaultValue: 'announcement'
    },

    eventDate: {
      type: DataTypes.DATE,
      allowNull: true
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: 'announcements',
    timestamps: true
  }
);