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

// プレイヤーのステータス変更のイベント名およびメソッド名
type StatusChangeEventType = 'heal' | 'damage' | 'recharge' | 'discharge' | 'givesanity' | 'takesanity';

// スクリプトに渡されるメインAPI
// グローバル環境に、api: ScriptAPIが渡されます
type ScriptAPI = {
    isCanceled: boolean; // beforeフックでtrueに変更することで、イベントをキャンセル
    readonly game: Game; // Gameインスタンスを取得できます
    type: GameEvent['type']; // 呼び出されたイベントの情報を取得できます
    unref: (ref: number) => GameObject; // イベント情報のrefから、インスタンスの実態を取得できます
    value: GameEvent['value']; // イベントの内容です
    selfRef: number; // このスクリプトの呼び出し元の参照です。useイベントであれば、カード使用プレイヤーになります。
    createCard: (arg?: { state?: StateType; script?: ScriptData[]; weight?: number }) => Card; // カードのインスタンスを作成します。これにより作成されたカードは、gameに登録すれば抽選に入り、プレイヤーに直接追加すれば、1度きりのカードとなります。
    useAttack(dmg: number): EventOf<'attack'> | null; // useスクリプト限定で、現在のターゲット1人に攻撃ができます
    useState<T extends StatusChangeEventType>(amo: number, type: T): EventOf<T> | null; // useスクリプト限定で、自身のステータスを増減させられます。
    useTryMp<R>(cost: number, func: () => R): R | null; // 特定のMPを消費して、処理を実行できます。MPが足りなければ不発となります。
};

// 各GameObjectが保有する、フック用の生のスクリプトデータ
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

// 各GameObjectが保有する、生のステータスデータ
type StateType = { [key: string]: any };

// Game, Player, Cardで共通のオブジェクト構造
export class GameObject {
    // unrefで実体を取得できるidを取得
    get id(): number;
    // スクリプトを取得
    get script(): Script;
    // ステータス状態を取得
    get state(): State;
}

export class State {
    // ステータス状態をコピーして、生のデータを取得します
    get copy(): StateType;
    // 特定のプロパティをセットできます
    set(key: string, value: any): EventOf<'changeState'>;
}

export class Script {
    // スクリプトの生データをコピーして取得
    get scripts(): ScriptData[];
    // 特定のイベントをフィルタリングして取得
    getScriptsFilteredByType(type: GameEvent['type']): ScriptData[];
    // 特定のスクリプト名で取得
    getScriptByName(name: string): ScriptData['scripts'];
    // 特定のスクリプトを変更します。nameが一意のキーとなり、重複する場合置き換えられます。
    changeScript(script: ScriptData): EventOf<'changeScript'> | null;
    // 特定のスクリプトを削除します。
    removeScript(name: string): EventOf<'removeScript'> | null;
}

export class Game extends GameObject {
    // ゲームに参加しているプレイヤーのインスタンスのリストを取得
    get players(): Player[];
    // ゲームに登録されているカードを取得
    get cards(): Card[];
    // ゲームにプレイヤーを参加させます
    registerPlayer(player: Player): void;
    // カードをゲームに登録し、ランダム抽選に加えます
    registerCard(card: Card): void;
    // プレイヤーをゲームから除外します
    unregisterPlayer(player: Player): void;
    // カードをゲームから除外し、抽選から外します
    unregisterCard(card: Card): void;
    // ランダム抽選されたカードをクローンしたインスタンスを取得します
    weightedRandomClonedCard(): Card | null;
}

export class Player extends GameObject {
    // 手札のカードのインスタンスのリストを取得します
    get inventory(): Card[];
    // ステータスを取得します
    get hp(): number;
    get mp(): number;
    get sanity(): number; // sanityが0以下になると、狂乱に陥り、ランダムな行動をするようになります

    // ステータスを変更するメソッド
    heal(amount: number, ref?: number): EventOf<'heal'>;
    damage(amount: number, ref?: number): EventOf<'damage'>; // damageはattackではないので、強制ダメージなどで利用されます
    recharge(amount: number, ref?: number): EventOf<'recharge'>;
    discharge(amount: number, ref?: number): EventOf<'discharge'>;
    givesanity(amount: number, ref?: number): EventOf<'givesanity'>;
    takesanity(amount: number, ref?: number): EventOf<'takesanity'>;
    // ランダム抽選されたカードを手札に追加します
    draw(): EventOf<'draw'> | null;
    // 特定のカード参照を利用し、インベントリに追加します
    addInventory(cardRef: number): EventOf<'addcard'>;
    // 特定のカードをインベントリから削除します
    removeFromInventory(cardRef: number): EventOf<'removecard'> | null;
    // 特定のプレイヤーに攻撃をすることができます
    attackDamage(amount: number, targetRef: number, usingCardRef: number): EventOf<'attack'> | null;
    // 特定のカードを使用させられます
    // 注意: ホストによるゲームの実装によっては、手札にないカードは使用不可になっている可能性があります
    // 注意: 手札に一度追加してから使用することを推奨します
    use(cardRef: number, targetRef: number): EventOf<'use'> | null;
}

export class Card extends GameObject {
    // カードが抽選される重みを取得します
    get weight(): number;
    // カードをクローンします
    clone(): Card;
}

/*
# LLM向け、スクリプト作成ドキュメント

*/
