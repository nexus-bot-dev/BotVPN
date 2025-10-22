 const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

// ==========================================================
// ⚠️ FUNGSI BARU UNTUK MEMPROSES REFUND (PERLU DISESUAIKAN)
// ==========================================================
/**
 * Memproses refund ke saldo pengguna berdasarkan sisa hari dan harga akun.
 * @param {string} username - Username akun yang dihapus.
 * @param {number} daysLeft - Sisa hari kedaluwarsa.
 * @returns {Promise<{success: boolean, refundAmount: number}>}
 */
async function processRefund(username, daysLeft) {
    // ⚠️ PENTING: Anda harus mengganti logika ini dengan logika harga/saldo Anda.

    // 1. Dapatkan detail harga akun yang dihapus.
    // Asumsi: Harga akun per 30 hari adalah Rp. 30,000
    const PRICE_PER_30_DAYS = 30000;
    const pricePerDay = PRICE_PER_30_DAYS / 30; // Rp. 1000 per hari

    // 2. Hitung jumlah refund
    const refundAmount = Math.floor(daysLeft * pricePerDay);

    // 3. Perbarui saldo pengguna di database Anda (Contoh SQL UPDATE)
    // Asumsi: Ada tabel 'Users' dengan kolom 'username' dan 'balance'
    
    // return new Promise((resolve) => {
    //     db.run(
    //         'UPDATE Users SET balance = balance + ? WHERE username = ?',
    //         [refundAmount, username],
    //         function (err) {
    //             if (err) {
    //                 console.error('Gagal memproses refund untuk ' + username + ':', err.message);
    //                 return resolve({ success: false, refundAmount: 0 });
    //             }
    //             // Berhasil di-refund
    //             return resolve({ success: true, refundAmount: refundAmount });
    //         }
    //     );
    // });
    
    // Karena saya tidak memiliki tabel 'Users', saya akan mengembalikan nilai sukses
    // Hapus 4 baris di bawah ini dan uncomment kode di atas setelah Anda menyesuaikan SQL
    if (daysLeft > 0) {
        return { success: true, refundAmount: refundAmount };
    }
    return { success: false, refundAmount: 0 };
}


// ==========================================================
// FUNGSI DELSSH YANG SUDAH DIUPDATE DENGAN REFUND
// ==========================================================
async function delssh(username, password, exp, iplimit, serverId) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/deletesshvpn`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, async (_, stdout) => { // Perhatikan 'async' di sini
                let d;
                try {
                    d = JSON.parse(stdout);
                } catch (e) {
                    return resolve({ message: '❌ Format respon dari server tidak valid.', daysLeft: 0 });
                }

                if (d?.meta?.code !== 200 || !d.data) {
                    const errMsg = d?.message || d?.meta?.message || 'Gagal menghapus akun.';
                    return resolve({ message: `❌ Gagal: ${errMsg}`, daysLeft: 0 });
                }

                const s = d.data;
                const daysLeft = s.days_left || 0;

                // 🌟 BAGIAN BARU: PROSES REFUND
                let refundMsg = '';
                if (daysLeft > 0) {
                    const refundResult = await processRefund(username, daysLeft);
                    
                    if (refundResult.success) {
                        refundMsg = `\n💰 *Refund:* Berhasil ditambahkan sebesar \`Rp. ${refundResult.refundAmount.toLocaleString('id-ID')}\` ke saldo Anda.`;
                    } else {
                        refundMsg = `\n⚠️ *Peringatan:* Gagal memproses refund otomatis. Mohon hubungi admin.`;
                    }
                } else {
                    refundMsg = `\n*Tidak ada sisa hari. Tidak ada refund yang diproses.*`;
                }
                // 🌟 AKHIR BAGIAN BARU
                
                const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari.${refundMsg}`; // Gabungkan pesan refund

                return resolve({ message: msg, daysLeft: daysLeft });
            });
        });
    });
}

// ... Fungsi delvmess, delvless, deltrojan, delshadowsocks (harus diupdate dengan logika refund yang sama) ...

module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };
