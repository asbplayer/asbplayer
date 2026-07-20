export interface Notification<T> {
    id: number;
    value: T;
}

export const prependNotification = <T>(
    notifications: Notification<T>[],
    notification: Notification<T>
): Notification<T>[] => [notification, ...notifications];

export const removeNotification = <T>(notifications: Notification<T>[], id: number): Notification<T>[] =>
    notifications.filter((notification) => notification.id !== id);
