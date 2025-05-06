import * as CardGame from './game';

const manager = new CardGame.GameManager((event: CardGame.GameEvent) => {
    if (event.type === "registerplayer") {
        console.log("copy from event", event.value.object.state)
    }
});

const gameScript = {
    name: 'default',
    scripts: {
        use: {
            after: `
                const player = api.unref(api.value.playerRef);
                const cardId = api.value.usingCardRef;
                if (player.inventory.map(card => card.id).includes(cardId)) {
                    player.removeFromInventory(cardId);
                    console.log("使用されたカードをインベントリから削除しました。")
                }
            `,
        },
    },
};

const playerArgments = {
    hp: 1000,
    mp: 20,
    sanity: 0,
    script: [
        {
            name: 'default',
            scripts: {
                damage: {
                    before: 'api.unref(api.value.targetRef).addInventory(api.createCard({}).id); console.log(api.unref(api.value.targetRef).inventory.map(card => card.id))',
                    after: "console.log(`player damaged ${api.value.amount}`); console.log(api.unref(api.value.targetRef).hp + ' is owner hp')",
                },
            },
        },
    ],
};

const cardList = [
    // --- 単純な攻撃カード（5枚） ---
    {
        state: { name: 'Strike' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const target = api.unref(api.value.targetRef);
            if (target) target.damage(10, api.value.playerRef);
          `,
                    },
                },
            },
        ],
        weight: 1,
    },
    {
        state: { name: 'Slash' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const target = api.unref(api.value.targetRef);
            if (target) target.damage(15, api.value.playerRef);
          `,
                    },
                },
            },
        ],
        weight: 1,
    },
    {
        state: { name: 'Punch' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const target = api.unref(api.value.targetRef);
            if (target) target.damage(8, api.value.playerRef);
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Kick' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const target = api.unref(api.value.targetRef);
            if (target) target.damage(12, api.value.playerRef);
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Elbow Bash' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const target = api.unref(api.value.targetRef);
            if (target) target.damage(11, api.value.playerRef);
          `,
                    },
                },
            },
        ],
    },

    // --- 特殊な攻撃カード（2枚） ---
    {
        state: { name: 'Counter Strike' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            const card = api.unref(api.value.usingCardRef);
            if (!player || !card) return;
            const cardScript = card.script.getScriptByName('default');
            if (!cardScript) return;
            const dmgScript = cardScript.scripts.damage?.after;
            if (!dmgScript) return;
            player.script.changeScript({
              name: 'counterEffect',
              scripts: {
                damage: { after: dmgScript }
              }
            });
          `,
                    },
                    damage: {
                        after: `
            const self = api.unref(api.selfRef);
            const attacker = api.unref(api.value.sourceRef);
            if (self && attacker) {
              attacker.damage(api.value.amount * 2, self.id);
            }
            api.unref(api.selfRef).script.removeScript('counterEffect');
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Double Edge' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            const target = api.unref(api.value.targetRef);
            if (player && target) {
              target.damage(25, player.id);
              player.damage(10, -1);
            }
          `,
                    },
                },
            },
        ],
    },

    // --- MPを利用する攻撃カード（3枚） ---
    {
        state: { name: 'Fireball' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            const target = api.unref(api.value.targetRef);
            if (player && player.mp >= 5 && target) {
              player.discharge(5);
              target.damage(30, player.id);
            } else {
              api.isCanceled = true;
            }
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Ice Lance' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            const target = api.unref(api.value.targetRef);
            if (player && player.mp >= 3 && target) {
              player.discharge(3);
              target.damage(20, player.id);
            } else {
              api.isCanceled = true;
            }
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Lightning Bolt' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            const target = api.unref(api.value.targetRef);
            if (player && player.mp >= 7 && target) {
              player.discharge(7);
              target.damage(35, player.id);
            } else {
              api.isCanceled = true;
            }
          `,
                    },
                },
            },
        ],
    },

    // --- 回復系カード（3枚） ---
    {
        state: { name: 'Heal Potion' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            if (player) player.heal(25);
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Mana Elixir' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            if (player) player.recharge(15);
          `,
                    },
                },
            },
        ],
    },
    {
        state: { name: 'Soothing Incense' },
        script: [
            {
                name: 'default',
                scripts: {
                    use: {
                        before: `
            const player = api.unref(api.value.playerRef);
            if (player) player.givesanity(10);
          `,
                    },
                },
            },
        ],
    },
];

for (const card of cardList) {
    const cardInstance = manager.createCard(card);
    manager.game.registerCard(cardInstance);
}

manager.game.script.changeScript(gameScript);
const player = manager.createPlayer(playerArgments);
manager.game.registerPlayer(player);
console.log("copy from player", player.state.copy)