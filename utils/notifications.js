import { FirestoreAdapter } from '../models/firestore-adapter.js';

export const createNotification = async (userId, message, type = 'info', link = null) => {
  try {
    await FirestoreAdapter.createNotification({
      userId,
      type,
      title: type === 'success' ? '✅ ' : type === 'warning' ? '⚠️ ' : type === 'error' ? '❌ ' : 'ℹ️ ',
      message,
      link,
      isRead: false,
      createdAt: new Date().toISOString()
    });
    console.log(`📬 Notification created for user ${userId}: ${message.substring(0, 50)}...`);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export const notifyAllRole = async (role, message, type = 'info', link = null) => {
  try {
    // Get all users with the specified role
    const allUsers = await FirestoreAdapter.getAllUsers();
    const roleUsers = allUsers.filter(u => u.role === role);
    
    console.log(`📢 Notifying ${roleUsers.length} ${role} users: ${message.substring(0, 50)}...`);
    
    for (const user of roleUsers) {
      await createNotification(user.id, message, type, link);
    }
  } catch (err) {
    console.error('Failed to notify role:', err);
  }
};
