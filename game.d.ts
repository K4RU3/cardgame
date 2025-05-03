// イベントタイプごとの値の型を定義
type GameEventMap = {
    reset: {};
    registerobject: { id: number; object: GameObject };
    registerplayer: { id: number; object: Player };
    registercard: { id: number; object: Card };
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

type EventOf<T extends keyof GameEventMap> = {
    type: T;
    value: GameEventMap[T];
};

// 各イベントを統一した GameEvent 型としてユニオンに変換
type GameEvent = {
    [K in keyof GameEventMap]: { type: K; value: GameEventMap[K] };
}[keyof GameEventMap];

// スクリプトのAPI
// スクリプト内では、apiオブジェクトを使用してアクセス
type ScriptAPI = {
    // beforeスクリプトでapi.isCanceledをtrueにすると、後続のスクリプトの実行を中止し、イベントをキャンセルする
    isCanceled: boolean;
    // gameオブジェクトを取得
    readonly game: Game;
    type: GameEvent['type'];
    // GameObjectのidを渡して、インスタンスを取得
    unref: (ref: number) => GameObject | null;
    value: GameEvent['value'];
    // スクリプトを保持するインスタンスのid
    selfRef: number;
    // 新規カードを作成
    // カードを作成しても、他プレイヤーにドローされることはない
    // 新しくゲームに登録することも可能
    createCard: (arg?: { state?: StateType; script?: ScriptData[]; weight?: number }) => Card;
};

interface GameManager {
    getById(id: number): GameObject | null;
    readonly game: Game;
}

type StateType = { [key: string]: any };
// nameを一意のキーとしたスクリプト
type ScriptData = {
    name: string;
    scripts: Partial<
        Record<
            GameEvent['type'],
            {
                // beforeスクリプトでは、apiの各値を変更可能で、イベント内容を変更可能
                before?: string;
                // afterスクリプトではapiは読み取り専用
                after?: string;
            }
        >
    >;
};

declare class State {
    // ステータスのコピーを取得
    get copy(): StateType;
    // ステータスの特定のキーの値を変更
    set(key: string, value: any): EventOf<'changeState'>;
}

declare class Script {
    // スクリプトのコピーを取得
    get scripts(): ScriptData[];
    // 特定のイベントでフィルタリング
    getScriptsFilteredByType(type: GameEvent['type']): ScriptData[];
    // 特定の名前でフィルタリング
    getScriptByName(name: string): ScriptData | null;
    // スクリプトの編集
    changeScript(script: ScriptData): EventOf<'changeScript'>;
    // スクリプトの削除
    removeScript(name: string): EventOf<'removeScript'>;
}

declare class GameObject {
    // インスタンスの一意のID
    get id(): number;
    // スクリプト
    get script(): Script;
    // ステータス
    get state(): State;
}

declare class Game extends GameObject {
    // 参加プレイヤーインスタンスのリスト
    get players(): Player[];
    // カードインスタンスのリスト
    get cards(): Card[];

    // 新しいプレイヤーをゲームに追加
    registerPlayer(player: Player);
    // 新しいカードをゲームのランダムでプレイヤーに配られるカードのリストに追加
    registerCard(card: Card);
    // ゲームに登録されたランダムなカードを取得
    // 1枚も登録されていないとnullを返す
    weightedRandomClonedCard(): Card | null;
}

declare class Player extends GameObject {
    // 所持カードのリスト
    get inventory(): Card[];
    get hp(): number;
    // 魔法などの攻撃にコストとして使用
    get mp(): number;
    // 正気度
    // 0以下になると強制的にランダムな行動を行う
    get sanity(): number;

    // ステータス変更メソッド
    // refには、ステータスを変更する要因となるプレイヤーの参照もしくは-1
    heal(amount: number, ref?: number): EventOf<'heal'>;
    // プレイヤーへの攻撃時にdamageを利用すると、attackスクリプトを飛ばして実行する
    damage(amount: number, ref?: number): EventOf<'damage'>;
    recharge(amount: number, ref?: number): EventOf<'recharge'>;
    discharge(amount: number, ref?: number): EventOf<'discharge'>;
    givesanity(amount: number, ref?: number): EventOf<'givesanity'>;
    takesanity(amount: number, ref?: number): EventOf<'takesanity'>;

    // ランダムなカードをゲームから取得してインベントリに追加
    draw(): EventOf<'draw'> | null;
    // 特定のカードを追加
    // ゲームに未登録でも追加可能
    addInventory(cardRef: number): EventOf<'addcard'>;
    // インベントリからカードを削除
    removeFromInventory(cardRef: number): EventOf<'removecard'> | null;
    // ほかのプレイヤーに攻撃をするメソッド
    // 使用するカードの参照を利用
    attackDamage(amount: number, targetRef: number, usingCardRef: number): EventOf<'attack'> | null;
    // カードを使用
    // 使用するカードの参照もしくは-1を指定
    use(cardRef: number, targetRef: number): EventOf<'use'> | null;
}

declare class Card extends GameObject {
    // カードの出現確立の重み
    get weight(): number;
    // カードのクローンを作成
    clone(): Card;
}

/*
# スクリプトドキュメント

このドキュメントは、ゲームにおけるカードスクリプト・カード定義形式の仕様を示します。  
LLMが正しくカードリストを生成するためのフォーマットも併記しています。

---

## 概要

- スクリプトはイベント駆動型で、`before`（編集可・キャンセル可能）／`after`（読み取り専用）のタイミングに **JavaScript** を記述。
- LLMは主に **カードリスト生成** を担当するため、カード定義形式とスクリプト構造の理解が必須。

---

## カード定義の基本形式

```ts
const cardList = [
  {
    state: { name: 'Item Name' },
    script: [
      {
        name: 'default',
        scripts: {
          use: {
            before: 'api.unref(api.value.attackerRef).attackDamage(20, api.value.targetRef, api.value.usingCardRef)'
          }
        }
      }
    ]
  },
  ...
];
```

- `state.name`: カード名  
- `script`: 発動スクリプト群（`ScriptData[]`）  
- `scripts.use.before`: 使用時の **JavaScript** 処理  

---

## ScriptData 型概要

```ts
type ScriptData = {
  name: string;
  scripts: Partial<Record<GameEvent['type'], {
    before?: string;
    after?: string;
  }>>;
}
```

---

## 利用可能 API（ScriptAPI）

| プロパティ            | 説明                                                         |
|-----------------------|--------------------------------------------------------------|
| `api.isCanceled`      | `before` で `true` → イベント中止                           |
| `api.type`            | イベントタイプ（例：`"use"`）                                |
| `api.value`           | イベント値オブジェクト                                       |
| `api.selfRef`         | このスクリプトを持つオブジェクトのID                         |
| `api.unref(id)`       | ID → `GameObject | null`                                     |
| `api.game`            | `Game` インスタンス                                         |
| `api.createCard({...})` | 新規 `Card` インスタンス生成（未登録）                     |

---

## 使用例

### Fireball（use → damage）

```ts
{
  state: { name: "Fireball" },
  script: [
    {
      name: "default",
      scripts: {
        use: {
          before: `
            const player = api.unref(api.value.playerRef);
            const target = api.unref(api.value.targetRef);
            if (target) {
              target.damage(30, player?.id ?? -1);
            }
          `
        }
      }
    }
  ]
}
```

### Heavy Attack（attack → cancel）

```ts
{
  state: { name: "Heavy Attack" },
  script: [
    {
      name: "default",
      scripts: {
        attack: {
          before: `
            const a = api.unref(api.value.attackerRef);
            if (a && a.mp < 10) api.isCanceled = true;
          `
        }
      }
    }
  ]
}
```

---

## 同期的なイベント結果取得例

各操作メソッドは発生したイベントオブジェクトを返します。  
これにより、`before` スクリプトで変更された最終値を呼び出し元で即座に取得できます。

```ts
// Player B が Player A を攻撃
const ev = playerB.attackDamage(100, playerA.id, cardRef);
// ev.value の targetRef／amount は before フック後の最終値
// 例：リフレクトで targetRef が B に、amount が 200 など動的変更可能
```

---

## 注意点

- **スクリプトはすべて JavaScript**  
- `api.unref(...)` の戻り値は `null` 可能 → nullチェック必須  
- `api.createCard(...)` で生成したカードは自動登録されない → `game.registerCard(...)` を使用  
- `before` 内は編集可／キャンセル可、`after` 内は読み取り専用  

---

## まとめ：LLMが出力すべき構造

1. `state.name` が必須  
2. `script` 配列には最低限 `use` または `attack` のスクリプト  
3. スクリプトは **JavaScript** 文字列で、`before`／`after` に記述  
4. 同期的に返るイベントオブジェクトで動的変更も追跡可能  
*/