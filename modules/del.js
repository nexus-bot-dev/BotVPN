 const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

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

      exec(curlCommand, (_, stdout) => {
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
        // PENTING: Ganti 'days_left' jika nama field dari API Anda berbeda
        const daysLeft = s.days_left || 0; 
        const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari (akan diproses untuk refund).`;
        
        return resolve({ message: msg, daysLeft: daysLeft });
      });
    });
  });
}

async function delvmess(username, exp, quota, limitip, serverId) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/deletevmess`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
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
                // PENTING: Ganti 'days_left' jika nama field dari API Anda berbeda
                const daysLeft = s.days_left || 0;
                const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari (akan diproses untuk refund).`;

                return resolve({ message: msg, daysLeft: daysLeft });
            });
        });
    });
}

async function delvless(username, exp, quota, limitip, serverId) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/deletevless`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
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
                // PENTING: Ganti 'days_left' jika nama field dari API Anda berbeda
                const daysLeft = s.days_left || 0;
                const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari (akan diproses untuk refund).`;

                return resolve({ message: msg, daysLeft: daysLeft });
            });
        });
    });
}

async function deltrojan(username, exp, quota, limitip, serverId) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/deletetrojan`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
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
                // PENTING: Ganti 'days_left' jika nama field dari API Anda berbeda
                const daysLeft = s.days_left || 0;
                const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari (akan diproses untuk refund).`;

                return resolve({ message: msg, daysLeft: daysLeft });
            });
        });
    });
}

async function delshadowsocks(username, exp, quota, limitip, serverId) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            // Asumsi endpoint delete shadowsocks, sesuaikan jika berbeda
            const web_URL = `http://${domain}/vps/deleteshadowsocks`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
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
                // PENTING: Ganti 'days_left' jika nama field dari API Anda berbeda
                const daysLeft = s.days_left || 0;
                const msg = `✅ *Akun Berhasil Dihapus*

🗑️ **Detail Akun**
    ├─ Server: \`${nama_server}\`
    └─ Username: \`${s.username}\`

🗓️ *Sisa Hari*: \`${daysLeft}\` hari (akan diproses untuk refund).`;

                return resolve({ message: msg, daysLeft: daysLeft });
            });
        });
    });
}
  
module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };