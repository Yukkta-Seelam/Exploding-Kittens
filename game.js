/**
 * Exploding Kittens - Web App
 * Local pass-and-play + Online play with party code (Firebase Firestore)
 */

// Card definitions
const CARD_TYPES = {
    EXPLODING: { id: 'exploding', name: 'Exploding Kitten', type: 'exploding', cssClass: 'card-exploding', emoji: '💥', imageSrc: 'assets/cards/explodingkitten.jpeg' },
    DEFUSE: { id: 'defuse', name: 'Defuse', type: 'defuse', cssClass: 'card-defuse', emoji: '🛡️', imageSrc: 'assets/cards/defuse.jpeg' },
    SKIP: { id: 'skip', name: 'Skip', type: 'action', cssClass: 'card-skip', emoji: '⏭️', imageSrc: 'assets/cards/skip.jpeg' },
    ATTACK: { id: 'attack', name: 'Attack', type: 'action', cssClass: 'card-attack', emoji: '⚔️', imageSrc: 'assets/cards/attack.jpeg' },
    SEE_FUTURE: { id: 'see_future', name: 'See the Future', type: 'action', cssClass: 'card-see-future', emoji: '🔮', imageSrc: 'assets/cards/seethefuture.jpeg' },
    ALTER_FUTURE: { id: 'alter_future', name: 'Alter Future', type: 'action', cssClass: 'card-alter-future', emoji: '✏️', imageSrc: 'assets/cards/alterfuture.jpeg' },
    DRAW_FROM_BOTTOM: { id: 'draw_from_bottom', name: 'Draw from Bottom', type: 'action', cssClass: 'card-draw-from-bottom', emoji: '⬇️', imageSrc: 'assets/cards/drawfb.jpeg' },
    SHUFFLE: { id: 'shuffle', name: 'Shuffle', type: 'action', cssClass: 'card-shuffle', emoji: '🔀', imageSrc: 'assets/cards/shuffle.jpeg' },
    NOPE: { id: 'nope', name: 'Nope', type : 'action', cssClass: 'card-nope', emoji: '🙅', imageSrc: 'assets/cards/nope.jpeg' },
    FAVOR: { id: 'favor', name: 'Favor', type: 'action', cssClass: 'card-favor', emoji: '🙏', imageSrc: 'assets/cards/favor.jpeg' },
    CAT_BEARD: { id: 'cat_beard', name: 'Beard Cat', type: 'cat', cssClass: 'card-cat', emoji: '🐱', imageSrc: 'assets/cards/beard.jpeg', catType: 'beard' },
    CAT_CATTERMELON: { id: 'cat_cattermelon', name: 'Cattermelon', type: 'cat', cssClass: 'card-cat', emoji: '🍉', imageSrc: 'assets/cards/cattermelon.jpeg', catType: 'cattermelon' },
    CAT_HAIRY: { id: 'cat_hairy', name: 'Hairy Potato', type: 'cat', cssClass: 'card-cat', emoji: '🥔', imageSrc: 'assets/cards/potato.jpeg', catType: 'hairy' },
    CAT_RAINICORN: { id: 'cat_rainicorn', name: 'Rain-icorn', type: 'cat', cssClass: 'card-cat', emoji: '🌈', imageSrc: 'assets/cards/rainbow.jpeg', catType: 'rainicorn' },
    CAT_TACO: { id: 'cat_taco', name: 'Taco Cat', type: 'cat', cssClass: 'card-cat', emoji: '🌮', imageSrc: 'assets/cards/taco.jpeg', catType: 'taco' },
    CAT_FERAL: { id: 'cat_feral', name: 'Feral Cat', type: 'cat', cssClass: 'card-cat', emoji: '🃏', imageSrc: 'assets/cards/feral.jpeg', catType: 'feral', isFeral: true },
};
const CARDS_BY_ID = {};
Object.values(CARD_TYPES).forEach(c => { CARDS_BY_ID[c.id] = c; });

// Cards that can be requested by name when playing 3 of the same cat (all except Exploding)
const REQUESTABLE_CARDS = Object.values(CARD_TYPES).filter(c => c.id !== 'exploding');

// Deck composition: Base (2-5 players) and Party (2-10 players)
const BASE_DECK = [
    ...Array(4).fill(CARD_TYPES.EXPLODING),
    ...Array(6).fill(CARD_TYPES.DEFUSE),
    ...Array(4).fill(CARD_TYPES.SKIP),
    ...Array(4).fill(CARD_TYPES.ATTACK),
    ...Array(5).fill(CARD_TYPES.SEE_FUTURE),
    ...Array(4).fill(CARD_TYPES.ALTER_FUTURE),
    ...Array(4).fill(CARD_TYPES.DRAW_FROM_BOTTOM),
    ...Array(4).fill(CARD_TYPES.SHUFFLE),
    ...Array(5).fill(CARD_TYPES.NOPE),
    ...Array(4).fill(CARD_TYPES.FAVOR),
    ...Array(5).fill(CARD_TYPES.CAT_BEARD),
    ...Array(5).fill(CARD_TYPES.CAT_CATTERMELON),
    ...Array(5).fill(CARD_TYPES.CAT_HAIRY),
    ...Array(5).fill(CARD_TYPES.CAT_RAINICORN),
    ...Array(5).fill(CARD_TYPES.CAT_TACO),
    ...Array(4).fill(CARD_TYPES.CAT_FERAL),
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

// Shuffle a player's hand in place (so UI and state stay in sync)
function shufflePlayerHand(playerIndex) {
    const p = gameState.players[playerIndex];
    if (!p || !p.hand || p.hand.length === 0) return;
    const h = p.hand;
    for (let i = h.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [h[i], h[j]] = [h[j], h[i]];
    }
    pendingCards = []; // clear selection so indices don't point to wrong cards
    renderGame();
    syncStateIfOnline();
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
    pendingNope: null,
    lastEliminatedPlayerIndex: null, // Show "[Name] is out!" popup to all players
    explodingReveal: null, // { playerIndex } when someone just drew Exploding Kitten (show card to all)
    nextDrawFromBottom: false, // When true, next draw is from bottom of deck (Draw from Bottom card)
};

// Online state (Supabase)
let isOnline = false;
let myUserId = null;
let roomCode = null;
let roomUnsubscribe = null;
let supabaseClient = null;
let myPlayerIndex = 0;

// Play flow: select → confirm
let pendingCards = [];
let catStealMode = null;
let pickFromDiscardMode = null;
let lastShownElimination = -1;
let lastHandToShowIndex = 0; // used by shuffle-hand so handler always shuffles the currently displayed hand
let lastShownExplodingReveal = -1; // avoid showing "[X] drew Exploding Kitten" modal twice

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
        pendingNope: gameState.pendingNope,
        lastEliminatedPlayerIndex: gameState.lastEliminatedPlayerIndex,
        explodingReveal: gameState.explodingReveal ?? null,
        nextDrawFromBottom: gameState.nextDrawFromBottom ?? false,
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
    gameState.pendingNope = data.pendingNope ?? null;
    gameState.lastEliminatedPlayerIndex = data.lastEliminatedPlayerIndex ?? null;
    gameState.explodingReveal = data.explodingReveal ?? null;
    gameState.nextDrawFromBottom = data.nextDrawFromBottom ?? false;
    if (gameState.explodingReveal === null) lastShownExplodingReveal = -1;
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
const handPlayer1El = document.getElementById('hand-player-1');
const handSectionsEl = document.getElementById('hand-sections');
const handSection0El = document.getElementById('hand-section-0');
const handSection1El = document.getElementById('hand-section-1');
const handLabel0El = document.getElementById('hand-label-0');
const handLabel1El = document.getElementById('hand-label-1');
const gameBoardEl = document.getElementById('game-board');
const playersAreaEl = document.getElementById('players-area');
const turnIndicatorEl = document.getElementById('turn-indicator');
const turnBannerEl = document.getElementById('turn-banner');
const turnBannerNameEl = document.getElementById('turn-banner-name');
const currentPlayerLabel = document.getElementById('current-player-label'); // legacy single label; in two-mode we use handLabel0El/handLabel1El
const modalOverlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const showRulesBtn = document.getElementById('show-rules');
const rulesModal = document.getElementById('rules-modal');
const closeRulesBtn = document.getElementById('close-rules');
const playAgainBtn = document.getElementById('play-again');
const winnerCancelBtn = document.getElementById('winner-cancel');
const winnerSubtitleEl = document.getElementById('winner-subtitle');
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
const pendingCardsEl = document.getElementById('pending-cards');
const discardCardsEl = document.getElementById('discard-cards');
const confirmPlayBtn = document.getElementById('confirm-play-btn');
const cancelPlayBtn = document.getElementById('cancel-play-btn');
const shuffleHandBtn = document.getElementById('shuffle-hand-btn');

// Player count options based on mode
function updatePlayerCountOptions() {
    if (!gameModeSelect || !playerCountSelect) return;
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
    if (!playerCountSelect || !playerNamesDiv) return;
    const count = parseInt(playerCountSelect.value, 10);
    playerNamesDiv.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'player-name-group';
        div.innerHTML = `<input type="text" placeholder="Player ${i + 1} name" value="Player ${i + 1}" maxlength="20">`;
        playerNamesDiv.appendChild(div);
    }
}

if (gameModeSelect) gameModeSelect.addEventListener('change', () => {
    updatePlayerCountOptions();
    updatePlayerNameInputs();
});
if (playerCountSelect) playerCountSelect.addEventListener('change', updatePlayerNameInputs);

// Initialize (only if elements exist)
if (gameModeSelect && playerCountSelect) {
    updatePlayerCountOptions();
    updatePlayerNameInputs();
}

// Supabase: load script only when needed (avoids global conflict and keeps Play Locally working)
function loadSupabaseScript() {
    return new Promise((resolve) => {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            resolve();
            return;
        }
        const urls = [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
            'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
        ];
        let idx = 0;
        function tryLoad() {
            const s = document.createElement('script');
            s.src = urls[idx];
            s.onload = () => resolve();
            s.onerror = () => {
                idx++;
                if (idx < urls.length) tryLoad();
                else resolve();
            };
            document.head.appendChild(s);
        }
        tryLoad();
    });
}

function initSupabaseClient() {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function' &&
            window.supabaseUrl && window.supabaseAnonKey &&
            String(window.supabaseUrl).includes('YOUR_PROJECT') === false &&
            String(window.supabaseAnonKey).includes('YOUR_ANON') === false) {
            supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseAnonKey);
        }
    } catch (e) { console.warn('Supabase init failed', e); }
}

const hasSupabase = () => supabaseClient != null;

const SUPABASE_SETUP_MSG = 'Online play needs Supabase. Add your project URL and anon key to supabase-config.js (see README). Run supabase-setup.sql in the SQL Editor, then redeploy. Make sure supabase-config.js is committed to your repo (not in .gitignore) so it deploys.';

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
    if (!supabaseClient) {
        await loadSupabaseScript();
        initSupabaseClient();
    }
    if (!supabaseClient) {
        alert(SUPABASE_SETUP_MSG);
        return;
    }
    const name = (hostNameInput?.value || '').trim() || 'Host';
    const gameMode = createGameModeSelect?.value || 'base';
    const maxPlayers = parseInt(createPlayerCountSelect?.value || '5', 10);
    const uid = getMyUserId();
    roomCode = generateRoomCode();
    const { error } = await supabaseClient.from('rooms').insert({
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
    if (!supabaseClient) {
        await loadSupabaseScript();
        initSupabaseClient();
    }
    if (!supabaseClient) {
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
    const { data: row, error: fetchErr } = await supabaseClient.from('rooms').select('*').eq('room_code', code).single();
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
    const { error: updateErr } = await supabaseClient.from('rooms').update({
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
    if (!supabaseClient || !roomCode) return;
    if (roomUnsubscribe) {
        roomUnsubscribe.unsubscribe();
        roomUnsubscribe = null;
    }
    const channel = supabaseClient.channel('room-' + roomCode).on('postgres_changes', {
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
            // Ensure everyone is brought back to the room lobby (e.g. after a rematch request).
            showScreen('room-lobby');
            displayPartyCodeEl.textContent = roomCode;
            roomPlayersListEl.innerHTML = (data.playerNames || []).map((n) => `<li>${n}</li>`).join('');
            const isHost = data.hostId === getMyUserId();
            roomStartBtn.disabled = !isHost || (data.playerIds || []).length < 2;
            const isRematchLobby = !!(data.gameState && data.gameState.rematch && data.gameState.rematch.requestedAt);
            if ((data.playerIds || []).length < 2) {
                roomStartHint.textContent = isRematchLobby ? 'Rematch lobby: waiting for players to join...' : 'Need at least 2 players to start';
            } else {
                roomStartHint.textContent = isRematchLobby
                    ? (isHost ? 'Rematch lobby: waiting for everyone. Click Start when ready.' : 'Rematch lobby: waiting for host to start.')
                    : (isHost ? 'Click Start when everyone has joined' : 'Waiting for host to start');
            }
        } else if (data.status === 'playing' && data.gameState) {
            gameState.playerNames = data.playerNames || [];
            gameState.playerCount = gameState.playerNames.length;
            myPlayerIndex = (data.playerIds || []).indexOf(getMyUserId());
            if (myPlayerIndex < 0) myPlayerIndex = 0;
            deserializeState(data.gameState, gameState.playerNames);
            if (data.gameState.winnerIndex != null) {
                showWinner(data.gameState.winnerIndex);
            } else {
                const winnerScreenActive = winnerScreen && winnerScreen.classList.contains('active');
                if (!winnerScreenActive) {
                    showScreen('game');
                    renderGame();
                }
                // Show "[Name] drew an Exploding Kitten!" to all other players when they receive the reveal
                const rev = data.gameState.explodingReveal;
                if (rev && rev.playerIndex !== myPlayerIndex && lastShownExplodingReveal !== rev.playerIndex) {
                    lastShownExplodingReveal = rev.playerIndex;
                    const name = (data.playerNames || [])[rev.playerIndex] || 'A player';
                    const cardHtml = '<div class="exploding-reveal-card">' + getCardInnerHtml(CARD_TYPES.EXPLODING, false) + '</div>';
                    const html = cardHtml + '<p class="exploding-reveal-msg">' + name + ' drew an Exploding Kitten!</p><button class="btn" id="exploding-reveal-other-continue">Continue</button>';
                    showModal('Exploding Kitten!', html, () => {});
                    const btn = document.getElementById('exploding-reveal-other-continue');
                    if (btn) btn.onclick = () => { modalOverlay.classList.add('hidden'); };
                }
            }
        } else if (data.status === 'ended' && data.gameState && data.gameState.winnerIndex != null) {
            gameState.playerNames = data.playerNames || [];
            deserializeState(data.gameState, gameState.playerNames);
            showWinner(data.gameState.winnerIndex);
        }
    }).subscribe();
    roomUnsubscribe = channel;
    // Load current state once
    supabaseClient.from('rooms').select('*').eq('room_code', roomCode).single().then(({ data: row }) => {
        if (row) {
            const data = mapRoomRow(row);
            if (data.status === 'lobby') {
                showScreen('room-lobby');
                displayPartyCodeEl.textContent = roomCode;
                roomPlayersListEl.innerHTML = (data.playerNames || []).map((n) => `<li>${n}</li>`).join('');
                const isHost = data.hostId === getMyUserId();
                roomStartBtn.disabled = !isHost || (data.playerIds || []).length < 2;
                const isRematchLobby = !!(data.gameState && data.gameState.rematch && data.gameState.rematch.requestedAt);
                if ((data.playerIds || []).length < 2) {
                    roomStartHint.textContent = isRematchLobby ? 'Rematch lobby: waiting for players to join...' : 'Need at least 2 players to start';
                } else {
                    roomStartHint.textContent = isRematchLobby
                        ? (isHost ? 'Rematch lobby: waiting for everyone. Click Start when ready.' : 'Rematch lobby: waiting for host to start.')
                        : (isHost ? 'Click Start when everyone has joined' : 'Waiting for host to start');
                }
            }
        }
    });
}

async function startGameOnline() {
    if (!supabaseClient || !roomCode) return;
    const { data: row, error: fetchErr } = await supabaseClient.from('rooms').select('*').eq('room_code', roomCode).single();
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
        pendingNope: null,
        lastEliminatedPlayerIndex: null,
        explodingReveal: null,
        nextDrawFromBottom: false,
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
    const { error: updateErr } = await supabaseClient.from('rooms').update({
        status: 'playing',
        game_state: serializeState(),
        last_updated: new Date().toISOString(),
    }).eq('room_code', roomCode);
    if (updateErr) return;
    pendingCards = [];
    catStealMode = null;
    pickFromDiscardMode = null;
    showScreen('game');
    renderGame();
}

async function updateGameStateOnline(state) {
    if (!supabaseClient || !roomCode) return;
    await supabaseClient.from('rooms').update({
        game_state: state,
        last_updated: new Date().toISOString(),
    }).eq('room_code', roomCode);
}

async function restartGameOnline() {
    // Rematch flow: go back to lobby and wait; host will press Start when everyone has joined.
    if (!supabaseClient || !roomCode) return;
    showScreen('room-lobby');
    if (roomStartHint) roomStartHint.textContent = 'Rematch lobby: waiting for other players to join...';
    const rematchState = { rematch: { requestedAt: new Date().toISOString() } };
    await supabaseClient.from('rooms').update({
        status: 'lobby',
        game_state: rematchState,
        last_updated: new Date().toISOString(),
    }).eq('room_code', roomCode);
}

function leaveRoom() {
    if (roomUnsubscribe) {
        roomUnsubscribe.unsubscribe();
        roomUnsubscribe = null;
    }
    if (supabaseClient && roomCode) {
        supabaseClient.from('rooms').select('*').eq('room_code', roomCode).single().then(({ data: row }) => {
            if (!row) return;
            const uid = getMyUserId();
            const ids = [...(row.player_ids || [])];
            const names = [...(row.player_names || [])];
            const idx = ids.indexOf(uid);
            if (idx >= 0) {
                ids.splice(idx, 1);
                names.splice(idx, 1);
                if (ids.length === 0) {
                    supabaseClient.from('rooms').delete().eq('room_code', roomCode).then(() => {});
                } else {
                    const updates = { player_ids: ids, player_names: names, last_updated: new Date().toISOString() };
                    if (row.host_id === uid) updates.host_id = ids[0];
                    supabaseClient.from('rooms').update(updates).eq('room_code', roomCode).then(() => {});
                }
            }
        });
    }
    roomCode = null;
    isOnline = false;
    showScreen('home');
}


// Create card element
function getCardInnerHtml(card, small = false) {
    if (card.imageSrc) {
        const cls = small ? 'card-img-small' : 'card-img';
        return `<img src="${card.imageSrc}" alt="${card.name}" class="${cls}">`;
    }
    if (small) {
        return `<span>${card.emoji}</span><span class="card-name-small">${card.name}</span>`;
    }
    return `<span>${card.emoji}</span><span>${card.name}</span>`;
}

function createCardElement(card, index, playable = false) {
    const el = document.createElement('div');
    const hasImage = !!card.imageSrc;
    el.className = `card ${card.cssClass} ${hasImage ? 'has-image' : ''} ${!playable ? 'disabled' : ''}`;
    el.dataset.index = index;
    el.innerHTML = getCardInnerHtml(card, false);
    return el;
}

// Favor: show notification to all then let target choose which card to give.
function showFavorNotificationThenPicker(actingPlayerIndex, targetIdx, onComplete) {
    const actingName = gameState.playerNames[actingPlayerIndex];
    const targetName = gameState.playerNames[targetIdx];
    const notifyHtml = `<p class="favor-notify-msg"><strong>${actingName}</strong> has asked for a favour from <strong>${targetName}</strong>.</p><button class="btn btn-primary" id="favor-notify-ok">OK</button>`;
    showModal('Favour', notifyHtml, () => {});
    document.getElementById('favor-notify-ok').onclick = () => {
        modalOverlay.classList.add('hidden');
        showFavorTargetPicker(actingPlayerIndex, targetIdx, onComplete);
    };
}

function showFavorTargetPicker(actingPlayerIndex, targetIdx, onComplete) {
    const actingName = gameState.playerNames[actingPlayerIndex];
    const targetHand = gameState.players[targetIdx].hand;
    if (!targetHand || targetHand.length === 0) {
        if (onComplete) onComplete();
        renderGame();
        syncStateIfOnline();
        return;
    }
    const actingPlayer = gameState.players[actingPlayerIndex];
    const html = `<p>Choose a card to give to <strong>${actingName}</strong>:</p><div class="favor-pick-cards" id="favor-pick-cards"></div>`;
    showModal('Give a card', html, () => {});
    const container = document.getElementById('favor-pick-cards');
    if (!container) return;
    targetHand.forEach((card, idx) => {
        const el = createCardElement(card, idx, true);
        el.classList.add('favor-pick-card');
        el.addEventListener('click', () => {
            const taken = targetHand.splice(idx, 1)[0];
            actingPlayer.hand.push(taken);
            modalOverlay.classList.add('hidden');
            if (onComplete) onComplete();
            renderGame();
            syncStateIfOnline();
        });
        container.appendChild(el);
    });
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
        pendingNope: null,
        lastEliminatedPlayerIndex: null,
        explodingReveal: null,
        nextDrawFromBottom: false,
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
    gameState.lastEliminatedPlayerIndex = null;
    pendingCards = [];
    catStealMode = null;
    pickFromDiscardMode = null;
    lastShownElimination = -1;
    renderGame();
    lobby.classList.remove('active');
    gameScreen.classList.add('active');
}

function setupGameFromState(names, playerCount, mode) {
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
        pendingNope: null,
        lastEliminatedPlayerIndex: null,
        explodingReveal: null,
        nextDrawFromBottom: false,
    };
    let deck = mode === 'party' ? createPartyDeck(playerCount) : [...BASE_DECK];
    deck = deck.filter(c => c.id !== 'exploding' && c.id !== 'defuse');
    const defuseCount = Math.min(6, playerCount + 2);
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
    const defusesForDeck = mode === 'party' ? Math.min(10, defuseCount - playerCount) : (playerCount >= 4 ? 4 : 2);
    for (let i = 0; i < defusesForDeck && deck.length > 0; i++) {
        const idx = Math.floor(Math.random() * deck.length);
        deck.splice(idx, 0, CARD_TYPES.DEFUSE);
    }
    const explodingCount = playerCount - 1;
    for (let i = 0; i < explodingCount; i++) deck.push(CARD_TYPES.EXPLODING);
    gameState.drawPile = shuffle(deck);
    gameState.lastEliminatedPlayerIndex = null;
    pendingCards = [];
    catStealMode = null;
    pickFromDiscardMode = null;
    lastShownElimination = -1;
    lobby.classList.remove('active');
    gameScreen.classList.add('active');
    renderGame();
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
    // If exactly one player left and we haven't set winner yet, set it and show winner (safety net for all code paths)
    const alive = gameState.players.filter(p => !p.eliminated);
    if (alive.length === 1 && gameState.winnerIndex == null) {
        gameState.winnerIndex = gameState.players.findIndex(p => !p.eliminated);
        showWinner(gameState.winnerIndex);
        if (isOnline && supabaseClient && roomCode) {
            supabaseClient.from('rooms').update({
                status: 'ended',
                game_state: serializeState(),
                last_updated: new Date().toISOString(),
            }).eq('room_code', roomCode).catch(() => {});
        }
        return;
    }
    // If winner is already set (e.g. from sync), show winner screen so everyone sees who won
    if (gameState.winnerIndex != null) {
        showWinner(gameState.winnerIndex);
        return;
    }

    // Show "[Player] is out!" popup only when someone is eliminated AND more than one player still in the game
    if (gameState.lastEliminatedPlayerIndex != null && gameState.lastEliminatedPlayerIndex !== lastShownElimination) {
        const stillAlive = gameState.players.filter(p => !p.eliminated).length;
        if (stillAlive > 1) {
            lastShownElimination = gameState.lastEliminatedPlayerIndex;
            const name = gameState.playerNames[gameState.lastEliminatedPlayerIndex];
            showModal('Player Eliminated', `<p class="eliminated-msg">${name} is out!</p>`, () => {});
        }
    }

    pileCountEl.textContent = gameState.drawPile.length;
    const turnPlayerIndex = gameState.currentPlayerIndex;
    const turnPlayerName = gameState.playerNames[turnPlayerIndex];
    const isMyTurn = !isOnline || (myPlayerIndex === turnPlayerIndex);

    // Spectator: eliminated player (online) sees all players' hands and full game state
    const isSpectator = isOnline && gameState.players[myPlayerIndex] && gameState.players[myPlayerIndex].eliminated;

    // In online mode: each player sees only THEIR hand (or spectator view). In local mode: show current turn player's hand (or both when 2-player local).
    const isLocalTwoPlayer = !isOnline && gameState.playerCount === 2;
    const handToShowIndex = isSpectator ? turnPlayerIndex : (isOnline ? myPlayerIndex : turnPlayerIndex);
    const myHand = gameState.players[handToShowIndex];

    turnIndicatorEl.textContent = `${turnPlayerName}'s Turn`;
    if (turnBannerEl && turnBannerNameEl) {
        turnBannerNameEl.textContent = turnPlayerName;
    }

    // Layout: two hands side-by-side for local 2-player; single hand otherwise
    if (gameBoardEl) gameBoardEl.classList.toggle('local-two-player', isLocalTwoPlayer);
    if (handSectionsEl) {
        handSectionsEl.className = isLocalTwoPlayer ? 'hand-sections two' : 'hand-sections single';
        if (!isLocalTwoPlayer && handSection0El && handSection1El) {
            handSection0El.classList.toggle('active', handToShowIndex === 0);
            handSection1El.classList.toggle('active', handToShowIndex === 1);
        }
    }
    if (handLabel0El) handLabel0El.textContent = isLocalTwoPlayer ? `${gameState.playerNames[0]}'s Hand` : (handToShowIndex === 0 ? (isSpectator ? "You're out! Spectating" : (isOnline ? 'Your Hand' : `${turnPlayerName}'s Hand`)) : '');
    if (handLabel1El) handLabel1El.textContent = isLocalTwoPlayer ? `${gameState.playerNames[1]}'s Hand` : (handToShowIndex === 1 ? (isSpectator ? "You're out! Spectating" : (isOnline ? 'Your Hand' : `${turnPlayerName}'s Hand`)) : '');
    if (handSection0El) handSection0El.classList.toggle('current-turn', isLocalTwoPlayer && turnPlayerIndex === 0);
    if (handSection1El) handSection1El.classList.toggle('current-turn', isLocalTwoPlayer && turnPlayerIndex === 1);

    // Clear pending if not our turn (online)
    if (isOnline && !isMyTurn) {
        pendingCards = [];
        catStealMode = null;
        pickFromDiscardMode = null;
    }

    const inPickFromDiscard = pickFromDiscardMode && isMyTurn && handToShowIndex === gameState.currentPlayerIndex;

    // In catStealMode, ALL opponent cards are clickable to pick which card to take
    const inCatSteal = catStealMode && isMyTurn && handToShowIndex === gameState.currentPlayerIndex;
    playersAreaEl.innerHTML = '';
    for (let i = 0; i < gameState.playerCount; i++) {
        if (i === handToShowIndex && !isSpectator) continue;
        const isOut = !!gameState.players[i].eliminated;
        if (isOut && !isSpectator) continue;
        const opp = document.createElement('div');
        opp.className = `opponent-info${isOut ? ' eliminated' : ''}`;
        const showCards = isSpectator;
        const cardsHtml = showCards
            ? (gameState.players[i].hand.length
                ? gameState.players[i].hand.map(c => {
                    const inner = getCardInnerHtml(c, true);
                    const hasImage = c.imageSrc ? ' has-image' : '';
                    return `<div class="card ${c.cssClass} card-small${hasImage}">${inner}</div>`;
                }).join('')
                : `<div class="opponent-empty">(no cards)</div>`)
            : gameState.players[i].hand.map((_, cardIdx) => {
                const clickable = inCatSteal;
                const cls = clickable ? 'opponent-card clickable' : 'opponent-card';
                return `<div class="${cls}" data-player-index="${i}" data-card-index="${cardIdx}">?</div>`;
            }).join('');
        opp.innerHTML = `
            <div class="opponent-name">${gameState.playerNames[i]}${isOut ? ' (out)' : ''}${showCards ? ' (visible)' : ''}</div>
            <div class="opponent-cards ${showCards ? 'spectator-cards' : ''}">${cardsHtml}</div>
        `;
        if (!showCards && inCatSteal) {
            opp.querySelectorAll('.opponent-card.clickable').forEach(el => {
                el.addEventListener('click', () => onCatStealCardClick(parseInt(el.dataset.playerIndex, 10), parseInt(el.dataset.cardIndex, 10)));
            });
        }
        playersAreaEl.appendChild(opp);
    }

    // Pending cards area: show selected card(s) before confirm
    if (pendingCardsEl) {
        pendingCardsEl.innerHTML = '';
        const hand = gameState.players[handToShowIndex]?.hand || [];
        pendingCards.forEach(pi => {
            const card = hand[pi];
            if (!card) return;
            const el = createCardElement(card, pi, true);
            el.classList.add('pending');
            el.addEventListener('click', () => removeFromPending(pi));
            pendingCardsEl.appendChild(el);
        });
    }

    // Discard area: show all played cards from the beginning (visible to all).
    // When picking from discard (5-cat), cards are clickable.
    if (discardCardsEl) {
        discardCardsEl.innerHTML = '';
        const dp = gameState.discardPile;
        dp.forEach((card, actualIndex) => {
            const el = document.createElement('div');
            const hasImage = card.imageSrc ? ' has-image' : '';
            el.className = `card ${card.cssClass} card-small${hasImage} ${inPickFromDiscard ? 'clickable' : ''}`;
            el.innerHTML = getCardInnerHtml(card, true);
            if (inPickFromDiscard) {
                el.dataset.discardIndex = actualIndex;
                el.addEventListener('click', () => onPickFromDiscardClick(actualIndex));
            }
            discardCardsEl.appendChild(el);
        });
    }

    // Confirm / Cancel visibility
    const hasValidPending = pendingCards.length > 0 && !inCatSteal && !inPickFromDiscard;
    if (confirmPlayBtn) confirmPlayBtn.style.display = hasValidPending ? 'inline-block' : 'none';
    if (cancelPlayBtn) cancelPlayBtn.style.display = hasValidPending ? 'inline-block' : 'none';

    // Cat steal / pick from discard hints
    if (inCatSteal && turnIndicatorEl) {
        turnIndicatorEl.textContent = 'Click a card to take from an opponent';
        if (turnBannerNameEl) turnBannerNameEl.textContent = turnPlayerName;
    } else if (inPickFromDiscard && turnIndicatorEl) {
        turnIndicatorEl.textContent = 'Click a card in the discard pile to take it';
        if (turnBannerNameEl) turnBannerNameEl.textContent = turnPlayerName;
    } else if (turnBannerNameEl) {
        turnBannerNameEl.textContent = turnPlayerName;
    }

    // Show hand(s). Local 2-player: both hands visible; otherwise single hand (current or yours).
    handEl.innerHTML = '';
    if (handPlayer1El) handPlayer1El.innerHTML = '';
    if (isLocalTwoPlayer) {
        for (let pIdx = 0; pIdx <= 1; pIdx++) {
            const container = pIdx === 0 ? handEl : handPlayer1El;
            if (!container) continue;
            const hand = gameState.players[pIdx]?.hand || [];
            const isCurrent = gameState.currentPlayerIndex === pIdx;
            const eliminated = gameState.players[pIdx]?.eliminated;
            hand.forEach((card, idx) => {
                const inPending = isCurrent && pendingCards.includes(idx);
                let playable = isCurrent && canPlayCard(card, idx) && !inPending && !eliminated;
                if (inCatSteal || inPickFromDiscard) playable = false;
                const el = createCardElement(card, idx, playable);
                if (playable) {
                    el.addEventListener('click', () => selectCard(idx));
                }
                container.appendChild(el);
            });
        }
    } else if (isSpectator) {
        handEl.innerHTML = '<p class="spectator-msg">You\'re out! Watch the remaining players above. Draw pile and last played cards are shown in the center.</p>';
    } else {
        const singleHandContainer = handToShowIndex === 0 ? handEl : handPlayer1El;
        if (singleHandContainer) {
            myHand.hand.forEach((card, idx) => {
                const inPending = pendingCards.includes(idx);
                let playable = canPlayCard(card, idx) && !inPending;
                if (isOnline) playable = playable && isMyTurn && !myHand.eliminated;
                if (inCatSteal || inPickFromDiscard) playable = false;
                const el = createCardElement(card, idx, playable);
                if (playable) {
                    el.addEventListener('click', () => selectCard(idx));
                }
                singleHandContainer.appendChild(el);
            });
        }
    }

    drawBtn.disabled = isSpectator || !isMyTurn || (myHand && myHand.eliminated) || inCatSteal || inPickFromDiscard;

    lastHandToShowIndex = handToShowIndex;

    // Shuffle hand: in two-player local show both buttons; in single view show one
    const shuffleBtns = document.querySelectorAll('.shuffle-hand-btn');
    if (shuffleBtns.length) {
        shuffleBtns.forEach(btn => {
            if (isLocalTwoPlayer) {
                btn.style.display = 'inline-block';
            } else {
                const section = btn.closest('.hand-section');
                btn.style.display = (isSpectator || !section) ? 'none' : (section.classList.contains('active') ? 'inline-block' : 'none');
            }
        });
    }
}

function canPlayCard(card, index) {
    if (card.type === 'exploding') return false;
    if (card.id === 'defuse') return false; // Only used when drawing exploding
    if (card.id === 'nope') return false; // Played reactively via Nope flow
    if (card.type === 'action') return true;
    if (card.type === 'cat') {
        const hand = gameState.players[gameState.currentPlayerIndex].hand;
        const cats = hand.filter(c => c.type === 'cat');
        const feralCount = cats.filter(c => c.catType === 'feral').length;
        const counts = {};
        cats.forEach(c => {
            if (c.catType === 'feral') return;
            counts[c.catType] = (counts[c.catType] || 0) + 1;
        });
        // 2-of-a-kind or 3-of-a-kind possible if any real type plus ferals reaches 2+
        let canSameCombo = false;
        for (const t in counts) {
            if (counts[t] + feralCount >= 2) {
                canSameCombo = true;
                break;
            }
        }
        if (!canSameCombo && feralCount >= 2) canSameCombo = true; // e.g. two ferals
        if (canSameCombo) return true;
        // 5 different cats possible with ferals filling gaps
        const nonFeralTypes = Object.keys(counts);
        let distinct = nonFeralTypes.length;
        distinct += Math.min(feralCount, 5 - distinct);
        return distinct >= 5;
    }
    return false;
}

function getPendingCats(hand) {
    return pendingCards.map(i => hand[i]).filter(c => c && c.type === 'cat');
}

// 3-of-a-kind: allow Feral Cat(s) to stand in, but 2 same + 1 different (no feral) must NOT count.
function isPendingThreeSame(hand) {
    if (pendingCards.length !== 3) return false;
    const cats = getPendingCats(hand);
    if (cats.length !== 3) return false;
    const feralCount = cats.filter(c => c.catType === 'feral').length;
    const nonFeral = cats.filter(c => c.catType !== 'feral').map(c => c.catType);
    const counts = {};
    nonFeral.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    // Any real type plus available ferals can make 3 of that type
    for (const t in counts) {
        if (counts[t] + feralCount >= 3) return true;
    }
    // All ferals: they can act as any same type
    if (nonFeral.length === 0 && feralCount === 3) return true;
    return false;
}

// 5 different cats: Feral Cat(s) can fill in missing unique types.
function isPendingFiveDifferent(hand) {
    if (pendingCards.length !== 5) return false;
    const cats = getPendingCats(hand);
    if (cats.length !== 5) return false;
    const feralCount = cats.filter(c => c.catType === 'feral').length;
    const nonFeralTypes = Array.from(new Set(cats.filter(c => c.catType !== 'feral').map(c => c.catType)));
    let distinct = nonFeralTypes.length;
    // Each feral can pretend to be a missing unique cat up to 5 total
    distinct += Math.min(feralCount, 5 - distinct);
    return distinct >= 5;
}

function selectCard(idx) {
    const hand = gameState.players[gameState.currentPlayerIndex]?.hand || [];
    const card = hand[idx];
    if (!card || !canPlayCard(card, idx)) return;

    if (card.type === 'action') {
        // Action cards (Skip, Attack, Shuffle, See the Future) must be played alone.
        // Selecting an action always replaces any existing selection.
        pendingCards = [idx];
    } else if (card.type === 'cat') {
        // Cat combos must not be mixed with an action card selection.
        const hadActionSelected = pendingCards.some(i => hand[i] && hand[i].type === 'action');
        if (hadActionSelected) {
            pendingCards = [];
        }

        const sameTypeIndices = hand.map((c, i) => (c.type === 'cat' && c.catType === card.catType) ? i : -1).filter(i => i >= 0);
        const pendingCats = getPendingCats(hand);
        const pendingTypes = pendingCats.map(c => c.catType);
        const pendingSet = new Set(pendingTypes);

        if (pendingCards.length === 0) {
            pendingCards = [idx];
        } else if (isPendingFiveDifferent(hand)) {
            // Already have a valid 5-different combo selected; don't add more.
            return;
        } else if (pendingCards.length === 1) {
            if (hand[pendingCards[0]].catType === card.catType) {
                pendingCards = sameTypeIndices.length >= 2 ? sameTypeIndices.slice(0, 2) : [pendingCards[0], idx];
            } else {
                pendingCards = [pendingCards[0], idx];
            }
        } else if (pendingCards.length === 2 && pendingSet.size === 1) {
            if (card.catType === pendingTypes[0] && sameTypeIndices.length >= 3) {
                pendingCards = sameTypeIndices.slice(0, 3);
            } else if (card.catType !== pendingTypes[0]) {
                pendingCards = [pendingCards[0], pendingCards[1], idx];
            }
        } else if (pendingCards.length === 2 && pendingSet.size === 2) {
            // Two different types selected (e.g. 1 regular + 1 feral). Adding a third can make 3-of-a-kind (e.g. regular + 2 ferals).
            const withThird = [pendingCards[0], pendingCards[1], idx];
            const tempPending = pendingCards.slice();
            pendingCards = withThird;
            const wouldBeThreeSame = isPendingThreeSame(hand);
            pendingCards = tempPending;
            if (wouldBeThreeSame) {
                pendingCards = withThird;
            } else if (card.catType === hand[pendingCards[0]].catType && sameTypeIndices.length >= 3) {
                pendingCards = sameTypeIndices.slice(0, 3);
            } else if (!pendingSet.has(card.catType)) {
                pendingCards = [pendingCards[0], pendingCards[1], idx];
            } else {
                pendingCards = [idx];
            }
        } else if (pendingCards.length >= 3 && pendingCards.length < 5 && pendingSet.size === pendingCards.length) {
            if (!pendingSet.has(card.catType)) {
                pendingCards = [...pendingCards, idx];
            }
        } else {
            pendingCards = [idx];
        }
    }
    renderGame();
}

function removeFromPending(idx) {
    pendingCards = pendingCards.filter(i => i !== idx);
    renderGame();
}

function cancelPlay() {
    pendingCards = [];
    renderGame();
}

function confirmPlay() {
    if (pendingCards.length === 0) return;
    const actingPlayerIndex = gameState.currentPlayerIndex;
    const hand = gameState.players[actingPlayerIndex]?.hand || [];
    const cards = pendingCards.map(i => hand[i]).filter(Boolean);
    if (cards.length === 0) return;

    const card = cards[0];
    let indicesToDiscard = []; // when Nope cancels, we still discard these cards

    // All plays (except Defuse, which is never played from hand this way) can be Nope'd. Run Nope flow first, then execute.
    if (isOnline) {
        // Online: execute directly; Nope flow is handled via pendingNope/state when we add it.
        if (card.type === 'cat') {
            const h = gameState.players[actingPlayerIndex]?.hand || [];
            const count = isPendingFiveDifferent(h) ? 5 : isPendingThreeSame(h) ? 3 : 2;
            executeCatCombo(count);
        } else {
            executeActionCard(pendingCards[0]);
        }
        return;
    }

    let cardDescriptor = card;
    let effectFn;

    if (card.type === 'cat') {
        const h = gameState.players[actingPlayerIndex]?.hand || [];
        const count = isPendingFiveDifferent(h) ? 5 : isPendingThreeSame(h) ? 3 : 2;
        const indicesCopy = [...pendingCards].sort((a, b) => a - b).reverse().slice(0, count);
        indicesToDiscard = indicesCopy;
        cardDescriptor = {
            name: count === 2 ? '2 Same Cats' : count === 3 ? '3 Same Cats' : '5 Different Cards',
            emoji: '🐱',
        };
        effectFn = () => {
            pendingCards = indicesCopy;
            executeCatCombo(count);
        };
    } else {
        const actionIndex = pendingCards[0];
        indicesToDiscard = [actionIndex];
        cardDescriptor = hand[actionIndex];
        effectFn = () => executeActionCard(actionIndex);
    }

    const onCancelled = () => {
        discardPlayedCards(actingPlayerIndex, indicesToDiscard);
        pendingCards = [];
        renderGame();
        syncStateIfOnline();
    };

    handleLocalNope(actingPlayerIndex, cardDescriptor, effectFn, 0, onCancelled);
}

function onCatStealCardClick(targetPlayerIndex, cardIndex) {
    if (!catStealMode) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    const targetHand = gameState.players[targetPlayerIndex].hand;
    if (cardIndex < 0 || cardIndex >= targetHand.length) return;
    const taken = targetHand.splice(cardIndex, 1)[0];
    player.hand.push(taken);
    catStealMode = null;
    pendingCards = [];
    // Same player's turn continues; they still must draw later.
    renderGame();
    syncStateIfOnline();
}

function onPickFromDiscardClick(discardIndex) {
    if (!pickFromDiscardMode) return;
    const dp = gameState.discardPile;
    if (discardIndex < 0 || discardIndex >= dp.length) return;
    const card = dp.splice(discardIndex, 1)[0];
    gameState.players[gameState.currentPlayerIndex].hand.push(card);
    pickFromDiscardMode = null;
    // Still same player's turn; they must still draw later.
    renderGame();
    syncStateIfOnline();
}

// Unified Nope flow (local + online): state-driven so all clients see the same window.
function getNopeHolders() {
    const out = [];
    for (let i = 0; i < gameState.playerCount; i++) {
        if (gameState.players[i].eliminated) continue;
        if (gameState.players[i].hand.some(c => c.id === 'nope')) {
            out.push({ index: i, name: gameState.playerNames[i] });
        }
    }
    return out;
}

function playNopeFromState(playerIndex) {
    if (!gameState.pendingNope) return;
    const hand = gameState.players[playerIndex].hand;
    const nopeIdx = hand.findIndex(c => c.id === 'nope');
    if (nopeIdx < 0) return;
    const nopeCard = hand.splice(nopeIdx, 1)[0];
    gameState.discardPile.push(nopeCard);
    gameState.pendingNope.parity = (gameState.pendingNope.parity || 0) + 1;
    syncStateIfOnline();
    renderGame();
}

function resolvePendingNope() {
    if (!gameState.pendingNope) return;
    modalOverlay.classList.add('hidden');
    const p = gameState.pendingNope;
    const cancelled = (p.parity || 0) % 2 === 1;
    gameState.pendingNope = null;
    if (cancelled) {
        advanceTurn();
    } else {
        runPendingEffect(p);
    }
    syncStateIfOnline();
    renderGame();
}

function runPendingEffect(p) {
    const acting = p.actingPlayerIndex;
    if (p.effectType === 'skip') {
        if (gameState.attacksPending > 0) {
            gameState.attacksPending--;
            if (gameState.attacksPending === 0) advanceTurn();
        } else advanceTurn();
    } else if (p.effectType === 'attack') {
        gameState.attacksPending = (gameState.attacksPending || 0) + 2;
        advanceTurn();
    } else if (p.effectType === 'see_future') {
        const top3 = gameState.drawPile.slice(0, 3);
        const html = top3.map(c => `<div class="card ${c.cssClass}">${c.emoji} ${c.name}</div>`).join('');
        showModal('See the Future', html);
    } else if (p.effectType === 'alter_future') {
        runAlterFutureFlow();
    } else if (p.effectType === 'draw_from_bottom') {
        gameState.nextDrawFromBottom = true;
    } else if (p.effectType === 'shuffle') {
        gameState.drawPile = shuffle(gameState.drawPile);
        advanceTurn();
    } else if (p.effectType === 'favor') {
        const targets = [];
        for (let i = 0; i < gameState.playerCount; i++) {
            if (i !== acting && !gameState.players[i].eliminated && gameState.players[i].hand.length > 0) {
                targets.push({ index: i, name: gameState.playerNames[i] });
            }
        }
        if (targets.length === 0) {
            advanceTurn();
        } else {
            const html = targets.map(t => `<button class="btn" data-target="${t.index}">${t.name}</button>`).join('');
            showModal('Choose player to take a card from', html, () => {});
            modalContent.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const targetIdx = parseInt(btn.dataset.target, 10);
                    modalOverlay.classList.add('hidden');
                    showFavorNotificationThenPicker(acting, targetIdx, () => advanceTurn());
                };
            });
        }
    } else if (p.effectType === '3cat') {
        run3CatRequestFlow(p.actingPlayerIndex);
    } else if (p.effectType === '5cat') {
        run5CatPickFromDiscardFlow(p.actingPlayerIndex);
    }
}

function run3CatRequestFlow(actingPlayerIndex) {
    const targets = [];
    for (let i = 0; i < gameState.playerCount; i++) {
        if (i !== actingPlayerIndex && !gameState.players[i].eliminated) {
            targets.push({ index: i, name: gameState.playerNames[i] });
        }
    }
    if (targets.length === 0) {
        // No valid targets; 3 cats are wasted but turn continues.
        renderGame();
        syncStateIfOnline();
        return;
    }
    const html = '<p>Pick a player to request a card from:</p>' +
        targets.map(t => `<button class="btn" data-target="${t.index}">${t.name}</button>`).join('');
    showModal('3 Same Cats – Pick a player', html, () => {});
    modalContent.querySelectorAll('[data-target]').forEach(btn => {
        btn.onclick = () => {
            const targetIdx = parseInt(btn.dataset.target, 10);
            modalOverlay.classList.add('hidden');
            const cardOptions = REQUESTABLE_CARDS.map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
            const optionsHtml = '<p>Which card do you want to request?</p>' +
                cardOptions.map(c => `<button class="btn" data-card-id="${c.id}">${c.emoji} ${c.name}</button>`).join('');
            showModal('Request a card by name', optionsHtml, () => {});
            modalContent.querySelectorAll('[data-card-id]').forEach(optBtn => {
                optBtn.onclick = () => {
                    const requestedId = optBtn.dataset.cardId;
                    const targetHand = gameState.players[targetIdx].hand;
                    const hasCard = targetHand.some(c => c.id === requestedId);
                    modalOverlay.classList.add('hidden');
                    if (!hasCard) {
                        showModal('3 cats wasted', `<p>${gameState.playerNames[targetIdx]} doesn't have that card. Nothing happens.</p>`, () => {});
                        modalClose.onclick = () => {
                            modalOverlay.classList.add('hidden');
                            // Same player's turn continues.
                            renderGame();
                            syncStateIfOnline();
                        };
                        return;
                    }
                    const holders = getNopeHolders();
                    if (holders.length > 0) {
                        let html2 = `<p>${gameState.playerNames[targetIdx]} has the card. Does anyone play Nope to block the request?</p>`;
                        html2 += holders.map(h => `<button class="btn" data-nope-player="${h.index}">Play Nope as ${h.name}</button>`).join('');
                        html2 += '<button class="btn btn-secondary" id="nope-pass-3">No Nope</button>';
                        showModal('Play Nope?', html2, () => {});
                        modalContent.querySelectorAll('[data-nope-player]').forEach(nb => {
                            nb.onclick = () => {
                                const pIdx = parseInt(nb.dataset.nopePlayer, 10);
                                const hand = gameState.players[pIdx].hand;
                                const nopeIdx = hand.findIndex(c => c.id === 'nope');
                                if (nopeIdx >= 0) {
                                    const nopeCard = hand.splice(nopeIdx, 1)[0];
                                    gameState.discardPile.push(nopeCard);
                                }
                                modalOverlay.classList.add('hidden');
                                showModal('3 cats wasted', '<p>Nope! The request was blocked. 3 cats wasted.</p>', () => {});
                                modalClose.onclick = () => {
                                    modalOverlay.classList.add('hidden');
                                    // Same player's turn continues.
                                    renderGame();
                                    syncStateIfOnline();
                                };
                            };
                        });
                        const passBtn = document.getElementById('nope-pass-3');
                        if (passBtn) passBtn.onclick = () => {
                            modalOverlay.classList.add('hidden');
                            giveRequestedCard(actingPlayerIndex, targetIdx, requestedId);
                        };
                    } else {
                        giveRequestedCard(actingPlayerIndex, targetIdx, requestedId);
                    }
                };
            });
        };
    });
}

function giveRequestedCard(actingPlayerIndex, targetIdx, requestedId) {
    const targetHand = gameState.players[targetIdx].hand;
    const cardIdx = targetHand.findIndex(c => c.id === requestedId);
    if (cardIdx >= 0) {
        const taken = targetHand.splice(cardIdx, 1)[0];
        gameState.players[actingPlayerIndex].hand.push(taken);
    }
    // Request resolved; same player's turn continues so they can still draw.
    renderGame();
    syncStateIfOnline();
}

function run5CatPickFromDiscardFlow(actingPlayerIndex) {
    if (gameState.discardPile.length === 0) {
        showModal('5 cats wasted', '<p>The discard pile is empty. Nothing to take.</p>', () => {});
        modalClose.onclick = () => {
            modalOverlay.classList.add('hidden');
            // Turn continues.
            renderGame();
            syncStateIfOnline();
        };
        return;
    }
    pickFromDiscardMode = { active: true };
    renderGame();
    syncStateIfOnline();
}

function showNopeModalFromState() {
    const p = gameState.pendingNope;
    if (!p) return;
    const name = gameState.playerNames[p.actingPlayerIndex];
    let html = `<p><strong>${name}</strong> played ${p.emoji || ''} ${p.cardName}.</p>`;
    html += '<p>Does anyone want to play a Nope? Each Nope flips whether it takes effect.</p>';
    const holders = getNopeHolders();
    if (isOnline) {
        const me = holders.find(h => h.index === myPlayerIndex);
        if (me) html += `<button class="btn" data-nope-player="${me.index}">Play Nope (${me.name})</button>`;
    } else {
        holders.forEach(h => {
            html += `<button class="btn" data-nope-player="${h.index}">Play Nope as ${h.name}</button>`;
        });
    }
    html += '<button class="btn btn-secondary" id="nope-pass">No Nope</button>';
    showModal('Play Nope?', html, () => {});
    modalContent.querySelectorAll('[data-nope-player]').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.nopePlayer, 10);
            playNopeFromState(idx);
        };
    });
    const passBtn = document.getElementById('nope-pass');
    if (passBtn) passBtn.onclick = () => { modalOverlay.classList.add('hidden'); resolvePendingNope(); };
}

// When Nope cancels an action, the played cards still go to the discard pile (action has no effect but cards are lost).
function discardPlayedCards(playerIndex, indices) {
    const hand = gameState.players[playerIndex]?.hand;
    if (!hand) return;
    const sorted = [...indices].sort((a, b) => b - a);
    sorted.forEach(idx => {
        if (idx >= 0 && idx < hand.length) {
            const c = hand.splice(idx, 1)[0];
            if (c) gameState.discardPile.push(c);
        }
    });
}

// Local (same-device) Nope resolution: lets any player with a Nope cancel or re-enable an effect.
// onCancelled (optional): called when effect is cancelled (e.g. to advance turn for cat combos).
// Used only when we want modal-driven flow without persisting pendingNope (kept for any legacy paths).
function handleLocalNope(actingPlayerIndex, card, effectFn, parity = 0, onCancelled = null) {
    const nopeHolders = [];
    for (let i = 0; i < gameState.playerCount; i++) {
        if (gameState.players[i].eliminated) continue;
        if (i === actingPlayerIndex) continue; // acting player cannot Nope their own play
        const hasNope = gameState.players[i].hand.some(c => c.id === 'nope');
        if (hasNope) {
            nopeHolders.push({ index: i, name: gameState.playerNames[i] });
        }
    }

    // No one can Nope: resolve immediately or treat as cancelled based on parity
    if (nopeHolders.length === 0) {
        const cancelled = (parity % 2) === 1;
        if (!cancelled) {
            effectFn();
        } else {
            if (onCancelled) onCancelled();
            renderGame();
            syncStateIfOnline();
        }
        return;
    }

    let html = `<p><strong>${gameState.playerNames[actingPlayerIndex]}</strong> played ${card.emoji || ''} ${card.name}.</p>`;
    html += '<p>Does anyone want to play a Nope? Each Nope flips whether it takes effect.</p>';
    html += '<div class="nope-buttons">';
    nopeHolders.forEach(h => {
        html += `<button class="btn" data-nope-player="${h.index}">Play Nope as ${h.name}</button>`;
    });
    html += '</div>';
    html += '<button class="btn btn-secondary" id="nope-pass">No more Nopes</button>';

    showModal('Play Nope?', html, () => {});

    // Someone plays a Nope
    modalContent.querySelectorAll('[data-nope-player]').forEach(btn => {
        btn.onclick = () => {
            const pIdx = parseInt(btn.dataset.nopePlayer, 10);
            const hand = gameState.players[pIdx].hand;
            const nopeIdx = hand.findIndex(c => c.id === 'nope');
            if (nopeIdx >= 0) {
                const nopeCard = hand.splice(nopeIdx, 1)[0];
                gameState.discardPile.push(nopeCard);
            }
            modalOverlay.classList.add('hidden');
            renderGame();
            syncStateIfOnline();
            handleLocalNope(actingPlayerIndex, card, effectFn, parity ^ 1, onCancelled);
        };
    });

    const passBtn = document.getElementById('nope-pass');
    if (passBtn) {
        passBtn.onclick = () => {
            modalOverlay.classList.add('hidden');
            const cancelled = (parity % 2) === 1;
            if (!cancelled) {
                effectFn();
            } else {
                if (onCancelled) onCancelled();
                renderGame();
                syncStateIfOnline();
            }
        };
    }
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

function runAlterFutureFlow() {
    const top3 = gameState.drawPile.slice(0, 3);
    if (top3.length < 3) {
        renderGame();
        syncStateIfOnline();
        return;
    }
    let orderedCards = [...top3];

    function renderSlots() {
        const container = document.getElementById('alter-future-slots');
        if (!container) return;
        container.innerHTML = '';
        orderedCards.forEach((card, i) => {
            const slot = document.createElement('div');
            slot.className = 'alter-future-slot';
            slot.dataset.slotIndex = String(i);
            const cardEl = document.createElement('div');
            cardEl.className = `card ${card.cssClass} has-image`;
            cardEl.innerHTML = getCardInnerHtml(card, false);
            cardEl.draggable = true;
            cardEl.dataset.cardIndex = String(i);
            cardEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i);
                e.dataTransfer.effectAllowed = 'move';
                e.target.classList.add('alter-future-dragging');
            });
            cardEl.addEventListener('dragend', (e) => e.target.classList.remove('alter-future-dragging'));
            slot.appendChild(cardEl);
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const to = parseInt(slot.dataset.slotIndex, 10);
                if (from === to) return;
                const card = orderedCards[from];
                orderedCards.splice(from, 1);
                orderedCards.splice(to, 0, card);
                renderSlots();
            });
            container.appendChild(slot);
        });
    }

    const html = '<p>Drag cards to set the new order (left = top of deck).</p>' +
        '<div id="alter-future-slots" class="alter-future-slots"></div>' +
        '<button class="btn btn-primary" id="alter-future-confirm">Confirm order</button>';
    showModal('Alter Future', html, () => {});
    renderSlots();

    document.getElementById('alter-future-confirm').onclick = () => {
        gameState.drawPile.splice(0, 3, ...orderedCards);
        modalOverlay.classList.add('hidden');
        renderGame();
        syncStateIfOnline();
    };
}

function executeActionCard(index) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const card = player.hand[index];
    if (!card || card.type === 'cat') return;

    player.hand.splice(index, 1);
    gameState.discardPile.push(card);
    pendingCards = [];

    // Turn only ends immediately for Skip / Attack.
    if (card.id === 'skip') {
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
        gameState.attacksPending = (gameState.attacksPending || 0) + 2;
        advanceTurn();
        renderGame();
        syncStateIfOnline();
        return;
    }

    if (card.id === 'see_future') {
        const top3 = gameState.drawPile.slice(0, 3);
        const html = top3.map(c => `<div class="card ${c.cssClass}">${c.emoji} ${c.name}</div>`).join('');
        showModal('See the Future', html);
        renderGame();
        syncStateIfOnline();
        return;
    }

    if (card.id === 'alter_future') {
        runAlterFutureFlow();
        return;
    }

    if (card.id === 'draw_from_bottom') {
        gameState.nextDrawFromBottom = true;
        renderGame();
        syncStateIfOnline();
        return;
    }

    if (card.id === 'shuffle') {
        gameState.drawPile = shuffle(gameState.drawPile);
        // Same player's turn continues; they still must draw later.
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
            renderGame();
            syncStateIfOnline();
            return;
        }
        const actingPlayerIndex = gameState.currentPlayerIndex;
        const html = targets.map(t => `<button class="btn" data-target="${t.index}">${t.name}</button>`).join('');
        showModal('Choose player to take a card from', html, () => {});
        modalContent.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                const targetIdx = parseInt(btn.dataset.target, 10);
                modalOverlay.classList.add('hidden');
                showFavorNotificationThenPicker(actingPlayerIndex, targetIdx, () => {});
            };
        });
        return;
    }

    // Playing Nope (or any other action we don't special‑case) just discards it; turn continues.
    syncStateIfOnline();
    renderGame();
}

function executeCatCombo(count) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const indices = [...pendingCards].sort((a, b) => a - b).reverse();
    const toRemove = indices.slice(0, count);
    const cardsToDiscard = [];
    toRemove.forEach(idx => {
        const c = player.hand[idx];
        if (c) {
            player.hand.splice(idx, 1);
            cardsToDiscard.push(c);
        }
    });
    gameState.discardPile.push(...cardsToDiscard);
    pendingCards = [];
    syncStateIfOnline();

    if (count === 2) {
        const targets = [];
        for (let i = 0; i < gameState.playerCount; i++) {
            if (i !== gameState.currentPlayerIndex && !gameState.players[i].eliminated && gameState.players[i].hand.length > 0) {
                targets.push({ index: i });
            }
        }
        if (targets.length > 0) {
            catStealMode = { waitingForCardClick: true };
            renderGame();
        } else {
            advanceTurn();
            renderGame();
            syncStateIfOnline();
        }
    } else if (count === 3) {
        run3CatRequestFlow(gameState.currentPlayerIndex);
    } else if (count === 5) {
        run5CatPickFromDiscardFlow(gameState.currentPlayerIndex);
    }
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

    const fromBottom = gameState.nextDrawFromBottom === true;
    if (fromBottom) gameState.nextDrawFromBottom = false;
    const card = fromBottom ? gameState.drawPile.pop() : gameState.drawPile.shift();
    const player = gameState.players[gameState.currentPlayerIndex];

    if (card.id === 'exploding') {
        gameState.explodingReveal = { playerIndex: gameState.currentPlayerIndex };
        syncStateIfOnline();
        const playerName = gameState.playerNames[gameState.currentPlayerIndex];

        const hasDefuse = player.hand.findIndex(c => c.id === 'defuse') >= 0;

        if (hasDefuse) {
            // Has defuse: no Continue/Close — show only the two choices
            const defuseIdx = player.hand.findIndex(c => c.id === 'defuse');
            player.hand.splice(defuseIdx, 1);
            gameState.discardPile.push(CARD_TYPES.DEFUSE);

            const placeAt = (index) => {
                gameState.drawPile.splice(index, 0, card);
                gameState.explodingReveal = null;
                // Turn ends immediately after placing the Exploding Kitten back
                gameState.attacksPending = 0;
                modalOverlay.classList.add('hidden');
                if (modalClose) modalClose.style.display = '';
                advanceTurn();
                drawBtn.disabled = false;
                renderGame();
                syncStateIfOnline();
            };

            const cardHtml = '<div class="exploding-reveal-card">' + getCardInnerHtml(CARD_TYPES.EXPLODING, false) + '</div>';
            const defuseHtml = cardHtml +
                `<p class="exploding-reveal-msg">${playerName} has drawn an Exploding Kitten.</p>` +
                '<div class="defuse-options">' +
                '<button class="btn btn-primary" id="defuse-place-random-btn">Place kitten back randomly</button>' +
                '<button class="btn btn-secondary" id="defuse-choose-position-btn">Choose where to place kitten</button>' +
                '</div>';
            showModal('Exploding Kitten', defuseHtml, () => {});
            if (modalClose) modalClose.style.display = 'none';

            const randomBtn = document.getElementById('defuse-place-random-btn');
            if (randomBtn) randomBtn.onclick = () => {
                const index = Math.floor(Math.random() * (gameState.drawPile.length + 1));
                placeAt(index);
            };

            const choosePosBtn = document.getElementById('defuse-choose-position-btn');
            if (choosePosBtn) choosePosBtn.onclick = () => {
                modalOverlay.classList.add('hidden');
                const maxPos = gameState.drawPile.length + 1;
                let posHtml = '<p>Choose the position in the draw pile (1 = top):</p>';
                posHtml += '<div class="defuse-positions">';
                for (let pos = 1; pos <= maxPos; pos++) {
                    posHtml += `<button class="btn" data-pos="${pos}">${pos}</button>`;
                }
                posHtml += '</div>';
                showModal('Choose position', posHtml, () => { if (modalClose) modalClose.style.display = ''; });
                if (modalClose) modalClose.style.display = 'none';
                modalContent.querySelectorAll('[data-pos]').forEach(btn => {
                    btn.onclick = () => {
                        const pos = parseInt(btn.dataset.pos, 10);
                        const index = Math.min(Math.max(pos - 1, 0), gameState.drawPile.length);
                        placeAt(index);
                    };
                });
            };
            return;
        }

        // No defuse: show "You drew an Exploding Kitten!" then eliminate
        const cardHtml = '<div class="exploding-reveal-card">' + getCardInnerHtml(CARD_TYPES.EXPLODING, false) + '</div>';
        const msg = isOnline && gameState.currentPlayerIndex === myPlayerIndex
            ? 'You drew an Exploding Kitten!'
            : `${playerName} drew an Exploding Kitten!`;
        const html = cardHtml + '<p class="exploding-reveal-msg">' + msg + '</p><button class="btn" id="exploding-reveal-continue">Continue</button>';
        showModal('Exploding Kitten!', html, () => {});

        const continueBtn = document.getElementById('exploding-reveal-continue');
        if (continueBtn) continueBtn.onclick = () => {
            modalOverlay.classList.add('hidden');
            gameState.explodingReveal = null;
            player.eliminated = true;
            gameState.lastEliminatedPlayerIndex = gameState.currentPlayerIndex;
            const alive = gameState.players.filter(p => !p.eliminated);
            if (alive.length === 1) {
                const winnerIdx = gameState.players.findIndex(p => !p.eliminated);
                gameState.winnerIndex = winnerIdx;
                showWinner(winnerIdx);
                syncStateIfOnline();
                if (isOnline && supabaseClient && roomCode) {
                    supabaseClient.from('rooms').update({
                        status: 'ended',
                        game_state: serializeState(),
                        last_updated: new Date().toISOString(),
                    }).eq('room_code', roomCode).catch(() => {});
                }
                return;
            }
            advanceTurn();
            drawBtn.disabled = false;
            renderGame();
            syncStateIfOnline();
        };
        return;
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
    const winnerName = gameState.playerNames[winnerIndex];
    // Show winner as a modal on top of the game so players can still see the board and their cards
    const msg = `🎉 ${winnerName} Wins! 🏆`;
    const sub = 'They avoided all the Exploding Kittens! 🐱💥';
    const html = `<p class="winner-modal-msg">${msg}</p><p class="winner-modal-sub">${sub}</p><div class="winner-modal-buttons"><button class="btn btn-primary" id="winner-modal-play-again">Play Again (Same Party)</button><button class="btn btn-ghost" id="winner-modal-cancel">Cancel</button></div>`;
    showModal('Game Over', html, () => {});
    if (modalClose) {
        modalClose.style.display = 'block';
        modalClose.textContent = 'Close';
        modalClose.onclick = () => {
            modalOverlay.classList.add('hidden');
            modalClose.style.display = '';
            modalClose.textContent = 'Close';
            if (isOnline) leaveRoom();
            else showScreen('home');
        };
    }
    const playAgainEl = document.getElementById('winner-modal-play-again');
    const cancelEl = document.getElementById('winner-modal-cancel');
    if (playAgainEl) {
        playAgainEl.onclick = () => {
            modalOverlay.classList.add('hidden');
            if (modalClose) { modalClose.style.display = ''; modalClose.textContent = 'Close'; }
            if (isOnline) restartGameOnline();
            else setupGameFromState(gameState.playerNames, gameState.playerCount, gameState.gameMode);
        };
    }
    if (cancelEl) {
        cancelEl.onclick = () => {
            modalOverlay.classList.add('hidden');
            if (modalClose) { modalClose.style.display = ''; modalClose.textContent = 'Close'; }
            if (isOnline) leaveRoom();
            else showScreen('home');
        };
    }
}

function syncStateIfOnline() {
    if (isOnline && supabaseClient && roomCode) {
        updateGameStateOnline(serializeState()).catch(() => {});
    }
}

// Event listeners (guard so one missing element doesn't break all)
if (startBtn) startBtn.addEventListener('click', setupGame);

if (backBtn) backBtn.addEventListener('click', () => {
    gameScreen.classList.remove('active');
    winnerScreen.classList.remove('active');
    if (isOnline) {
        showScreen('room-lobby');
    } else {
        lobby.classList.add('active');
        showScreen('lobby');
    }
});

if (drawPileEl) drawPileEl.addEventListener('click', () => {
    if (!drawBtn.disabled) drawCard();
});
if (drawBtn) drawBtn.addEventListener('click', drawCard);
if (handSectionsEl) handSectionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.shuffle-hand-btn');
    if (!btn) return;
    const isLocalTwoPlayer = !isOnline && gameState.playerCount === 2;
    const idx = isLocalTwoPlayer && btn.dataset.player != null ? parseInt(btn.dataset.player, 10) : (isOnline ? myPlayerIndex : lastHandToShowIndex);
    if (idx >= 0) shufflePlayerHand(idx);
});
if (confirmPlayBtn) confirmPlayBtn.addEventListener('click', confirmPlay);
if (cancelPlayBtn) cancelPlayBtn.addEventListener('click', cancelPlay);

if (showRulesBtn) showRulesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    rulesModal.classList.remove('hidden');
});
if (document.getElementById('show-rules-home')) {
    document.getElementById('show-rules-home').addEventListener('click', (e) => {
        e.preventDefault();
        rulesModal.classList.remove('hidden');
    });
}

if (closeRulesBtn) closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
    winnerScreen.classList.remove('active');
    if (isOnline) {
        restartGameOnline();
    } else {
        setupGameFromState(gameState.playerNames, gameState.playerCount, gameState.gameMode);
    }
});

if (winnerCancelBtn) winnerCancelBtn.addEventListener('click', () => {
    winnerScreen.classList.remove('active');
    if (isOnline) {
        leaveRoom();
    } else {
        showScreen('home');
    }
});

// Home & online flow
if (playLocalBtn) playLocalBtn.addEventListener('click', () => showScreen('lobby'));
if (playOnlineBtn) playOnlineBtn.addEventListener('click', () => {
    loadSupabaseScript().then(() => {
        initSupabaseClient();
        showScreen('online-setup');
    });
});
if (createPartyBtn) createPartyBtn.addEventListener('click', () => showScreen('create-party-form'));
if (onlineBackBtn) onlineBackBtn.addEventListener('click', () => showScreen('home'));
if (createBackBtn) createBackBtn.addEventListener('click', () => showScreen('online-setup'));
if (createPartySubmitBtn) createPartySubmitBtn.addEventListener('click', () => createRoom());
if (joinPartyBtn) joinPartyBtn.addEventListener('click', () => joinRoom());
if (roomStartBtn) roomStartBtn.addEventListener('click', () => startGameOnline());
if (roomLeaveBtn) roomLeaveBtn.addEventListener('click', () => leaveRoom());
