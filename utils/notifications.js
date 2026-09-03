import { Notification } from '../models/index.js';

export const createNotification = async (userId, message, type = 'info', link = null) => {
  try {
    await Notification.create({ userId, message, type, link });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export const notifyAllRole = async (role, message, type = 'info', link = null) => {
  try {
    const { User } = await import('../models/index.js');
    const users = await User.findAll({ where: { role } });
    for (const user of users) {
      await createNotification(user.id, message, type, link);
    }
  } catch (err) {
    console.error('Failed to notify role:', err);
  }
};
