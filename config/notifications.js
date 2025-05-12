let notifications = [];

const addNotification = (type, data) => {
    notifications.push({ type, data, timestamp: new Date() });
};

const getNotifications = () => {
    return notifications;
};

const clearNotifications = () => {
    notifications = [];
};

module.exports = { addNotification, getNotifications, clearNotifications };