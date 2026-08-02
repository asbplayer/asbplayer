import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles } from '@mui/styles';
import MuiAlert, { type AlertColor } from '@mui/material/Alert';
import Grow from '@mui/material/Grow';
import { prepend, remove, update, type Stack } from './notification-stack';
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
    severity: AlertColor | undefined;
    disableAutoHide?: boolean;
    anchor?: 'top' | 'bottom';
    children: React.ReactNode;
}

interface AlertNotification {
    children: React.ReactNode;
    severity: AlertColor | undefined;
    disableAutoHide: boolean;
    open: boolean;
}

function toAlertNotification(
    children: React.ReactNode,
    severity: AlertColor | undefined,
    disableAutoHide: boolean | undefined
): AlertNotification {
    return {
        children,
        severity,
        disableAutoHide: disableAutoHide ?? false,
        open: true,
    };
}

interface AlertItemProps extends AlertNotification {
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

export default function Alert(props: Props) {
    const initialNotification = props.open
        ? toAlertNotification(props.children, props.severity, props.disableAutoHide)
        : undefined;
    const [notifications, setNotifications] = useState<Stack<AlertNotification>[]>(() =>
        initialNotification === undefined ? [] : [{ id: 0, value: initialNotification }]
    );
    const nextNotificationIdRef = useRef(initialNotification === undefined ? 0 : 1);
    const previousPropsRef = useRef<AlertNotification | undefined>(initialNotification);
    const hadNotificationsRef = useRef(props.open);
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

        const currentProps = toAlertNotification(props.children, props.severity, props.disableAutoHide);
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
            setNotifications((current) => prepend(current, notification));
        }
        previousPropsRef.current = currentProps;
    }, [props.open, props.children, props.severity, props.disableAutoHide]);

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
