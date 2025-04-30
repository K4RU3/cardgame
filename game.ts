// イベントタイプごとの値の型を定義
export type GameEventMap = {
    registerobject: { id: number; object: GameObject };
    gamestart: {};
    gameend: { winners: string[] };
    turnstart: { playerRef: number };
    turnend: { playerRef: number };
    attack: { attackerRef: number; targetRef: number; usingCardRef: number };
    use: { playerRef: number; usingCardRef: number; targetRef: number };
    draw: { playerRef: number; cardRef: number };
    addcard: { playerRef: number; cardRef: number };
    removecard: { playerRef: number; cardRef: number };
    heal: { targetRef: number; sourceRef: number; amount: number };
    damage: { targetRef: number; sourceRef: number; amount: number };
    recharge: { targetRef: number; sourceRef: number; amount: number };
    discharge: { targetRef: number; sourceRef: number; amount: number };
    givesanity: { targetRef: number; sourceRef: number; amount: number };
    takesanity: { targetRef: number; sourceRef: number; amount: number };
    changeState: { stateParentRef: number; key: string; value: any };
    changeScript: { scriptParentRef: number; script: ScriptData };
    removeScript: { scriptParentRef: number; name: string };
    custom: { name: string; value: any };
};

export type EventOf<T extends keyof GameEventMap> = {
  type: T;
  value: GameEventMap[T];
};

// 各イベントを統一した GameEvent 型としてユニオンに変換
export type GameEvent = {
    [K in keyof GameEventMap]: { type: K; value: GameEventMap[K] };
}[keyof GameEventMap];

const UNCALLABLE_EVENT: GameEvent['type'][] = ['registerobject'];
type StatusChangeEventType = 'heal' | 'damage' | 'recharge' | 'discharge' | 'givesanity' | 'takesanity';

type ScriptAPI = {
    isCanceled: boolean;
    readonly game: Game;
    type: GameEvent['type'];
    unref: (ref: number) => GameObject;
    value: GameEvent['value'];
    selfRef: number;
    createCard: (arg?: { state?: stateType; script?: ScriptData[]; weight?: number }) => Card;
};

type ScriptData = {
    name: string;
    scripts: Partial<
        Record<
            GameEvent['type'],
            {
                before?: string;
                after?: string;
            }
        >
    >;
};

export class GameManager {
    #gameid: number = -1;
    #objects: (GameObject | null)[] = [];
    #eventCallback: (event: GameEvent) => void = () => {};

    constructor(callback: (event: GameEvent) => void) {
        this.#reset(callback);
    }

    #reset(callback: (event: GameEvent) => void) {
        this.#objects = [];
        this.#eventCallback = callback;
        this.#gameid = this.#allocateId();
        const game = new Game(this.#gameid, this, {});
        this.#register(game, this.#gameid);
    }

    #allocateId = (): number => this.#objects.push(null) - 1;

    #register(object: GameObject, id: number) {
        const [isCanceled, _, afterScript] = this.callEvent(
            {
                type: 'registerobject',
                value: {
                    id: id,
                    object: object,
                },
            },
            -1
        );

        if (isCanceled) {
            console.warn('オブジェクトの作成をキャンセルしたり、変更することはできません。');
        }

        this.#objects[id] = object;
    }

    callEvent(event: GameEvent, selfRef: number): [boolean, GameEvent, () => void] {
        if (UNCALLABLE_EVENT.includes(event.type)) {
            this.#eventCallback(JSON.parse(JSON.stringify(event)));
            return [false, event, () => {}];
        }

        const game = this.game;
        const api = this.#createScriptAPI(event);
        this.#runScripts(api, game, selfRef, 'before');

        if (api.isCanceled) {
            return [true, event, () => {}];
        }

        this.#eventCallback(JSON.parse(JSON.stringify(event)));

        const afterScript = () => this.#runScripts(api, game, selfRef, 'after');

        return [false, event, afterScript];
    }

    #executeScript(script: string, api: ScriptAPI) {
        try {
            const fn = new Function('api', `"use strict";\n${script}`);
            fn(api);
        } catch (error) {
            console.error('スクリプト実行中にエラーが発生しました:', {
                error: error,
                script: script,
                api: api,
            });
        }
    }

    #runScripts(api: ScriptAPI, game: Game, selfRef: number, phase: 'before' | 'after') {
        // 1. ゲームのスクリプト
        const gameScripts = game.script.getScriptsFilteredByType(api.type);
        const gameAPI = phase === 'before' ? { ...api, selfRef: game.id } : deepFreeze({ ...api, selfRef: game.id });
        for (const scriptObject of gameScripts) {
            if (api.isCanceled) {
                return;
            }

            const script = scriptObject.scripts[api.type]?.[phase];
            if (script) {
                if (phase === 'before') {
                    gameAPI.selfRef = game.id;
                }
                this.#executeScript(script, gameAPI);
            }
        }

        if (gameAPI.isCanceled) {
            return;
        }

        // 2. イベント保持者のスクリプト
        const self = this.getById(selfRef);
        if (!(self instanceof GameObject) || self instanceof Game) {
            return;
        }
        const selfScripts = self.script.getScriptsFilteredByType(api.type);
        const selfAPI = phase == 'before' ? { ...api, selfRef: self.id } : deepFreeze({ ...api, selfRef: self.id });
        for (const scriptObject of selfScripts) {
            const script = scriptObject.scripts[api.type]?.[phase];
            if (script) {
                if (api.isCanceled) {
                    return;
                }

                if (phase === 'before') {
                    selfAPI.selfRef = self.id;
                }

                this.#executeScript(script, selfAPI);
            }
        }
    }

    #createScriptAPI(event: GameEvent): ScriptAPI {
        const gameId = this.#gameid;

        const baseAPI = {
            type: event.type,
            get game(): Game {
                return this.unref(gameId) as Game;
            },
            isCanceled: false,
            unref: (ref: number) => this.getById(ref) as GameObject,
            value: event.value,
            selfRef: -1,
            createCard: (arg?: { state?: stateType; script?: ScriptData[]; weight?: number }) => this.createCard(arg),
        };

        return baseAPI;
    }

    getById(id: number): GameObject | null {
        return this.#objects[id];
    }

    get game(): Game {
        return this.getById(this.#gameid) as Game;
    }

    createPlayer(
        arg: {
            state?: stateType;
            script?: ScriptData[];
            hp?: number;
            mp?: number;
            sanity?: number;
            inventory?: number[];
        } = {}
    ): Player {
        const player = new Player(this.#allocateId(), this, arg);
        this.#register(player, player.id);
        return player;
    }

    createCard(
        arg: {
            state?: stateType;
            script?: ScriptData[];
            weight?: number;
        } = {}
    ): Card {
        const card = new Card(this.#allocateId(), this, arg);
        this.#register(card, card.id);
        return card;
    }
}

export class GameObject {
    #id: number;
    protected managerRef: WeakRef<GameManager>;
    #state: State;
    #script: Script;

    constructor(id: number, manager: GameManager, other: { state?: stateType; script?: ScriptData[] } = {}) {
        this.#id = id;
        this.managerRef = new WeakRef(manager);
        this.#state = new State(manager, id, other.state);
        this.#script = new Script(manager, id, other.script);
    }

    get id(): number {
        return this.#id;
    }

    get script(): Script {
        return this.#script;
    }

    get state(): State {
        return this.#state;
    }
}

type stateType = { [key: string]: any };
export class State {
    #manager: WeakRef<GameManager>;
    #parentRef: number;
    #state: stateType;

    constructor(manager: GameManager, parentRef: number, defaultState?: stateType) {
        this.#manager = new WeakRef(manager);
        this.#parentRef = parentRef;
        this.#state = defaultState ?? {};
    }

    get copy(): stateType {
        return JSON.parse(JSON.stringify(this.#state));
    }

    set(key: string, value: any): EventOf<'changeState'> {
        const [isCanceled, updatedEvent, afterScript] = this.#manager.deref()!.callEvent(
            {
                type: 'changeState',
                value: {
                    stateParentRef: this.#parentRef,
                    key: key,
                    value: value,
                },
            },
            this.#parentRef
        );

        if (isCanceled) {
            return updatedEvent as EventOf<'changeState'>;
        }

        if (updatedEvent.type === 'changeState') {
            this.#state[updatedEvent.value.key] = updatedEvent.value.value;
        }

        afterScript();
        return updatedEvent as EventOf<'changeState'>;
    }
}

export class Script {
    #manager: WeakRef<GameManager>;
    #parentRef: number;
    #scripts: ScriptData[];

    constructor(manager: GameManager, parentRef: number, scripts: ScriptData[] = []) {
        this.#manager = new WeakRef(manager);
        this.#parentRef = parentRef;
        this.#scripts = scripts;
    }

    get scripts(): ScriptData[] {
        return JSON.parse(JSON.stringify(this.#scripts));
    }

    getScriptsFilteredByType(type: GameEvent['type']): ScriptData[] {
        return JSON.parse(JSON.stringify(this.#scripts.filter((script) => script.scripts[type])));
    }

    getScriptByName(name: string): ScriptData['scripts'] {
        return JSON.parse(JSON.stringify(this.#scripts.find((script) => script.name === name)?.scripts));
    }

    changeScript(script: ScriptData): EventOf<'changeScript'> {
        const [isCanceled, updatedEvent, afterScript] = this.#manager.deref()!.callEvent(
            {
                type: 'changeScript',
                value: {
                    scriptParentRef: this.#parentRef,
                    script: script,
                },
            },
            this.#parentRef
        );

        if (isCanceled) {
            return updatedEvent as EventOf<'changeScript'>;
        }

        if (updatedEvent.type === 'changeScript') {
            const scriptIndex = this.#scripts.findIndex((script) => script.name === updatedEvent.value.script.name);
            if (scriptIndex === -1) {
                this.#scripts.push(updatedEvent.value.script);
            } else {
                this.#scripts[scriptIndex] = updatedEvent.value.script;
            }
        }

        afterScript();
        return updatedEvent as EventOf<'changeScript'>;
    }

    removeScript(name: string): EventOf<'removeScript'> {
        const [isCanceled, updatedEvent, afterScript] = this.#manager.deref()!.callEvent(
            {
                type: 'removeScript',
                value: {
                    scriptParentRef: this.#parentRef,
                    name: name,
                },
            },
            this.#parentRef
        );

        if (isCanceled) {
            return updatedEvent as EventOf<'removeScript'>;
        }

        if (updatedEvent.type === 'removeScript') {
            const scriptIndex = this.#scripts.findIndex((script) => script.name === updatedEvent.value.name);
            if (scriptIndex === -1) {
                return updatedEvent as EventOf<'removeScript'>;
            }

            this.#scripts.splice(scriptIndex, 1);
        }

        afterScript();
        return updatedEvent as EventOf<'removeScript'>;
    }
}

export class Game extends GameObject {
    #turn: number;
    #turnPlayerRef: number;
    #cardsRef: number[];
    #playersRef: number[];
    #cardWeight: number;

    constructor(id: number, manager: GameManager, other: { state?: stateType; script?: ScriptData[] } = {}) {
        super(id, manager, other);
        this.#turn = 0;
        this.#turnPlayerRef = -1;
        this.#cardsRef = [];
        this.#playersRef = [];
        this.#cardWeight = this.#calcAllCardWeight();
    }

    #calcAllCardWeight(): number {
        return this.#cardsRef
            .map((id) => this.managerRef.deref()!.getById(id) as Card)
            .map((card) => card.weight)
            .reduce((a, b) => a + b, 0);
    }

    get players(): Player[] {
        return this.#playersRef.map((ref) => this.managerRef.deref()?.getById(ref) as Player);
    }

    get cards(): Card[] {
        return this.#cardsRef.map((ref) => this.managerRef.deref()?.getById(ref) as Card);
    }

    registerPlayer(player: Player) {
        this.#playersRef.push(player.id);
    }

    registerCard(card: Card) {
        this.#cardsRef.push(card.id);
        this.#cardWeight = this.#calcAllCardWeight();
    }

    weightedRandomClonedCard(): Card | null {
        if (this.#cardsRef.length === 0) {
            return null;
        }

        const totalWeight = this.#cardWeight;
        const cardsWeightList = this.#cardsRef.map((ref) => this.managerRef.deref()?.getById(ref) as Card).map((card) => card.state.copy['weight'] || 1);
        const random = Math.random() * totalWeight;

        // 累積重みリストを作成
        const cumulativeWeights: number[] = [];
        let sum = 0;
        for (const weight of cardsWeightList) {
            sum += weight;
            cumulativeWeights.push(sum);
        }

        // 二分探索でインデックスを見つける
        let low = 0,
            high = cumulativeWeights.length - 1;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (random < cumulativeWeights[mid]) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        // 見つかったインデックスでカードを取得し、クローンして返す
        return this.cards[low].clone();
    }
}

export class Player extends GameObject {
    #hp: number;
    #mp: number;
    #sanity: number;
    #inventory: number[];

    constructor(id: number, manager: GameManager, other: { state?: stateType; script?: ScriptData[]; hp?: number; mp?: number; sanity?: number; inventory?: number[] } = {}) {
        super(id, manager, other);
        this.#hp = other.hp ?? 0;
        this.#mp = other.mp ?? 0;
        this.#sanity = other.sanity ?? 0;
        this.#inventory = other.inventory ?? [];
    }

    get inventory(): Card[] {
        return this.#inventory.map((ref) => this.managerRef.deref()?.getById(ref) as Card);
    }

    get hp(): number {
        return this.#hp;
    }

    get mp(): number {
        return this.#mp;
    }

    get sanity(): number {
        return this.#sanity;
    }

    #applyEvent<T extends StatusChangeEventType>(event: T, amount: number, ref: number): EventOf<T> {
        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: event,
                value: {
                    targetRef: this.id,
                    sourceRef: ref,
                    amount: amount,
                },
            },
            this.id
        );

        if (!isCanceled && updatedEvent.type === event) {
            switch (updatedEvent.type) {
                case 'heal':
                case 'damage':
                    this.#hp += (event === 'heal' ? 1 : -1) * updatedEvent.value.amount;
                    break;
                case 'recharge':
                case 'discharge':
                    this.#mp += (event === 'recharge' ? 1 : -1) * updatedEvent.value.amount;
                    break;
                case 'givesanity':
                case 'takesanity':
                    this.#sanity += (event === 'givesanity' ? 1 : -1) * updatedEvent.value.amount;
                    break;
            }
        }

        afterScript();
        return updatedEvent as EventOf<T>;
    }

    heal(amount: number, ref?: number): EventOf<'heal'> {
        return this.#applyEvent('heal', amount, ref ?? -1);
    }

    damage(amount: number, ref?: number): EventOf<'damage'> {
        return this.#applyEvent('damage', amount, ref ?? -1);
    }

    recharge(amount: number, ref?: number): EventOf<'recharge'> {
        return this.#applyEvent('recharge', amount, ref ?? -1);
    }

    discharge(amount: number, ref?: number): EventOf<'discharge'> {
        return this.#applyEvent('discharge', amount, ref ?? -1);
    }

    givesanity(amount: number, ref?: number): EventOf<'givesanity'> {
        return this.#applyEvent('givesanity', amount, ref ?? -1);
    }

    takesanity(amount: number, ref?: number): EventOf<'takesanity'> {
        return this.#applyEvent('takesanity', amount, ref ?? -1);
    }

    draw(): EventOf<'draw'> | null {
        const randomClonedCard = this.managerRef.deref()!.game.weightedRandomClonedCard();

        if (!randomClonedCard) {
            return null;
        }

        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: 'draw',
                value: {
                    playerRef: this.id,
                    cardRef: randomClonedCard.id,
                },
            },
            this.id
        );

        if (!isCanceled && updatedEvent.type === 'draw') {
            this.addInventory(updatedEvent.value.cardRef);
        }

        afterScript();

        return updatedEvent as EventOf<'draw'>;
    }

    addInventory(cardRef: number): EventOf<'addcard'> {
        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: 'addcard',
                value: {
                    playerRef: this.id,
                    cardRef: cardRef,
                },
            },
            this.id
        );

        if (!isCanceled && updatedEvent.type === 'addcard') {
            this.#inventory.push(updatedEvent.value.cardRef);
        }

        afterScript();
        return updatedEvent as EventOf<'addcard'>;
    }

    removeFromInventory(cardRef: number): EventOf<'removecard'> | null {
        if (!this.#inventory.includes(cardRef)) {
            return null;
        }

        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: 'removecard',
                value: {
                    playerRef: this.id,
                    cardRef: cardRef,
                },
            },
            this.id
        );

        if (!isCanceled && updatedEvent.type === 'removecard') {
            this.#inventory.splice(this.#inventory.indexOf(cardRef), 1);
            afterScript();
        }

        return updatedEvent as EventOf<'removecard'>;
    }

    attackDamage(amount: number, targetRef: number, usingCardRef: number): EventOf<'attack'> | null {
        if (!(this.managerRef.deref()!.getById(targetRef) as Player)) {
            return null;
        }

        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: 'attack',
                value: {
                    attackerRef: this.id,
                    targetRef: targetRef,
                    usingCardRef: usingCardRef,
                },
            },
            this.id
        );

        if (!isCanceled && updatedEvent.type === 'attack') {
            const target = this.managerRef.deref()!.getById(updatedEvent.value.targetRef) as Player;
            target?.damage?.(amount, this.id);
        }

        afterScript();
        return updatedEvent as EventOf<'attack'>;
    }

    use(cardRef: number, targetRef: number): EventOf<'use'> | null {
        const card = this.managerRef.deref()!.getById(cardRef) as Card;
        if (!card || !(card instanceof Card)) {
            return null;
        }

        const [isCanceled, updatedEvent, afterScript] = this.managerRef.deref()!.callEvent(
            {
                type: 'use',
                value: {
                    playerRef: this.id,
                    usingCardRef: cardRef,
                    targetRef: targetRef,
                },
            },
            card.id
        );

        afterScript();
        return updatedEvent as EventOf<'use'>;
    }
}

export class Card extends GameObject {
    #weight: number;

    constructor(id: number, manager: GameManager, other: { state?: stateType; script?: ScriptData[]; weight?: number }) {
        super(id, manager, other);
        this.#weight = other.weight ?? 1;
    }

    get weight(): number {
        return this.#weight;
    }

    clone(): Card {
        return this.managerRef.deref()!.createCard({
            state: this.state.copy,
            script: this.script.scripts,
            weight: this.#weight,
        });
    }
}

/* =============== ユーティリティ関数 =============== */
function deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
        Object.getOwnPropertyNames(obj).forEach((key) => {
            const prop = (obj as any)[key];
            if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
                deepFreeze(prop);
            }
        });

        // オブジェクト自身を凍結
        Object.freeze(obj);
    }
    return obj;
}
