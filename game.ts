/// <reference path="./gameInterface.d.ts" />
/// <reference path="./event.d.ts" />

export class StateManager implements IStateManager {
    private _rawState: StateType;
    private readonly changeCallbacks: ((patches: JSONPatchOperation[]) => void)[] = [];
    private readonly proxyCache = new WeakMap<object, any>();

    constructor(initialState: StateType) {
        if (!this.isValidStateValue(initialState)) {
            throw new TypeError('[StateManager] 初期状態に無効な値が渡されました。StateType に一致しません。');
        }
        this._rawState = initialState;
    }

    public getStateProxy(): StateType {
        return this.createProxy(this._rawState, '');
    }

    public onChange(callback: (patches: JSONPatchOperation[]) => void): void {
        this.changeCallbacks.push(callback);
    }

    private createProxy(target: any, path: string): any {
        if (this.proxyCache.has(target)) {
            return this.proxyCache.get(target);
        }

        const handler: ProxyHandler<any> = {
            get: (t, prop, receiver) => {
                const value = Reflect.get(t, prop, receiver);
                if (typeof value === 'object' && value !== null) {
                    const childPath = `${path}/${String(prop)}`;
                    return this.createProxy(value, childPath);
                }
                return value;
            },

            set: (t, prop, value, receiver) => {
                const fullPath = `${path}/${String(prop)}`;
                if (!this.isValidStateValue(value)) {
                    console.warn('[StateManager] 無効な値が設定されました:', {
                        path: fullPath,
                        attemptedValue: value,
                        reason: 'StateType に一致しない型です',
                    });
                    return false;
                }

                const oldValue = t[prop];
                const op: JSONPatchOperation = {
                    op: oldValue === undefined ? 'add' : 'replace',
                    path: fullPath,
                    value,
                };

                const success = Reflect.set(t, prop, value, receiver);
                if (success) {
                    this.emitChange([op]);
                }
                return success;
            },

            deleteProperty: (t, prop) => {
                const fullPath = `${path}/${String(prop)}`;
                const success = Reflect.deleteProperty(t, prop);
                if (success) {
                    const op: JSONPatchOperation = { op: 'remove', path: fullPath };
                    this.emitChange([op]);
                }
                return success;
            },
        };

        const proxy = new Proxy(target, handler);
        this.proxyCache.set(target, proxy);
        return proxy;
    }

    private emitChange(patches: JSONPatchOperation[]) {
        for (const cb of this.changeCallbacks) {
            cb(patches);
        }
    }

    private isValidStateValue(value: unknown): value is StateType {
        if (value === null) return false;

        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') return true;

        if (Array.isArray(value)) {
            return value.every((v) => this.isValidStateValue(v));
        }

        if (type === 'object') {
            const entries = Object.entries(value as Record<string, unknown>);
            return entries.every(([_, v]) => this.isValidStateValue(v));
        }

        return false;
    }
}
