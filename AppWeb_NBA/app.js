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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============== CONFIG ==============

const players = ['WILL', 'OLI', 'MIK', 'SAM', 'THOM', 'DOUSKI'];
let currentUser = null;
let isAdmin = false;

// NIP codes (même que ton server.py)
const PIN_CODES = {
    'MANAGER': '2417',
    'WILL': '0220',
    'OLI': '1005',
    'MIK': '0508',
    'THOM': '0716',
    'SAM': '0506',
    'DOUSKI': '0731'
};

const ADMIN_USER = 'MANAGER';

// Date limite : 18 Avril 2026 à 10:00 du matin
const REVEAL_DATE = new Date(2026, 3, 18, 10, 0, 0); // mois 3 = avril (0-indexed)

// Structure des playoffs
const bracketData = [
    { title: "Première ronde", series: [{ id: "rd1_1", name: "Matchup 1" },{ id: "rd1_2", name: "Matchup 2" },{ id: "rd1_3", name: "Matchup 3" },{ id: "rd1_4", name: "Matchup 4" },{ id: "rd1_5", name: "Matchup 5" },{ id: "rd1_6", name: "Matchup 6" },{ id: "rd1_7", name: "Matchup 7" },{ id: "rd1_8", name: "Matchup 8" }] },
    { title: "Deuxième ronde", series: [{ id: "rd2_1", name: "Matchup 1" },{ id: "rd2_2", name: "Matchup 2" },{ id: "rd2_3", name: "Matchup 3" },{ id: "rd2_4", name: "Matchup 4" }] },
    { title: "Final four", series: [{ id: "ff_1", name: "Finale de l'EST" },{ id: "ff_2", name: "MVP de l'EST" },{ id: "ff_3", name: "Finale de l'OUEST" },{ id: "ff_4", name: "MVP de l'OUEST" }] },
    { title: "Finales NBA", series: [{ id: "fin_1", name: "Grande Finale" },{ id: "fin_2", name: "MVP des FINALES" }] }
];

const teamAliases = { "cavs": "cavaliers", "sixers": "76ers", "wolves": "timberwolves", "blazers": "trail blazers" };

let realResults = {};
let realMvps = { "ff_2": "tatum", "ff_4": "jokic", "fin_2": "tatum" };

let serverPredictions = {};
let isRevealed = false;

// ============== INIT ==============

document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
});

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
        });
    });

    document.getElementById('login-submit').addEventListener('click', () => {
        const pin = document.getElementById('pin-input').value;
        if (!selectedPlayer || !pin) return;
        
        // Vérification locale du NIP (plus besoin du serveur!)
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
                }
                
                initApp();
            }, 500);
        } else {
            document.getElementById('login-error').style.display = 'block';
            setTimeout(() => {
                document.getElementById('login-error').style.display = 'none';
            }, 2000);
        }
    });

    // Enter key support
    document.getElementById('pin-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('login-submit').click();
    });
}

// ============== APP INIT ==============

function initApp() {
    buildGrid();
    setupFirebaseListener();
    fetchNBAResults();
}

// ============== FIREBASE SYNC ==============

function setupFirebaseListener() {
    // Écouter les changements en temps réel
    db.ref('predictions').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        serverPredictions = {};
        
        // Convertir Firebase data en format plat
        for (const key in data) {
            serverPredictions[key] = data[key];
        }
        
        // Vérifier si la date limite est passée
        isRevealed = new Date() >= REVEAL_DATE;
        
        if (isRevealed && !isAdmin) {
            document.getElementById("sync-status").textContent = "TEMPS ÉCOULÉ ⏳ / RÉSULTATS DÉVOILÉS!";
            document.getElementById("sync-status").style.color = "#FF4500";
        }
        
        populateInputs();
        applyLockingLogic();
        calculatePoints();
    });
}

function populateInputs() {
    // Remplir les inputs avec les données Firebase
    const inputs = document.querySelectorAll(".pred-input");
    inputs.forEach(inp => {
        if (!inp.dataset.matchupId) return; // Skip pin input
        const player = inp.dataset.player;
        const key = `nba2026_${inp.dataset.matchupId}_${player}`;
        const value = serverPredictions[key];
        
        if (value !== undefined && value !== null) {
            // Privacy: masquer les picks des autres avant la deadline
            if (!isRevealed && player !== currentUser && !isAdmin) {
                if (value.trim() !== "") {
                    inp.value = "🔒 Secret";
                } else {
                    inp.value = "";
                }
            } else {
                inp.value = value;
            }
        } else {
            inp.value = "";
        }
    });
    
    // Matchup names
    document.querySelectorAll(".matchup-name").forEach((el) => {
        const nextInput = el.nextElementSibling?.querySelector('input');
        if (!nextInput) return;
        const mId = nextInput.dataset.matchupId;
        const saved = serverPredictions[`nba2026_matchupName_${mId}`];
        if (saved) el.textContent = saved;
    });
}

function savePredictionToFirebase(key, value) {
    // Écrire directement dans Firebase
    return db.ref('predictions/' + key).set(value);
}

// ============== BUILD GRID ==============

function buildGrid() {
    const container = document.getElementById("bracket-container");
    container.innerHTML = "";
    
    bracketData.forEach(round => {
        const section = document.createElement("div");
        section.className = "round-section";
        const title = document.createElement("h2");
        title.className = "round-title"; title.innerHTML = `🔥 ${round.title}`;
        section.appendChild(title);
        
        round.series.forEach(matchup => {
            const row = document.createElement("div");
            row.className = "series-row";
            
            const matchName = document.createElement("div");
            matchName.className = "matchup-name";
            matchName.contentEditable = isAdmin ? "true" : "false";
            
            row.appendChild(matchName);
            
            // Generate inputs
            players.forEach(p => {
                const cell = document.createElement("div");
                cell.className = "prediction-cell";
                const input = document.createElement("input");
                input.className = "pred-input";
                input.placeholder = (p === currentUser || isAdmin) ? "ex: Pistons 6" : "🔒";
                input.type = "text";
                input.dataset.matchupId = matchup.id;
                input.dataset.player = p;
                
                input.addEventListener("change", (e) => {
                    savePrediction(matchup.id, p, e.target.value);
                });
                
                const badge = document.createElement("div");
                badge.className = "score-badge";
                badge.id = `badge-${matchup.id}-${p}`;
                
                cell.appendChild(input);
                cell.appendChild(badge);
                row.appendChild(cell);
            });
            section.appendChild(row);
        });
        container.appendChild(section);
    });
    
    // Setup matchup name editing
    setupMatchupNameEditing();
}

function setupMatchupNameEditing() {
    document.querySelectorAll(".matchup-name").forEach((el) => {
        el.addEventListener("input", (e) => {
            if (!isAdmin && isRevealed) return;
            const nextInput = el.nextElementSibling?.querySelector('input');
            if (!nextInput) return;
            const mId = nextInput.dataset.matchupId;
            savePredictionToFirebase(`nba2026_matchupName_${mId}`, e.target.textContent);
        });
    });
}

// ============== LOCKING LOGIC ==============

function applyLockingLogic() {
    const inputs = document.querySelectorAll(".pred-input");
    inputs.forEach(inp => {
        if (!inp.dataset.matchupId) return; // Skip pin input
        const p = inp.dataset.player;
        if (!isAdmin) {
            if (isRevealed) {
                // Tout est bloqué (Date limite passée)
                inp.readOnly = true;
                inp.style.opacity = "0.7";
            } else if (p !== currentUser) {
                // Avant deadline, mais colonne d'un autre joueur
                inp.readOnly = true;
                inp.style.opacity = "0.7";
            } else {
                // Ma colonne avant deadline → éditable
                inp.readOnly = false;
                inp.style.opacity = "1";
            }
        } else {
            // Admin = pleins pouvoirs
            inp.readOnly = false;
            inp.style.opacity = "1";
        }
    });

    const matchupNames = document.querySelectorAll(".matchup-name");
    matchupNames.forEach(el => {
        if (!isAdmin && isRevealed) {
            el.contentEditable = "false";
            el.style.opacity = "0.8";
            el.style.cursor = "default";
        } else if (isAdmin) {
            el.contentEditable = "true";
        } else {
            el.contentEditable = "false";
            el.style.cursor = "default";
        }
    });
}

// ============== SAVE PREDICTION ==============

function savePrediction(matchupId, player, val) {
    if (player !== currentUser && !isAdmin) {
        alert("Vous ne pouvez pas modifier la colonne des autres !");
        return; 
    }
    
    if (isRevealed && !isAdmin) {
        alert("La date limite est passée, impossible de modifier !");
        return;
    }
    
    const key = `nba2026_${matchupId}_${player}`;
    
    // Sauvegarder dans Firebase (le listener mettra à jour automatiquement)
    savePredictionToFirebase(key, val).then(() => {
        console.log(`✅ Sauvegardé: ${key}`);
    }).catch(err => {
        console.error("Erreur de sauvegarde:", err);
        alert("Erreur de sauvegarde! Vérifiez votre connexion.");
    });
}

// ============== PARSE INPUT ==============

function parseInput(text) {
    if (!text || text.includes('🔒')) return { team: null, games: null }; 
    text = text.toLowerCase().trim();
    const match = text.match(/([a-z\s]+)(?:en\s)?(\d)/);
    if (match) {
        let tStr = match[1].trim();
        Object.keys(teamAliases).forEach(k => {
            if (tStr.includes(k)) tStr = teamAliases[k];
        });
        return { team: tStr, games: parseInt(match[2]) };
    }
    return { team: text, games: null };
}

// ============== NBA RESULTS ==============

async function fetchNBAResults() {
    try {
        const url = "https://corsproxy.io/?https://stats.nba.com/stats/playoffbracket?LeagueID=00&SeasonYear=2025&State=2";
        const response = await fetch(url);
        const data = await response.json();
        if (data.resultSets && data.resultSets[0].rowSet) {
            const rows = data.resultSets[0].rowSet;
            const headers = data.resultSets[0].headers;
            rows.forEach(r => {
                let highWins = r[headers.indexOf("HIGH_SEED_SERIES_WINS")];
                let lowWins = r[headers.indexOf("LOW_SEED_SERIES_WINS")];
                let highTeam = r[headers.indexOf("HIGH_SEED_TEAM_NICKNAME")]?.toLowerCase() || "";
                let lowTeam = r[headers.indexOf("LOW_SEED_TEAM_NICKNAME")]?.toLowerCase() || "";
                if (highWins === 4) realResults[highTeam] = 4 + lowWins;
                else if (lowWins === 4) realResults[lowTeam] = 4 + highWins;
            });
        }
    } catch(err) {
        // Fallback
        realResults = {"pistons": 6}; 
    }
    calculatePoints();
}

// ============== CALCULATE POINTS ==============

function calculatePoints() {
    let playerScores = { 'WILL': 0, 'OLI': 0, 'MIK': 0, 'THOM': 0, 'SAM': 0, 'DOUSKI': 0 };
    const inputs = document.querySelectorAll(".pred-input");
    inputs.forEach(inp => {
        if (!inp.dataset.matchupId) return;
        const matchupId = inp.dataset.matchupId;
        const player = inp.dataset.player;
        const pred = parseInput(inp.value);
        const badge = document.getElementById(`badge-${matchupId}-${player}`);
        let pts = 0;
        
        if (pred.team && !inp.value.includes('🔒')) {
            if (matchupId.includes("ff_2") || matchupId.includes("ff_4") || matchupId.includes("fin_2")) {
                const realMvp = realMvps[matchupId];
                if (realMvp && pred.team.includes(realMvp)) pts = 1;
            } else {
                if (realResults[pred.team]) {
                    pts = 1;
                    if (pred.games === realResults[pred.team]) pts = 2;
                }
            }
        }
        
        if (badge) {
            badge.className = "score-badge";
            if (inp.value.trim() !== "" && !inp.value.includes('🔒')) {
                badge.classList.add("active", `points-${pts}`);
                badge.textContent = pts;
            } else {
                badge.classList.remove("active");
            }
        }
        playerScores[player] += pts;
    });
    players.forEach(p => {
        if(document.getElementById(`score-${p}`)) {
            document.getElementById(`score-${p}`).textContent = playerScores[p];
        }
    });
}
