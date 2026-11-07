import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import Chrome from '@uiw/react-color-chrome';
import { hexToHsva, hsvaToHex, hsvaToHexa } from '@uiw/color-convert';
import type { HsvaColor } from '@uiw/color-convert';

interface Props {
    value: string;
    showAlpha?: boolean;
    onChange: (hex: string) => void;
    label?: ReactNode;
    disabled?: boolean;
    fullWidth?: boolean;
    sx?: SxProps<Theme>;
    textFieldProps?: TextFieldProps;
}

const hexPattern = /^#?[0-9a-fA-F]{6}$/;
const hexWithAlphaPattern = /^#?[0-9a-fA-F]{8}$/;
const changeThrottleMs = 300;

const ColorPickerField: React.FC<Props> = ({
    value,
    showAlpha,
    onChange,
    label,
    disabled,
    fullWidth,
    sx,
    textFieldProps,
}) => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [hsva, setHsva] = useState<HsvaColor>(() => hexToHsva(value));
    const [hexText, setHexText] = useState(value.toUpperCase());

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const lastEmitTimeRef = useRef(0);
    const pendingRef = useRef<string | undefined>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const flush = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;

        if (pendingRef.current !== undefined) {
            const hex = pendingRef.current;
            pendingRef.current = undefined;
            lastEmitTimeRef.current = Date.now();
            onChangeRef.current(hex);
        }
    }, []);

    // Dragging fires continuously, so throttle how often the change is propagated (and saved)
    const emitThrottled = useCallback(
        (hex: string) => {
            pendingRef.current = hex;
            const wait = changeThrottleMs - (Date.now() - lastEmitTimeRef.current);

            if (wait <= 0) {
                flush();
            } else if (timerRef.current === undefined) {
                timerRef.current = setTimeout(flush, wait);
            }
        },
        [flush]
    );

    // Don't lose the final value if we unmount while a change is pending
    useEffect(() => flush, [flush]);

    const open = anchorEl !== null;

    // Update the picker when `value` changes from outside, but only while closed. While open, the picker
    // is the source of truth, because `value` can briefly lag behind it and would make it jump around.
    // Skip the update if the picker already shows this color, so it keeps its hue. White, gray and black have
    // no hue of their own, so converting them from hex would reset the hue slider to red.
    useEffect(() => {
        if (open) {
            return;
        }

        if (
            (showAlpha && value.toLowerCase() !== hsvaToHexa(hsva).toLowerCase()) ||
            (!showAlpha && value.toLowerCase() !== hsvaToHex({ ...hsva, a: 1 }).toLowerCase())
        ) {
            setHsva(hexToHsva(value));
        }

        setHexText(value.toUpperCase());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, showAlpha, open]);

    const handlePickerChange = useCallback(
        (result: { hsva: HsvaColor }) => {
            if (showAlpha) {
                setHsva(result.hsva);
                setHexText(hsvaToHexa(result.hsva).toUpperCase());
                emitThrottled(hsvaToHexa(result.hsva).toLowerCase());
            } else {
                const newHsva = { ...result.hsva, a: 1 };
                setHsva(newHsva);
                setHexText(hsvaToHex(newHsva).toUpperCase());
                emitThrottled(hsvaToHex(newHsva).toLowerCase());
            }
        },
        [emitThrottled, showAlpha]
    );

    const handleHexTextChange = useCallback(
        (text: string) => {
            setHexText(text);
            const pattern = showAlpha ? hexWithAlphaPattern : hexPattern;

            if (pattern.test(text)) {
                const hex = (text.startsWith('#') ? text : `#${text}`).toLowerCase();
                setHsva(hexToHsva(hex));
                emitThrottled(hex);
                flush();
            }
        },
        [emitThrottled, showAlpha, flush]
    );

    const handleOpen = (e: React.SyntheticEvent<HTMLElement>) => {
        if (!disabled) {
            setAnchorEl(e.currentTarget);
        }
    };

    const field = (
        <>
            <TextField
                value={value.toUpperCase()}
                color="primary"
                fullWidth={fullWidth}
                sx={{ '& .MuiInputBase-root, & input': { cursor: disabled ? 'default' : 'pointer' }, ...sx }}
                disabled={disabled}
                onClick={handleOpen}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(e);
                    }
                }}
                slotProps={{
                    htmlInput: { readOnly: true },
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <span
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 4,
                                        backgroundColor: value,
                                        border: `1px solid ${theme.palette.divider}`,
                                    }}
                                />
                            </InputAdornment>
                        ),
                    },
                }}
                {...(textFieldProps ?? {})}
            />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={() => {
                    flush();
                    setAnchorEl(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Stack spacing={1} sx={{ p: 1 }}>
                    <Chrome
                        color={hsva}
                        showAlpha={showAlpha ?? false}
                        showEyeDropper={true}
                        showEditableInput={false}
                        onChange={handlePickerChange}
                        style={
                            {
                                '--github-background-color': theme.palette.background.paper,
                                '--github-border': 'none',
                                '--github-box-shadow': 'none',
                            } as React.CSSProperties
                        }
                    />
                    <TextField
                        label="HEX"
                        size="small"
                        color="primary"
                        value={hexText}
                        error={showAlpha ? !hexWithAlphaPattern.test(hexText) : !hexPattern.test(hexText)}
                        onChange={(e) => handleHexTextChange(e.target.value)}
                        onBlur={() => {
                            if (showAlpha) {
                                setHexText(hsvaToHexa(hsva).toUpperCase());
                            } else {
                                setHexText(hsvaToHex({ ...hsva, a: 1 }).toUpperCase());
                            }
                        }}
                    />
                </Stack>
            </Popover>
        </>
    );

    if (label === undefined) {
        return field;
    }

    return (
        <FormControl fullWidth>
            <FormLabel>{label}</FormLabel>
            {field}
        </FormControl>
    );
};

export default ColorPickerField;
