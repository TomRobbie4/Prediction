import json
import os
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')

DB_FILE = 'db.json'
# Date limite où tout est dévoilé et verrouillé
# 18 Avril 2026 à 10:00:00 du matin
REVEAL_DATE = datetime(2026, 4, 18, 10, 0, 0)

# Passwords
PIN_CODES = {
    'MANAGER': '2417',
    'WILL': '0220',
    'OLI': '1005',
    'MIK': '0508',
    'THOM': '0716',
    'SAM': '0506',
    'DOUSKI': '0731'
}

ADMIN_USER = 'MANAGER'

def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    player = data.get('player')
    pin = data.get('pin')
    if PIN_CODES.get(player) == pin:
        return jsonify({"success": True, "isAdmin": player == ADMIN_USER})
    return jsonify({"success": False, "message": "Code NIP incorrect"})

@app.route('/api/predictions', methods=['GET'])
def get_predictions():
    requester = request.args.get('player') 
    db = load_db()
    is_revealed = datetime.now() >= REVEAL_DATE
    is_admin = requester == ADMIN_USER
    
    response_data = []
    
    for key, value in db.items():
        if key.startswith('nba2026_'):
            
            # Masking logic
            val = value
            # Si c'est un nom de match-up, on ne le masque pas
            if 'matchupName' not in key:
                parts = key.replace('nba2026_', '').split('_')
                pred_player = parts[-1]
                
                # Si ce n'est pas révélé, ce n'est pas le joueur qui demande, et c'est pas l'admin qui regarde : on masque.
                if not is_revealed and pred_player != requester and not is_admin:
                    if value.strip() != "":
                        val = "🔒 Secret"
            
            response_data.append({
                "key": key,
                "value": val
            })
            
    return jsonify({
        "revealed": is_revealed,
        "is_admin": is_admin,
        "predictions": response_data
    })

@app.route('/api/prediction', methods=['POST'])
def save_prediction():
    data = request.json
    player = data.get('player')
    pin = data.get('pin')
    
    if PIN_CODES.get(player) != pin:
        return jsonify({"success": False, "message": "Non autorisé"}), 401
        
    is_admin = player == ADMIN_USER
    is_revealed = datetime.now() >= REVEAL_DATE
    
    # Validation du Verrouillage
    if is_revealed and not is_admin:
        return jsonify({"success": False, "message": "La date limite est passée, impossible de modifier !"}), 403
        
    key = data.get('key')
    value = data.get('value')
    
    db = load_db()
    db[key] = value
    save_db(db)
    
    return jsonify({"success": True})


if __name__ == '__main__':
    print("============================================")
    print("🏀 SERVEUR NBA DÉMARRÉ ! 🏀")
    print("Serveur local accessible sur http://localhost:5001")
    print("============================================")
    app.run(host='0.0.0.0', port=5001, debug=True)
