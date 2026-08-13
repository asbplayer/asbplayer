import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles } from '@mui/styles';
import MuiAlert, { type AlertColor } from '@mui/material/Alert';
import Grow from '@mui/material/Grow';
import { remove, update, type Stack } from '@project/common/app/components/notification-stack';
import LogoIcon from '@project/common/components/LogoIcon';
import { useTranslation } from 'react-i18next';
import { type TFunction } from 'i18next';

const defaultAutoHideDuration = 3000;

const useAlertStyles = makeStyles(() => ({
    root: {
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        pointerEvents: 'none',
        zIndex: 2000,
    },
    stack: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        position: 'fixed',
        width: '100%',
        pointerEvents: 'none',
        zIndex: 2000,
    },
    bottom: {
        bottom: '10vh',
    },
    top: {
        top: '10vh',
    },
}));

interface AlertStackProps {
    anchor?: 'top' | 'bottom';
    children: React.ReactNode;
}

export function AlertStack({ anchor, children }: AlertStackProps) {
    const classes = useAlertStyles();
    const anchorClass = anchor === 'bottom' ? classes.bottom : classes.top;
    return <div className={`${classes.stack} ${anchorClass}`}>{children}</div>;
}

interface Props {
    open: boolean;
    autoHideDuration?: number;
    useAppLogo: boolean;
    onClose: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    severity?: AlertColor | undefined;
    disableAutoHide?: boolean;
    anchor?: 'top' | 'bottom';
    children?: React.ReactNode;
    notifications?: readonly AlertNotification[];
}

interface LocalizableMessage {
    locKey: string;
    replacements: { [key: string]: any };
}

type LazyLocalizableMessage = (t: TFunction) => React.ReactNode;

type Message = React.ReactNode | LocalizableMessage | LazyLocalizableMessage;

export interface AlertNotification {
    key?: string;
    message: Message;
    severity: AlertColor | undefined;
    autoHideDuration?: number;
}

interface AlertNotificationValue {
    notificationKey?: string;
    autoHideResetKey: number;
    children: React.ReactNode;
    severity: AlertColor | undefined;
    autoHideDuration?: number;
    disableAutoHide: boolean;
    open: boolean;
}

const messageToReactNode = (children: Message, t: TFunction): React.ReactNode => {
    if (typeof children === 'object' && children !== null && 'locKey' in children) {
        return t(children.locKey, children.replacements);
    }
    if (typeof children === 'function') {
        return children(t);
    }
    return children;
};

function toAlertNotification(
    notification: AlertNotification,
    disableAutoHide: boolean | undefined,
    autoHideResetKey: number,
    t: TFunction
): AlertNotificationValue {
    return {
        notificationKey: notification.key,
        autoHideResetKey,
        children: messageToReactNode(notification.message, t),
        severity: notification.severity,
        autoHideDuration: notification.autoHideDuration,
        disableAutoHide: disableAutoHide ?? false,
        open: true,
    };
}

interface AlertItemProps extends AlertNotificationValue {
    id: number;
    open: boolean;
    autoHideDuration: number;
    useAppLogo: boolean;
    onClose: (id: number) => void;
    onExitedAnimation: (id: number) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

function AlertItem({
    id,
    open,
    autoHideDuration,
    useAppLogo,
    autoHideResetKey,
    onClose,
    onExitedAnimation,
    onMouseEnter,
    onMouseLeave,
    children,
    severity,
    disableAutoHide,
}: AlertItemProps) {
    const classes = useAlertStyles();

    useEffect(() => {
        if (!open || disableAutoHide) {
            return;
        }

        const timeout = setTimeout(() => onClose(id), autoHideDuration);
        return () => clearTimeout(timeout);
    }, [id, autoHideResetKey, open, autoHideDuration, disableAutoHide, onClose]);

    return (
        <div className={classes.root}>
            <Grow in={open} onExited={() => onExitedAnimation(id)}>
                <MuiAlert
                    severity={severity}
                    icon={useAppLogo ? <LogoIcon fontSize="small" /> : undefined}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    style={{ pointerEvents: 'auto' }}
                >
                    {children}
                </MuiAlert>
            </Grow>
        </div>
    );
}

function alertNotificationsEqual(first: readonly AlertNotification[], second: readonly AlertNotification[]): boolean {
    return (
        first.length === second.length &&
        first.every(
            (notification, index) =>
                notification.key === second[index].key &&
                Object.is(notification.message, second[index].message) &&
                notification.severity === second[index].severity &&
                notification.autoHideDuration === second[index].autoHideDuration
        )
    );
}

/** Keeps unkeyed notifications and retains only the latest occurrence of each keyed notification. */
function deduplicateAlertNotifications(notifications: readonly AlertNotification[]): AlertNotification[] {
    const deduplicated: AlertNotification[] = [];
    const indexesByKey = new Map<string, number>();

    for (const notification of notifications) {
        if (notification.key === undefined) {
            deduplicated.push(notification);
            continue;
        }

        const existingIndex = indexesByKey.get(notification.key);
        if (existingIndex === undefined) {
            indexesByKey.set(notification.key, deduplicated.length);
            deduplicated.push(notification);
        } else {
            deduplicated[existingIndex] = notification;
        }
    }

    return deduplicated;
}

/**
 * Adds new notifications while removing older entries with matching keys. A keyed notification that remains at the
 * same position updates that stack entry in place so its position and exit animation are preserved.
 */
function updateAlertNotificationStack(
    current: readonly Stack<AlertNotificationValue>[],
    newNotifications: readonly Stack<AlertNotificationValue>[]
): Stack<AlertNotificationValue>[] {
    const keys = new Set(
        newNotifications
            .map((notification) => notification.value.notificationKey)
            .filter((key): key is string => key !== undefined)
    );
    const updatedNotificationIds = new Set<number>();
    const notificationsToAdd = newNotifications.map((notification, index) => {
        const currentNotification = current[index];
        const notificationKey = notification.value.notificationKey;
        if (
            currentNotification !== undefined &&
            notificationKey !== undefined &&
            currentNotification.value.notificationKey === notificationKey
        ) {
            updatedNotificationIds.add(currentNotification.id);
            return { id: currentNotification.id, value: notification.value };
        }
        return notification;
    });

    return [
        ...notificationsToAdd,
        ...current.filter(
            (notification) =>
                !updatedNotificationIds.has(notification.id) &&
                (notification.value.notificationKey === undefined || !keys.has(notification.value.notificationKey))
        ),
    ];
}

export default function Alert(props: Props) {
    const defaultDuration = props.autoHideDuration ?? defaultAutoHideDuration;
    const initialRequestedNotifications = props.open
        ? deduplicateAlertNotifications(props.notifications ?? [{ message: props.children, severity: props.severity }])
        : [];
    const { t } = useTranslation();
    const initialNotifications = initialRequestedNotifications
        .map((notification, index) => ({
            id: index,
            value: toAlertNotification(notification, props.disableAutoHide, index, t),
        }))
        .filter((notif) => !!notif.value.children);
    const [notifications, setNotifications] = useState<Stack<AlertNotificationValue>[]>(initialNotifications);
    const nextNotificationIdRef = useRef(initialNotifications.length);
    const previousPropsRef = useRef<readonly AlertNotification[] | undefined>(
        props.open ? initialRequestedNotifications : undefined
    );
    const hadNotificationsRef = useRef(initialNotifications.length > 0);
    const onCloseRef = useRef(props.onClose);
    onCloseRef.current = props.onClose;

    const closeNotification = useCallback((id: number) => {
        setNotifications((current) => update(current, id, (item) => ({ ...item, open: false })));
    }, []);

    const removeNotification = useCallback((id: number) => setNotifications((current) => remove(current, id)), []);

    useEffect(() => {
        if (props.open && notifications.length === 0 && hadNotificationsRef.current) {
            onCloseRef.current();
        }
    }, [notifications.length, props.open]);

    useEffect(() => {
        if (!props.open) {
            previousPropsRef.current = undefined;
            hadNotificationsRef.current = false;
            if (notifications.length) setNotifications([]);
            return;
        }

        const currentNotifications = deduplicateAlertNotifications(
            props.notifications ?? [{ message: props.children, severity: props.severity }]
        );
        const previousNotifications = previousPropsRef.current;
        const changed =
            previousNotifications === undefined ||
            !alertNotificationsEqual(previousNotifications, currentNotifications) ||
            (notifications.length > 0 && notifications[0].value.disableAutoHide !== (props.disableAutoHide ?? false));

        if (changed && currentNotifications.length > 0) {
            hadNotificationsRef.current = true;
            const newNotifications = currentNotifications
                .map((notification) => {
                    const id = nextNotificationIdRef.current++;
                    return { id, value: toAlertNotification(notification, props.disableAutoHide, id, t) };
                })
                .filter((notif) => !!notif.value.children);
            setNotifications((current) => updateAlertNotificationStack(current, newNotifications));
        }
        previousPropsRef.current = currentNotifications;
    }, [props.open, props.notifications, props.children, props.severity, props.disableAutoHide, notifications, t]);

    return (
        <AlertStack anchor={props.anchor}>
            {notifications.map((notification) => (
                <AlertItem
                    {...notification.value}
                    key={notification.id}
                    id={notification.id}
                    autoHideDuration={notification.value.autoHideDuration ?? defaultDuration}
                    useAppLogo={props.useAppLogo}
                    onClose={closeNotification}
                    onExitedAnimation={removeNotification}
                    onMouseEnter={props.onMouseEnter}
                    onMouseLeave={props.onMouseLeave}
                    open={notification.value.open && props.open}
                />
            ))}
        </AlertStack>
    );
}
