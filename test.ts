import * as CardGame from './game';

const manager = new CardGame.GameManager((event: CardGame.GameEvent) => {
    console.log("callback called", event);
});

const playerArgments = {
    hp: 1000,
    mp: 20,
    sanity: 0,
    script: [{
        name: 'default',
        scripts: {
            'damage': {
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
                    after: `api.unref(api.value.targetRef).`
                }
            }
        }],
        weight: 5 // アイテム取得重み
    }
]

const player = manager.createPlayer(playerArgments);
manager.game.registerPlayer(player);

// 自分にダメージ
player.damage(200, player.id);
player.draw();