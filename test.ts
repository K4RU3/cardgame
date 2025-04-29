import * as CardGame from './game';

const manager = new CardGame.GameManager((event: CardGame.GameEvent) => {
    console.log("callback called", event);
});

const gameScript = {
    name: 'default',
    scripts: {
        'use': {
            after: `
                const player = api.unref(api.value.playerRef);
                const cardId = api.value.usingCardRef;
                if (player.inventory.map(card => card.id).includes(cardId)) {
                    player.removeFromInventory(cardId);
                    console.log("使用されたカードをインベントリから削除しました。")
                }
            `
        }
    }
}

const playerArgments = {
    hp: 1000,
    mp: 20,
    sanity: 0,
    script: [{
        name: 'default',
        scripts: {
            'damage': {
                before: "api.unref(api.value.targetRef).addInventory(api.createCard({}).id); console.log(api.unref(api.value.targetRef).inventory.map(card => card.id))",
                after: "console.log(`player damaged ${api.value.amount}`); console.log(api.unref(api.value.targetRef).hp + ' is owner hp')",
            }
        }
    }]
}

const cardList = [
    {
        state: {
            name: 'Item1',
        },
        script: [{
            name: 'default',
            scripts: {
                'use': {
                    after: `api.unref(api.value.targetRef).attackDamage(100, api.value.playerRef, api.value.usingCardRef)`
                }
            }
        }],
        weight: 5 // アイテム取得重み
    }
]

for (const card of cardList) {
    const cardInstance = manager.createCard(card);
    manager.game.registerCard(cardInstance);
}

manager.game.script.changeScript(gameScript);

const player = manager.createPlayer(playerArgments);
manager.game.registerPlayer(player);

player.damage(10, player.id);