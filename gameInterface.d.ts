declare type StateType = string | number | boolean | Partial<Record<string, StateType>> | Array<StateType>;
interface IStateManager {
    getStateProxy(): StateType;
    onChange(callback: (patch: JSONPatchOperation[]) => void): void;
}

declare interface IScriptManager {
    set(name: string, script: Script): EventOf<'setscript'>;
    remove(name: string): EventOf<'removescript'>;
    get(name: string): Script;
    getByEvent(type: EventKey): Script[];
}

declare interface IGameManager {
    readonly game: Game;
}

declare interface IGameObject {
    readonly id: number;
    readonly state: State;
    readonly script: ScriptManager;
}

declare interface IGame extends GameObject {}

declare interface IPlayer extends GameObject {}

declare interface ICard extends GameObject {}
