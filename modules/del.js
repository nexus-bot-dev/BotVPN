 const { exec } = require('child_process'); // Tetap ada untuk penggunaan internal jika diperlukan, tapi tidak disarankan untuk API call
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch'); // ⬅️ GANTI: Pake fetch native untuk API call
const db = new sqlite3.Database('./sellvpn.db');

/**
 * Fungsi inti untuk menghapus akun VPN/SSH berdasarkan protokol.
 * Menggantikan delssh, delvmess, delvless, deltrojan, delshadowsocks.
 *
 * @param {string} username - Nama pengguna akun.
 * @param {string} protocol - Jenis protokol (ssh, vmess, vless, trojan, shadowsocks).
 * @param {number} serverId - ID Server dari database.
 * @returns {Promise<{message: string, daysLeft: number}>}
 */
async function deleteAccount(username, protocol, serverId) {
    const apiPaths = {
        ssh: 'deletesshvpn',
        vmess: 'deletevmess',
        vless: 'deletevless',
        trojan: 'deletetrojan',
        shadowsocks: 'deleteshadowsocks'
    };
    
    // 1. Validasi Input
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }
    
    // Validasi Protokol
    const apiPath = apiPaths[protocol.toLowerCase()];
    if (!apiPath) {
        return { message: '❌ Protokol tidak valid.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        // 2. Database Lookup
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], async (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/${apiPath}/${username}`;

            let d;
            try {
                // 3. API Call menggunakan node-fetch (Lebih bersih dari curl)
                const response = await fetch(web_URL, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': auth,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    // Coba ambil pesan error dari body response jika ada
                    try {
                        d = await response.json();
                    } catch (e) {
                        return resolve({ message: `❌ Gagal menghapus akun. Status: ${response.status}`, daysLeft: 0 });
                    }
                } else {
                    d = await response.json();
                }

            } catch (e) {
                // Error koneksi atau masalah jaringan
                return resolve({ message: `❌ Gagal koneksi ke server ${domain}.`, daysLeft: 0 });
            }

            // 4. Response Handling
            if (d?.meta?.code !== 200 || !d.data) {
                const errMsg = d?.message || d?.meta?.message || `Gagal menghapus akun ${protocol}.`;
                return resolve({ message: `❌ Gagal: ${errMsg}`, daysLeft: 0 });
            }

            const s = d.data;
            const daysLeft = s.days_left || 0;
            
            // 💡 INTEGRASI REFUND LOGIC DI SINI (seperti yang dibahas sebelumnya)
            // Lakukan pemanggilan fungsi processRefund() di sini jika Anda sudah membuatnya.
            let refundMsg = '';
            if (daysLeft > 0) {
                 // Ganti dengan logika refund Anda yang sebenarnya
                 // Contoh: const refundResult = await processRefund(username, daysLeft);
                 refundMsg = `\n💰 *Refund:* Sisa ${daysLeft} hari akan diproses.`; 
            }
            
            const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari.${refundMsg}`;
            
            return resolve({ message: msg, daysLeft: daysLeft });
        });
    });
}

// ==========================================================
// ⚠️ FUNGSI YANG DIEKSPOR (WRAPPER BARU)
// ==========================================================
// Sekarang, Anda bisa memanggil fungsi utama dengan protokol yang sesuai:

async function delssh(...args) { 
    return deleteAccount(args[0], 'ssh', args[4]); 
}

async function delvmess(...args) { 
    return deleteAccount(args[0], 'vmess', args[4]); 
}

async function delvless(...args) { 
    return deleteAccount(args[0], 'vless', args[4]); 
}

async function deltrojan(...args) { 
    return deleteAccount(args[0], 'trojan', args[4]); 
}

async function delshadowsocks(...args) { 
    return deleteAccount(args[0], 'shadowsocks', args[4]); 
}
  
module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };
