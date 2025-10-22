 const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { Telegraf } = require('telegraf');
const app = express();
const axios = require('axios');
const { buildPayload, headers, API_URL } = require('./api-cekpayment-orkut');
const winston = require('winston');
const { exec } = require('child_process');
const fsPromises = require('fs/promises');
const path = require('path');
const fs = require('fs');

// --- INTEGRASI FUNGSI MODUL LAIN (TETAP DIPERLUKAN) ---
// Pastikan file-file ini ada di folder modules/ Anda
const { 
  createssh, 
  createvmess, 
  createvless, 
  createtrojan, 
  createshadowsocks 
} = require('./modules/create');

const { 
  trialssh, 
  trialvmess, 
  trialvless, 
  trialtrojan, 
  trialshadowsocks 
} = require('./modules/trial');

const { 
  renewssh, 
  renewvmess, 
  renewvless, 
  renewtrojan, 
  renewshadowsocks 
} = require('./modules/renew');

const { 
  lockssh, 
  lockvmess, 
  lockvless, 
  locktrojan, 
  lockshadowsocks 
} = require('./modules/lock');

const { 
  unlockssh, 
  unlockvmess, 
  unlockvless, 
  unlocktrojan, 
  unlockshadowsocks 
} = require('./modules/unlock');

// --- SETUP LOGGING ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'bot-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'bot-combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const trialFile = path.join(__dirname, 'trial.db');

// --- FUNGSI TRIAL ACCESS ---
// Mengecek apakah user sudah pakai trial hari ini
async function checkTrialAccess(userId) {
  try {
    const data = await fsPromises.readFile(trialFile, 'utf8');
    const trialData = JSON.parse(data);
    const lastAccess = trialData[userId];

    const today = new Date().toISOString().slice(0, 10); // format YYYY-MM-DD
    return lastAccess === today;
  } catch (err) {
    return false; // anggap belum pernah pakai kalau file belum ada
  }
}

// Menyimpan bahwa user sudah pakai trial hari ini
async function saveTrialAccess(userId) {
  let trialData = {};
  try {
    const data = await fsPromises.readFile(trialFile, 'utf8');
    trialData = JSON.parse(data);
  } catch (err) {
    // file belum ada, lanjut
  }

  const today = new Date().toISOString().slice(0, 10);
  trialData[userId] = today;
  await fsPromises.writeFile(trialFile, JSON.stringify(trialData, null, 2));
}

// --- FUNGSI DELETE AKUN (PENGGANTI del.js) UNTUK AUTO REFUND ---

async function executeDeleteCommand(username, serverId, endpoint) {
    if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username)) {
        return { message: '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.', daysLeft: 0 };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
            if (err || !server) {
                return resolve({ message: '❌ Server tidak ditemukan.', daysLeft: 0 });
            }

            const { domain, auth, nama_server } = server;
            const web_URL = `http://${domain}/vps/${endpoint}`;
            const curlCommand = `curl -s -X DELETE "${web_URL}/${username}" -H "Authorization: ${auth}" -H "accept: application/json"`;

            exec(curlCommand, (_, stdout) => {
                let d;
                try {
                    d = JSON.parse(stdout);
                } catch (e) {
                    logger.error(`Error parsing response from server ${domain} (${endpoint}):`, e.message);
                    return resolve({ message: '❌ Format respon dari server tidak valid.', daysLeft: 0 });
                }

                if (d?.meta?.code !== 200 || !d.data) {
                    const errMsg = d?.message || d?.meta?.message || 'Gagal menghapus akun.';
                    return resolve({ message: `❌ Gagal: ${errMsg}`, daysLeft: 0 });
                }

                const s = d.data;
                // Kunci Auto Refund: Ambil sisa hari dari respons API
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

// Fungsi Wrapper untuk setiap tipe layanan
async function delssh(username, password, exp, iplimit, serverId) {
    return executeDeleteCommand(username, serverId, 'deletesshvpn');
}
async function delvmess(username, exp, quota, limitip, serverId) {
    return executeDeleteCommand(username, serverId, 'deletevmess');
}
async function delvless(username, exp, quota, limitip, serverId) {
    return executeDeleteCommand(username, serverId, 'deletevless');
}
async function deltrojan(username, exp, quota, limitip, serverId) {
    return executeDeleteCommand(username, serverId, 'deletetrojan');
}
async function delshadowsocks(username, exp, quota, limitip, serverId) {
    return executeDeleteCommand(username, serverId, 'deleteshadowsocks');
}


// --- INI ADALAH FUNGSI HELPER UNTUK REFUND (Wajib ada di app.js) ---
async function getServerPrice(serverId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT harga FROM Server WHERE id = ?', [serverId], (err, row) => {
            if (err) return reject(err);
            resolve(row ? row.harga : 0);
        });
    });
}

async function updateUserBalance(userId, saldo) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [saldo, userId], function (err) {
      if (err) {
        logger.error('⚠️ Kesalahan saat menambahkan saldo user:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
// -------------------------------------------------------------------


// --- LOAD VARIABEL DARI .vars.json ---
const vars = JSON.parse(fs.readFileSync('./.vars.json', 'utf8'));
const BOT_TOKEN = vars.BOT_TOKEN;
const port = vars.PORT || 6969;
const ADMIN = vars.USER_ID; 
const NAMA_STORE = vars.NAMA_STORE || '@ARI_VPN_STORE';
const DATA_QRIS = vars.DATA_QRIS;
const MERCHANT_ID = vars.MERCHANT_ID;
const API_KEY = vars.API_KEY;
const GROUP_ID = vars.GROUP_ID;

// PENTING: Inisialisasi variabel Bonus Top-Up dan Minimal Top-Up dari .vars.json
let topUpBonusPercentage = vars.TOP_UP_BONUS_PERCENTAGE || 0; 
let minTopUpAmount = vars.MIN_TOP_UP_AMOUNT || 5000; // Default 5000

logger.info(`Top-Up Bonus set to: ${topUpBonusPercentage}%`);
logger.info(`Min Top Up set to: Rp ${minTopUpAmount}`);

const bot = new Telegraf(BOT_TOKEN);
const adminIds = ADMIN;
logger.info('Bot initialized');

// --- SETUP DATABASE SQLITE3 ---
const db = new sqlite3.Database('./sellvpn.db', (err) => {
  if (err) {
    logger.error('Kesalahan koneksi SQLite3:', err.message);
  } else {
    logger.info('Terhubung ke SQLite3');
  }
});

// CREATE TABLES
db.run(`CREATE TABLE IF NOT EXISTS pending_deposits (
  unique_code TEXT PRIMARY KEY,
  user_id INTEGER,
  amount INTEGER,
  original_amount INTEGER,
  timestamp INTEGER,
  status TEXT,
  qr_message_id INTEGER
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel pending_deposits:', err.message);
  }
});

db.run(`CREATE TABLE IF NOT EXISTS Server (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  auth TEXT,
  harga INTEGER,
  nama_server TEXT,
  quota INTEGER,
  iplimit INTEGER,
  batas_create_akun INTEGER,
  total_create_akun INTEGER
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel Server:', err.message);
  } else {
    logger.info('Server table created or already exists');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  saldo INTEGER DEFAULT 0,
  CONSTRAINT unique_user_id UNIQUE (user_id)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel users:', err.message);
  } else {
    logger.info('Users table created or already exists');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount INTEGER,
  type TEXT,
  reference_id TEXT,
  timestamp INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel transactions:', err.message);
  } else {
    logger.info('Transactions table created or already exists');
    
    // Add reference_id column if it doesn't exist (Keeping original logic for completeness)
    db.get("PRAGMA table_info(transactions)", (err, rows) => {
      if (err) {
        logger.error('Kesalahan memeriksa struktur tabel:', err.message);
        return;
      }
      
      db.get("SELECT * FROM transactions WHERE reference_id IS NULL LIMIT 1", (err, row) => {
        if (err && err.message.includes('no such column')) {
          // Column doesn't exist, add it
          db.run("ALTER TABLE transactions ADD COLUMN reference_id TEXT", (err) => {
            if (err) {
              logger.error('Kesalahan menambahkan kolom reference_id:', err.message);
            } else {
              logger.info('Kolom reference_id berhasil ditambahkan ke tabel transactions');
            }
          });
        } else if (row) {
          // Update existing transactions with reference_id
          db.all("SELECT id, user_id, type, timestamp FROM transactions WHERE reference_id IS NULL", [], (err, rows) => {
            if (err) {
              logger.error('Kesalahan mengambil transaksi tanpa reference_id:', err.message);
              return;
            }
            
            rows.forEach(row => {
              const referenceId = `account-${row.type}-${row.user_id}-${row.timestamp}`;
              db.run("UPDATE transactions SET reference_id = ? WHERE id = ?", [referenceId, row.id], (err) => {
                if (err) {
                  logger.error(`Kesalahan mengupdate reference_id untuk transaksi ${row.id}:`, err.message);
                } else {
                  logger.info(`Berhasil mengupdate reference_id untuk transaksi ${row.id}`);
                }
              });
            });
          });
        }
      });
    });
  }
});

const userState = {};
logger.info('User state initialized');

// --- COMMAND HANDLERS ---

bot.command(['start', 'menu'], async (ctx) => {
  logger.info('Start or Menu command received');
  
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      logger.error('Kesalahan saat memeriksa user_id:', err.message);
      return;
    }

    if (row) {
      logger.info(`User ID ${userId} sudah ada di database`);
    } else {
      db.run('INSERT INTO users (user_id) VALUES (?)', [userId], (err) => {
        if (err) {
          logger.error('Kesalahan saat menyimpan user_id:', err.message);
        } else {
          logger.info(`User ID ${userId} berhasil disimpan`);
        }
      });
    }
  });

  await sendMainMenu(ctx);
});

bot.command('admin', async (ctx) => {
  logger.info('Admin menu requested');
  
  if (!adminIds.includes(ctx.from.id)) {
    await ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
    return;
  }

  await sendAdminMenu(ctx);
});

async function sendMainMenu(ctx) {
  // Ambil data user
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || '-';
  let saldo = 0;
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    saldo = row ? row.saldo : 0;
  } catch (e) { saldo = 0; }

  // Statistik user
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let userToday = 0, userWeek = 0, userMonth = 0;
  let globalToday = 0, globalWeek = 0, globalMonth = 0;
  try {
    userToday = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [userId, todayStart], (err, row) => resolve(row ? row.count : 0));
    });
    userWeek = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [userId, weekStart], (err, row) => resolve(row ? row.count : 0));
    });
    userMonth = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [userId, monthStart], (err, row) => resolve(row ? row.count : 0));
    });
    globalToday = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [todayStart], (err, row) => resolve(row ? row.count : 0));
    });
    globalWeek = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [weekStart], (err, row) => resolve(row ? row.count : 0));
    });
    globalMonth = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM transactions WHERE timestamp >= ? AND type IN ("ssh","vmess","vless","trojan","shadowsocks")', [monthStart], (err, row) => resolve(row ? row.count : 0));
    });
  } catch (e) {}

  // Jumlah pengguna bot
  let jumlahPengguna = 0;
  let isReseller = false;
  const resselFilePath = path.join(__dirname, 'ressel.db');
if (fs.existsSync(resselFilePath)) {
  const resellerList = fs.readFileSync(resselFilePath, 'utf8').split('\n').map(x => x.trim());
  isReseller = resellerList.includes(userId.toString());
}
const statusReseller = isReseller ? 'Reseller' : 'Bukan Reseller';
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) AS count FROM users', (err, row) => { if (err) reject(err); else resolve(row); });
    });
    jumlahPengguna = row.count;
  } catch (e) { jumlahPengguna = 0; }

  // Latency (dummy, bisa diubah sesuai kebutuhan)
  const latency = (Math.random() * 0.1 + 0.01).toFixed(2);

  const messageText = `
╭─ <b>⚡ BOT VPN ${NAMA_STORE} ⚡</b>
├ Bot VPN Premium dengan sistem otomatis
├ Pembelian layanan VPN berkualitas tinggi
└ Akses internet cepat & aman dengan server terpercaya! 

<b>👋 Hai, Member <code>${userName}</code>!</b>
ID: <code>${userId}</code>
Saldo: <code>Rp ${saldo}</code>
Status: <code>${statusReseller}</code>

<blockquote>📊 <b>Statistik Anda</b>
• Hari Ini   : ${userToday} akun
• Minggu Ini  : ${userWeek} akun
• Bulan Ini   : ${userMonth} akun

🌐 <b>Statistik Global</b>
• Hari Ini   : ${globalToday} akun
• Minggu Ini  : ${globalWeek} akun
• Bulan Ini   : ${globalMonth} akun
</blockquote>

⚙️ <b>COMMAND</b>
• 🏠 Menu Utama   : /start
• 🔑 Menu Admin   : /admin
• 🛡️ Admin Panel  : /helpadmin

👨‍💻 <b>Pembuat:</b> @ARI_VPN_STORE
🛠️ <b>Credit:</b> ARI STORE × API POTATO
🔧 <b>Base:</b> FighterTunnel
👥 <b>Pengguna BOT:</b> ${jumlahPengguna}
⏱️ <b>Latency:</b> ${latency} ms
──────────────────────────`;

  const keyboard = [
    [
      { text: '➕ Buat Akun', callback_data: 'service_create' },
      { text: '♻️ Perpanjang Akun', callback_data: 'service_renew' }
    ],
    [
      { text: '❌ Hapus Akun', callback_data: 'service_del' },
      { text: '📶 Cek Server', callback_data: 'cek_service' }
    ],
    [
      { text: '🗝️ Kunci Akun', callback_data: 'service_lock' },
      { text: '🔐 Buka Kunci Akun', callback_data: 'service_unlock' }
    ],    
    [
      { text: '⌛ Trial Akun', callback_data: 'service_trial' },
      { text: '💰 TopUp Saldo', callback_data: 'topup_saldo' }
    ],
  ];

  try {
    if (ctx.updateType === 'callback_query') {
      try {
      await ctx.editMessageText(messageText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (error) {
        // Jika error karena message sudah diedit/dihapus, abaikan
        if (error && error.response && error.response.error_code === 400 &&
            (error.response.description.includes('message is not modified') ||
             error.response.description.includes('message to edit not found') ||
             error.response.description.includes('message can\'t be edited'))
        ) {
          logger.info('Edit message diabaikan karena pesan sudah diedit/dihapus atau tidak berubah.');
    } else {
          logger.error('Error saat mengedit menu utama:', error);
        }
      }
    } else {
      try {
        await ctx.reply(messageText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (error) {
        logger.error('Error saat mengirim menu utama:', error);
      }
    }
    logger.info('Main menu sent');
  } catch (error) {
    logger.error('Error umum saat mengirim menu utama:', error);
  }
}


// Tambahan fitur admin, etc... (Dihilangkan untuk brevity, asumsikan semua fitur admin di bawah tetap ada)

// --- ADMIN COMMANDS (Hanya yang menerima input text) ---
// ... (/setbonus, /setmintopup, /hapuslog, /helpadmin, /broadcast, /addsaldo, /addserver, /editharga, /editnama, dll. )
// ... (Semua logika perintah admin dari kode Anda sebelumnya tetap dipertahankan di sini)
// ...

// --- ACTION HANDLERS ---
async function handleServiceAction(ctx, action) {
  let keyboard;
  if (action === 'create') {
    keyboard = [
      [{ text: 'Buat Ssh/Ovpn', callback_data: 'create_ssh' }],      
      [{ text: 'Buat Vmess', callback_data: 'create_vmess' }, { text: 'Buat Vless', callback_data: 'create_vless' }],
      [{ text: 'Buat Trojan', callback_data: 'create_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'trial') {
    keyboard = [
      [{ text: 'Trial Ssh/Ovpn', callback_data: 'trial_ssh' }],      
      [{ text: 'Trial Vmess', callback_data: 'trial_vmess' }, { text: 'Trial Vless', callback_data: 'trial_vless' }],
      [{ text: 'Trial Trojan', callback_data: 'trial_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }],
    ];
  } else if (action === 'renew') {
    keyboard = [
      [{ text: 'Perpanjang Ssh/Ovpn', callback_data: 'renew_ssh' }],      
      [{ text: 'Perpanjang Vmess', callback_data: 'renew_vmess' }, { text: 'Perpanjang Vless', callback_data: 'renew_vless' }],
      [{ text: 'Perpanjang Trojan', callback_data: 'renew_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }],
    ];
  } else if (action === 'del') {
    keyboard = [
      [{ text: 'Hapus Ssh/Ovpn', callback_data: 'del_ssh' }],      
      [{ text: 'Hapus Vmess', callback_data: 'del_vmess' }, { text: 'Hapus Vless', callback_data: 'del_vless' }],
      [{ text: 'Hapus Trojan', callback_data: 'del_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }],
    ];
  } else if (action === 'lock') {
    keyboard = [
      [{ text: 'Lock Ssh/Ovpn', callback_data: 'lock_ssh' }],      
      [{ text: 'Lock Vmess', callback_data: 'lock_vmess' }, { text: 'Lock Vless', callback_data: 'lock_vless' }],
      [{ text: 'Lock Trojan', callback_data: 'lock_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }],
    ];
  } else if (action === 'unlock') {
    keyboard = [
      [{ text: 'Unlock Ssh/Ovpn', callback_data: 'unlock_ssh' }],      
      [{ text: 'Unlock Vmess', callback_data: 'unlock_vmess' }, { text: 'Unlock Vless', callback_data: 'unlock_vless' }],
      [{ text: 'Unlock Trojan', callback_data: 'unlock_trojan' }, { text: '🔙 Kembali', callback_data: 'send_main_menu' }],
    ];
  } 
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: keyboard
    });
    logger.info(`${action} service menu sent`);
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      await ctx.reply(`Pilih jenis layanan yang ingin Anda ${action}:`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      logger.info(`${action} service menu sent as new message`);
    } else {
      logger.error(`Error saat mengirim menu ${action}:`, error);
    }
  }
}
// ... (Semua bot.action handlers untuk service_create, trial, renew, del, lock, unlock, cek_service, dll. tetap dipertahankan)
// ...

bot.action('service_del', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('❌ *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await handleServiceAction(ctx, 'del');
});

bot.action('del_ssh', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('❌ *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'del', 'ssh');
});
// ... (semua action del_vmess, del_vless, del_trojan, del_shadowsocks tetap dipertahankan)
// ...

// --- FUNGSI NOTIFIKASI PEMBUATAN AKUN ---
async function sendCreationNotification(ctx, state, totalHarga) {
    if (!GROUP_ID) {
        logger.warn('GROUP_ID is not set in .vars.json. Skipping creation notification.');
        return;
    }

    try {
        // Ambil nama server dari database
        const server = await new Promise((resolve, reject) => {
            db.get('SELECT nama_server FROM Server WHERE id = ?', [state.serverId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        const serverName = server ? server.nama_server : 'Unknown Server';

        const user = ctx.from;
        const userIdentifier = user.username ? `@${user.username}` : `${user.first_name} (ID: ${user.id})`;
        const creationDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const expiryDate = new Date(Date.now() + state.exp * 24 * 60 * 60 * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const message = `
✅ <b>Akun Baru Dibuat!</b>
<blockquote>
👤 <b>Dibuat Oleh:</b> ${userIdentifier}
🔧 <b>Tipe Akun:</b> ${state.type.toUpperCase()}
🖥️ <b>Server:</b> ${serverName}
🆔 <b>Username:</b> <code>${state.username}</code>
💰 <b>Harga:</b> Rp ${totalHarga}
🗓️ <b>Tanggal Buat:</b> ${creationDate}
⏳ <b>Masa Aktif:</b> ${state.exp} hari
🔚 <b>Kedaluwarsa:</b> ${expiryDate}
</blockquote>
        `;
        
        await bot.telegram.sendMessage(GROUP_ID, message, { parse_mode: 'HTML' });
        logger.info(`Successfully sent creation notification to GROUP_ID: ${GROUP_ID}`);

    } catch (error) {
        logger.error('Failed to send creation notification to group:', error.message);
    }
}


// --- MAIN TEXT HANDLER UNTUK SEMUA LOGIKA STATE (PENTING UNTUK REFUND) ---
bot.on('text', async (ctx) => {
  const state = userState[ctx.chat.id];

  if (!state) return; 
    const text = ctx.message.text.trim();

    if (state.step.startsWith('username_trial_')) {
  // ... (Logika trial tetap dipertahankan)
    return;
  }

    if (state.step.startsWith('username_unlock_')) {
  // ... (Logika unlock tetap dipertahankan)
    return;
  }
    if (state.step.startsWith('username_lock_')) {
  // ... (Logika lock tetap dipertahankan)
    return;
  }
  if (state.step.startsWith('username_del_')) {
    const username = text;
    // Validasi username (hanya huruf kecil dan angka, 3-20 karakter)
    if (!/^[a-z0-9]{3,20}$/.test(username)) {
      return ctx.reply('❌ *Username tidak valid. Gunakan huruf kecil dan angka (3–20 karakter).*', { parse_mode: 'Markdown' });
    }
       //izin ressel saja
    const resselDbPath = path.join(__dirname, 'ressel.db');
    fs.readFile(resselDbPath, 'utf8', async (err, data) => {
      if (err) {
        logger.error('❌ Gagal membaca file ressel.db:', err.message);
        return ctx.reply('❌ *Terjadi kesalahan saat membaca data reseller.*', { parse_mode: 'Markdown' });
      }

      const idUser = ctx.from.id.toString().trim();
      const resselList = data.split('\n').map(line => line.trim()).filter(Boolean);

      const isRessel = resselList.includes(idUser);

      if (!isRessel) {
        return ctx.reply('❌ *Fitur ini hanya untuk Ressel VPN.*', { parse_mode: 'Markdown' });
      }
  //izin ressel saja
    const { type, serverId } = state;
    delete userState[ctx.chat.id];

    let msg = 'none';
    let deleteResult = null;
    let daysLeft = 0; 

    try {
      const password = 'none', exp = 'none', iplimit = 'none';

      // MENGGUNAKAN FUNGSI YANG BARU DIINTEGRASIKAN
      const delFunctions = {
        vmess: delvmess,
        vless: delvless,
        trojan: deltrojan,
        shadowsocks: delshadowsocks,
        ssh: delssh
      };

      if (delFunctions[type]) {
        // Memanggil fungsi DELETE yang sudah terintegrasi
        deleteResult = await delFunctions[type](username, password, exp, iplimit, serverId);
        msg = deleteResult.message || deleteResult;

        // KUNCI AUTO REFUND: Ambil daysLeft dari hasil objek
        if (typeof deleteResult === 'object' && deleteResult.daysLeft > 0) {
            daysLeft = deleteResult.daysLeft;
        }
      }
      
      // LOGIC REFUND SALDO DAN UPDATE TOTAL AKUN
      if (msg.includes('✅') && daysLeft > 0) {
        const dailyPrice = await getServerPrice(serverId); 
        const refundAmount = dailyPrice * daysLeft; 

        if (refundAmount > 0) {
            await updateUserBalance(ctx.from.id, refundAmount); 
            // Catat transaksi refund
            const referenceId = `refund-${type}-${ctx.from.id}-${Date.now()}`;
            db.run('INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
                [ctx.from.id, refundAmount, 'refund', referenceId, Date.now()]);
            
                // Kurangi total akun yang dibuat di server
                db.run('UPDATE Server SET total_create_akun = total_create_akun - 1 WHERE id = ? AND total_create_akun > 0', [serverId], (err) => {
                    if (err) {
                        logger.error('⚠️ Kesalahan saat mengurangi total_create_akun setelah delete:', err.message);
                    }
                });

            // Tambahkan notifikasi ke pesan balasan
            msg += `\n\n💰 **REFUND SALDO**\n` +
                   `• Sisa Hari: \`${daysLeft}\` hari\n` +
                   `• Harga Harian: \`Rp ${dailyPrice}\`\n` +
                   `• **Total Refund: \`Rp ${refundAmount}\`**`;
            logger.info(`✅ Refund saldo Rp ${refundAmount} ke user ${ctx.from.id} karena delete akun ${type}.`);
        }
      }

      await ctx.reply(msg, { parse_mode: 'Markdown' });
      logger.info(`✅ Akun ${type} berhasil dihapus oleh ${ctx.from.id}`);
    } catch (err) {
      logger.error('❌ Gagal hapus akun:', err.message);
      await ctx.reply('❌ *Terjadi kesalahan saat menghapus akun.*', { parse_mode: 'Markdown' });
    }});
    return; // Penting! Jangan lanjut ke case lain
  }
// ... (Semua logika text handler lainnya: username_, password_, exp_, addserver, dll. tetap dipertahankan)
// ...
});


// --- FUNGSI UTILITY GLOBAL (Wajib ada) ---

function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ... (Semua fungsi Top-Up QRIS: checkQRISStatus, processDeposit, keyboard_*, processMatchingPayment, dll. tetap dipertahankan)
// ...

// --- FUNGSI AUTO BACKUP DATABASE ---
async function autoBackupDb() {
  const dbPath = path.join(__dirname, 'sellvpn.db');
  const adminId = adminIds[0] || adminIds; // Ambil ID admin pertama
  
  if (!fs.existsSync(dbPath)) {
    logger.error('❌ File sellvpn.db tidak ditemukan untuk backup.');
    return;
  }
  
  try {
    const date = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    // Kirim file ke admin
    await bot.telegram.sendDocument(adminId, { source: dbPath, filename: `sellvpn_backup_${date}.db` }, {
      caption: `✅ **Backup Otomatis Database**\n\nTanggal: ${date}`,
      parse_mode: 'Markdown'
    });
    
    logger.info(`✅ Database sellvpn.db berhasil dibackup ke admin ID: ${adminId}`);
  } catch (error) {
    logger.error(`❌ Gagal mengirim backup database ke admin: ${error.message}`);
  }
}
// ------------------------------------------

// Interval 6 jam (6 * 60 * 60 * 1000 ms)
const backupInterval = 6 * 60 * 60 * 1000; 

app.listen(port, () => {
  bot.launch().then(() => {
      logger.info('Bot telah dimulai');
      
      // JALANKAN AUTO BACKUP
      autoBackupDb(); // Jalankan sekali saat start
      setInterval(autoBackupDb, backupInterval); 

  }).catch((error) => {
      logger.error('Error saat memulai bot:', error);
  });
  logger.info(`Server berjalan di port ${port}`);
});
