import { StateManager } from "./game";

const manager = new StateManager({});
manager.onChange((patch) => {
    console.log("applyed patches", patch);
})

// 仮想プレイヤー
const player = {
    get state() {
        return manager.getStateProxy();
    }
}

player.state.effects.poisoned = true;
console.log(player.state.effects)