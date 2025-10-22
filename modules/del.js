 const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

async function executeDelete(username, serverId, apiEndpoint) {
    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan di database.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}${apiEndpoint}`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
                let responseData;
                try {
                    responseData = JSON.parse(stdout);
                } catch (e) {
                    const errorMsg = `❌ **Error: Gagal Membaca Respons Server**\nServer Anda tidak memberikan balasan JSON yang valid. Ini adalah data mentah yang diterima:\n\n\`\`\`\n${stdout || 'Tidak ada output dari server.'}\n\`\`\``;
                    return resolve({ message: errorMsg, daysLeft: 0 });
                }
                
                console.log(`--- DEBUG: API Response for user ${username} ---\n${JSON.stringify(responseData, null, 2)}\n---------------------------------`);

                if (responseData?.meta?.code !== 200 || !responseData.data) {
                    const errMsg = `❌ **Error: Respons API Tidak Sukses**\nDetail:\n\`\`\`json\n${JSON.stringify(responseData, null, 2)}\n\`\`\``;
                    return resolve({ message: errMsg, daysLeft: 0 });
                }

                const accountData = responseData.data;
                let daysLeft = 0;

                const possibleKeys = ['days_left', 'sisa_hari', 'remaining_days', 'daysLeft', 'expire_in'];
                if (typeof accountData === 'object' && accountData !== null) {
                    for (const key of possibleKeys) {
                        if (typeof accountData[key] === 'number') {
                            daysLeft = accountData[key];
                            break;
                        }
                    }
                }

                const msg = `✅ *Akun Berhasil Dihapus*\n\n🗑️ **Detail Akun**\n    ├─ Server: \`${nama_server}\`\n    └─ Username: \`${accountData.username}\``;
                return resolve({ message: msg, daysLeft });
            });
        });
    });
}

async function delssh(username, p, e, i, serverId) {
    return executeDelete(username, serverId, '/vps/deletesshvpn');
}

async function delvmess(username, p, e, i, serverId) {
    return executeDelete(username, serverId, '/vps/deletevmess');
}

async function delvless(username, p, e, i, serverId) {
    return executeDelete(username, serverId, '/vps/deletevless');
}

async function deltrojan(username, p, e, i, serverId) {
    return executeDelete(username, serverId, '/vps/deletetrojan');
}

async function delshadowsocks(username, p, e, i, serverId) {
    return executeDelete(username, serverId, '/vps/deleteshadowsocks');
}
  
module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };
