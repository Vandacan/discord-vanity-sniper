import http2 from "http2";
import WebSocket from "ws";
import fs from "fs";

const CONFIG = {
    host: 'https://canary.discord.com',
    token: "", 
    serverID: "1421903125203255328",
    logChannel: "1421904385230901293",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    superProps: 'eyJicm93c2VyIjoiQ2hyb21lIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiQ2hyb21lIiwiY2xpZW50X2J1aWxkX251bWJlciI6MzU1NjI0fQ=='
};
let mfaToken = "";
let guilds = new Map(); //
const client = http2.connect(CONFIG.host);

const updateMfa = () => {
    try {
        mfaToken = fs.readFileSync("mfa.txt", "utf8").trim();
    } catch (e) { }
};
updateMfa();
fs.watch("mfa.txt", (event) => event === "change" && updateMfa());

const getHeaders = (method, path) => ({
    ':method': method,
    ':path': path,
    'authorization': CONFIG.token,
    'x-discord-mfa-authorization': mfaToken,
    'user-agent': CONFIG.userAgent,
    'x-super-properties': CONFIG.superProps,
    'content-type': 'application/json',
});

const logToDiscord = (msg) => {
    const req = client.request(getHeaders('POST', `/api/v9/channels/${CONFIG.logChannel}/messages`));
    req.write(JSON.stringify({ content: msg }));
    req.end();
};

const claimVanity = (code) => {
    const body = Buffer.from(JSON.stringify({ code })); 

    for (let i = 0; i < 4; i++) {
        const req = client.request(
            getHeaders('PATCH', `/api/v9/guilds/${CONFIG.serverID}/vanity-url`),
            { weight: 255, exclusive: true } 
        );

        req.on('response', (headers) => {
            if (headers[':status'] === '200' || headers[':status'] === '204') {
                logToDiscord(`@everyone Vandacan ${code}`);
            }
        });

        req.end(body);
    }
};

const connectWS = () => {
    const ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");

    ws.on('open', () => {
        ws.send(JSON.stringify({
            op: 2,
            d: {
                token: CONFIG.token,
                intents: 1, 
                properties: { os: "linux", browser: "chrome", device: "Vandababa" }
            }
        }));
    });

    ws.on('message', (data) => {
        const packet = JSON.parse(data);
        const { t, d, op } = packet;

        if (t === "GUILD_UPDATE" || t === "GUILD_DELETE") {
            const guildId = d.guild_id || d.id;
            const oldVanity = guilds.get(guildId);

            if (oldVanity && (t === "GUILD_DELETE" || d.vanity_url_code !== oldVanity)) {
                claimVanity(oldVanity); 
            }

            if (d.vanity_url_code) guilds.set(guildId, d.vanity_url_code);
        }

        else if (t === "READY") {
            d.guilds.forEach(g => {
                if (g.vanity_url_code) guilds.set(g.id, g.vanity_url_code);
            });
            console.log("VandacanXrayzruin");
        }

        if (op === 10) { 
            setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), d.heartbeat_interval);
        }
    });

    ws.on('close', () => process.exit());
};

client.on('connect', connectWS);
