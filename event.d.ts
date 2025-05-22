export type StateChangeEventMap = {
    registerobject: {
        event: { id: number; readonly object: GameObject };
    };
    registerplayer: {
        event: { id: number; readonly object: Player };
    };
    registercard: {
        event: { id: number; readonly object: Card };
    };
    unregisterplayer: {
        event: { id: number; readonly object: Player };
    };
    unregistercard: {
        event: { id: number; readonly object: Card };
    };
    changestate: {
        event: { readonly object: GameObject; patch: JSONPatchOperation };
        api: {};
    };
};

export type JSONPatchOperation =
    | { op: 'add'; path: string; value: any }
    | { op: 'remove'; path: string }
    | { op: 'replace'; path: string; value: any }
    | { op: 'move'; from: string; path: string }
    | { op: 'copy'; from: string; path: string }
    | { op: 'test'; path: string; value: any };

export type DummyEventMap = {
    gamestart: {
        event: {};
        api: {};
    };
    gameend: {
        event: {};
    };
    turnstart: {
        event: { readonly player: Player };
        api: { changePlayer: (Player) => void } & CancelableAPI;
    };
    turnend: {
        event: { readonly player: Player };
    };
    attack: {
        event: { readonly attacker: Player; readonly target: Player; damage: DamageFormula };
        api: {} & CancelableAPI;
    };
    damage: {
        event: { readonly damager: Player; readonly target: Player; damage: DamageFormula };
        api: {} & CancelableAPI;
    };
    heal: {
        event: { readonly healer: Player, readonly target: Player, amount };
        api: {} & CancelableAPI;
    }
};

export type DamageFormula = {
    base: number;
    bonus: number;
    mult: number;
    uniqueMult: number[];
    critRate: number;
    critMultiplier: number;
    tags: string[];
};

export type EventMap = StateChangeEventMap & DummyEventMap;

type CancelableAPI = {
    cancel: () => void;
};

// 全イベントキー
export type EventKey = keyof EventMap;
// 呼び出し可能イベントキー
export type CallableEventKey = {
    [K in EventKey]: EventMap[K] extends { event: any } ? K : never;
};
// スクリプトの干渉可能なイベントキー
export type ExecutableEventKey = {
    [K in EventKey]: EventMap[K] extends { event: any; api: any } ? K : never;
};
