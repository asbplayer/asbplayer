import type { ButtonBaseActions } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import React, { ForwardedRef, useCallback, useEffect, useRef, useState } from 'react';

interface Props extends ButtonProps {
    focusVisible: boolean;
    onBlurVisible: () => void;
    component?: (props: ButtonProps) => React.ReactNode;
}

export default React.forwardRef(function AnkiDialogButton(
    { children, focusVisible, onBlurVisible, component: Component, ...rest }: Props,
    ref: ForwardedRef<HTMLButtonElement>
) {
    const actionRef = useRef<ButtonBaseActions | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [rendered, setRendered] = useState<boolean>(false);

    const focusOnButton = useCallback(() => {
        actionRef.current?.focusVisible();
    }, []);

    useEffect(() => {
        if (focusVisible && rendered) {
            focusOnButton();
        }
    }, [focusVisible, focusOnButton, rendered]);

    const refCallback = useCallback(
        (element: HTMLButtonElement | null) => {
            if (ref) {
                if (typeof ref === 'function') {
                    ref(element);
                } else {
                    ref.current = element;
                }

                buttonRef.current = element;
            }

            setRendered(element !== null);
        },
        [ref]
    );

    const handleBlur = useCallback(() => onBlurVisible(), [onBlurVisible]);

    if (Component !== undefined) {
        return <Component ref={refCallback} onBlur={handleBlur} action={actionRef} {...rest} />;
    }

    return (
        <Button ref={refCallback} onBlur={handleBlur} action={actionRef} {...rest}>
            {children}
        </Button>
    );
});
