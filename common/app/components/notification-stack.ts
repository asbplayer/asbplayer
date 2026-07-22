export interface Stack<T> {
    id: number;
    value: T;
}

export const prepend = <T>(items: Stack<T>[], item: Stack<T>): Stack<T>[] => [item, ...items];

export const remove = <T>(items: Stack<T>[], id: number): Stack<T>[] => items.filter((item) => item.id !== id);
