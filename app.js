// ...existing code...
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
 const vars = JSON.parse(fs.readFileSync('./.vars.json', 'utf8'));
 
 const BOT_TOKEN = vars.BOT_TOKEN;
 const port = vars.PORT || 6969;
 const ADMIN = vars.USER_ID; 
 const NAMA_STORE = vars.NAMA_STORE || '@ARI_VPN_STORE';
 const DATA_QRIS = vars.DATA_QRIS;
 const MERCHANT_ID = vars.MERCHANT_ID;
 const API_KEY = vars.API_KEY;
 const GROUP_ID = vars.GROUP_ID;
 
 const bot = new Telegraf(BOT_TOKEN);
 const adminIds = ADMIN;
 logger.info('Bot initialized');

 // === START: admin-config (bonus) ===
 const ADMIN_CONFIG_PATH = path.join(__dirname, 'admin-config.json');
 let adminConfig = {
   bonusEnabled: true,
   bonusThreshold: 5000, // minimal topup untuk dapat bonus (Rp)
   bonusAmount: 3000     // bonus (Rp)
 };
 
 function loadAdminConfig() {
   try {
     if (fs.existsSync(ADMIN_CONFIG_PATH)) {
       const raw = fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8');
       const parsed = JSON.parse(raw);
       adminConfig = Object.assign(adminConfig, parsed);
       logger.info('admin-config loaded');
     } else {
       fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(adminConfig, null, 2));
       logger.info('admin-config created with defaults');
     }
   } catch (e) {
     logger.error('Gagal load admin-config: ' + (e.message || e));
   }
 }
 function saveAdminConfig() {
   try {
     fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(adminConfig, null, 2));
     logger.info('admin-config saved');
   } catch (e) {
     logger.error('Gagal simpan admin-config: ' + (e.message || e));
   }
 }
 loadAdminConfig();
 // === END: admin-config (bonus) ===
 
 const db = new sqlite3.Database('./sellvpn.db', (err) => {
   if (err) {
     logger.error('Kesalahan koneksi SQLite3:', err.message);
   } else {
     logger.info('Terhubung ke SQLite3');
   }
 });
 
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
     
     // Add reference_id column if it doesn't exist
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
 • Hari Ini    : ${userToday} akun
 • Minggu Ini  : ${userWeek} akun
 • Bulan Ini   : ${userMonth} akun
 
 🌐 <b>Statistik Global</b>
 • Hari Ini    : ${globalToday} akun
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
 
 bot.command('hapuslog', async (ctx) => {
   if (!adminIds.includes(ctx.from.id)) return ctx.reply('Tidak ada izin!');
   try {
     if (fs.existsSync('bot-combined.log')) fs.unlinkSync('bot-combined.log');
     if (fs.existsSync('bot-error.log')) fs.unlinkSync('bot-error.log');
     ctx.reply('Log berhasil dihapus.');
     logger.info('Log file dihapus oleh admin.');
   } catch (e) {
     ctx.reply('Gagal menghapus log: ' + e.message);
     logger.error('Gagal menghapus log: ' + e.message);
   }
 });
 
 bot.command('helpadmin', async (ctx) => {
   const userId = ctx.message.from.id;
   if (!adminIds.includes(userId)) {
       return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
   }
   const helpMessage = `
 *📋 Daftar Perintah Admin:*
 
 1. /addsaldo - Menambahkan saldo ke akun pengguna.
 2. /addserver - Menambahkan server baru.
 3. /addressel - Menambahkan Ressel baru.
 4. /delressel- Menghapus id Ressel.
 5. /broadcast - Mengirim pesan siaran ke semua pengguna.
 6. /editharga - Mengedit harga layanan.
 7. /editauth - Mengedit auth server.
 8. /editdomain - Mengedit domain server.
 9. /editlimitcreate - Mengedit batas pembuatan akun server.
 10. /editlimitip - Mengedit batas IP server.
 11. /editlimitquota - Mengedit batas quota server.
 12. /editnama - Mengedit nama server.
 13. /edittotalcreate - Mengedit total pembuatan akun server.
 14. /hapuslog - Menghapus log bot.
 15. /getbonus - Lihat pengaturan bonus top-up.
 16. /setbonus - Atur bonus top-up. Format: /setbonus <threshold> <amount> atau /setbonus on|off
 
 Gunakan perintah ini dengan format yang benar untuk menghindari kesalahan.
 `;
   ctx.reply(helpMessage, { parse_mode: 'Markdown' });
 });
 
 // === START: bonus admin commands ===
 bot.command('getbonus', async (ctx) => {
   if (!adminIds.includes(ctx.from.id)) return ctx.reply('Tidak ada izin!');
   const status = adminConfig.bonusEnabled ? 'ON' : 'OFF';
   return ctx.reply(`Bonus status: ${status}\nThreshold: Rp ${adminConfig.bonusThreshold}\nAmount: Rp ${adminConfig.bonusAmount}`);
 });
 
 bot.command('setbonus', async (ctx) => {
   // Format: /setbonus <threshold> <amount>   (contoh: /setbonus 5000 3000) atau /setbonus on|off
   if (!adminIds.includes(ctx.from.id)) return ctx.reply('Tidak ada izin!');
   const parts = ctx.message.text.split(' ').slice(1);
   if (parts.length === 0) {
     return ctx.reply('Gunakan: /setbonus <threshold> <amount> atau /setbonus off untuk matikan, on untuk aktifkan');
   }
   if (parts[0].toLowerCase() === 'off') {
     adminConfig.bonusEnabled = false;
     saveAdminConfig();
     return ctx.reply('Bonus top-up dinonaktifkan.');
   }
   if (parts[0].toLowerCase() === 'on') {
     adminConfig.bonusEnabled = true;
     saveAdminConfig();
     return ctx.reply('Bonus top-up diaktifkan.');
   }
   if (parts.length < 2) {
     return ctx.reply('Gunakan: /setbonus <threshold> <amount> (contoh: /setbonus 5000 3000)');
   }
   const thresh = parseInt(parts[0]);
   const amt = parseInt(parts[1]);
   if (isNaN(thresh) || isNaN(amt) || thresh <= 0 || amt < 0) {
     return ctx.reply('Nilai tidak valid. Pastikan angka positif.');
   }
   adminConfig.bonusThreshold = thresh;
   adminConfig.bonusAmount = amt;
   adminConfig.bonusEnabled = true;
   saveAdminConfig();
   return ctx.reply(`Berhasil set bonus. Threshold: Rp ${thresh}, Bonus: Rp ${amt}`);
 });
 // === END: bonus admin commands ===
 
 bot.command('broadcast', async (ctx) => {
   const userId = ctx.message.from.id;
   logger.info(`Broadcast command received from user_id: ${userId}`);
   if (!adminIds.includes(userId)) {
       logger.info(`⚠️ User ${userId} tidak memiliki izin untuk menggunakan perintah ini.`);
       return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
   }
 
   const message = ctx.message.reply_to_message ? ctx.message.reply_to_message.text : ctx.message.text.split(' ').slice(1).join(' ');
   if (!message) {
       logger.info('⚠️ Pesan untuk disiarkan tidak diberikan.');
       return ctx.reply('⚠️ Mohon berikan pesan untuk disiarkan.', { parse_mode: 'Markdown' });
   }
 
   db.all("SELECT user_id FROM users", [], (err, rows) => {
       if (err) {
           logger.error('⚠️ Kesalahan saat mengambil daftar pengguna:', err.message);
           return ctx.reply('⚠️ Kesalahan saat mengambil daftar pengguna.', { parse_mode: 'Markdown' });
       }
 
       rows.forEach((row) => {
           const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
           axios.post(telegramUrl, {
               chat_id: row.user_id,
               text: message
           }).then(() => {
               logger.info(`✅ Pesan siaran berhasil dikirim ke ${row.user_id}`);
           }).catch((error) => {
               logger.error(`⚠️ Kesalahan saat mengirim pesan siaran ke ${row.user_id}`, error.message);
           });
       });
 
       ctx.reply('✅ Pesan siaran berhasil dikirim.', { parse_mode: 'Markdown' });
   });
 });
 bot.command('addsaldo', async (ctx) => {
   const userId = ctx.message.from.id;
   if (!adminIds.includes(userId)) {
       return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
   }
 
   const args = ctx.message.text.split(' ');
   if (args.length !== 3) {
       return ctx.reply('⚠️ Format salah. Gunakan: `/addsaldo <user_id> <jumlah>`', { parse_mode: 'Markdown' });
   }
 
   const targetUserId = parseInt(args[1]);
   const amount = parseInt(args[2]);
 
   if (isNaN(targetUserId) || isNaN(amount)) {
       return ctx.reply('⚠️ `user_id` dan `jumlah` harus berupa angka.', { parse_mode: 'Markdown' });
   }
 
   if (/\s/.test(args[1]) || /\./.test(args[1]) || /\s/.test(args[2]) || /\./.test(args[2])) {
       return ctx.reply('⚠️ `user_id` dan `jumlah` tidak boleh mengandung spasi atau titik.', { parse_mode: 'Markdown' });
   }
 
   db.get("SELECT * FROM users WHERE user_id = ?", [targetUserId], (err, row) => {
       if (err) {
           logger.error('⚠️ Kesalahan saat memeriksa `user_id`:', err.message);
           return ctx.reply('⚠️ Kesalahan saat memeriksa `user_id`.', { parse_mode: 'Markdown' });
       }
 
       if (!row) {
           return ctx.reply('⚠️ `user_id` tidak terdaftar.', { parse_mode: 'Markdown' });
       }
 
       db.run("UPDATE users SET saldo = saldo + ? WHERE user_id = ?", [amount, targetUserId], function(err) {
           if (err) {
               logger.error('⚠️ Kesalahan saat menambahkan saldo:', err.message);
               return ctx.reply('⚠️ Kesalahan saat menambahkan saldo.', { parse_mode: 'Markdown' });
           }
 
           if (this.changes === 0) {
               return ctx.reply('⚠️ Pengguna tidak ditemukan.', { parse_mode: 'Markdown' });
           }
 
           ctx.reply(`✅ Saldo sebesar \`${amount}\` berhasil ditambahkan untuk \`user_id\` \`${targetUserId}\`.`, { parse_mode: 'Markdown' });
       });
   });
 });
 
 // ... rest of commands and handlers unchanged ...
 // (kept original file logic for create/renew/del/lock/unlock/trial, keyboard builders, deposit flows, etc.)
 
 global.processedTransactions = new Set();
 async function updateUserBalance(userId, amount) {
   return new Promise((resolve, reject) => {
     db.run("UPDATE users SET saldo = saldo + ? WHERE user_id = ?", [amount, userId], function(err) {
         if (err) {
         logger.error('⚠️ Kesalahan saat mengupdate saldo user:', err.message);
           reject(err);
       } else {
         resolve();
         }
     });
   });
 }
 
 async function getUserBalance(userId) {
   return new Promise((resolve, reject) => {
     db.get("SELECT saldo FROM users WHERE user_id = ?", [userId], function(err, row) {
         if (err) {
         logger.error('⚠️ Kesalahan saat mengambil saldo user:', err.message);
           reject(err);
       } else {
         resolve(row ? row.saldo : 0);
         }
     });
   });
 }
 
 // --- REPLACED: sendPaymentSuccessNotification to include bonus param ---
 async function sendPaymentSuccessNotification(userId, deposit, currentBalance, bonus = 0) {
   try {
     // Hitung admin fee
     const adminFee = Number(deposit.amount || 0) - Number(deposit.originalAmount || 0);
     await bot.telegram.sendMessage(userId,
       `✅ *Pembayaran Berhasil!*\n\n` +
       `💰 Nominal Top Up: Rp ${deposit.originalAmount}\n` +
       (bonus > 0 ? `🎁 Bonus Otomatis: Rp ${bonus}\n` : '') +
       `💰 Biaya Admin: Rp ${adminFee}\n` +
       `💳 Total Diterima (saldo): Rp ${Number(deposit.originalAmount) + Number(bonus)}\n` +
       `💳 Saldo Sekarang: Rp ${currentBalance}`,
       { parse_mode: 'Markdown' }
     );
     return true;
   } catch (error) {
     logger.error('Error sending payment notification:', error);
     return false;
   }
 }
 
 // --- REPLACED: processMatchingPayment to apply bonus and record bonus transaction ---
 async function processMatchingPayment(deposit, matchingTransaction, uniqueCode) {
   const amountKey = matchingTransaction.kredit || matchingTransaction.amount || 0;
   const transactionKey = `${matchingTransaction.reference_id || uniqueCode}_${amountKey}`;
   return new Promise((resolve, reject) => {
     db.serialize(() => {
       db.run('BEGIN TRANSACTION');
       db.get('SELECT id FROM transactions WHERE reference_id = ? AND amount = ?', 
         [matchingTransaction.reference_id || uniqueCode, amountKey], 
         (err, row) => {
           if (err) {
             db.run('ROLLBACK');
             logger.error('Error checking transaction:', err);
             return reject(err);
           }
           if (row) {
             db.run('ROLLBACK');
             logger.info(`Transaction ${transactionKey} already processed, skipping...`);
             return resolve(false);
           }
 
           // Determine amounts
           const originalAmount = Number(deposit.originalAmount || 0);
           const bonusToApply = (adminConfig.bonusEnabled && originalAmount >= (adminConfig.bonusThreshold || 0))
             ? Number(adminConfig.bonusAmount || 0)
             : 0;
           const totalCredit = originalAmount + bonusToApply;
 
           // Update user balance (deposit + bonus)
           db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', 
             [totalCredit, deposit.userId], 
             function(err) {
               if (err) {
                 db.run('ROLLBACK');
                 logger.error('Error updating balance:', err);
                 return reject(err);
               }
 
               // Record the deposit transaction
               db.run(
                 'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
                 [deposit.userId, originalAmount, 'deposit', matchingTransaction.reference_id || uniqueCode, Date.now()],
                 (err) => {
                   if (err) {
                     db.run('ROLLBACK');
                     logger.error('Error recording transaction:', err);
                     return reject(err);
                   }
 
                   // If bonus applied, record bonus transaction
                   const recordBonus = (bonusToApply > 0) ? new Promise((resRec, rejRec) => {
                     db.run(
                       'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
                       [deposit.userId, bonusToApply, 'bonus', `bonus-${matchingTransaction.reference_id || uniqueCode}`, Date.now()],
                       (err2) => {
                         if (err2) return rejRec(err2);
                         resRec();
                       }
                     );
                   }) : Promise.resolve();
 
                   recordBonus.then(() => {
                     db.get('SELECT saldo FROM users WHERE user_id = ?', [deposit.userId], async (err, user) => {
                       if (err) {
                         db.run('ROLLBACK');
                         logger.error('Error getting updated balance:', err);
                         return reject(err);
                       }
 
                       // Send notification including bonus info
                       const notificationSent = await sendPaymentSuccessNotification(
                         deposit.userId,
                         deposit,
                         user.saldo,
                         bonusToApply
                       );
 
                       // Delete QR code message after payment success
                       if (deposit.qrMessageId) {
                         try {
                           await bot.telegram.deleteMessage(deposit.userId, deposit.qrMessageId);
                         } catch (e) {
                           logger.error("Gagal menghapus pesan QR code:", e.message);
                         }
                       }
 
                       if (notificationSent) {
                         // Notifikasi ke grup untuk top up (sertakan bonus jika ada)
                         try {
                           let userInfo;
                           try {
                             userInfo = await bot.telegram.getChat(deposit.userId);
                           } catch (e) {
                             userInfo = {};
                           }
                           const username = userInfo.username ? `@${userInfo.username}` : (userInfo.first_name || deposit.userId);
                           const userDisplay = userInfo.username ? `${username} (${deposit.userId})` : `${username}`;
                           await bot.telegram.sendMessage(
                             GROUP_ID,
                             `<b>✅ Top Up Berhasil</b>\nUser: ${userDisplay}\nNominal: Rp ${originalAmount}\n` +
                             (bonusToApply > 0 ? `Bonus: Rp ${bonusToApply}\n` : '') +
                             `Saldo Sekarang: Rp ${user.saldo}\nWaktu: ${new Date().toLocaleString('id-ID')}`,
                             { parse_mode: 'HTML' }
                           );
                         } catch (e) { logger.error('Gagal kirim notif top up ke grup:', e.message); }
 
                         // Hapus receipts folder files jika ada
                         try {
                           const receiptsDir = path.join(__dirname, 'receipts');
                           if (fs.existsSync(receiptsDir)) {
                             const files = fs.readdirSync(receiptsDir);
                             for (const file of files) fs.unlinkSync(path.join(receiptsDir, file));
                           }
                         } catch (e) { logger.error('Gagal menghapus file di receipts:', e.message); }
 
                         db.run('COMMIT');
                         global.processedTransactions.add(transactionKey);
                         delete global.pendingDeposits[uniqueCode];
                         db.run('DELETE FROM pending_deposits WHERE unique_code = ?', [uniqueCode]);
                         resolve(true);
                       } else {
                         db.run('ROLLBACK');
                         reject(new Error('Failed to send payment notification.'));
                       }
                     });
                   }).catch((errRec) => {
                     db.run('ROLLBACK');
                     logger.error('Error recording bonus transaction:', errRec);
                     reject(errRec);
                   });
                 }
               );
             }
           );
         }
       );
     });
   });
 }
 
 setInterval(checkQRISStatus, 10000);
 
 async function recordAccountTransaction(userId, type) {
   return new Promise((resolve, reject) => {
     const referenceId = `account-${type}-${userId}-${Date.now()}`;
     db.run(
       'INSERT INTO transactions (user_id, type, reference_id, timestamp) VALUES (?, ?, ?, ?)',
       [userId, type, referenceId, Date.now()],
       (err) => {
         if (err) {
           logger.error('Error recording account transaction:', err.message);
           reject(err);
         } else {
           resolve();
         }
       }
     );
   });
 }
 
 app.listen(port, () => {
   bot.launch().then(() => {
       logger.info('Bot telah dimulai');
   }).catch((error) => {
       logger.error('Error saat memulai bot:', error);
   });
   logger.info(`Server berjalan di port ${port}`);
 });
 // ...existing code...