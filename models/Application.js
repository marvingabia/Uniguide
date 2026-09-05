import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Application = sequelize.define(
  'Application',
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

    // Student Information

    surname: {
      type: DataTypes.STRING,
      allowNull: false
    },

    givenName: {
      type: DataTypes.STRING,
      allowNull: false
    },

    middleName: {
      type: DataTypes.STRING,
      allowNull: true
    },

    gender: {
      type: DataTypes.ENUM('Male', 'Female', 'Other'),
      allowNull: false
    },

    contactNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },

    course: {
      type: DataTypes.STRING,
      allowNull: false
    },

    major: {
      type: DataTypes.STRING,
      allowNull: true
    },

    yearLevel: {
      type: DataTypes.STRING,
      allowNull: true
    },

    section: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Enrollment Status

    enrollmentStatus: {
      type: DataTypes.ENUM(
        'currently_enrolled',
        'was_enrolled',
        'graduated'
      ),
      allowNull: false
    },

    academicYear: {
      type: DataTypes.STRING,
      allowNull: true
    },

    semester: {
      type: DataTypes.ENUM('1st', '2nd'),
      allowNull: true
    },

    monthYearGraduated: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Purpose

    purposes: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    otherPurpose: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Fee Items

    qtyGoodMoral: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },

    qtyCTC: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },

    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0
    },

    // Payment Information

    paymentMethod: {
      type: DataTypes.ENUM('GCash', 'LandBank', 'Cash'),
      allowNull: true
    },

    paymentScreenshot: {
      type: DataTypes.STRING,
      allowNull: true
    },

    referenceNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },

    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    // Receipt

    orNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },

    receiptFile: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Release

    releasedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    releasedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },

    claimStatus: {
      type: DataTypes.ENUM('unclaimed', 'claimed'),
      allowNull: false,
      defaultValue: 'unclaimed'
    },

    // Application Status

    status: {
      type: DataTypes.ENUM(
        'pending',
        'payment_submitted',
        'payment_verified',
        'receipt_issued',
        'approved',
        'released',
        'rejected'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'applications',
    timestamps: true
  }
);