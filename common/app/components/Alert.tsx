import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles } from '@mui/styles';
import MuiAlert, { type AlertColor } from '@mui/material/Alert';
import Grow from '@mui/material/Grow';
import { remove, update, type Stack } from './notification-stack';
import LogoIcon from '../../components/LogoIcon';

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
    autoHideDuration: number;
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

export interface AlertNotification {
    message: React.ReactNode;
    severity: AlertColor | undefined;
}

interface AlertNotificationValue {
    children: React.ReactNode;
    severity: AlertColor | undefined;
    disableAutoHide: boolean;
    open: boolean;
}

function toAlertNotification(
    notification: AlertNotification,
    disableAutoHide: boolean | undefined
): AlertNotificationValue {
    return {
        children: notification.message,
        severity: notification.severity,
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
    }, [id, open, autoHideDuration, disableAutoHide, onClose]);

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
                Object.is(notification.message, second[index].message) &&
                notification.severity === second[index].severity
        )
    );
}

export default function Alert(props: Props) {
    const initialRequestedNotifications = props.open
        ? (props.notifications ?? [{ message: props.children, severity: props.severity }])
        : [];
    const initialNotifications = initialRequestedNotifications.map((notification, index) => ({
        id: index,
        value: toAlertNotification(notification, props.disableAutoHide),
    }));
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
            setNotifications([]);
            return;
        }

        const currentNotifications = props.notifications ?? [{ message: props.children, severity: props.severity }];
        const previousNotifications = previousPropsRef.current;
        const changed =
            previousNotifications === undefined ||
            !alertNotificationsEqual(previousNotifications, currentNotifications) ||
            (notifications.length > 0 && notifications[0].value.disableAutoHide !== (props.disableAutoHide ?? false));

        if (changed && currentNotifications.length > 0) {
            hadNotificationsRef.current = true;
            const newNotifications = currentNotifications.map((notification) => ({
                id: nextNotificationIdRef.current++,
                value: toAlertNotification(notification, props.disableAutoHide),
            }));
            setNotifications((current) => [...newNotifications, ...current]);
        }
        previousPropsRef.current = currentNotifications;
    }, [props.open, props.notifications, props.children, props.severity, props.disableAutoHide, notifications]);

    return (
        <AlertStack anchor={props.anchor}>
            {notifications.map((notification) => (
                <AlertItem
                    key={notification.id}
                    id={notification.id}
                    autoHideDuration={props.autoHideDuration}
                    useAppLogo={props.useAppLogo}
                    onClose={closeNotification}
                    onExitedAnimation={removeNotification}
                    onMouseEnter={props.onMouseEnter}
                    onMouseLeave={props.onMouseLeave}
                    {...notification.value}
                    open={notification.value.open && props.open}
                />
            ))}
        </AlertStack>
    );
}
