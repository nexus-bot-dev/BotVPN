  const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch'); // Pastikan Anda sudah menginstal: npm install node-fetch
const db = new sqlite3.Database('./sellvpn.db');

// ==========================================================
// ⚠️ FUNGSI REFUND (HARUS ANDA IMPLEMENTASIKAN)
// ==========================================================
/**
 * Memproses refund ke saldo pengguna berdasarkan sisa hari dan harga akun.
 * @param {string} username - Username akun yang dihapus.
 * @param {number} daysLeft - Sisa hari kedaluwarsa.
 * @returns {Promise<{success: boolean, refundAmount: number}>}
 */
async function processRefund(username, daysLeft) {
    // ⚠️ PENTING: GANTI DENGAN LOGIKA DATABASE DAN HARGA ANDA!
    if (daysLeft > 0) {
        const PRICE_PER_DAY = 1000; // Contoh: Harga Rp 1000 per hari
        const refundAmount = Math.floor(daysLeft * PRICE_PER_DAY);
        
        // --- UNCOMMENT DAN SESUAIKAN LOGIKA UPDATE SALDO ANDA DI SINI ---
        /*
        await new Promise((resolve, reject) => {
             db.run(
                 'UPDATE Users SET balance = balance + ? WHERE username = ?',
                 [refundAmount, username],
                 (err) => {
                     if (err) return reject(err);
                     resolve();
                 }
             );
        });
        */
        // -----------------------------------------------------------------

        return { success: true, refundAmount: refundAmount };
    }
    return { success: false, refundAmount: 0 };
}


// ==========================================================
// FUNGSI INTI PENGHAPUSAN AKUN (Lebih bersih dan efisien)
// ==========================================================
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
                // 3. API Call menggunakan node-fetch
                const response = await fetch(web_URL, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': auth,
                        'Accept': 'application/json'
                    }
                });

                d = await response.json();

                // Cek status HTTP 
                if (!response.ok || d?.meta?.code !== 200 || !d.data) {
                    const errMsg = d?.message || d?.meta?.message || `Gagal menghapus akun ${protocol}.`;
                    return resolve({ message: `❌ Gagal: ${errMsg}. Status HTTP: ${response.status}`, daysLeft: 0 });
                }

            } catch (e) {
                // Error koneksi atau JSON parsing
                return resolve({ message: `❌ Gagal koneksi atau format respon tidak valid dari server ${domain}.`, daysLeft: 0 });
            }

            // 4. Response Handling & Refund Logic
            
            // ✅ MENGAMBIL DATA DARI ENDPOINT DELETE 
            const s = d.data;
            const daysLeft = s.days_left || 0; // Mengambil sisa hari
            const deletedUsername = s.username || username; // Mengambil username dari respon (jika ada)

            let refundMsg = '';
            if (daysLeft > 0) {
                try {
                    const refundResult = await processRefund(deletedUsername, daysLeft);
                    if (refundResult.success) {
                        refundMsg = `\n💰 *Refund Otomatis:* Berhasil ditambahkan sebesar \`Rp. ${refundResult.refundAmount.toLocaleString('id-ID')}\` ke saldo Anda.`;
                    } else {
                        refundMsg = `\n⚠️ *Peringatan:* Akun dihapus, tetapi GAGAL memproses refund otomatis. Mohon hubungi admin.`;
                    }
                } catch (e) {
                    refundMsg = `\n⚠️ *Peringatan:* Akun dihapus, tetapi terjadi ERROR saat memproses refund. Mohon hubungi admin.`;
                    console.error('Error saat proses refund:', e);
                }
            } else {
                refundMsg = `\n*Tidak ada sisa hari. Tidak ada refund yang diproses.*`;
            }
            
            const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${deletedUsername}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari.${refundMsg}`;
            
            return resolve({ message: msg, daysLeft: daysLeft });
        });
    });
}

// ==========================================================
// WRAPPER FUNGSI YANG DIEKSPOR (Menggunakan parameter yang relevan saja)
// ==========================================================

// Fungsi delssh yang asli memiliki 5 argumen. Kita hanya butuh username dan serverId.
// Kami mempertahankan struktur argumen lama (username, password, exp, iplimit, serverId) 
// tetapi hanya menggunakan argumen ke-1 (username) dan ke-5 (serverId).
// Ini penting agar BOT Anda tidak error saat memanggilnya.

async function delssh(username, password, exp, iplimit, serverId) { 
    return deleteAccount(username, 'ssh', serverId); 
}

async function delvmess(username, exp, quota, limitip, serverId) { 
    // Menggunakan index yang benar dari argumen asli: username (0), serverId (4)
    return deleteAccount(username, 'vmess', serverId); 
}

async function delvless(username, exp, quota, limitip, serverId) { 
    return deleteAccount(username, 'vless', serverId); 
}

async function deltrojan(username, exp, quota, limitip, serverId) { 
    return deleteAccount(username, 'trojan', serverId); 
}

async function delshadowsocks(username, exp, quota, limitip, serverId) { 
    return deleteAccount(username, 'shadowsocks', serverId); 
}
  
module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };
