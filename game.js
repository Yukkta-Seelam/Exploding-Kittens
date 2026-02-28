/**
 * Exploding Kittens - Web App
 * Pass-and-play mode: players take turns on the same device
 */

// Card definitions
const CARD_TYPES = {
    EXPLODING: { id: 'exploding', name: 'Exploding Kitten', type: 'exploding', cssClass: 'card-exploding', emoji: '💥' },
    DEFUSE: { id: 'defuse', name: 'Defuse', type: 'defuse', cssClass: 'card-defuse', emoji: '🛡️' },
    SKIP: { id: 'skip', name: 'Skip', type: 'action', cssClass: 'card-skip', emoji: '⏭️' },
    ATTACK: { id: 'attack', name: 'Attack', type: 'action', cssClass: 'card-attack', emoji: '⚔️' },
    SEE_FUTURE: { id: 'see_future', name: 'See the Future', type: 'action', cssClass: 'card-see-future', emoji: '🔮' },
    SHUFFLE: { id: 'shuffle', name: 'Shuffle', type: 'action', cssClass: 'card-shuffle', emoji: '🔀' },
    NOPE: { id: 'nope', name: 'Nope', type: 'action', cssClass: 'card-nope', emoji: '🙅' },
    FAVOR: { id: 'favor', name: 'Favor', type: 'action', cssClass: 'card-favor', emoji: '🙏' },
    CAT_BEARD: { id: 'cat_beard', name: 'Beard Cat', type: 'cat', cssClass: 'card-cat', emoji: '🐱', catType: 'beard' },
    CAT_CATTERMELON: { id: 'cat_cattermelon', name: 'Cattermelon', type: 'cat', cssClass: 'card-cat', emoji: '🍉', catType: 'cattermelon' },
    CAT_HAIRY: { id: 'cat_hairy', name: 'Hairy Potato', type: 'cat', cssClass: 'card-cat', emoji: '🥔', catType: 'hairy' },
    CAT_RAINICORN: { id: 'cat_rainicorn', name: 'Rain-icorn', type: 'cat', cssClass: 'card-cat', emoji: '🌈', catType: 'rainicorn' },
    CAT_TACO: { id: 'cat_taco', name: 'Taco Cat', type: 'cat', cssClass: 'card-cat', emoji: '🌮', catType: 'taco' },
};

// Deck composition: Base (2-5 players) and Party (2-10 players)
const BASE_DECK = [
    ...Array(4).fill(CARD_TYPES.EXPLODING),
    ...Array(6).fill(CARD_TYPES.DEFUSE),
    ...Array(4).fill(CARD_TYPES.SKIP),
    ...Array(4).fill(CARD_TYPES.ATTACK),
    ...Array(5).fill(CARD_TYPES.SEE_FUTURE),
    ...Array(4).fill(CARD_TYPES.SHUFFLE),
    ...Array(5).fill(CARD_TYPES.NOPE),
    ...Array(4).fill(CARD_TYPES.FAVOR),
    ...Array(5).fill(CARD_TYPES.CAT_BEARD),
    ...Array(5).fill(CARD_TYPES.CAT_CATTERMELON),
    ...Array(5).fill(CARD_TYPES.CAT_HAIRY),
    ...Array(5).fill(CARD_TYPES.CAT_RAINICORN),
    ...Array(5).fill(CARD_TYPES.CAT_TACO),
];

function createPartyDeck(playerCount) {
    const scale = Math.ceil(playerCount / 5);
    const deck = [];
    BASE_DECK.forEach(card => {
        for (let i = 0; i < scale; i++) {
            deck.push(card);
        }
    });
    return deck;
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Game State
let gameState = {
    players: [],
    playerNames: [],
    drawPile: [],
    discardPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    attacksPending: 0,
    playerCount: 2,
    gameMode: 'base',
};

// DOM refs
const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('game');
const winnerScreen = document.getElementById('winner');
const gameModeSelect = document.getElementById('game-mode');
const playerCountSelect = document.getElementById('player-count');
const playerNamesDiv = document.getElementById('player-names');
const startBtn = document.getElementById('start-btn');
const backBtn = document.getElementById('back-btn');
const drawBtn = document.getElementById('draw-btn');
const drawPileEl = document.getElementById('draw-pile');
const pileCountEl = document.getElementById('pile-count');
const handEl = document.getElementById('hand');
const playersAreaEl = document.getElementById('players-area');
const turnIndicatorEl = document.getElementById('turn-indicator');
const currentPlayerLabel = document.getElementById('current-player-label');
const modalOverlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const showRulesBtn = document.getElementById('show-rules');
const rulesModal = document.getElementById('rules-modal');
const closeRulesBtn = document.getElementById('close-rules');
const playAgainBtn = document.getElementById('play-again');
const winnerMessage = document.getElementById('winner-message');

// Player count options based on mode
function updatePlayerCountOptions() {
    const mode = gameModeSelect.value;
    const select = playerCountSelect;
    select.innerHTML = '';
    const maxPlayers = mode === 'party' ? 10 : 5;
    for (let i = 2; i <= maxPlayers; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i} players`;
        select.appendChild(opt);
    }
}

function updatePlayerNameInputs() {
    const count = parseInt(playerCountSelect.value, 10);
    playerNamesDiv.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'player-name-group';
        div.innerHTML = `<input type="text" placeholder="Player ${i + 1} name" value="Player ${i + 1}" maxlength="20">`;
        playerNamesDiv.appendChild(div);
    }
}

gameModeSelect.addEventListener('change', () => {
    updatePlayerCountOptions();
    updatePlayerNameInputs();
});

playerCountSelect.addEventListener('change', updatePlayerNameInputs);

// Initialize
updatePlayerCountOptions();
updatePlayerNameInputs();

// Create card element
function createCardElement(card, index, playable = false) {
    const el = document.createElement('div');
    el.className = `card ${card.cssClass} ${!playable ? 'disabled' : ''}`;
    el.dataset.index = index;
    el.innerHTML = `<span>${card.emoji}</span><span>${card.name}</span>`;
    return el;
}

// Setup game
function setupGame() {
    const playerCount = parseInt(playerCountSelect.value, 10);
    const mode = gameModeSelect.value;
    const names = Array.from(playerNamesDiv.querySelectorAll('input')).map(i => i.value.trim() || 'Player');

    gameState = {
        players: [],
        playerNames: names.slice(0, playerCount),
        drawPile: [],
        discardPile: [],
        currentPlayerIndex: 0,
        direction: 1,
        attacksPending: 0,
        playerCount,
        gameMode: mode,
    };

    // Build deck
    let deck = mode === 'party' ? createPartyDeck(playerCount) : [...BASE_DECK];
    deck = deck.filter(c => c.id !== 'exploding' && c.id !== 'defuse');

    // Give each player 1 defuse
    const defuseCount = Math.min(6, playerCount + 2);
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({
            hand: [CARD_TYPES.DEFUSE],
            eliminated: false,
        });
    }

    // Deal 7 cards each (minus the defuse = 6 more)
    const cardsPerPlayer = 7;
    for (let i = 0; i < playerCount; i++) {
        for (let j = 1; j < cardsPerPlayer; j++) {
            if (deck.length > 0) {
                const idx = Math.floor(Math.random() * deck.length);
                gameState.players[i].hand.push(deck.splice(idx, 1)[0]);
            }
        }
    }

    // Add defuses to deck for 4-5 players
    const defusesForDeck = mode === 'party' ? Math.min(10, defuseCount - playerCount) : (playerCount >= 4 ? 4 : 2);
    for (let i = 0; i < defusesForDeck && deck.length > 0; i++) {
        const idx = Math.floor(Math.random() * deck.length);
        deck.splice(idx, 0, CARD_TYPES.DEFUSE);
    }

    // Add exploding kittens (N-1)
    const explodingCount = playerCount - 1;
    for (let i = 0; i < explodingCount; i++) {
        deck.push(CARD_TYPES.EXPLODING);
    }

    gameState.drawPile = shuffle(deck);
    renderGame();
    lobby.classList.remove('active');
    gameScreen.classList.add('active');
}

// Get next alive player
function getNextPlayer(fromIndex) {
    let idx = (fromIndex + gameState.direction + gameState.playerCount) % gameState.playerCount;
    let attempts = 0;
    while (gameState.players[idx].eliminated && attempts < gameState.playerCount) {
        idx = (idx + gameState.direction + gameState.playerCount) % gameState.playerCount;
        attempts++;
    }
    return idx;
}

// Render game UI
function renderGame() {
    pileCountEl.textContent = gameState.drawPile.length;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const name = gameState.playerNames[gameState.currentPlayerIndex];

    turnIndicatorEl.textContent = `${name}'s Turn`;
    currentPlayerLabel.textContent = `${name}'s Hand`;

    // Opponents
    playersAreaEl.innerHTML = '';
    for (let i = 0; i < gameState.playerCount; i++) {
        if (i === gameState.currentPlayerIndex) continue;
        if (gameState.players[i].eliminated) continue;
        const opp = document.createElement('div');
        opp.className = 'opponent-info';
        opp.innerHTML = `
            <div class="opponent-name">${gameState.playerNames[i]}</div>
            <div class="opponent-cards">
                ${gameState.players[i].hand.map(() => '<div class="opponent-card">?</div>').join('')}
            </div>
        `;
        playersAreaEl.appendChild(opp);
    }

    // Current player hand
    handEl.innerHTML = '';
    currentPlayer.hand.forEach((card, idx) => {
        const playable = canPlayCard(card, idx);
        const el = createCardElement(card, idx, playable);
        if (playable) {
            el.addEventListener('click', () => playCard(idx));
        }
        handEl.appendChild(el);
    });

    drawBtn.disabled = false;
}

function canPlayCard(card, index) {
    if (card.type === 'exploding') return false;
    if (card.id === 'defuse') return false; // Only used when drawing exploding
    if (card.type === 'action') return true;
    if (card.type === 'cat') {
        const hand = gameState.players[gameState.currentPlayerIndex].hand;
        const sameCats = hand.filter(c => c.type === 'cat' && c.catType === card.catType);
        return sameCats.length >= 2;
    }
    return false;
}

// Show modal
function showModal(title, contentHtml, onClose) {
    modalTitle.textContent = title;
    modalContent.innerHTML = contentHtml;
    modalOverlay.classList.remove('hidden');
    const close = () => {
        modalOverlay.classList.add('hidden');
        if (onClose) onClose();
    };
    modalClose.onclick = close;
}

// Play a card
function playCard(index) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const card = player.hand[index];

    if (card.type === 'cat') {
        const sameCats = player.hand.filter(c => c.type === 'cat' && c.catType === card.catType);
        if (sameCats.length === 2) {
            playCatCombo(2, index);
        } else if (sameCats.length >= 3) {
            playCatCombo(3, index);
        }
        return;
    }

    if (card.id === 'skip') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        if (gameState.attacksPending > 0) {
            gameState.attacksPending--;
            if (gameState.attacksPending === 0) advanceTurn();
        } else {
            advanceTurn();
        }
        renderGame();
        return;
    }

    if (card.id === 'attack') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        gameState.attacksPending = (gameState.attacksPending || 0) + 2;
        advanceTurn();
        renderGame();
        return;
    }

    if (card.id === 'see_future') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        const top3 = gameState.drawPile.slice(0, 3);
        const html = top3.map(c => `<div class="card ${c.cssClass}">${c.emoji} ${c.name}</div>`).join('');
        showModal('See the Future', html);
        renderGame();
        return;
    }

    if (card.id === 'shuffle') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        gameState.drawPile = shuffle(gameState.drawPile);
        advanceTurn();
        renderGame();
        return;
    }

    if (card.id === 'favor') {
        const targets = [];
        for (let i = 0; i < gameState.playerCount; i++) {
            if (i !== gameState.currentPlayerIndex && !gameState.players[i].eliminated && gameState.players[i].hand.length > 0) {
                targets.push({ index: i, name: gameState.playerNames[i] });
            }
        }
        if (targets.length === 0) {
            player.hand.splice(index, 1);
            gameState.discardPile.push(card);
            advanceTurn();
        } else {
            const html = targets.map(t => `<button class="btn" data-target="${t.index}">${t.name}</button>`).join('');
            showModal('Choose player to take a card from', html, () => {});
            modalContent.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const targetIdx = parseInt(btn.dataset.target, 10);
                    const targetHand = gameState.players[targetIdx].hand;
                    const cardIdx = Math.floor(Math.random() * targetHand.length);
                    const taken = targetHand.splice(cardIdx, 1)[0];
                    player.hand.push(taken);
                    player.hand.splice(player.hand.indexOf(card), 1);
                    gameState.discardPile.push(card);
                    modalOverlay.classList.add('hidden');
                    advanceTurn();
                    renderGame();
                };
            });
        }
        renderGame();
        return;
    }

    if (card.id === 'nope') {
        // Nope is typically played in response - for simplicity we allow playing it to discard (house rule: can discard nope)
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        advanceTurn();
        renderGame();
        return;
    }
}

function playCatCombo(count, index) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const card = player.hand[index];
    const sameCats = player.hand.filter(c => c.type === 'cat' && c.catType === card.catType);

    const toRemove = sameCats.slice(0, count);
    toRemove.forEach(c => {
        const idx = player.hand.indexOf(c);
        player.hand.splice(idx, 1);
        gameState.discardPile.push(c);
    });

    if (count === 2) {
        const targets = [];
        for (let i = 0; i < gameState.playerCount; i++) {
            if (i !== gameState.currentPlayerIndex && !gameState.players[i].eliminated && gameState.players[i].hand.length > 0) {
                targets.push({ index: i });
            }
        }
        if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            const targetHand = gameState.players[target.index].hand;
            const cardIdx = Math.floor(Math.random() * targetHand.length);
            const taken = targetHand.splice(cardIdx, 1)[0];
            player.hand.push(taken);
        }
        // Pair: take card and turn continues (can play more or draw)
    } else {
        showModal('Request a specific card', '<p>Pick a player to request a card from (simplified: random card taken)</p>', () => {});
        const targets = [];
        for (let i = 0; i < gameState.playerCount; i++) {
            if (i !== gameState.currentPlayerIndex && !gameState.players[i].eliminated && gameState.players[i].hand.length > 0) {
                targets.push({ index: i, name: gameState.playerNames[i] });
            }
        }
        if (targets.length > 0) {
            const html = targets.map(t => `<button class="btn" data-target="${t.index}">${t.name}</button>`).join('');
            modalContent.innerHTML = html;
            modalContent.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const targetIdx = parseInt(btn.dataset.target, 10);
                    const targetHand = gameState.players[targetIdx].hand;
                    if (targetHand.length > 0) {
                        const cardIdx = Math.floor(Math.random() * targetHand.length);
                        const taken = targetHand.splice(cardIdx, 1)[0];
                        player.hand.push(taken);
                    }
                    modalOverlay.classList.add('hidden');
                    advanceTurn();
                    renderGame();
                };
            });
        } else {
            modalContent.innerHTML = '<p>No valid targets.</p>';
            advanceTurn();
        }
    }
    renderGame();
}

function advanceTurn() {
    if (gameState.attacksPending > 0) {
        gameState.currentPlayerIndex = getNextPlayer(gameState.currentPlayerIndex);
        gameState.attacksPending--;
        if (gameState.attacksPending > 0) {
            renderGame();
            return;
        }
    }
    gameState.currentPlayerIndex = getNextPlayer(gameState.currentPlayerIndex);
    renderGame();
}

// Draw a card
function drawCard() {
    drawBtn.disabled = true;
    if (gameState.drawPile.length === 0) {
        drawBtn.disabled = false;
        return;
    }

    const card = gameState.drawPile.shift();
    const player = gameState.players[gameState.currentPlayerIndex];

    if (card.id === 'exploding') {
        const hasDefuse = player.hand.findIndex(c => c.id === 'defuse') >= 0;
        if (hasDefuse) {
            const defuseIdx = player.hand.findIndex(c => c.id === 'defuse');
            player.hand.splice(defuseIdx, 1);
            gameState.discardPile.push(CARD_TYPES.DEFUSE);
            const pos = Math.floor(Math.random() * (gameState.drawPile.length + 1));
            gameState.drawPile.splice(pos, 0, card);
            advanceTurn();
        } else {
            player.eliminated = true;
            const alive = gameState.players.filter(p => !p.eliminated);
            if (alive.length === 1) {
                const winnerIdx = gameState.players.findIndex(p => !p.eliminated);
                showWinner(winnerIdx);
                return;
            }
            advanceTurn();
        }
    } else {
        player.hand.push(card);
        advanceTurn();
    }
    drawBtn.disabled = false;
    renderGame();
}

function showWinner(winnerIndex) {
    gameScreen.classList.remove('active');
    winnerScreen.classList.add('active');
    winnerMessage.textContent = `${gameState.playerNames[winnerIndex]} Wins! 🎉`;
}

// Event listeners
startBtn.addEventListener('click', setupGame);

backBtn.addEventListener('click', () => {
    gameScreen.classList.remove('active');
    winnerScreen.classList.remove('active');
    lobby.classList.add('active');
});

drawPileEl.addEventListener('click', () => {
    if (!drawBtn.disabled) drawCard();
});

drawBtn.addEventListener('click', drawCard);

showRulesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    rulesModal.classList.remove('hidden');
});

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

playAgainBtn.addEventListener('click', () => {
    winnerScreen.classList.remove('active');
    lobby.classList.add('active');
});
