// ============== FIREBASE CONFIG ==============
const firebaseConfig = {
  apiKey: "AIzaSyBrKW0ltAkQiKcYD3OAolCoGRjvk-JtM7c",
  authDomain: "nba-pool-2026.firebaseapp.com",
  databaseURL: "https://nba-pool-2026-default-rtdb.firebaseio.com",
  projectId: "nba-pool-2026",
  storageBucket: "nba-pool-2026.firebasestorage.app",
  messagingSenderId: "939431198504",
  appId: "1:939431198504:web:61e3ce741f5910ff75da1d",
  measurementId: "G-V1M33694BT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============== CONFIG ==============

const players = ['WILL', 'OLI', 'MIK', 'TOM', 'SAM', 'DOUSKI'];
let currentUser = null;
let isAdmin = false;

const PIN_CODES = {
    'MANAGER': '2417',
    'WILL': '0220',
    'OLI': '1005',
    'MIK': '0508',
    'TOM': '0716',
    'SAM': '0506',
    'DOUSKI': '0731'
};

const ADMIN_USER = 'MANAGER';

// ============== TEAM LABELS ==============

const TEAM_LABELS = {
    "pistons": "Pistons", "celtics": "Celtics", "knicks": "Knicks",
    "cavaliers": "Cavaliers", "raptors": "Raptors", "hawks": "Hawks",
    "76ers": "76ers", "magic": "Magic", "hornets": "Hornets", "heat": "Heat",
    "thunder": "Thunder", "spurs": "Spurs", "nuggets": "Nuggets",
    "lakers": "Lakers", "rockets": "Rockets", "timberwolves": "T-Wolves",
    "suns": "Suns", "trail blazers": "Blazers", "clippers": "Clippers",
    "warriors": "Warriors",
};

function teamLabel(val) {
    return TEAM_LABELS[val] || val || "TBD";
}

// ============== BRACKET STRUCTURE ==============

const MVP_SERIES = ["ff_2", "ff_4", "fin_2"];

// Which series' winner feeds into which next series
const FEEDS_TO = {
    rd1_1: { target: "rd2_1", slot: "team1" },
    rd1_2: { target: "rd2_1", slot: "team2" },
    rd1_3: { target: "rd2_2", slot: "team1" },
    rd1_4: { target: "rd2_2", slot: "team2" },
    rd1_5: { target: "rd2_3", slot: "team1" },
    rd1_6: { target: "rd2_3", slot: "team2" },
    rd1_7: { target: "rd2_4", slot: "team1" },
    rd1_8: { target: "rd2_4", slot: "team2" },
    rd2_1: { target: "ff_1", slot: "team1" },
    rd2_2: { target: "ff_1", slot: "team2" },
    rd2_3: { target: "ff_3", slot: "team1" },
    rd2_4: { target: "ff_3", slot: "team2" },
    ff_1:  { target: "fin_1", slot: "team1" },
    ff_3:  { target: "fin_1", slot: "team2" },
};

// Default bracket data (Round 1 teams preset, rest computed from results)
const DEFAULT_BRACKET = {
    rd1_1: { team1: "pistons", team2: null, winner: null },
    rd1_2: { team1: "celtics", team2: null, winner: null },
    rd1_3: { team1: "knicks", team2: "hawks", winner: null },
    rd1_4: { team1: "cavaliers", team2: "raptors", winner: null },
    rd1_5: { team1: "thunder", team2: null, winner: null },
    rd1_6: { team1: "spurs", team2: null, winner: null },
    rd1_7: { team1: "nuggets", team2: "timberwolves", winner: null },
    rd1_8: { team1: "lakers", team2: "rockets", winner: null },
    rd2_1: { team1: null, team2: null, winner: null },
    rd2_2: { team1: null, team2: null, winner: null },
    rd2_3: { team1: null, team2: null, winner: null },
    rd2_4: { team1: null, team2: null, winner: null },
    ff_1:  { team1: null, team2: null, winner: null },
    ff_3:  { team1: null, team2: null, winner: null },
    fin_1: { team1: null, team2: null, winner: null },
};

// Display config
const bracketData = [
    { 
        title: "Première ronde", roundKey: "rd1",
        series: [
            { id: "rd1_1" }, { id: "rd1_2" }, { id: "rd1_3" }, { id: "rd1_4" },
            { id: "rd1_5" }, { id: "rd1_6" }, { id: "rd1_7" }, { id: "rd1_8" }
        ] 
    },
    { 
        title: "Deuxième ronde", roundKey: "rd2",
        series: [{ id: "rd2_1" }, { id: "rd2_2" }, { id: "rd2_3" }, { id: "rd2_4" }] 
    },
    { 
        title: "Finales de conférence", roundKey: "ff",
        series: [{ id: "ff_1" }, { id: "ff_2" }, { id: "ff_3" }, { id: "ff_4" }] 
    },
    { 
        title: "Finales NBA", roundKey: "fin",
        series: [{ id: "fin_1" }, { id: "fin_2" }] 
    }
];

const teamAliases = { "cavs": "cavaliers", "sixers": "76ers", "wolves": "timberwolves", "blazers": "trail blazers" };
let realResults = {};
let liveSeriesScores = {};
let realMvps = {};
let serverPredictions = {};
let roundLocks = { rd1: false, rd2: true, ff: true, fin: true };

// Live bracket state (computed from Firebase)
let bracket = JSON.parse(JSON.stringify(DEFAULT_BRACKET));

// All teams for play-in assignment dropdowns (admin only)
const EAST_PLAYIN = ["76ers", "magic", "hornets", "heat"];
const WEST_PLAYIN = ["suns", "trail blazers", "clippers", "warriors"];

// ============== INIT ==============

document.addEventListener("DOMContentLoaded", () => { setupLogin(); });

// ============== LOGIN ==============

function setupLogin() {
    let selectedPlayer = null;
    const btns = document.querySelectorAll('.player-btn');
    const pinSection = document.getElementById('pin-section');
    
    btns.forEach(b => {
        b.addEventListener('click', (e) => {
            btns.forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedPlayer = e.target.dataset.p;
            pinSection.style.display = 'block';
            document.getElementById('pin-input').focus();
        });
    });

    document.getElementById('login-submit').addEventListener('click', () => {
        const pin = document.getElementById('pin-input').value;
        if (!selectedPlayer || !pin) return;
        
        if (PIN_CODES[selectedPlayer] === pin) {
            currentUser = selectedPlayer;
            isAdmin = (selectedPlayer === ADMIN_USER);
            document.getElementById('login-modal').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-modal').style.display = 'none';
                const mainApp = document.getElementById('main-app');
                mainApp.style.filter = 'none';
                mainApp.style.pointerEvents = 'all';
                if(isAdmin) {
                    document.getElementById("sync-status").textContent = "MODE ADMIN ACTIVÉ";
                    document.getElementById("sync-status").style.color = "#FF4500";
                    
                    if (!document.getElementById("admin-sync-nba-btn")) {
                        const syncBtn = document.createElement("button");
                        syncBtn.id = "admin-sync-nba-btn";
                        syncBtn.innerHTML = "🔄 Auto-Sync NBA";
                        syncBtn.style.padding = "4px 12px";
                        syncBtn.style.borderRadius = "10px";
                        syncBtn.style.background = "#10B981";
                        syncBtn.style.color = "white";
                        syncBtn.style.fontWeight = "bold";
                        syncBtn.style.border = "none";
                        syncBtn.style.cursor = "pointer";
                        syncBtn.style.marginLeft = "10px";
                        syncBtn.addEventListener("click", adminSyncNBA);
                        document.querySelector(".live-status").appendChild(syncBtn);
                    }
                }
                initApp();
            }, 500);
        } else {
            document.getElementById('login-error').style.display = 'block';
            setTimeout(() => document.getElementById('login-error').style.display = 'none', 2000);
        }
    });

    document.getElementById('pin-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('login-submit').click();
    });
}

// ============== APP INIT ==============

function initApp() {
    setupFirebaseListener();
    fetchNBAResults();
    fetchLiveScores();
    // Refresh live scores every 30 seconds
    setInterval(fetchLiveScores, 30000);
}

// ============== LIVE SCORES ==============

async function fetchLiveScores() {
    const grid = document.getElementById('live-scores-grid');
    const statusEl = document.getElementById('live-scores-status');
    
    try {
        // ESPN API — pas de problème CORS!
        const url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
        const response = await fetch(url);
        const data = await response.json();
        const events = data?.events || [];
        
        if (events.length === 0) {
            grid.innerHTML = '<p class="live-scores-empty">Aucun match aujourd\'hui 🏖️</p>';
            statusEl.innerHTML = '😴 Pas de match';
            return;
        }
        
        const hasLive = events.some(e => e.status?.type?.state === 'in');
        statusEl.innerHTML = hasLive 
            ? '<span class="pulse"></span> LIVE' 
            : '📅 Aujourd\'hui';
        
        grid.innerHTML = events.map(event => {
            const comp = event.competitions?.[0];
            if (!comp) return '';
            
            const statusObj = event.status?.type;
            const state = statusObj?.state || 'pre'; // pre, in, post
            const detail = statusObj?.shortDetail || statusObj?.detail || '';
            
            let statusClass = '';
            let statusLabel = '';
            if (state === 'pre') {
                statusClass = 'upcoming';
                statusLabel = detail;
            } else if (state === 'in') {
                statusClass = 'live';
                statusLabel = detail;
            } else {
                statusClass = 'final';
                statusLabel = detail || 'FINAL';
            }
            
            // ESPN: competitors[0] = home, competitors[1] = away (or vice versa)
            const teams = comp.competitors || [];
            const home = teams.find(t => t.homeAway === 'home') || teams[0];
            const away = teams.find(t => t.homeAway === 'away') || teams[1];
            
            const homeScore = parseInt(home?.score) || 0;
            const awayScore = parseInt(away?.score) || 0;
            const homeAbbr = home?.team?.abbreviation || '???';
            const awayAbbr = away?.team?.abbreviation || '???';
            
            const awayWinning = awayScore > homeScore;
            const homeWinning = homeScore > awayScore;
            const gameStarted = state !== 'pre';
            
            return `
                <div class="live-game-card ${statusClass}">
                    <div class="game-status-bar ${statusClass}">${statusLabel}</div>
                    <div class="game-teams">
                        <div class="game-team ${awayWinning && gameStarted ? 'winning' : ''}">
                            <span class="game-team-name">${awayAbbr}</span>
                            <span class="game-team-score">${gameStarted ? awayScore : '-'}</span>
                        </div>
                        <div class="game-vs">@</div>
                        <div class="game-team ${homeWinning && gameStarted ? 'winning' : ''}">
                            <span class="game-team-name">${homeAbbr}</span>
                            <span class="game-team-score">${gameStarted ? homeScore : '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch(err) {
        console.warn("Live scores fetch error:", err);
        grid.innerHTML = '<p class="live-scores-empty">Impossible de charger les scores 😕</p>';
        statusEl.innerHTML = '❌ Hors-ligne';
    }
}

// ============== BRACKET LOGIC ==============

function computeBracket() {
    // Propagate winners to next round teams (and handle clearing)
    for (const [seriesId, feed] of Object.entries(FEEDS_TO)) {
        const series = bracket[seriesId];
        if (!series || !bracket[feed.target]) continue;

        const prevValue = bracket[feed.target][feed.slot];

        if (series.winner) {
            // Winner set → propagate to next round
            bracket[feed.target][feed.slot] = series.winner;
            if (prevValue !== series.winner) {
                saveSeriesTeam(feed.target, feed.slot, series.winner);
            }
        } else if (prevValue !== null && prevValue !== undefined) {
            // Winner cleared → also clear the propagated team in next round
            bracket[feed.target][feed.slot] = null;
            saveSeriesTeam(feed.target, feed.slot, null);
            // Cascade: if the next series had a winner that was the removed team, clear it too
            if (bracket[feed.target].winner === prevValue) {
                bracket[feed.target].winner = null;
                saveSeriesWinner(feed.target, null);
            }
        }
    }
}

function getSeriesTeams(seriesId) {
    const s = bracket[seriesId];
    if (!s) return [null, null];
    return [s.team1, s.team2];
}

function getSeriesLabel(seriesId) {
    const [t1, t2] = getSeriesTeams(seriesId);
    const conf = seriesId.startsWith("rd1_1") || seriesId.startsWith("rd1_2") || seriesId.startsWith("rd1_3") || seriesId.startsWith("rd1_4") || seriesId.startsWith("rd2_1") || seriesId.startsWith("rd2_2") || seriesId === "ff_1" ? "🔵" :
                 seriesId === "fin_1" ? "🏆" :
                 seriesId.startsWith("ff_2") || seriesId.startsWith("ff_4") || seriesId.startsWith("fin_2") ? "⭐" : "🔴";
    
    if (MVP_SERIES.includes(seriesId)) {
        const mvpLabels = { ff_2: "⭐ MVP de l'EST", ff_4: "⭐ MVP de l'OUEST", fin_2: "🏆 MVP des FINALES" };
        return mvpLabels[seriesId] || seriesId;
    }
    
    return `${conf} ${teamLabel(t1)} vs ${teamLabel(t2)}`;
}

// ============== FIREBASE SYNC ==============

function setupFirebaseListener() {
    // Listen to predictions
    db.ref('predictions').on('value', (snapshot) => {
        serverPredictions = snapshot.val() || {};
        refreshUI();
    });

    // Listen to bracket state (results + teams)
    db.ref('bracket').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Merge with defaults
            for (const id of Object.keys(DEFAULT_BRACKET)) {
                if (data[id]) {
                    bracket[id] = { ...DEFAULT_BRACKET[id], ...data[id] };
                } else {
                    bracket[id] = { ...DEFAULT_BRACKET[id] };
                }
            }
        } else {
            bracket = JSON.parse(JSON.stringify(DEFAULT_BRACKET));
            // Initialize bracket in Firebase
            db.ref('bracket').set(DEFAULT_BRACKET);
        }
        computeBracket();
        refreshUI();
    });

    // Listen to round locks
    db.ref('roundLocks').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) roundLocks = data;
        refreshUI();
    });
}

function refreshUI() {
    computeBracket();
    buildGrid();
    populateInputs();
    applyLockingLogic();
    calculatePoints();
    updateRoundLockUI();
}

function savePredictionToFirebase(key, value) {
    return db.ref('predictions/' + key).set(value);
}

function saveRoundLock(roundKey, locked) {
    return db.ref('roundLocks/' + roundKey).set(locked);
}

function saveSeriesWinner(seriesId, winner, games = null) {
    if (winner === null) {
        return db.ref('bracket/' + seriesId).update({ winner: null, games: null });
    }
    const updates = { winner: winner };
    if (games !== null) updates.games = games;
    return db.ref('bracket/' + seriesId).update(updates);
}

function saveSeriesTeam(seriesId, slot, teamValue) {
    return db.ref('bracket/' + seriesId + '/' + slot).set(teamValue);
}

// ============== HELPERS ==============

function getRoundKey(matchupId) {
    if (matchupId.startsWith("rd1")) return "rd1";
    if (matchupId.startsWith("rd2")) return "rd2";
    if (matchupId.startsWith("ff")) return "ff";
    if (matchupId.startsWith("fin")) return "fin";
    return "rd1";
}

function isMvpSeries(matchupId) {
    return MVP_SERIES.includes(matchupId);
}

function parseStoredValue(text) {
    if (!text || text.includes('🔒')) return { team: null, games: null };
    text = text.toLowerCase().trim();
    const match = text.match(/(.+?)\s+(\d)$/);
    if (match) return { team: match[1].trim(), games: parseInt(match[2]) };
    return { team: text, games: null };
}

// ============== BUILD GRID ==============

function buildGrid() {
    const container = document.getElementById("bracket-container");
    container.innerHTML = "";
    
    bracketData.forEach(round => {
        const section = document.createElement("div");
        section.className = "round-section";
        section.dataset.round = round.roundKey;
        
        // Title row
        const titleRow = document.createElement("div");
        titleRow.className = "round-title-row";
        const title = document.createElement("h2");
        title.className = "round-title";
        title.innerHTML = `🔥 ${round.title}`;
        titleRow.appendChild(title);
        
        const lockBadge = document.createElement("span");
        lockBadge.className = "round-lock-badge";
        lockBadge.id = `lock-badge-${round.roundKey}`;
        titleRow.appendChild(lockBadge);
        
        if (isAdmin) {
            const lockBtn = document.createElement("button");
            lockBtn.className = "admin-lock-btn";
            lockBtn.id = `lock-btn-${round.roundKey}`;
            lockBtn.addEventListener("click", () => toggleRoundLock(round.roundKey));
            titleRow.appendChild(lockBtn);
        }
        section.appendChild(titleRow);
        
        // Column headers
        const headerRow = document.createElement("div");
        headerRow.className = "series-row header-row";
        const matchupLabel = document.createElement("div");
        matchupLabel.className = "matchup-name header-label";
        matchupLabel.textContent = "SÉRIE";
        matchupLabel.contentEditable = "false";
        headerRow.appendChild(matchupLabel);
        
        players.forEach(p => {
            const cell = document.createElement("div");
            cell.className = `prediction-cell header-cell player-col-${p.toLowerCase()}`;
            cell.textContent = p;
            headerRow.appendChild(cell);
        });
        section.appendChild(headerRow);
        
        // Series rows
        round.series.forEach(matchup => {
            const seriesId = matchup.id;
            const row = document.createElement("div");
            row.className = "series-row";
            row.dataset.round = round.roundKey;
            
            // ---- Matchup name cell ----
            const matchCell = document.createElement("div");
            matchCell.className = "matchup-name";
            matchCell.dataset.matchupId = seriesId;
            
            const nameSpan = document.createElement("span");
            nameSpan.className = "matchup-label";
            nameSpan.textContent = getSeriesLabel(seriesId);
            matchCell.appendChild(nameSpan);
            
            if (!isMvpSeries(seriesId)) {
                const scoreSpan = document.createElement("div");
                scoreSpan.className = "series-live-score";
                scoreSpan.id = `series-score-${seriesId}`;
                matchCell.appendChild(scoreSpan);
            }
            
            // Admin: winner selector + play-in team setter
            if (isAdmin && !isMvpSeries(seriesId)) {
                const [t1, t2] = getSeriesTeams(seriesId);
                const currentWinner = bracket[seriesId]?.winner || null;
                
                // Play-in team setter (Round 1 series that have a play-in slot)
                const defaultSeries = DEFAULT_BRACKET[seriesId];
                const hasPlayinSlot = seriesId.startsWith("rd1_") && defaultSeries && (!defaultSeries.team1 || !defaultSeries.team2);
                if (hasPlayinSlot) {
                    const playinDiv = document.createElement("div");
                    playinDiv.className = "admin-playin";
                    
                    const isEast = ["rd1_1","rd1_2","rd1_3","rd1_4"].includes(seriesId);
                    const playinTeams = isEast ? EAST_PLAYIN : WEST_PLAYIN;
                    const missingSlot = !defaultSeries.team2 ? "team2" : "team1";
                    
                    const pSel = document.createElement("select");
                    pSel.className = "admin-mini-select";
                    const pDef = document.createElement("option");
                    pDef.value = ""; pDef.textContent = "→ Play-in?";
                    pSel.appendChild(pDef);
                    
                    playinTeams.forEach(tv => {
                        const opt = document.createElement("option");
                        opt.value = tv; opt.textContent = teamLabel(tv);
                        if (bracket[seriesId]?.[missingSlot] === tv) opt.selected = true;
                        pSel.appendChild(opt);
                    });
                    
                    pSel.addEventListener("change", () => {
                        const newTeam = pSel.value || null;
                        saveSeriesTeam(seriesId, missingSlot, newTeam);
                        // If clearing the play-in team, also clear the winner if it was that team
                        if (!newTeam && bracket[seriesId]?.winner) {
                            saveSeriesWinner(seriesId, null);
                        }
                    });
                    
                    playinDiv.appendChild(pSel);
                    matchCell.appendChild(playinDiv);
                }
                
                // Winner selector (only if both teams exist)
                if (t1 && t2) {
                    const winDiv = document.createElement("div");
                    winDiv.className = "admin-winner";
                    
                    const wSel = document.createElement("select");
                    wSel.className = "admin-mini-select winner-select";
                    
                    const wDef = document.createElement("option");
                    wDef.value = ""; wDef.textContent = "⭐ Gagnant?";
                    wSel.appendChild(wDef);
                    
                    [t1, t2].forEach(tv => {
                        const opt = document.createElement("option");
                        opt.value = tv; opt.textContent = teamLabel(tv);
                        if (currentWinner === tv) opt.selected = true;
                        wSel.appendChild(opt);
                    });
                    
                    const currentGames = bracket[seriesId]?.games || null;
                    const gSel = document.createElement("select");
                    gSel.className = "admin-mini-select games-select";
                    
                    const gDef = document.createElement("option");
                    gDef.value = ""; gDef.textContent = "#";
                    gSel.appendChild(gDef);
                    
                    [4, 5, 6, 7].forEach(g => {
                        const opt = document.createElement("option");
                        opt.value = g; opt.textContent = g;
                        if (currentGames === g) opt.selected = true;
                        gSel.appendChild(opt);
                    });
                    
                    const updateWinnerAndGames = () => {
                        const winner = wSel.value || null;
                        const games = gSel.value ? parseInt(gSel.value) : null;
                        saveSeriesWinner(seriesId, winner, games);
                    };

                    wSel.addEventListener("change", updateWinnerAndGames);
                    gSel.addEventListener("change", updateWinnerAndGames);
                    
                    winDiv.appendChild(wSel);
                    winDiv.appendChild(gSel);
                    matchCell.appendChild(winDiv);
                }
            }
            
            // Show winner badge
            if (bracket[seriesId]?.winner && !isMvpSeries(seriesId)) {
                const winBadge = document.createElement("div");
                winBadge.className = "winner-badge";
                winBadge.textContent = `✅ ${teamLabel(bracket[seriesId].winner)}`;
                matchCell.appendChild(winBadge);
            }
            
            row.appendChild(matchCell);
            
            // ---- Player prediction cells ----
            players.forEach(p => {
                const cell = document.createElement("div");
                cell.className = "prediction-cell";
                cell.dataset.player = p;
                
                if (isMvpSeries(seriesId)) {
                    // MVP: text input
                    const input = document.createElement("input");
                    input.className = "pred-input mvp-input";
                    input.placeholder = (p === currentUser || isAdmin) ? "ex: Tatum" : "🔒";
                    input.type = "text";
                    input.dataset.matchupId = seriesId;
                    input.dataset.player = p;
                    input.dataset.round = round.roundKey;
                    input.addEventListener("change", () => savePrediction(seriesId, p, input.value));
                    cell.appendChild(input);
                } else {
                    // Series: team dropdown + games dropdown
                    const wrapper = document.createElement("div");
                    wrapper.className = "pick-dropdowns";
                    
                    const [t1, t2] = getSeriesTeams(seriesId);
                    
                    // Team dropdown (only the 2 teams!)
                    const teamSelect = document.createElement("select");
                    teamSelect.className = "pick-team";
                    teamSelect.dataset.matchupId = seriesId;
                    teamSelect.dataset.player = p;
                    teamSelect.dataset.round = round.roundKey;
                    
                    const defOpt = document.createElement("option");
                    defOpt.value = ""; defOpt.textContent = "—";
                    teamSelect.appendChild(defOpt);
                    
                    [t1, t2].forEach(tv => {
                        if (!tv) return;
                        const opt = document.createElement("option");
                        opt.value = tv;
                        opt.textContent = teamLabel(tv);
                        teamSelect.appendChild(opt);
                    });
                    
                    // Games dropdown
                    const gamesSelect = document.createElement("select");
                    gamesSelect.className = "pick-games";
                    gamesSelect.dataset.matchupId = seriesId;
                    gamesSelect.dataset.player = p;
                    gamesSelect.dataset.round = round.roundKey;
                    
                    const gDef = document.createElement("option");
                    gDef.value = ""; gDef.textContent = "#";
                    gamesSelect.appendChild(gDef);
                    
                    [4,5,6,7].forEach(g => {
                        const opt = document.createElement("option");
                        opt.value = g; opt.textContent = g;
                        gamesSelect.appendChild(opt);
                    });
                    
                    const saveDropdowns = () => {
                        const team = teamSelect.value;
                        const games = gamesSelect.value;
                        const val = team ? (games ? `${team} ${games}` : team) : "";
                        savePrediction(seriesId, p, val);
                    };
                    
                    teamSelect.addEventListener("change", saveDropdowns);
                    gamesSelect.addEventListener("change", saveDropdowns);
                    
                    wrapper.appendChild(teamSelect);
                    wrapper.appendChild(gamesSelect);
                    cell.appendChild(wrapper);
                }
                
                const badge = document.createElement("div");
                badge.className = "score-badge";
                badge.id = `badge-${seriesId}-${p}`;
                cell.appendChild(badge);
                
                const remBadge = document.createElement("div");
                remBadge.className = "remaining-badge";
                remBadge.id = `remaining-${seriesId}-${p}`;
                cell.appendChild(remBadge);
                
                row.appendChild(cell);
            });
            section.appendChild(row);
        });
        container.appendChild(section);
    });
}

// ============== POPULATE FROM FIREBASE ==============

function populateInputs() {
    // Dropdowns
    document.querySelectorAll(".pick-team").forEach(sel => {
        const player = sel.dataset.player;
        const matchupId = sel.dataset.matchupId;
        const key = `nba2026_${matchupId}_${player}`;
        const value = serverPredictions[key];
        const roundKey = getRoundKey(matchupId);
        const isLocked = roundLocks[roundKey];
        
        if (value) {
            if (!isLocked && player !== currentUser && !isAdmin) {
                sel.value = "";
                sel.classList.add("secret-pick");
            } else {
                const parsed = parseStoredValue(value);
                sel.value = parsed.team || "";
                sel.classList.remove("secret-pick");
            }
        } else {
            sel.value = "";
            sel.classList.remove("secret-pick");
        }
    });
    
    document.querySelectorAll(".pick-games").forEach(sel => {
        const player = sel.dataset.player;
        const matchupId = sel.dataset.matchupId;
        const key = `nba2026_${matchupId}_${player}`;
        const value = serverPredictions[key];
        const roundKey = getRoundKey(matchupId);
        const isLocked = roundLocks[roundKey];
        
        if (value) {
            if (!isLocked && player !== currentUser && !isAdmin) {
                sel.value = "";
                sel.classList.add("secret-pick");
            } else {
                const parsed = parseStoredValue(value);
                sel.value = parsed.games || "";
                sel.classList.remove("secret-pick");
            }
        } else {
            sel.value = "";
            sel.classList.remove("secret-pick");
        }
    });
    
    // MVP inputs
    document.querySelectorAll(".mvp-input").forEach(inp => {
        const player = inp.dataset.player;
        const matchupId = inp.dataset.matchupId;
        const key = `nba2026_${matchupId}_${player}`;
        const value = serverPredictions[key];
        const roundKey = getRoundKey(matchupId);
        const isLocked = roundLocks[roundKey];
        
        if (value) {
            if (!isLocked && player !== currentUser && !isAdmin) {
                inp.value = "🔒 Secret";
            } else {
                inp.value = value;
            }
        } else {
            inp.value = "";
        }
    });
}

// ============== ROUND LOCK ==============

function updateRoundLockUI() {
    bracketData.forEach(round => {
        const isLocked = roundLocks[round.roundKey];
        const badge = document.getElementById(`lock-badge-${round.roundKey}`);
        if (badge) {
            badge.textContent = isLocked ? "🔒 LOCKÉ" : "🔓 OUVERT";
            badge.className = `round-lock-badge ${isLocked ? 'locked' : 'open'}`;
        }
        const btn = document.getElementById(`lock-btn-${round.roundKey}`);
        if (btn) {
            btn.textContent = isLocked ? "🔓 Délocker" : "🔒 Locker";
            btn.className = `admin-lock-btn ${isLocked ? 'unlockable' : 'lockable'}`;
        }
        const section = document.querySelector(`.round-section[data-round="${round.roundKey}"]`);
        if (section) {
            section.classList.toggle("round-locked", !!isLocked);
            section.classList.toggle("round-open", !isLocked);
        }
    });
}

function toggleRoundLock(roundKey) {
    const newStatus = !roundLocks[roundKey];
    const roundName = bracketData.find(r => r.roundKey === roundKey)?.title || roundKey;
    if (newStatus && !confirm(`🔒 Locker "${roundName}"?\nTous les picks seront révélés.`)) return;
    roundLocks[roundKey] = newStatus;
    saveRoundLock(roundKey, newStatus);
}

// ============== LOCKING LOGIC ==============

function applyLockingLogic() {
    document.querySelectorAll(".pick-team, .pick-games").forEach(sel => {
        const p = sel.dataset.player;
        const roundKey = getRoundKey(sel.dataset.matchupId);
        const isRoundLocked = roundLocks[roundKey];
        if (!isAdmin && (isRoundLocked || p !== currentUser)) {
            sel.disabled = true;
            sel.classList.add("input-locked");
        } else {
            sel.disabled = false;
            sel.classList.remove("input-locked");
        }
    });
    
    document.querySelectorAll(".mvp-input").forEach(inp => {
        const p = inp.dataset.player;
        const roundKey = getRoundKey(inp.dataset.matchupId);
        const isRoundLocked = roundLocks[roundKey];
        if (!isAdmin && (isRoundLocked || p !== currentUser)) {
            inp.readOnly = true;
            inp.classList.add("input-locked");
        } else {
            inp.readOnly = false;
            inp.classList.remove("input-locked");
        }
    });
}

// ============== SAVE PREDICTION ==============

function savePrediction(matchupId, player, val) {
    if (player !== currentUser && !isAdmin) return;
    const roundKey = getRoundKey(matchupId);
    if (roundLocks[roundKey] && !isAdmin) return;
    
    const key = `nba2026_${matchupId}_${player}`;
    savePredictionToFirebase(key, val).catch(err => console.error("Save error:", err));
}

// ============== NBA RESULTS ==============

async function adminSyncNBA() {
    try {
        const btn = document.getElementById("admin-sync-nba-btn");
        if (btn) btn.innerHTML = "⏳ Sync en cours...";
        
        const targetUrl = encodeURIComponent("https://stats.nba.com/stats/playoffbracket?LeagueID=00&SeasonYear=2025&State=2");
        const url = "https://api.allorigins.win/get?url=" + targetUrl;
        const response = await fetch(url);
        const rawData = await response.json();
        const data = JSON.parse(rawData.contents);
        
        let updates = {};
        
        if (data.bracket && data.bracket.playoffBracketSeries) {
            data.bracket.playoffBracketSeries.forEach(apiSeries => {
                let highTeam = apiSeries.highSeedName;
                let lowTeam = apiSeries.lowSeedName;
                if (!highTeam || !lowTeam) return;
                
                highTeam = highTeam.toLowerCase();
                lowTeam = lowTeam.toLowerCase();
                
                const highWins = apiSeries.highSeedSeriesWins || 0;
                const lowWins = apiSeries.lowSeedSeriesWins || 0;
                
                let matchedSeriesId = null;
                for (let key of Object.keys(bracket)) {
                    const b = bracket[key];
                    if (!b) continue;
                    
                    if ((b.team1 === highTeam && b.team2 === lowTeam) ||
                        (b.team1 === lowTeam && b.team2 === highTeam)) {
                        matchedSeriesId = key;
                        break;
                    }
                    if (key.startsWith("rd1")) {
                        if (b.team1 === highTeam && !b.team2) {
                            updates[`bracket/${key}/team2`] = lowTeam;
                            matchedSeriesId = key;
                            break;
                        }
                        if (b.team2 === highTeam && !b.team1) {
                            updates[`bracket/${key}/team1`] = lowTeam;
                            matchedSeriesId = key;
                            break;
                        }
                        if (b.team1 === lowTeam && !b.team2) {
                            updates[`bracket/${key}/team2`] = highTeam;
                            matchedSeriesId = key;
                            break;
                        }
                        if (b.team2 === lowTeam && !b.team1) {
                            updates[`bracket/${key}/team1`] = highTeam;
                            matchedSeriesId = key;
                            break;
                        }
                    }
                }
                
                if (matchedSeriesId) {
                    if (highWins === 4) {
                        updates[`bracket/${matchedSeriesId}/winner`] = highTeam;
                        updates[`bracket/${matchedSeriesId}/games`] = 4 + lowWins;
                    } else if (lowWins === 4) {
                        updates[`bracket/${matchedSeriesId}/winner`] = lowTeam;
                        updates[`bracket/${matchedSeriesId}/games`] = 4 + highWins;
                    }
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                alert("✅ Sync succès! " + Object.keys(updates).length + " éléments (play-ins, gagnants) mis à jour.");
            } else {
                alert("Aucun nouveau résultat à synchroniser depuis la NBA.");
            }
        } else {
            alert("L'API de la NBA n'a pas répondu avec le format attendu.");
        }
        
        if (btn) btn.innerHTML = "🔄 Auto-Sync NBA";
    } catch(err) {
        console.error(err);
        alert("Erreur de sync: " + err.message);
        const btn = document.getElementById("admin-sync-nba-btn");
        if (btn) btn.innerHTML = "🔄 Auto-Sync NBA";
    }
}

async function fetchNBAResults() {
    try {
        const targetUrl = encodeURIComponent("https://stats.nba.com/stats/playoffbracket?LeagueID=00&SeasonYear=2025&State=2");
        const url = "https://api.allorigins.win/get?url=" + targetUrl;
        const response = await fetch(url);
        const rawData = await response.json();
        const data = JSON.parse(rawData.contents);
        if (data.bracket && data.bracket.playoffBracketSeries) {
            data.bracket.playoffBracketSeries.forEach(apiSeries => {
                let highTeam = apiSeries.highSeedName;
                let lowTeam = apiSeries.lowSeedName;
                if (!highTeam || !lowTeam) return;
                
                highTeam = highTeam.toLowerCase();
                lowTeam = lowTeam.toLowerCase();
                
                const highWins = apiSeries.highSeedSeriesWins || 0;
                const lowWins = apiSeries.lowSeedSeriesWins || 0;
                
                if (highWins === 4) realResults[highTeam] = 4 + lowWins;
                else if (lowWins === 4) realResults[lowTeam] = 4 + highWins;
                
                liveSeriesScores[highTeam] = highWins;
                liveSeriesScores[lowTeam] = lowWins;
            });
        }
    } catch(err) {
        realResults = {};
        liveSeriesScores = {};
    }
    calculatePoints();
}

// ============== CALCULATE POINTS ==============

function calculatePoints() {
    let playerScores = {};
    let playerRemaining = {};
    players.forEach(p => {
        playerScores[p] = 0;
        playerRemaining[p] = 0;
    });
    
    // Dropdown predictions
    document.querySelectorAll(".pick-team").forEach(sel => {
        const matchupId = sel.dataset.matchupId;
        const player = sel.dataset.player;
        const team = sel.value;
        const gSel = document.querySelector(`.pick-games[data-matchup-id="${matchupId}"][data-player="${player}"]`);
        const games = gSel ? (parseInt(gSel.value) || null) : null;
        const badge = document.getElementById(`badge-${matchupId}-${player}`);
        const remBadge = document.getElementById(`remaining-${matchupId}-${player}`);
        let pts = 0;
        let remPts = 0;
        
        if (team && !sel.classList.contains("secret-pick")) {
            const series = bracket[matchupId];
            if (series && series.winner) {
                if (series.winner === team) {
                    pts = 1;
                    if (series.games && games === series.games) {
                        pts = 2;
                    } else if (!series.games && realResults[team] && games === realResults[team]) {
                        pts = 2;
                    }
                }
            } else if (realResults[team]) {
                pts = 1;
                if (games === realResults[team]) pts = 2;
            }
        }
        
        // Calculate remaining points
        const [t1, t2] = getSeriesTeams(matchupId);
        const series = bracket[matchupId];
        const seriesOver = (series && series.winner) || (t1 && realResults[t1]) || (t2 && realResults[t2]);
        if (!seriesOver) {
            // They can still get 2 points for any series that isn't over
            remPts = 2;
            
            if (team && !sel.classList.contains("secret-pick")) {
                if (!games) {
                    remPts = 1; // No games picked = can't get the +1 for games
                } else {
                    const opponent = (t1 === team) ? t2 : ((t2 === team) ? t1 : null);
                    if (opponent) {
                        const opponentWins = liveSeriesScores[opponent] || 0;
                        // If opponent has already won more games than they are allowed to lose
                        if (opponentWins > games - 4) {
                            remPts = 1;
                        }
                    }
                }
            }
        }
        
        if (badge) {
            badge.className = "score-badge";
            if (team && !sel.classList.contains("secret-pick")) {
                badge.classList.add("active", `points-${pts}`);
                badge.textContent = pts;
            }
        }
        if (remBadge) {
            remBadge.textContent = remPts > 0 ? `+${remPts}` : "";
        }
        if (playerScores[player] !== undefined) playerScores[player] += pts;
        if (playerRemaining[player] !== undefined) playerRemaining[player] += remPts;
    });
    
    // MVP inputs
    document.querySelectorAll(".mvp-input").forEach(inp => {
        const matchupId = inp.dataset.matchupId;
        const player = inp.dataset.player;
        const badge = document.getElementById(`badge-${matchupId}-${player}`);
        const remBadge = document.getElementById(`remaining-${matchupId}-${player}`);
        const text = inp.value.toLowerCase().trim();
        let pts = 0;
        let remPts = 0;
        
        if (text && !text.includes('🔒')) {
            const realMvp = realMvps[matchupId];
            if (realMvp && text.includes(realMvp)) pts = 1;
        }
        
        const realMvp = realMvps[matchupId];
        if (!realMvp) {
            // MVP not decided yet, they can still get 1 point
            remPts = 1;
        }
        
        if (badge) {
            badge.className = "score-badge";
            if (text && !text.includes('🔒')) {
                badge.classList.add("active", `points-${pts}`);
                badge.textContent = pts;
            }
        }
        if (remBadge) {
            remBadge.textContent = remPts > 0 ? `+${remPts}` : "";
        }
        if (playerScores[player] !== undefined) playerScores[player] += pts;
        if (playerRemaining[player] !== undefined) playerRemaining[player] += remPts;
    });
    
    // Update live series scores
    Object.keys(bracket).forEach(matchupId => {
        const scoreSpan = document.getElementById(`series-score-${matchupId}`);
        if (scoreSpan) {
            const [t1, t2] = getSeriesTeams(matchupId);
            if (t1 && t2) {
                const w1 = liveSeriesScores[t1];
                const w2 = liveSeriesScores[t2];
                if (w1 !== undefined || w2 !== undefined) {
                    scoreSpan.textContent = `${w1 || 0} - ${w2 || 0}`;
                    scoreSpan.classList.add("visible");
                } else {
                    scoreSpan.classList.remove("visible");
                }
            }
        }
    });
    
    players.forEach(p => {
        const el = document.getElementById(`score-${p}`);
        if (el) el.textContent = playerScores[p];
        const rel = document.getElementById(`remaining-${p}`);
        if (rel) rel.textContent = playerRemaining[p];
    });
}
