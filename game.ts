// イベントタイプごとの値の型を定義
export type GameEventMap = {
    reset: {};
    registerobject: { id: number; object: GameObject };
    registerplayer: { id: number; object: Player };
    registercard: { id: number; object: Card };
    unregisterplayer: { id: number };
    unregistercard: { id: number };
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
};

export type EventOf<T extends keyof GameEventMap> = {
    type: T;
    value: GameEventMap[T];
};

// 各イベントを統一した GameEvent 型としてユニオンに変換
export type GameEvent = {
    [K in keyof GameEventMap]: { type: K; value: GameEventMap[K] };
}[keyof GameEventMap];

export const UNCALLABLE_EVENT: GameEvent['type'][] = ['registerobject', 'registerplayer', 'registercard', 'unregisterplayer', 'unregistercard', 'reset', 'gamestart', 'gameend'];
type StatusChangeEventType = 'heal' | 'damage' | 'recharge' | 'discharge' | 'givesanity' | 'takesanity';

type ScriptAPI = {
    isCanceled: boolean;
    readonly game: Game;
    type: GameEvent['type'];
    unref: (ref: number) => GameObject;
    value: GameEvent['value'];
    selfRef: number;
    createCard: (arg?: { state?: stateType; script?: ScriptData[]; weight?: number }) => Card;
    useAttack(dmg: number): EventOf<'attack'> | null;
    useState<T extends StatusChangeEventType>(amo: number, type: T): EventOf<T> | null;
    useTryMp<R>(cost: number, func: () => R): R | null;
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

export type NoticeEvent = GameEvent & { timing: 'before' | 'after' | 'end' };
export class GameManager {
    #gameid: number = -1;
    #objects: (GameObject | null)[] = [];
    #eventCallback: (event: NoticeEvent) => void = () => {};

    constructor(callback: (event: NoticeEvent) => void) {
        this.#reset(callback);
    }

    #reset(callback: (event: NoticeEvent) => void) {
        callback({ type: 'reset', value: {}, timing: 'end' });
        this.#objects = [];
        this.#eventCallback = callback;
        this.#gameid = this.#allocateId();
        const game = new Game(this.#gameid, this, {});
        this.#register(game, this.#gameid);
    }

    #allocateId = (): number => this.#objects.push(null) - 1;

    #register(object: GameObject, id: number) {
        const [isCanceled, _] = this.callEvent(
            {
                type: 'registerobject',
                value: {
                    id: id,
                    object: object,
                },
            },
            -1,
            () => {}
        );

        if (isCanceled) {
            console.warn('オブジェクトの作成をキャンセルしたり、変更することはできません。');
        }

        this.#objects[id] = object;
    }

    #noticeEvent<T extends keyof GameEventMap>(event: EventOf<T>, timing: NoticeEvent['timing']) {
        this.#eventCallback({ ...(event as GameEvent), timing });
    }

    callEvent<T extends keyof GameEventMap, R>(event: EventOf<T>, selfRef: number, editProcess: (event: EventOf<T>) => R): [EventOf<T>, R | null] {
        const game = this.game;
        const api = this.#createScriptAPI(event as GameEvent);

        this.#noticeEvent(event, 'before');

        if (UNCALLABLE_EVENT.includes(event.type)) {
            if (game !== null && game !== undefined) {
                this.#runScripts(api, game, selfRef, 'after');
            }
            this.#noticeEvent(event, 'end');
            const result = editProcess(event);
            return [event, result];
        }

        this.#runScripts(api, game, selfRef, 'before');

        if (api.isCanceled) {
            return [event, null];
        }

        const margedEvent = this.#margeScriptAPI(api, event);

        const result = editProcess(margedEvent);

        const event_copy = JSON.parse(JSON.stringify(event)) as GameEvent;
        this.#noticeEvent(event_copy, 'after');
        this.#runScripts(api, game, selfRef, 'after');
        this.#noticeEvent(event_copy, 'end');

        return [event, result];
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

        const baseAPI: ScriptAPI = {
            type: event.type,
            get game(): Game {
                return this.unref(gameId) as Game;
            },
            isCanceled: false,
            unref: (ref: number) => this.getById(ref) as GameObject,
            value: event.value,
            selfRef: -1,
            createCard: (arg?: { state?: stateType; script?: ScriptData[]; weight?: number }) => this.createCard(arg),
            useAttack: (dmg: number) => (event.type === 'use' && (baseAPI.unref(event.value.playerRef) as Player)?.attackDamage(dmg, event.value.targetRef, event.value.usingCardRef)) || null,
            useState: function <T extends StatusChangeEventType>(amo: number, type: T): EventOf<T> | null {
                if (event.type !== 'use') return null;

                const player = baseAPI.unref(event.value.playerRef) as Player;
                if (!player || !(player instanceof Player) || typeof player[type] !== 'function') return null;

                // 呼び出しと戻り値を EventOf<T> にキャスト
                return (player[type](amo, event.value.playerRef) as EventOf<T>) ?? null;
            },
            useTryMp: function <R>(cost: number, func: () => R) {
                if (event.type !== 'use') return null;

                const player = baseAPI.unref(event.value.playerRef) as Player;
                if (!player || !(player instanceof Player)) return null;
                
                if (player.mp >= cost) {
                    player.discharge(cost);
                    return func();
                }
                
                return null;
            }
        };

        return baseAPI;
    }

    #margeScriptAPI<T extends keyof GameEventMap>(api: ScriptAPI, event: EventOf<T>): EventOf<T> {
        return {
            type: event.type,
            value: api.value,
        } as typeof event;
    }

    setEventCallback(callback: (event: NoticeEvent) => void) {
        this.#eventCallback = callback;
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
        const [updatedEvent, result] = this.#manager.deref()!.callEvent(
            {
                type: 'changeState',
                value: {
                    stateParentRef: this.#parentRef,
                    key: key,
                    value: value,
                },
            },
            this.#parentRef,
            (event) => {
                this.#state[event.value.key] = event.value.value;
                return event;
            }
        );
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

    changeScript(script: ScriptData): EventOf<'changeScript'> | null {
        const [updatedEvent, result] = this.#manager.deref()!.callEvent(
            {
                type: 'changeScript',
                value: {
                    scriptParentRef: this.#parentRef,
                    script: script,
                },
            },
            this.#parentRef,
            (event) => {
                const scriptIndex = this.#scripts.findIndex((script) => script.name === event.value.script.name);
                if (scriptIndex === -1) {
                    this.#scripts.push(event.value.script);
                } else {
                    this.#scripts[scriptIndex] = event.value.script;
                }
                return event;
            }
        );

        return result;
    }

    removeScript(name: string): EventOf<'removeScript'> | null {
        const [updatedEvent, result] = this.#manager.deref()!.callEvent(
            {
                type: 'removeScript',
                value: {
                    scriptParentRef: this.#parentRef,
                    name: name,
                },
            },
            this.#parentRef,
            (event) => {
                const scriptIndex = this.#scripts.findIndex((script) => script.name === event.value.name);
                if (scriptIndex === -1) {
                    return event as EventOf<'removeScript'>;
                }

                this.#scripts.splice(scriptIndex, 1);

                return event;
            }
        );

        return result;
    }
}

export class Game extends GameObject {
    #cardsRef: number[];
    #playersRef: number[];
    #cardWeight: number;

    constructor(id: number, manager: GameManager, other: { state?: stateType; script?: ScriptData[] } = {}) {
        super(id, manager, other);
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
        this.managerRef.deref()!.callEvent(
            {
                type: 'registerplayer',
                value: {
                    id: player.id,
                    object: player,
                },
            },
            this.id,
            () => {}
        );
    }

    registerCard(card: Card) {
        this.#cardsRef.push(card.id);
        this.managerRef.deref()!.callEvent(
            {
                type: 'registercard',
                value: {
                    id: card.id,
                    object: card,
                },
            },
            this.id,
            () => {}
        );
        this.#cardWeight = this.#calcAllCardWeight();
    }

    unregisterPlayer(player: Player) {
        this.#playersRef = this.#playersRef.filter((inPlayer) => inPlayer !== player.id);
        this.managerRef.deref()!.callEvent(
            {
                type: 'unregisterplayer',
                value: {
                    id: player.id,
                },
            },
            this.id,
            () => {}
        );
    }

    unregisterCard(card: Card) {
        this.#cardsRef = this.#cardsRef.filter((inCard) => inCard !== card.id);
        this.#calcAllCardWeight();
        this.managerRef.deref()!.callEvent(
            {
                type: 'unregistercard',
                value: {
                    id: card.id,
                },
            },
            this.id,
            () => {}
        );
    }

    weightedRandomClonedCard(): Card | null {
        if (this.#cardsRef.length === 0) {
            return null;
        }

        const totalWeight = this.#cardWeight;
        const cardsWeightList = this.#cardsRef.map((ref) => this.managerRef.deref()?.getById(ref) as Card).map((card) => card.weight || 1);
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
        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: event,
                value: {
                    targetRef: this.id,
                    sourceRef: ref,
                    amount: amount,
                },
            },
            this.id,
            (event) => {
                switch (event.type) {
                    case 'heal':
                    case 'damage':
                        this.#hp += (event.type === 'heal' ? 1 : -1) * event.value.amount;
                        break;
                    case 'recharge':
                    case 'discharge':
                        this.#mp += (event.type === 'recharge' ? 1 : -1) * event.value.amount;
                        break;
                    case 'givesanity':
                    case 'takesanity':
                        this.#sanity += (event.type === 'givesanity' ? 1 : -1) * event.value.amount;
                        break;
                }
            }
        );

        return updatedEvent;
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

        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: 'draw',
                value: {
                    playerRef: this.id,
                    cardRef: randomClonedCard.id,
                },
            },
            this.id,
            (event) => {
                this.addInventory(event.value.cardRef);
            }
        );

        return updatedEvent as EventOf<'draw'>;
    }

    addInventory(cardRef: number): EventOf<'addcard'> {
        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: 'addcard',
                value: {
                    playerRef: this.id,
                    cardRef: cardRef,
                },
            },
            this.id,
            (event) => {
                this.#inventory.push(event.value.cardRef);
            }
        );

        return updatedEvent as EventOf<'addcard'>;
    }

    removeFromInventory(cardRef: number): EventOf<'removecard'> | null {
        if (!this.#inventory.includes(cardRef)) {
            return null;
        }

        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: 'removecard',
                value: {
                    playerRef: this.id,
                    cardRef: cardRef,
                },
            },
            this.id,
            (event) => {
                this.#inventory.splice(this.#inventory.indexOf(cardRef), 1);
            }
        );

        return updatedEvent as EventOf<'removecard'>;
    }

    attackDamage(amount: number, targetRef: number, usingCardRef: number): EventOf<'attack'> | null {
        if (!(this.managerRef.deref()!.getById(targetRef) as Player)) {
            return null;
        }

        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: 'attack',
                value: {
                    attackerRef: this.id,
                    targetRef: targetRef,
                    usingCardRef: usingCardRef,
                },
            },
            this.id,
            (event) => {
                const target = this.managerRef.deref()!.getById(event.value.targetRef) as Player;
                target?.damage?.(amount, this.id);
            }
        );

        return updatedEvent as EventOf<'attack'>;
    }

    use(cardRef: number, targetRef: number): EventOf<'use'> | null {
        const card = this.managerRef.deref()!.getById(cardRef) as Card;
        if (!card || !(card instanceof Card)) {
            return null;
        }

        // 強制呼び出しのため問題なし
        const [updatedEvent, result] = this.managerRef.deref()!.callEvent(
            {
                type: 'use',
                value: {
                    playerRef: this.id,
                    usingCardRef: cardRef,
                    targetRef: targetRef,
                },
            },
            card.id,
            (event) => {}
        );

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
