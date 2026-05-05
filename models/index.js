/*
    MIT License
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
*/

import { sequelize } from "./db.js";
import { User } from "./userModel.js";
import { UserProgress } from "./Userprogressmodel.js";
import { GameSession } from "./Gamesessionmodel.js";
import { JournalEntry } from "./Journalentrymodel.js";
import { Activity } from "./Activitymodel.js";
import Certificate from "./Certificatemodel.js";
import ReadingMaterialModel from "./ReadingMaterialModel.js";
import SavedMaterialModel from "./SavedMaterialModel.js";
import { ReadingSession } from "./ReadingSessionModel.js";
import { Message } from "./MessageModel.js";
import { FitnessVideo } from "./FitnessVideoModel.js";

// Initialize ReadingMaterial model
const ReadingMaterial = ReadingMaterialModel(sequelize);
const SavedMaterial = SavedMaterialModel(sequelize);

// Setup relationships
User.hasOne(UserProgress, { foreignKey: 'userId', as: 'progress', onDelete: 'CASCADE' });
UserProgress.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(GameSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
GameSession.belongsTo(User, { foreignKey: 'userId' });


User.hasMany(JournalEntry, { foreignKey: 'userId', onDelete: 'CASCADE' });
JournalEntry.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Activity, { foreignKey: 'userId', onDelete: 'CASCADE' });
Activity.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Certificate, { foreignKey: 'userId', onDelete: 'CASCADE' });
Certificate.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ReadingMaterial, { foreignKey: 'counselorId', onDelete: 'CASCADE' });
ReadingMaterial.belongsTo(User, { foreignKey: 'counselorId', as: 'counselor' });

User.hasMany(SavedMaterial, { foreignKey: 'userId', onDelete: 'CASCADE' });
SavedMaterial.belongsTo(User, { foreignKey: 'userId' });

ReadingMaterial.hasMany(SavedMaterial, { foreignKey: 'materialId', onDelete: 'CASCADE' });
SavedMaterial.belongsTo(ReadingMaterial, { foreignKey: 'materialId', as: 'material' });

User.hasMany(ReadingSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
ReadingSession.belongsTo(User, { foreignKey: 'userId' });

ReadingMaterial.hasMany(ReadingSession, { foreignKey: 'materialId', onDelete: 'CASCADE' });
ReadingSession.belongsTo(ReadingMaterial, { foreignKey: 'materialId', as: 'material' });

// Message relationships
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

// FitnessVideo relationships
User.hasMany(FitnessVideo, { foreignKey: 'counselorId', as: 'fitnessVideos', onDelete: 'CASCADE' });
FitnessVideo.belongsTo(User, { foreignKey: 'counselorId', as: 'counselor' });

// Sync models
export const syncModels = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log("✅ Database synced successfully");
  } catch (error) {
    console.error("❌ Error syncing database:", error);
  }
};

export { sequelize, User, UserProgress, GameSession, JournalEntry, Activity, Certificate, ReadingMaterial, SavedMaterial, ReadingSession, Message, FitnessVideo };
