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
以下のドキュメントは、LLM（大規模言語モデル）に**カード情報の構造を理解させ、正確な形式でカードを出力させる**ためのチュートリアルです。LLM向けの設計指針として活用されます。

---

## はじめに

このチュートリアルでは、LLMが生成すべき**カード情報オブジェクト**の構造・記述規則・スクリプト設計などを明示します。LLMは以下の仕様に従って、ゲームに使用されるカードをJSON形式で出力します。

---

## 1. カード情報フォーマット（LLM出力形式）

出力は以下の形式のJSON配列とします：

```ts
{
  name: string;
  description: string;
  weight: number;
  scripts: ScriptData;
}[]
```

* `name`: カード名（日本語）
* `description`: UI表示向けの効果説明（改行可）
* `weight`: ゲーム抽選時の重み（1〜10の整数）
* `scripts`: ScriptData型のスクリプト情報（詳細は次項）

> ※ LLMは、必ずこの形式に合致したJSON文字列を出力すること。

---

## 2. ScriptDataの構造と命名規則

```ts
interface ScriptData {
  name: string; // 通常 "default" を指定
  scripts: Partial<
    Record<
      GameEvent['type'],
      { before?: string; after?: string }
    >
  >;
}
```

### スクリプト命名規則

* 通常のスクリプト名は必ず `"default"` を指定すること。
* 特別な処理が追加されている場合のみ、`名前空間:名前` 形式で記述する（例: `"counter:reflect"`）。

### イベント処理の記述例

```ts
scripts: {
  name: "default",
  scripts: {
    use: {
      after: "api.useAttack(200)"
    }
  }
}
```

* `before` はイベント発生直前に実行されるコード。
* `after` はイベント直後に実行されるコード。

LLMはJavaScript構文を記述する。関数呼び出しには `api.` から始まるインターフェースを用いる。

---

## 3. ScriptAPI（スクリプト内で利用可能なAPI）

スクリプト中で使用可能な `api` のインターフェースは以下の通り：

```ts
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
```

---

## 4. 出力例

以下にLLMが出力すべきカードデータの例を示します。

### 1. 単純攻撃カード

```ts
{
  name: "迫撃砲",
  description: "大きく湾曲した弾道で、敵を一掃する兵器。\n対象に200ダメージを与える。",
  weight: 1,
  scripts: {
    name: "default",
    scripts: {
      use: {
        after: "api.useAttack(200)"
      }
    }
  }
}
```

### 2. 回復アイテム

```ts
{
  name: "薬草",
  description: "そこらへんに生えてた薬草。とある国では、これを使った医学が発展しているらしい。\n使用者のHPを150回復する。",
  weight: 8,
  scripts: {
    name: "default",
    scripts: {
      use: {
        after: "api.useState(150, 'heal')"
      }
    }
  }
}
```

### 3. 魔術（MP消費）

```ts
{
  name: "ファイアボール",
  description: "多くの一般的な魔術教本に載っている初級炎魔法。\nMP2を消費し、対象に200ダメージを与える。",
  weight: 1,
  scripts: {
    name: "default",
    scripts: {
      use: {
        after: "api.useTryMp(2, () => {api.useAttack(200)})"
      }
    }
  }
}
```

### 4. カウンター技

```ts
{
  name: "居合の構え",
  description: "とある流派に伝わる剣技。敵の攻撃を待ち、即座に反撃する。\nこのカードを使用後、次に受けるダメージを無効化し、1.5倍にして相手に返す。",
  weight: 1,
  scripts: {
    name: "default",
    scripts: {
      use: {
        after: "const player = api.unref(api.value.playerRef); const counterScript = api.unref(api.value.usingCardRef).script.getScriptsFilteredByType('damage')[0]; player.script.changeScript('counter', counterScript)"
      },
      damage: {
        before: "api.isCanceled = true; const selfPlayer = api.unref(api.value.targetRef); selfPlayer.attackDamage(Math.floor(api.value.amount * 1.5), api.value.sourceRef, -1)"
      }
    }
  }
}
```

---

## 5. 出力ルール（LLM向け）

LLMは以下のルールに従ってカードを出力すること：

* 出力はJSON形式で、カードオブジェクト配列とする（整形済み）
* 各カードは `name`、`description`、`weight`、`scripts` を持つ
* `scripts.name` は原則 `"default"` を指定（例外時は `名前空間:名前`）
* `scripts.scripts` の各イベントキーに応じた `before` / `after` を使う
* JavaScript構文で、提供されたAPI（例: `api.useAttack()`）を用いる
* カードの説明文は日本語で簡潔・わかりやすく記述すること

---

## 6. 推奨プロンプト例

```text
あなたはゲームのカード生成エンジンです。
以下の形式で、新たなカード情報を3件生成してください：

【出力形式】
[
  {
    name: string,
    description: string,
    weight: number,
    scripts: ScriptData
  },
  …
]

【条件】
- name: 日本語名（例: "炎の剣"）
- description: 効果を簡潔に日本語で（\nによる改行可）
- weight: 1〜10の整数（低いほど希少）
- scripts.name: 原則 "default"
- scripts: 使用イベントなどに対応した処理を記述
```

---

## 7. 注意点（LLMが守るべき）

* JSONの構文エラーがないよう整形を行うこと
* すべてのカードに `scripts` 情報が含まれること
* `weight` に小数や0は使わない（1〜10の整数のみ）
* 不要なプロパティを含めない（例: id, typeなど）

---

## まとめ

このチュートリアルにより、LLMはカード情報を正確に構造化して出力できます。これをもとにゲーム内登録や自動テストなどに活用可能です。

開発者は、この構造に基づいてLLMの出力を評価し、エラーなくデータを統合することが可能となります。
*/
