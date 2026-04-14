const players = ['WILL', 'OLI', 'MIK', 'THOM', 'SAM', 'DOUSKI'];
let currentUser = null;
let currentPin = null;
let isAdmin = false;

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

document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
});

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

    document.getElementById('login-submit').addEventListener('click', async () => {
        const pin = document.getElementById('pin-input').value;
        if (!selectedPlayer || !pin) return;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: selectedPlayer, pin: pin })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = selectedPlayer;
                currentPin = pin;
                isAdmin = data.isAdmin;
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
            }
        } catch(err) {
            console.error("Erreur serveur", err);
            alert("Erreur de connexion au serveur !");
        }
    });
}

function initApp() {
    buildGrid();
    loadServerPredictions();
    fetchNBAResults();
}

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
            matchName.contentEditable = isAdmin ? "true" : "false"; // Seulement Admin peut changer? Ou tout le monde avant deadline? Laisons-le editable pour tout le monde avant deadline c'est bloqué par app.js plus tard.
            
            row.appendChild(matchName);
            
            // Generate inputs
            players.forEach(p => {
                const cell = document.createElement("div");
                cell.className = "prediction-cell";
                const input = document.createElement("input");
                input.className = "pred-input";
                input.placeholder = (p === currentUser || isAdmin) ? "ex: Pistons 6" : "Attendez...";
                input.type = "text";
                input.dataset.matchupId = matchup.id;
                input.dataset.player = p;
                
                input.addEventListener("change", (e) => {
                    savePrediction(matchup.id, p, e.target.value, input);
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
}

function applyLockingLogic() {
    // Si la date limite est passée et qu'on n'est pas admin, on bloque.
    // Et on bloque toujours les colonnes des AUTRES joueurs si on n'est pas admin.
    const inputs = document.querySelectorAll(".pred-input");
    inputs.forEach(inp => {
        const p = inp.dataset.player;
        if (!isAdmin) {
            if (isRevealed) {
                // Tout est bloqué (Date limite)
                inp.readOnly = true;
                inp.style.opacity = "0.7";
            } else if (p !== currentUser) {
                // On est avant la deadline, mais ce n'est pas ma colonne
                inp.readOnly = true;
                inp.style.opacity = "0.7";
            } else {
                // Ma colonne avant deadline
                inp.readOnly = false;
                inp.style.opacity = "1";
            }
        } else {
            // L'admin a les pleins pouvoirs
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
        } else {
            el.contentEditable = "true";
        }
    });
}

async function savePrediction(matchupId, player, val, inputElement) {
    if (player !== currentUser && !isAdmin) {
        alert("Vous ne pouvez pas modifier la colonne des autres !");
        return; 
    }
    
    const key = `nba2026_${matchupId}_${player}`;
    serverPredictions[key] = val; 
    calculatePoints();
    
    try {
        const res = await fetch('/api/prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: currentUser, pin: currentPin, key: key, value: val })
        });
        
        const data = await res.json();
        if(!data.success) {
            alert(data.message); // Ex: "La date limite est passée !"
            // Revert state
            loadServerPredictions(); 
        }
        
    } catch(err) {
        console.error("Save error", err);
    }
}

async function loadServerPredictions() {
    try {
        const res = await fetch(`/api/predictions?player=${currentUser}`);
        const data = await res.json();
        
        isRevealed = data.revealed;
        if(isRevealed && !isAdmin) {
            document.getElementById("sync-status").textContent = "TEMPS ÉCOULÉ ⏳ / RÉSULTATS DÉVOILÉS!";
            document.getElementById("sync-status").style.color = "#FF4500";
        }
        
        serverPredictions = {};
        data.predictions.forEach(p => {
            serverPredictions[p.key] = p.value;
        });
        
        // Remplir les inputs
        const inputs = document.querySelectorAll(".pred-input");
        inputs.forEach(inp => {
            const key = `nba2026_${inp.dataset.matchupId}_${inp.dataset.player}`;
            if (serverPredictions[key]) {
                inp.value = serverPredictions[key];
            }
        });
        
        // Matchups
        document.querySelectorAll(".matchup-name").forEach((el, index) => {
            let mId = el.nextElementSibling.querySelector('input').dataset.matchupId;
            let saved = serverPredictions[`nba2026_matchupName_${mId}`];
            if(saved) el.textContent = saved;
            
            el.addEventListener("input", async (e) => {
                const saveRes = await fetch('/api/prediction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player: currentUser, pin: currentPin, key: `nba2026_matchupName_${mId}`, value: e.target.textContent })
                });
                const saveData = await saveRes.json();
                if(!saveData.success) {
                    alert(saveData.message);
                }
            });
        });

        applyLockingLogic();
        calculatePoints();
    } catch(err) {
        console.error("Load error", err);
    }
}

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

function calculatePoints() {
    let playerScores = { 'WILL': 0, 'OLI': 0, 'MIK': 0, 'THOM': 0, 'SAM': 0, 'DOUSKI': 0 };
    const inputs = document.querySelectorAll(".pred-input");
    inputs.forEach(inp => {
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
        
        badge.className = "score-badge";
        if (inp.value.trim() !== "" && !inp.value.includes('🔒')) {
            badge.classList.add("active", `points-${pts}`);
            badge.textContent = pts;
        } else {
            badge.classList.remove("active");
        }
        playerScores[player] += pts;
    });
    players.forEach(p => {
        if(document.getElementById(`score-${p}`)) {
            document.getElementById(`score-${p}`).textContent = playerScores[p];
        }
    });
}
