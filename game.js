/**
 * Exploding Kittens - Web App
 * Local pass-and-play + Online play with party code (Firebase Firestore)
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
const CARDS_BY_ID = {};
Object.values(CARD_TYPES).forEach(c => { CARDS_BY_ID[c.id] = c; });

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

// Online state (Supabase)
let isOnline = false;
let myUserId = null;
let roomCode = null;
let roomUnsubscribe = null;
let supabase = null;
let myPlayerIndex = 0;

function getMyUserId() {
    if (myUserId) return myUserId;
    let id = localStorage.getItem('ek_user_id');
    if (!id) {
        id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('ek_user_id', id);
    }
    myUserId = id;
    return id;
}

// Serialize/deserialize for Firestore (card objects <-> ids)
function cardToId(card) { return card.id; }
function idToCard(id) { return CARDS_BY_ID[id] || null; }
function serializeState() {
    return {
        drawPile: gameState.drawPile.map(cardToId),
        discardPile: gameState.discardPile.map(cardToId),
        hands: gameState.players.map(p => p.hand.map(cardToId)),
        currentPlayerIndex: gameState.currentPlayerIndex,
        attacksPending: gameState.attacksPending || 0,
        eliminated: gameState.players.map(p => p.eliminated),
        winnerIndex: gameState.winnerIndex ?? null,
    };
}
function deserializeState(data, playerNames) {
    if (!data || !data.hands) return;
    gameState.drawPile = (data.drawPile || []).map(idToCard).filter(Boolean);
    gameState.discardPile = (data.discardPile || []).map(idToCard).filter(Boolean);
    gameState.players = (data.hands || []).map(hand => ({
        hand: hand.map(idToCard).filter(Boolean),
        eliminated: false,
    }));
    data.eliminated?.forEach((el, i) => { if (gameState.players[i]) gameState.players[i].eliminated = el; });
    gameState.playerNames = playerNames || gameState.playerNames;
    gameState.currentPlayerIndex = data.currentPlayerIndex ?? 0;
    gameState.attacksPending = data.attacksPending ?? 0;
    gameState.winnerIndex = data.winnerIndex ?? null;
}

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
const homeScreen = document.getElementById('home');
const playLocalBtn = document.getElementById('play-local-btn');
const playOnlineBtn = document.getElementById('play-online-btn');
const onlineSetupScreen = document.getElementById('online-setup');
const createPartyFormScreen = document.getElementById('create-party-form');
const roomLobbyScreen = document.getElementById('room-lobby');
const partyCodeInput = document.getElementById('party-code');
const joinNameInput = document.getElementById('join-name');
const joinPartyBtn = document.getElementById('join-party-btn');
const createPartyBtn = document.getElementById('create-party-btn');
const onlineBackBtn = document.getElementById('online-back-btn');
const hostNameInput = document.getElementById('host-name');
const createGameModeSelect = document.getElementById('create-game-mode');
const createPlayerCountSelect = document.getElementById('create-player-count');
const createPartySubmitBtn = document.getElementById('create-party-submit');
const createBackBtn = document.getElementById('create-back-btn');
const displayPartyCodeEl = document.getElementById('display-party-code');
const roomPlayersListEl = document.getElementById('room-players-list');
const roomStartBtn = document.getElementById('room-start-btn');
const roomStartHint = document.getElementById('room-start-hint');
const roomLeaveBtn = document.getElementById('room-leave-btn');

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

// Supabase init (optional)
if (typeof window.supabase !== 'undefined' && window.supabaseUrl && window.supabaseAnonKey &&
    window.supabaseUrl.includes('YOUR_PROJECT') === false && window.supabaseAnonKey.includes('YOUR_ANON') === false) {
    try {
        supabase = window.supabase.createClient(window.supabaseUrl, window.supabaseAnonKey);
    } catch (e) { console.warn('Supabase init failed', e); }
}
const hasSupabase = () => supabase != null;

const SUPABASE_SETUP_MSG = 'Online play needs Supabase. Add your project URL and anon key to supabase-config.js (see README). Run supabase-setup.sql in the SQL Editor, then redeploy.';

if (createGameModeSelect && createPlayerCountSelect) {
    const updateCreatePlayerCount = () => {
        const max = createGameModeSelect.value === 'party' ? 10 : 5;
        createPlayerCountSelect.innerHTML = '';
        for (let i = 2; i <= max; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i + ' players';
            createPlayerCountSelect.appendChild(opt);
        }
    };
    createGameModeSelect.addEventListener('change', updateCreatePlayerCount);
    updateCreatePlayerCount();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

async function createRoom() {
    if (!supabase) {
        alert(SUPABASE_SETUP_MSG);
        return;
    }
    const name = (hostNameInput?.value || '').trim() || 'Host';
    const gameMode = createGameModeSelect?.value || 'base';
    const maxPlayers = parseInt(createPlayerCountSelect?.value || '5', 10);
    const uid = getMyUserId();
    roomCode = generateRoomCode();
    const { error } = await supabase.from('rooms').insert({
        room_code: roomCode,
        host_id: uid,
        player_ids: [uid],
        player_names: [name],
        status: 'lobby',
        game_mode: gameMode,
        player_count: maxPlayers,
    });
    if (error) {
        alert('Could not create room. Try again.');
        return;
    }
    isOnline = true;
    showScreen('room-lobby');
    subscribeToRoom();
}

async function joinRoom() {
    if (!supabase) {
        alert(SUPABASE_SETUP_MSG);
        return;
    }
    const code = (partyCodeInput?.value || '').trim().toUpperCase().replace(/\s/g, '');
    const name = (joinNameInput?.value || '').trim() || 'Player';
    if (!code || code.length < 4) {
        alert('Please enter a valid party code (4–6 characters).');
        return;
    }
    const uid = getMyUserId();
    const { data: row, error: fetchErr } = await supabase.from('rooms').select('*').eq('room_code', code).single();
    if (fetchErr || !row) {
        alert('No party found with that code. Check the code and try again.');
        return;
    }
    if (row.status !== 'lobby') {
        alert('That game has already started.');
        return;
    }
    const playerIds = row.player_ids || [];
    const playerNames = row.player_names || [];
    if (playerIds.includes(uid)) {
        roomCode = code;
        isOnline = true;
        showScreen('room-lobby');
        subscribeToRoom();
        return;
    }
    if (playerIds.length >= row.player_count) {
        alert('This party is full.');
        return;
    }
    const { error: updateErr } = await supabase.from('rooms').update({
        player_ids: [...playerIds, uid],
        player_names: [...playerNames, name],
        last_updated: new Date().toISOString(),
    }).eq('room_code', code);
    if (updateErr) {
        alert('Could not join. Try again.');
        return;
    }
    roomCode = code;
    isOnline = true;
    showScreen('room-lobby');
    subscribeToRoom();
}

function mapRoomRow(row) {
    if (!row) return null;
    return {
        hostId: row.host_id,
        playerIds: row.player_ids || [],
        playerNames: row.player_names || [],
        status: row.status,
        gameMode: row.game_mode,
        playerCount: row.player_count,
        gameState: row.game_state,
    };
}

function subscribeToRoom() {
    if (!supabase || !roomCode) return;
    if (roomUnsubscribe) {
        roomUnsubscribe.unsubscribe();
        roomUnsubscribe = null;
    }
    const channel = supabase.channel('room-' + roomCode).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: 'room_code=eq.' + roomCode,
    }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        const data = mapRoomRow(row);
        if (!data) return;
        if (data.status === 'lobby') {
            displayPartyCodeEl.textContent = roomCode;
            roomPlayersListEl.innerHTML = (data.playerNames || []).map((n) => `<li>${n}</li>`).join('');
            const isHost = data.hostId === getMyUserId();
            roomStartBtn.disabled = !isHost || (data.playerIds || []).length < 2;
            roomStartHint.textContent = (data.playerIds || []).length < 2 ? 'Need at least 2 players to start' : (isHost ? 'Click Start when everyone has joined' : 'Waiting for host to start');
        } else if (data.status === 'playing' && data.gameState) {
            gameState.playerNames = data.playerNames || [];
            gameState.playerCount = gameState.playerNames.length;
            myPlayerIndex = (data.playerIds || []).indexOf(getMyUserId());
            if (myPlayerIndex < 0) myPlayerIndex = 0;
            deserializeState(data.gameState, gameState.playerNames);
            if (data.gameState.winnerIndex != null) {
                showWinner(data.gameState.winnerIndex);
            } else {
                showScreen('game');
                renderGame();
            }
        } else if (data.status === 'ended' && data.gameState && data.gameState.winnerIndex != null) {
            gameState.playerNames = data.playerNames || [];
            deserializeState(data.gameState, gameState.playerNames);
            showWinner(data.gameState.winnerIndex);
        }
    }).subscribe();
    roomUnsubscribe = channel;
    // Load current state once
    supabase.from('rooms').select('*').eq('room_code', roomCode).single().then(({ data: row }) => {
        if (row) {
            const data = mapRoomRow(row);
            if (data.status === 'lobby') {
                displayPartyCodeEl.textContent = roomCode;
                roomPlayersListEl.innerHTML = (data.playerNames || []).map((n) => `<li>${n}</li>`).join('');
                const isHost = data.hostId === getMyUserId();
                roomStartBtn.disabled = !isHost || (data.playerIds || []).length < 2;
                roomStartHint.textContent = (data.playerIds || []).length < 2 ? 'Need at least 2 players to start' : (isHost ? 'Click Start when everyone has joined' : 'Waiting for host to start');
            }
        }
    });
}

async function startGameOnline() {
    if (!supabase || !roomCode) return;
    const { data: row, error: fetchErr } = await supabase.from('rooms').select('*').eq('room_code', roomCode).single();
    if (fetchErr || !row) return;
    const data = mapRoomRow(row);
    if (data.hostId !== getMyUserId() || data.status !== 'lobby') return;
    const playerNames = data.playerNames || [];
    const playerCount = playerNames.length;
    if (playerCount < 2) return;
    const mode = data.gameMode || 'base';
    gameState = {
        players: [],
        playerNames: playerNames,
        drawPile: [],
        discardPile: [],
        currentPlayerIndex: 0,
        direction: 1,
        attacksPending: 0,
        playerCount,
        gameMode: mode,
    };
    let deck = mode === 'party' ? createPartyDeck(playerCount) : [...BASE_DECK];
    deck = deck.filter(c => c.id !== 'exploding' && c.id !== 'defuse');
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({ hand: [CARD_TYPES.DEFUSE], eliminated: false });
    }
    const cardsPerPlayer = 7;
    for (let i = 0; i < playerCount; i++) {
        for (let j = 1; j < cardsPerPlayer; j++) {
            if (deck.length > 0) {
                const idx = Math.floor(Math.random() * deck.length);
                gameState.players[i].hand.push(deck.splice(idx, 1)[0]);
            }
        }
    }
    const defuseCount = Math.min(6, playerCount + 2);
    const defusesForDeck = mode === 'party' ? Math.min(10, defuseCount - playerCount) : (playerCount >= 4 ? 4 : 2);
    for (let i = 0; i < defusesForDeck && deck.length > 0; i++) {
        const idx = Math.floor(Math.random() * deck.length);
        deck.splice(idx, 0, CARD_TYPES.DEFUSE);
    }
    const explodingCount = playerCount - 1;
    for (let i = 0; i < explodingCount; i++) deck.push(CARD_TYPES.EXPLODING);
    gameState.drawPile = shuffle(deck);
    const { error: updateErr } = await supabase.from('rooms').update({
        status: 'playing',
        game_state: serializeState(),
        last_updated: new Date().toISOString(),
    }).eq('room_code', roomCode);
    if (updateErr) return;
    showScreen('game');
    renderGame();
}

async function updateGameStateOnline(state) {
    if (!supabase || !roomCode) return;
    await supabase.from('rooms').update({
        game_state: state,
        last_updated: new Date().toISOString(),
    }).eq('room_code', roomCode);
}

function leaveRoom() {
    if (roomUnsubscribe) {
        roomUnsubscribe.unsubscribe();
        roomUnsubscribe = null;
    }
    if (supabase && roomCode) {
        supabase.from('rooms').select('*').eq('room_code', roomCode).single().then(({ data: row }) => {
            if (!row) return;
            const uid = getMyUserId();
            const ids = [...(row.player_ids || [])];
            const names = [...(row.player_names || [])];
            const idx = ids.indexOf(uid);
            if (idx >= 0) {
                ids.splice(idx, 1);
                names.splice(idx, 1);
                if (ids.length === 0) {
                    supabase.from('rooms').delete().eq('room_code', roomCode).then(() => {});
                } else {
                    const updates = { player_ids: ids, player_names: names, last_updated: new Date().toISOString() };
                    if (row.host_id === uid) updates.host_id = ids[0];
                    supabase.from('rooms').update(updates).eq('room_code', roomCode).then(() => {});
                }
            }
        });
    }
    roomCode = null;
    isOnline = false;
    showScreen('home');
}


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
    const isMyTurn = !isOnline || (myPlayerIndex === gameState.currentPlayerIndex);

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

    // Current player hand (only playable when it's your turn in online mode)
    handEl.innerHTML = '';
    currentPlayer.hand.forEach((card, idx) => {
        let playable = canPlayCard(card, idx);
        if (isOnline) playable = playable && isMyTurn && !currentPlayer.eliminated;
        const el = createCardElement(card, idx, playable);
        if (playable) {
            el.addEventListener('click', () => playCard(idx));
        }
        handEl.appendChild(el);
    });

    drawBtn.disabled = !isMyTurn || currentPlayer.eliminated;
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
        syncStateIfOnline();
        return;
    }

    if (card.id === 'attack') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        gameState.attacksPending = (gameState.attacksPending || 0) + 2;
        advanceTurn();
        renderGame();
        syncStateIfOnline();
        return;
    }

    if (card.id === 'see_future') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        const top3 = gameState.drawPile.slice(0, 3);
        const html = top3.map(c => `<div class="card ${c.cssClass}">${c.emoji} ${c.name}</div>`).join('');
        showModal('See the Future', html);
        renderGame();
        syncStateIfOnline();
        return;
    }

    if (card.id === 'shuffle') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        gameState.drawPile = shuffle(gameState.drawPile);
        advanceTurn();
        renderGame();
        syncStateIfOnline();
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
            renderGame();
            syncStateIfOnline();
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
                    syncStateIfOnline();
                };
            });
        }
        renderGame();
        return;
    }

    if (card.id === 'nope') {
        player.hand.splice(index, 1);
        gameState.discardPile.push(card);
        advanceTurn();
        renderGame();
        syncStateIfOnline();
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
        syncStateIfOnline();
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
    syncStateIfOnline();
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
                gameState.winnerIndex = winnerIdx;
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
    syncStateIfOnline();
}

function showWinner(winnerIndex) {
    gameState.winnerIndex = winnerIndex;
    if (isOnline && supabase && roomCode) {
        supabase.from('rooms').update({
            status: 'ended',
            game_state: serializeState(),
            last_updated: new Date().toISOString(),
        }).eq('room_code', roomCode).catch(() => {});
    }
    gameScreen.classList.remove('active');
    winnerScreen.classList.add('active');
    winnerMessage.textContent = `${gameState.playerNames[winnerIndex]} Wins! 🎉`;
}

function syncStateIfOnline() {
    if (isOnline && supabase && roomCode) {
        updateGameStateOnline(serializeState()).catch(() => {});
    }
}

// Event listeners
startBtn.addEventListener('click', setupGame);

backBtn.addEventListener('click', () => {
    gameScreen.classList.remove('active');
    winnerScreen.classList.remove('active');
    if (isOnline) {
        showScreen('room-lobby');
    } else {
        lobby.classList.add('active');
        showScreen('lobby');
    }
});

drawPileEl.addEventListener('click', () => {
    if (!drawBtn.disabled) drawCard();
});

drawBtn.addEventListener('click', drawCard);

showRulesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    rulesModal.classList.remove('hidden');
});
if (document.getElementById('show-rules-home')) {
    document.getElementById('show-rules-home').addEventListener('click', (e) => {
        e.preventDefault();
        rulesModal.classList.remove('hidden');
    });
}

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

playAgainBtn.addEventListener('click', () => {
    winnerScreen.classList.remove('active');
    if (isOnline) {
        leaveRoom();
    } else {
        lobby.classList.add('active');
        showScreen('lobby');
    }
});

// Home & online flow
if (playLocalBtn) playLocalBtn.addEventListener('click', () => showScreen('lobby'));
if (playOnlineBtn) playOnlineBtn.addEventListener('click', () => showScreen('online-setup'));
if (createPartyBtn) createPartyBtn.addEventListener('click', () => showScreen('create-party-form'));
if (onlineBackBtn) onlineBackBtn.addEventListener('click', () => showScreen('home'));
if (createBackBtn) createBackBtn.addEventListener('click', () => showScreen('online-setup'));
if (createPartySubmitBtn) createPartySubmitBtn.addEventListener('click', () => createRoom());
if (joinPartyBtn) joinPartyBtn.addEventListener('click', () => joinRoom());
if (roomStartBtn) roomStartBtn.addEventListener('click', () => startGameOnline());
if (roomLeaveBtn) roomLeaveBtn.addEventListener('click', () => leaveRoom());
