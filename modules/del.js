  const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

/**
 * Fungsi umum untuk menghapus akun & refund otomatis
 * @param {string} type - tipe layanan (sshvpn, vmess, vless, trojan, shadowsocks)
 * @param {string} username - nama akun yang akan dihapus
 * @param {number} userId - ID user pemilik akun
 * @param {number} serverId - ID server tempat akun dibuat
 * @returns {Promise<{message: string, daysLeft: number}>}
 */
async function deleteAccount(type, username, userId, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
    return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });

      const { domain, auth, nama_server } = server;
      const endpoint = `http://${domain}/vps/delete${type}`;
      const curlCommand = `curl -s -X DELETE "${endpoint}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

      exec(curlCommand, (_, stdout) => {
        let d;
        try {
          d = JSON.parse(stdout);
        } catch {
          return resolve({ message: '❌ Format respon dari server tidak valid.', daysLeft: 0 });
        }

        if (d?.meta?.code !== 200 || !d.data) {
          const errMsg = d?.message || d?.meta?.message || 'Gagal menghapus akun.';
          return resolve({ message: `❌ Gagal: ${errMsg}`, daysLeft: 0 });
        }

        const s = d.data;
        const daysLeft = s.days_left || 0;

        // === Ambil harga akun dari database ===
        db.get(
          'SELECT harga, exp FROM Akun WHERE username = ? AND server_id = ? AND user_id = ?',
          [username, serverId, userId],
          (err2, akun) => {
            if (err2 || !akun) {
              const msgNoRefund = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

⚠️ Data harga akun tidak ditemukan, refund tidak diproses.`;
              return resolve({ message: msgNoRefund, daysLeft });
            }

            const hargaPerHari = akun.harga / akun.exp;
            const refund = Math.round(daysLeft * hargaPerHari);

            // === Proses refund saldo ke user ===
            db.get('SELECT saldo FROM Users WHERE id = ?', [userId], (err3, user) => {
              if (err3 || !user) {
                const msgNoUser = `✅ *Akun Dihapus*, tapi refund gagal karena user tidak ditemukan.`;
                return resolve({ message: msgNoUser, daysLeft });
              }

              const saldoBaru = user.saldo + refund;
              db.run('UPDATE Users SET saldo = ? WHERE id = ?', [saldoBaru, userId], (err4) => {
                if (err4) {
                  const msgFailRefund = `✅ *Akun Dihapus*, tapi refund gagal disimpan ke database.`;
                  return resolve({ message: msgFailRefund, daysLeft });
                }

                // === Hapus juga data akun dari tabel Akun ===
                db.run(
                  'DELETE FROM Akun WHERE username = ? AND server_id = ? AND user_id = ?',
                  [username, serverId, userId],
                  () => {}
                );

                const msg = `✅ *Akun Berhasil Dihapus dan Refund Diproses!*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari
💰 *Saldo Dikembalikan*: Rp${refund.toLocaleString('id-ID')}

💵 *Saldo Baru*: Rp${saldoBaru.toLocaleString('id-ID')}`;
                return resolve({ message: msg, daysLeft });
              });
            });
          }
        );
      });
    });
  });
}

// === Alias sesuai jenis layanan (agar kompatibel dengan kode lama) ===
async function delssh(username, userId, serverId) {
  return deleteAccount('sshvpn', username, userId, serverId);
}

async function delvmess(username, userId, serverId) {
  return deleteAccount('vmess', username, userId, serverId);
}

async function delvless(username, userId, serverId) {
  return deleteAccount('vless', username, userId, serverId);
}

async function deltrojan(username, userId, serverId) {
  return deleteAccount('trojan', username, userId, serverId);
}

async function delshadowsocks(username, userId, serverId) {
  return deleteAccount('shadowsocks', username, userId, serverId);
}

module.exports = { delssh, delvmess, delvless, deltrojan, delshadowsocks };
