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
    | { op: 'replace'; path: string; value: StateType }
    | { op: 'move'; from: string; path: string }
    | { op: 'copy'; from: string; path: string };

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

declare type EventMap = StateChangeEventMap & DummyEventMap;

type CancelableAPI = {
    cancel: () => void;
};

// 全イベントキー
declare type EventKey = keyof EventMap;
// 呼び出し可能イベントキー
declare type CallableEventKey = {
    [K in EventKey]: EventMap[K] extends { event: any } ? K : never;
};
// スクリプトの干渉可能なイベントキー
declare type ExecutableEventKey = {
    [K in EventKey]: EventMap[K] extends { event: any; api: any } ? K : never;
};
