import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles } from '@mui/styles';
import MuiAlert, { type AlertColor } from '@mui/material/Alert';
import Grow from '@mui/material/Grow';
import { prependNotification, removeNotification, type Notification } from './notification-stack';

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
    onClose: () => void;
    severity: AlertColor | undefined;
    disableAutoHide?: boolean;
    anchor?: 'top' | 'bottom';
    children: React.ReactNode;
}

interface AlertNotification {
    children: React.ReactNode;
    severity: AlertColor | undefined;
    disableAutoHide: boolean;
}

interface AlertItemProps extends AlertNotification {
    id: number;
    open: boolean;
    autoHideDuration: number;
    onClose: (id: number) => void;
}

function AlertItem({ id, open, autoHideDuration, onClose, children, severity, disableAutoHide }: AlertItemProps) {
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
            <Grow in={open}>
                <MuiAlert severity={severity}>{children}</MuiAlert>
            </Grow>
        </div>
    );
}

export default function Alert(props: Props) {
    const [notifications, setNotifications] = useState<Notification<AlertNotification>[]>(() =>
        props.open
            ? [
                  {
                      id: 0,
                      value: {
                          children: props.children,
                          severity: props.severity,
                          disableAutoHide: props.disableAutoHide ?? false,
                      },
                  },
              ]
            : []
    );
    const nextNotificationIdRef = useRef(props.open ? 1 : 0);
    const previousPropsRef = useRef<
        { children: React.ReactNode; severity: AlertColor | undefined; disableAutoHide: boolean } | undefined
    >(
        props.open
            ? {
                  children: props.children,
                  severity: props.severity,
                  disableAutoHide: props.disableAutoHide ?? false,
              }
            : undefined
    );
    const hadNotificationsRef = useRef(props.open);
    const onCloseRef = useRef(props.onClose);
    onCloseRef.current = props.onClose;

    const closeNotification = useCallback((id: number) => {
        setNotifications((current) => removeNotification(current, id));
    }, []);

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

        const currentProps = {
            children: props.children,
            severity: props.severity,
            disableAutoHide: props.disableAutoHide ?? false,
        };
        const previousProps = previousPropsRef.current;
        const changed =
            previousProps === undefined ||
            !Object.is(previousProps.children, currentProps.children) ||
            previousProps.severity !== currentProps.severity ||
            previousProps.disableAutoHide !== currentProps.disableAutoHide;

        if (changed) {
            hadNotificationsRef.current = true;
            const notification = {
                id: nextNotificationIdRef.current++,
                value: currentProps,
            };
            setNotifications((current) => prependNotification(current, notification));
        }
        previousPropsRef.current = currentProps;
    }, [props.open, props.children, props.severity, props.disableAutoHide]);

    return (
        <AlertStack anchor={props.anchor}>
            {notifications.map((notification) => (
                <AlertItem
                    key={notification.id}
                    id={notification.id}
                    open={props.open}
                    autoHideDuration={props.autoHideDuration}
                    onClose={closeNotification}
                    {...notification.value}
                />
            ))}
        </AlertStack>
    );
}
