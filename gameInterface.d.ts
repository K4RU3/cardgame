import { EventKey, EventOf } from './event';


export interface IState {
    set(key: string, value: any): EventOf<'setstate'>;
    get(key: string): any;
}

export interface IScriptManager {
    set(name: string, script: Script): EventOf<'setscript'>;
    remove(name: string): EventOf<'removescript'>;
    get(name: string): Script;
    getByEvent(type: EventKey): Script[];
}

export type ScriptFase = 'before' | 'after';
export interface IScript {
    get(type: EventKey, fase: ScriptFase): string;
    set(type: EventKey, fase: ScriptFase): EventOf<'setscriptfase'>;
}

export interface IGameManager {
    readonly game: Game;
}

export interface IGameObject {
    id: number;
    state: State;
    script: ScriptManager;
}

export interface IGame extends GameObject {

}

export interface IPlayer extends GameObject {}

export interface ICard extends GameObject {}
