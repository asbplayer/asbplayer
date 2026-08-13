import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import NumericSettingInput from '@project/common/components/NumericSettingInput';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NumericSettingInput', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    const renderInput = (
        value: number,
        onValueChange = jest.fn(),
        normalizeValue?: (value: number) => number | undefined,
        integerOnly = false
    ) => {
        act(() => {
            root.render(
                <NumericSettingInput
                    label="Value"
                    value={value}
                    onValueChange={onValueChange}
                    normalizeValue={normalizeValue}
                    integerOnly={integerOnly}
                />
            );
        });
        return container.querySelector('input') as HTMLInputElement;
    };

    const setInputValue = (input: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('commits complete numeric values', () => {
        const onValueChange = jest.fn();
        const input = renderInput(5, onValueChange);

        act(() => {
            setInputValue(input, '-25');
        });

        expect(onValueChange).toHaveBeenCalledWith(-25);
    });

    it('keeps incomplete input until blur, then restores the persisted value', () => {
        const input = renderInput(5);

        act(() => {
            input.focus();
            Object.defineProperty(input, 'value', { configurable: true, writable: true, value: '-' });
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(input.value).toBe('-');

        act(() => {
            input.blur();
        });
        expect(input.value).toBe('5');
    });

    it('synchronizes an externally changed setting', () => {
        const onValueChange = jest.fn();
        renderInput(5, onValueChange);

        act(() => {
            root.render(<NumericSettingInput label="Value" value={8} onValueChange={onValueChange} />);
        });

        expect((container.querySelector('input') as HTMLInputElement).value).toBe('8');
    });

    it('displays normalized values and reports the normalized result', () => {
        const onValueChange = jest.fn();
        const input = renderInput(5, onValueChange, (value) => Math.max(0, Math.min(10, value)));

        act(() => {
            setInputValue(input, '15');
        });

        expect(onValueChange).toHaveBeenCalledWith(10);
        expect(input.value).toBe('10');
    });

    it('keeps decimal input from being reported when integer-only', () => {
        const onValueChange = jest.fn();
        const input = renderInput(5, onValueChange, undefined, true);

        act(() => {
            input.focus();
            setInputValue(input, '1.5');
        });

        expect(onValueChange).not.toHaveBeenCalled();
        expect(input.value).toBe('1.5');

        act(() => {
            input.blur();
        });
        expect(input.value).toBe('5');
    });
});
