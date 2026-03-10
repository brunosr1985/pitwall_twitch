<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Concentra Pit Wall - Standalone</title>
    <script src="https://github.com/tmijs/tmi.js/releases/download/v1.8.5/tmi.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">

    <style>
        /* O chassi agora tem exatamente o tamanho do letreiro */
        body {
            margin: 0; padding: 0; overflow: hidden;
            background-color: transparent; 
            width: 100vw; height: 100vh;
        }

        /* --- TICKER PIT CREW --- */
        .ticker-wrap { 
            width: 100%; height: 50px; 
            background: rgba(11, 11, 14, 0.98); border-top: 2px solid #d500f9; 
            display: flex; align-items: center; overflow: hidden; position: relative; 
            box-shadow: 0 -5px 20px rgba(0,0,0,0.5); 
        }
        .ticker-title { 
            background: #d500f9; color: #fff; font-family: 'Orbitron', sans-serif; 
            font-size: 16px; font-weight: bold; padding: 0 15px; height: 100%; 
            display: flex; align-items: center; z-index: 2; box-shadow: 5px 0 15px rgba(0,0,0,0.5); 
        }
        .ticker-content-box { 
            flex-grow: 1; overflow: hidden; position: relative; height: 100%; 
        }
        .ticker-content { 
            white-space: nowrap; display: inline-block; position: absolute; 
            top: 50%; transform: translateY(-50%); 
            animation: scroll-left 25s linear infinite; 
            font-family: 'Share Tech Mono', monospace; font-size: 20px; color: #fff; padding-left: 100%; 
        }
        .sep { color: #00d26a; margin: 0 15px; font-weight: bold; }
        
        @keyframes scroll-left { 0% { left: 0; } 100% { left: -150%; } }
    </style>
</head>
<body>

    <div class="ticker-wrap">
        <div class="ticker-title">CONCENTRA PIT WALL</div>
        <div class="ticker-content-box">
            <div class="ticker-content" id="crew-ticker">
                AGUARDANDO EQUIPE <span class="sep">///</span> CONECTANDO TELEMETRIA
            </div>
        </div>
    </div>

    <script>
        // ==========================================
        // 🔧 PIT CREW TICKER STANDALONE
        // ==========================================
        const myChannel = "";
        const teamNameTwitch = ""; 
        
        // Suas credenciais da Twitch (já preenchidas com as que você forneceu)
        const helixClientID = ""; 
        const helixSecret = ""; 
        
        // A sua lista de segurança (Pneu de Chuva)
        const backupTeam = []; 
        
        let concentraTeam = [];
        let onlineCrew = new Set();
        const tickerEl = document.getElementById('crew-ticker');

        // --- CAIXA PRETA (LOCAL STORAGE) ---
        function saveCrewState() {
            localStorage.setItem('concentraPitWall', JSON.stringify(Array.from(onlineCrew)));
        }

        function loadCrewState() {
            const saved = localStorage.getItem('concentraPitWall');
            if (saved) {
                try {
                    onlineCrew = new Set(JSON.parse(saved));
                } catch (e) {
                    onlineCrew = new Set();
                }
            }
        }

        function clearCrewState() {
            onlineCrew.clear();
            localStorage.removeItem('concentraPitWall');
            updateCrewDisplay();
        }

        // --- ATUALIZAÇÃO VISUAL ---
        function updateCrewDisplay() {
            if (onlineCrew.size === 0) {
                tickerEl.innerHTML = `AGUARDANDO EQUIPE NO PIT WALL <span class="sep">///</span>`;
                return;
            }
            const names = Array.from(onlineCrew).map(name => `🎧 ${name.charAt(0).toUpperCase() + name.slice(1)}`);
            const separator = `<span class="sep">///</span>`;
            tickerEl.innerHTML = names.join(separator) + separator;
        }

        // ==========================================
        // ⚙️ MOTOR HÍBRIDO (AUTO-TOKEN + FAILOVER)
        // ==========================================

        // 1. Função que fabrica um pneu (token) novo na hora
        async function getFreshToken() {
            try {
                const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${helixClientID}&client_secret=${helixSecret}&grant_type=client_credentials`, {
                    method: 'POST'
                });
                if (!res.ok) throw new Error("Falha de ignição no Token");
                const data = await res.json();
                return data.access_token;
            } catch (e) {
                console.warn("Erro ao gerar token:", e);
                return null;
            }
        }

        // 2. Busca a equipe na Twitch ou ativa o Failover
        async function fetchConcentraTeam() {
            try {
                const freshToken = await getFreshToken(); // Pede o token novo
                
                if (!freshToken) throw new Error("Sem token disponível");

                const response = await fetch(`https://api.twitch.tv/helix/teams?name=${teamNameTwitch}`, {
                    method: "GET", 
                    headers: { 
                        "Client-ID": helixClientID, 
                        "Authorization": `Bearer ${freshToken}` 
                    }
                });
                
                if (response.ok) {
                    const json = await response.json();
                    if (json.data && json.data.length > 0) {
                        concentraTeam = json.data[0].users.map(u => u.user_login.toLowerCase());
                        console.log("🟢 Telemetria Twitch OK! Equipe oficial carregada.");
                    } else {
                        throw new Error("Equipe não encontrada no servidor da Twitch");
                    }
                } else {
                    throw new Error(`Servidor da Twitch recusou. Status: ${response.status}`);
                }

            } catch (error) {
                // 🚨 Ocorreu qualquer erro? Aciona a lista de backup imediatamente!
                console.warn("🟡 Falha na API. Acionando MODO FAILOVER (Backup)!", error);
                concentraTeam = backupTeam; 
            }
            
            updateCrewDisplay();
        }

        // --- CONEXÃO DO CHAT ---
        const chatClient = new tmi.Client({ channels: [myChannel] });
        
        chatClient.on("message", (channel, tags, message, self) => {
            const username = tags.username.toLowerCase();
            const msgObj = message.toLowerCase().trim();

            // Comando para limpar o letreiro (Apenas Broadcaster ou Mod)
            if (msgObj === '!zerarmuro' && (tags.badges?.broadcaster || tags.mod)) {
                clearCrewState();
                return;
            }

            // Verifica se quem falou é da equipe e ainda não está no letreiro
            if (concentraTeam.includes(username) && !onlineCrew.has(username)) {
                onlineCrew.add(username);
                updateCrewDisplay();
                saveCrewState(); // Salva na Caixa Preta
            }
        });

        // 🚀 LIGA O MOTOR!
        loadCrewState(); 
        fetchConcentraTeam().then(() => { chatClient.connect().catch(console.error); });
    </script>
</body>
</html>
