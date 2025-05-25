/// <reference path=".gameInterface.d.ts" />

type StateChangeEventMap = {
    registerobject: {
        event: { id: number; readonly object: IGameObject };
    };
    registerplayer: {
        event: { id: number; readonly object: IPlayer };
    };
    registercard: {
        event: { id: number; readonly object: ICard };
    };
    unregisterplayer: {
        event: { id: number; readonly object: IPlayer };
    };
    unregistercard: {
        event: { id: number; readonly object: ICard };
    };
    changestate: {
        event: { readonly object: GameObject; patch: JSONPatchOperation };
        api: {};
    };
};

declare type JSONPatchOperation =
    | { op: 'add'; path: string; value: StateType }
    | { op: 'remove'; path: string }
    | { op: 'replace'; path: string; value: StateType };

declare type DummyEventMap = {
    gamestart: {
        event: {};
        api: {};
    };
    gameend: {
        event: {};
    };
    turnstart: {
        event: { readonly player: IPlayer };
        api: { changePlayer: (Player) => void } & CancelableAPI;
    };
    turnend: {
        event: { readonly player: IPlayer };
    };
    attack: {
        event: { readonly attacker: IPlayer; readonly target: IPlayer; damage: DamageFormula };
        api: {} & CancelableAPI;
    };
    damage: {
        event: { readonly damager: IPlayer; readonly target: IPlayer; damage: DamageFormula };
        api: {} & CancelableAPI;
    };
    heal: {
        event: { readonly healer: IPlayer; readonly target: IPlayer; amount };
        api: {} & CancelableAPI;
    };
};

declare type DamageFormula = {
    base: number;
    bonus: number;
    mult: number;
    uniqueMult: number[];
    critRate: number;
    critMultiplier: number;
    tags: string[];
};

type CancelableAPI = {
    cancel: () => void;
};

// 全イベント
declare type EventMap = StateChangeEventMap & DummyEventMap;
// 全イベントキー
declare type EventKey = Extract<keyof EventMap, string>;
// 呼び出し可能イベントキー
declare type CallableEventKey = {
    [K in EventKey]: EventMap[K] extends { event: any } ? K : never;
}[EventKey];
// 実行可能なイベントキー
declare type ExecutableEventKey = {
    [K in CallableEventKey]: EventMap[K] extends { api: any } ? K : never;
}[EventKey];
// 呼び出し可能イベント
declare type CallableEvent = {
    [K in CallableEventKey]: {
        type: K;
    } & EventMap[K]['event'];
}[CallableEventKey];
// 実行可能イベント
declare type ExecutableEvent = {
    [K in ExecutableEventKey]: {
        type: K;
    } & EventMap[K]['event'];
}[ExecutableEventKey];
// イベント取り出し
declare type CallableEventOf<T extends CallableEventKey> = Extract<CallableEvent, { type: T }>;
declare type ExecutableEventOf<T extends ExecutableEventKey> = Extract<ExecutableEvent, { type: T }>;