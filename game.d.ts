export type GameEvent =
    | { type: 'registerobject'; value: { id: number; object: GameObject } }
    | { type: 'gamestart'; value: {} }
    | { type: 'gameend'; value: { winners: string[] } }
    | { type: 'turnstart'; value: { playerRef: number } }
    | { type: 'turnend'; value: { playerRef: number } }
    | { type: 'attack'; value: { attackerRef: number; targetRef: number, usingCardRef: number } }
    | { type: 'use'; value: { playerRef: number; usingCardRef: number, targetRef: number } }
    | { type: 'draw', value: { playerRef: number; cardRef: number } }
    | { type: 'addcard', value: { playerRef: number; cardRef: number } }
    | { type: 'removecard', value: { playerRef: number; cardRef: number } }
    | { type: 'heal' | 'damage' | 'recharge' | 'discharge' | 'givesanity' | 'takesanity', value: { targetRef: number; sourceRef: number, amount: number } }
    | { type: 'changeState'; value: { stateParentRef: number; key: string; value: any } }
    | { type: 'changeScript'; value: { scriptParentRef: number, script: ScriptData } }
    | { type: 'removeScript'; value: { scriptParentRef: number, name: string } }
    | { type: 'custom'; value: { name: string; value: any } };

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
    createCard: (arg?: {
        state?: StateType, script?: ScriptData[], weight?: number
    }) => Card;
};

type StateType = { [key: string]: any };
// nameを一意のキーとしたスクリプト
type ScriptData = {
    name: string;
    scripts: Partial<Record<GameEvent['type'], {
        // beforeスクリプトでは、apiの各値を変更可能で、イベント内容を変更可能
        before?: string;
        // afterスクリプトではapiは読み取り専用
        after?: string;
    }>>;
}

declare class State {
    // ステータスのコピーを取得
    get copy(): StateType;
    // ステータスの特定のキーの値を変更
    set(key: string, value: any): void;
}

declare class Script {
    // スクリプトのコピーを取得
    get scripts(): ScriptData[];
    // 特定のイベントでフィルタリング
    getScriptsFilteredByType(type: GameEvent['type']): ScriptData[];
    // 特定の名前でフィルタリング
    getScriptByName(name: string): ScriptData | null;
    // スクリプトの編集
    changeScript(script: ScriptData): void;
    // スクリプトの削除
    removeScript(name: string): void;
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
    heal(amount: number, ref?: number): void;
    // プレイヤーへの攻撃時にdamageを利用すると、attackスクリプトを飛ばして実行する
    damage(amount: number, ref?: number): void;
    recharge(amount: number, ref?: number): void;
    discharge(amount: number, ref?: number): void;
    givesanity(amount: number, ref?: number): void;
    takesanity(amount: number, ref?: number): void;
    
    // ランダムなカードをゲームから取得してインベントリに追加
    draw(): number | null;
    // 特定のカードを追加
    // ゲームに未登録でも追加可能
    addInventory(cardRef: number): void;
    // インベントリからカードを削除
    removeFromInventory(cardRef: number): void;
    // ほかのプレイヤーに攻撃をするメソッド
    // 使用するカードの参照を利用
    attackDamage(amount: number, targetRef: number, usingCardRef: number): void;
    // カードを使用
    // 使用するカードの参照もしくは-1を指定
    use(cardRef: number, targetRef: number): void;
}

declare class Card extends GameObject {
    // カードの出現確立の重み
    get weight(): number;
    // カードのクローンを作成
    clone(): Card;
}

/*
# スクリプトドキュメント

このドキュメントは、ゲームにおけるカードスクリプトおよびカード定義形式についての仕様を示します。  
また、LLMに対して正しくカードリストを生成させるための記述フォーマットを明確にします。

---

## 概要

このゲームでは、カードやキャラクターに任意のスクリプト（効果）を付与できます。  
スクリプトはイベント駆動型で、イベントの `before` または `after` タイミングに応じた処理を記述できます。

**スクリプトの記述形式は JavaScript です。**  
すべてのスクリプト文字列は JavaScript 文として `eval` されるため、文法や記述には注意してください。

LLMは主に **カードリストの生成** を担当します。  
そのため、**カード定義形式とスクリプト構造の理解**が不可欠です。

---

## カード定義の基本形式（LLM生成用）

```ts
const cardList = [
  {
    state: {
      name: 'Item Name' // カード名（自由記述）
    },
    script: [
      {
        name: 'default', // 任意のスクリプト名
        scripts: {
          'use': {
            before: 'api.unref(api.value.attackerRef).attackDamage(20, api.value.targetRef, api.value.usingCardRef)'
          }
        }
      }
    ]
  },
  ...
];
```

### 解説

- `state.name`: カードの名称。
- `script`: 発動するスクリプト群（`ScriptData[]`）。
- `scripts.use.before`: 使用時に発火するスクリプト（**JavaScript文字列**で記述）。

---

## ScriptData 型概要

```ts
type ScriptData = {
  name: string;
  scripts: Partial<Record<GameEvent['type'], {
    before?: string; // JavaScriptとして実行される
    after?: string;  // JavaScriptとして実行される
  }>>;
}
```

- 各イベントに対応する処理を `before` または `after` に記述。
- 処理はすべて **JavaScript**。

---

## 利用可能な API（ScriptAPI）

| プロパティ | 説明 |
|------------|------|
| `api.isCanceled` | `before` スクリプトで `true` にするとイベントがキャンセルされる |
| `api.type` | 現在発生しているイベントタイプ（例：`"use"`） |
| `api.value` | イベントに付随する情報（対象IDなど） |
| `api.selfRef` | このスクリプトを持つインスタンスのID |
| `api.unref(ref: number)` | オブジェクトIDをインスタンスに変換（Player/Cardなど） |
| `api.game` | 現在のゲームオブジェクト |
| `api.createCard({...})` | 新しいカードインスタンスを作成（未登録） |

---

## 使用例

### 火球（fireball）

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

### 魔力チェック付きの重攻撃

```ts
{
  state: { name: "Heavy Attack" },
  script: [
    {
      name: "default",
      scripts: {
        attack: {
          before: `
            const attacker = api.unref(api.value.attackerRef);
            if (attacker && attacker.mp < 10) {
              api.isCanceled = true;
            }
          `
        }
      }
    }
  ]
}
```

---

## 注意点

- **スクリプトはすべてJavaScriptで記述すること。**
- `api.unref(...)` の戻り値は null の可能性があるため、使用時は null チェックを行うこと。
- `api.createCard(...)` で生成したカードは登録されない。必要に応じて `game.registerCard(...)` を行う。
- `before` 内では `api.value` を編集可能、`after` 内では読み取り専用。

---

## まとめ：LLMが出力すべき構造

LLMが生成するカードリストは、以下の構造を満たす必要があります：

- `state.name` が設定されている
- `script` 配列が存在し、最低限 `use` または `attack` などのイベントスクリプトが含まれている
- スクリプトは JavaScript として記述され、`before` または `after` のタイミングに処理を書く

---
*/