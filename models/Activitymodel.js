import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { User } from "./userModel.js";

export const Activity = sequelize.define("Activity", {
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  type: { 
    type: DataTypes.ENUM('game', 'quiz', 'journal', 'login', 'registration', 'achievement', 'admin_action', 'fitness', 'reading'),
    allowNull: false 
  },
  subType: { type: DataTypes.STRING }, // Specific game/quiz name or video title
  description: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSON } // Store score, points, video ID, etc.
});

Activity.belongsTo(User, { foreignKey: 'userId' });
export { sequelize };
