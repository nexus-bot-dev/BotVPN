 const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { Telegraf } = require('telegraf');
const app = express();
const axios = require('axios');
const { buildPayload, headers, API_URL } = require('./api-cekpayment-orkut');
const winston = require('winston');
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
  delssh, 
  delvmess, 
  delvless, 
  deltrojan, 
  delshadowsocks 
} = require('./modules/del');

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

const fsPromises = require('fs/promises');
const path = require('path');
const trialFile = path.join(__dirname, 'trial.db');

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


const fs = require('fs');
const { exec } = require('child_process');
const VARS_FILE_PATH = './.vars.json';
const vars = JSON.parse(fs.readFileSync(VARS_FILE_PATH, 'utf8'));

const BOT_TOKEN = vars.BOT_TOKEN;
const port = vars.PORT || 6969;
const ADMIN = vars.USER_ID; 
const NAMA_STORE = vars.NAMA_STORE || '@ARI_VPN_STORE';
const DATA_QRIS = vars.DATA_QRIS;
const MERCHANT_ID = vars.MERCHANT_ID;
const API_KEY = vars.API_KEY;
const GROUP_ID = vars.GROUP_ID;

let topUpBonusPercentage = vars.TOP_UP_BONUS_PERCENTAGE || 0; 
let minTopUpAmount = vars.MIN_TOP_UP_AMOUNT || 5000;
let backupIntervalMinutes = vars.BACKUP_INTERVAL_MINUTES || 360; // Default 6 jam
let backupIntervalId = null;

logger.info(`Top-Up Bonus set to: ${topUpBonusPercentage}%`);
logger.info(`Min Top Up set to: Rp ${minTopUpAmount}`);
logger.info(`Initial backup interval set to: ${backupIntervalMinutes} minutes`);

const bot = new Telegraf(BOT_TOKEN);
const adminIds = ADMIN;
logger.info('Bot initialized');

const db = new sqlite3.Database('./sellvpn.db', (err) => {
  if (err) {
    logger.error('Kesalahan koneksi SQLite3:', err.message);
  } else {
    logger.info('Terhubung ke SQLite3');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS pending_deposits (unique_code TEXT PRIMARY KEY, user_id INTEGER, amount INTEGER, original_amount INTEGER, timestamp INTEGER, status TEXT, qr_message_id INTEGER)`, (err) => { if (err) { logger.error('Kesalahan membuat tabel pending_deposits:', err.message); }});
db.run(`CREATE TABLE IF NOT EXISTS Server (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT, auth TEXT, harga INTEGER, nama_server TEXT, quota INTEGER, iplimit INTEGER, batas_create_akun INTEGER, total_create_akun INTEGER)`, (err) => { if (err) { logger.error('Kesalahan membuat tabel Server:', err.message); } else { logger.info('Server table created or already exists'); }});
db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, saldo INTEGER DEFAULT 0, CONSTRAINT unique_user_id UNIQUE (user_id))`, (err) => { if (err) { logger.error('Kesalahan membuat tabel users:', err.message); } else { logger.info('Users table created or already exists'); }});
db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER, type TEXT, reference_id TEXT, timestamp INTEGER, FOREIGN KEY (user_id) REFERENCES users(user_id))`, (err) => { if (err) { logger.error('Kesalahan membuat tabel transactions:', err.message); } else { logger.info('Transactions table created or already exists'); db.get("PRAGMA table_info(transactions)", (err, rows) => { if (err) { logger.error('Kesalahan memeriksa struktur tabel:', err.message); return; } db.get("SELECT * FROM transactions WHERE reference_id IS NULL LIMIT 1", (err, row) => { if (err && err.message.includes('no such column')) { db.run("ALTER TABLE transactions ADD COLUMN reference_id TEXT", (err) => { if (err) { logger.error('Kesalahan menambahkan kolom reference_id:', err.message); } else { logger.info('Kolom reference_id berhasil ditambahkan ke tabel transactions'); } }); } else if (row) { db.all("SELECT id, user_id, type, timestamp FROM transactions WHERE reference_id IS NULL", [], (err, rows) => { if (err) { logger.error('Kesalahan mengambil transaksi tanpa reference_id:', err.message); return; } rows.forEach(row => { const referenceId = `account-${row.type}-${row.user_id}-${row.timestamp}`; db.run("UPDATE transactions SET reference_id = ? WHERE id = ?", [referenceId, row.id], (err) => { if (err) { logger.error(`Kesalahan mengupdate reference_id untuk transaksi ${row.id}:`, err.message); } else { logger.info(`Berhasil mengupdate reference_id untuk transaksi ${row.id}`); } }); }); }); } }); }); }});

const userState = {};
logger.info('User state initialized');

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
• Hari Ini   : ${userToday} akun
• Minggu Ini  : ${userWeek} akun
• Bulan Ini   : ${userMonth} akun

🌐 <b>Statistik Global</b>
• Hari Ini   : ${globalToday} akun
• Minggu Ini  : ${globalWeek} akun
• Bulan Ini   : ${globalMonth} akun
</blockquote>

⚙️ <b>COMMAND</b>
• 🏠 Menu Utama   : /start
• 🔑 Menu Admin   : /admin
• 🛡️ Admin Panel  : /helpadmin

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

bot.command('setbonus', async (ctx) => {
    const userId = ctx.message.from.id;
    if (!adminIds.includes(userId)) {
        return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
    }

    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
        return ctx.reply(`⚠️ Format salah. Gunakan: \`/setbonus <persentase>\`\n\nContoh: \`/setbonus 30\` (untuk bonus 30%)`, { parse_mode: 'Markdown' });
    }

    const percentage = parseInt(args[1]);

    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return ctx.reply('⚠️ Persentase harus berupa angka antara 0 hingga 100.', { parse_mode: 'Markdown' });
    }

    topUpBonusPercentage = percentage;
    
    try {
        const currentVars = JSON.parse(fs.readFileSync(VARS_FILE_PATH, 'utf8'));
        currentVars.TOP_UP_BONUS_PERCENTAGE = percentage;
        fs.writeFileSync(VARS_FILE_PATH, JSON.stringify(currentVars, null, 2));
        logger.info(`TOP_UP_BONUS_PERCENTAGE updated in .vars.json to ${percentage}%`);
    } catch (e) {
        logger.error('Gagal update TOP_UP_BONUS_PERCENTAGE di .vars.json:', e.message);
    }


    await ctx.reply(`✅ Bonus Top Up berhasil diatur ke **${percentage}%**.\n\nSetiap Top Up sebesar \`Rp 10.000\` akan mendapat bonus \`Rp ${Math.floor(10000 * percentage / 100)}\`.`, { parse_mode: 'Markdown' });
});

bot.command('setmintopup', async (ctx) => {
    const userId = ctx.message.from.id;
    if (!adminIds.includes(userId)) {
        return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
    }

    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
        return ctx.reply(`⚠️ Format salah. Gunakan: \`/setmintopup <nominal>\`\n\nContoh: \`/setmintopup 15000\``, { parse_mode: 'Markdown' });
    }

    const nominal = parseInt(args[1]);

    if (isNaN(nominal) || nominal < 1000) {
        return ctx.reply('⚠️ Nominal harus berupa angka dan minimal Rp 1.000.', { parse_mode: 'Markdown' });
    }

    minTopUpAmount = nominal;
    
    try {
        const currentVars = JSON.parse(fs.readFileSync(VARS_FILE_PATH, 'utf8'));
        currentVars.MIN_TOP_UP_AMOUNT = nominal;
        fs.writeFileSync(VARS_FILE_PATH, JSON.stringify(currentVars, null, 2));
        logger.info(`MIN_TOP_UP_AMOUNT updated in .vars.json to Rp ${nominal}`);
    } catch (e) {
        logger.error('Gagal update MIN_TOP_UP_AMOUNT di .vars.json:', e.message);
    }


    await ctx.reply(`✅ Minimal Top Up berhasil diatur ke **Rp ${nominal}**.`, { parse_mode: 'Markdown' });
});

// ... (semua command admin lainnya seperti /hapuslog, /helpadmin, /addserver, dll. dari file asli)

bot.command('setbackup', async (ctx) => {
    const userId = ctx.from.id;
    if (!adminIds.includes(userId)) {
        return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
        return ctx.reply(`⚠️ Format salah. Gunakan: \`/setbackup <menit>\`\n\nContoh: \`/setbackup 60\`.\nSaat ini: ${backupIntervalMinutes} menit.`, { parse_mode: 'Markdown' });
    }

    const minutes = parseInt(args[1], 10);
    if (isNaN(minutes) || minutes < 1) {
        return ctx.reply('⚠️ Menit harus berupa angka dan minimal 1.');
    }

    try {
        const currentVars = JSON.parse(fs.readFileSync(VARS_FILE_PATH, 'utf8'));
        currentVars.BACKUP_INTERVAL_MINUTES = minutes;
        fs.writeFileSync(VARS_FILE_PATH, JSON.stringify(currentVars, null, 2));
        
        backupIntervalMinutes = minutes;
        restartBackupTimer();
        
        await ctx.reply(`✅ Interval backup otomatis berhasil diatur ke **${minutes} menit**.`, { parse_mode: 'Markdown' });
    } catch (e) {
        logger.error('Gagal menyimpan interval backup ke .vars.json:', e.message);
        await ctx.reply('❌ Gagal menyimpan pengaturan.');
    }
});


// ... (semua bot.action dari file asli Anda)

bot.on('text', async (ctx) => {
    const state = userState[ctx.chat.id];
    if (!state) return;
    const text = ctx.message.text.trim();

    if (state.step.startsWith('username_del_')) {
        const username = text;
        if (!/^[a-z0-9]{3,20}$/.test(username)) {
            return ctx.reply('❌ *Username tidak valid.*', { parse_mode: 'Markdown' });
        }
        
        const { type, serverId } = state;
        delete userState[ctx.chat.id];

        try {
            const delFunctions = { vmess: delvmess, vless: delvless, trojan: deltrojan, shadowsocks: delshadowsocks, ssh: delssh };
            if (delFunctions[type]) {
                const deleteResult = await delFunctions[type](username, 'none', 'none', 'none', serverId);
                let msg = deleteResult.message;
                const daysLeft = deleteResult.daysLeft;

                if (msg.includes('✅') && daysLeft > 0) {
                    const userBefore = await new Promise((resolve) => db.get('SELECT saldo FROM users WHERE user_id = ?', [ctx.from.id], (err, row) => resolve(row)));
                    const saldoSebelum = userBefore ? userBefore.saldo : 0;
                    
                    const serverInfo = await new Promise((resolve) => db.get('SELECT nama_server, harga FROM Server WHERE id = ?', [serverId], (err, row) => resolve(row)));
                    const serverName = serverInfo ? serverInfo.nama_server : 'Tidak Diketahui';
                    const dailyPrice = serverInfo ? serverInfo.harga : 0;
                    
                    if (dailyPrice > 0) {
                        const refundAmount = dailyPrice * daysLeft;
                        if (refundAmount > 0) {
                            await new Promise(resolve => db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [refundAmount, ctx.from.id], () => resolve()));
                            db.run('INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)', [ctx.from.id, refundAmount, 'refund', `refund-${type}-${Date.now()}`, Date.now()]);
                            db.run('UPDATE Server SET total_create_akun = total_create_akun - 1 WHERE id = ? AND total_create_akun > 0', [serverId]);
                            const saldoSesudah = saldoSebelum + refundAmount;
                            
                            msg = `✅ *Akun Dihapus & Saldo Direfund*\n\n🗑️ **Detail Akun**\n    ├─ Server: \`${serverName}\`\n    └─ Username: \`${username}\`\n\n💰 **Rincian Refund**\n    ├─ Sisa Hari: \`${daysLeft}\` hari\n    ├─ Harga Harian: \`Rp ${dailyPrice}\`\n    ├─ Saldo Anda: \`Rp ${saldoSebelum}\`\n    │\n    ├─ Saldo Direfund: \`+ Rp ${refundAmount}\`\n    └─ Saldo Sekarang: \`Rp ${saldoSesudah}\``;
                            
                            logger.info(`✅ Refund saldo Rp ${refundAmount} ke user ${ctx.from.id}.`);

                            if (GROUP_ID) {
                                try {
                                    const userInfo = await bot.telegram.getChat(ctx.from.id);
                                    const userIdentifier = userInfo.username ? `@${userInfo.username}` : `${userInfo.first_name} (ID: ${ctx.from.id})`;
                                    const groupMessage = `💰 *Laporan Refund Otomatis*\n<blockquote>👤 **User:** ${userIdentifier}\n🗑️ **Aksi:** Hapus Akun ${type.toUpperCase()} (\`${username}\`)\n🖥️ **Server:** ${serverName}\n\n📈 **Rincian Saldo**\n├ Saldo Awal: \`Rp ${saldoSebelum}\`\n├ Jumlah Refund: \`+ Rp ${refundAmount}\`\n└ Saldo Akhir: \`Rp ${saldoSesudah}\`</blockquote>`;
                                    await bot.telegram.sendMessage(GROUP_ID, groupMessage, { parse_mode: 'HTML' });
                                } catch (error) {
                                    logger.error(`Gagal mengirim notifikasi refund ke grup: ${error.message}`);
                                }
                            }
                        }
                    } else {
                         msg += "\n\n(Harga harian server tidak diatur, refund tidak dapat diproses).";
                    }
                } else if (msg.includes('✅') && daysLeft === 0) {
                    msg += "\n\n(Tidak ada sisa masa aktif untuk direfund).";
                }
                await ctx.reply(msg, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            logger.error('❌ Gagal dalam proses hapus akun:', err.message);
            await ctx.reply('❌ *Terjadi kesalahan sistem saat menghapus akun.*', { parse_mode: 'Markdown' });
        }
        return;
    }

    // ... (Your other 'if' blocks for create, renew, trial, lock, etc. go here)
});


function restartBackupTimer() {
    if (backupIntervalId) {
        clearInterval(backupIntervalId);
    }
    const intervalMs = backupIntervalMinutes * 60 * 1000;
    if (intervalMs > 0) {
        backupIntervalId = setInterval(autoBackupDb, intervalMs);
        logger.info(`Backup timer restarted. New interval: ${backupIntervalMinutes} minutes.`);
    }
}

async function autoBackupDb() {
    const dbPath = path.join(__dirname, 'sellvpn.db');
    const adminId = Array.isArray(adminIds) ? adminIds[0] : adminIds;
 
    if (!fs.existsSync(dbPath) || !adminId) return;
 
    try {
        const date = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        await bot.telegram.sendDocument(adminId, { source: dbPath, filename: `sellvpn_backup_${date}.db` }, {
            caption: `✅ **Backup Otomatis Database**\n\nTanggal: ${date}`,
            parse_mode: 'Markdown'
        });
        logger.info(`✅ Database backup sent to admin ID: ${adminId}`);
    } catch (error) {
        logger.error(`❌ Failed to send database backup: ${error.message}`);
    }
}

app.listen(port, () => {
    bot.launch().then(() => {
        logger.info('Bot has started');
        autoBackupDb();
        restartBackupTimer();
    }).catch((error) => {
        logger.error('Error starting bot:', error);
    });
    logger.info(`Server is running on port ${port}`);
});
