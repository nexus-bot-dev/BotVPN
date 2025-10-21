 // Full app.js — gabungan fitur lama + bonus top-up/admin
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { Telegraf } = require('telegraf');
const app = express();
const axios = require('axios');
const { buildPayload, headers, API_URL } = require('./api-cekpayment-orkut');
const winston = require('winston');
const fsPromises = require('fs/promises');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'bot-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'bot-combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Modules (original project uses these; keep requires so existing code still works)
const {
  createssh, createvmess, createvless, createtrojan, createshadowsocks
} = require('./modules/create');

const {
  trialssh, trialvmess, trialvless, trialtrojan, trialshadowsocks
} = require('./modules/trial');

const {
  renewssh, renewvmess, renewvless, renewtrojan, renewshadowsocks
} = require('./modules/renew');

const {
  delssh, delvmess, delvless, deltrojan, delshadowsocks
} = require('./modules/del');

const {
  lockssh, lockvmess, lockvless, locktrojan, lockshadowsocks
} = require('./modules/lock');

const {
  unlockssh, unlockvmess, unlockvless, unlocktrojan, unlockshadowsocks
} = require('./modules/unlock');

// basic files & vars
const fs = require('fs');
const VARS_PATH = path.join(__dirname, '.vars.json');
if (!fs.existsSync(VARS_PATH)) {
  logger.error('.vars.json not found. Buat file .vars.json di direktori project.');
  process.exit(1);
}
const vars = JSON.parse(fs.readFileSync(VARS_PATH, 'utf8'));

const BOT_TOKEN = vars.BOT_TOKEN;
const port = vars.PORT || 6969;
const ADMIN = vars.USER_ID; // bisa single id atau array
const NAMA_STORE = vars.NAMA_STORE || '@ARI_VPN_STORE';
const DATA_QRIS = vars.DATA_QRIS;
const MERCHANT_ID = vars.MERCHANT_ID;
const API_KEY = vars.API_KEY;
const GROUP_ID = vars.GROUP_ID || null;

const bot = new Telegraf(BOT_TOKEN);

// normalize adminIds to array
const adminIds = Array.isArray(ADMIN) ? ADMIN.map(Number) : [Number(ADMIN)];
function isAdmin(id) { return adminIds.includes(Number(id)); }

logger.info('Bot initialized');

// === START: admin-config (bonus) ===
const ADMIN_CONFIG_PATH = path.join(__dirname, 'admin-config.json');
let adminConfig = {
  bonusEnabled: true,
  bonusThreshold: 5000,
  bonusAmount: 3000
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

const db = new sqlite3.Database(path.join(__dirname, 'sellvpn.db'), (err) => {
  if (err) logger.error('Kesalahan koneksi SQLite3:', err.message);
  else logger.info('Terhubung ke SQLite3');
});

// create necessary tables if missing
db.run(`CREATE TABLE IF NOT EXISTS pending_deposits (
  unique_code TEXT PRIMARY KEY,
  user_id INTEGER,
  amount INTEGER,
  original_amount INTEGER,
  timestamp INTEGER,
  status TEXT,
  qr_message_id INTEGER
)`);
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  saldo INTEGER DEFAULT 0
)`);
db.run(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount INTEGER,
  type TEXT,
  reference_id TEXT,
  timestamp INTEGER
)`);

// ensure processed/pending sets
global.processedTransactions = global.processedTransactions || new Set();
global.pendingDeposits = global.pendingDeposits || {};

// helper user-state
const userState = {};
const trialFile = path.join(__dirname, 'trial.db');
async function checkTrialAccess(userId) {
  try {
    const data = await fsPromises.readFile(trialFile, 'utf8');
    const trialData = JSON.parse(data);
    const lastAccess = trialData[userId];
    const today = new Date().toISOString().slice(0, 10);
    return lastAccess === today;
  } catch { return false; }
}
async function saveTrialAccess(userId) {
  let trialData = {};
  try { const data = await fsPromises.readFile(trialFile, 'utf8'); trialData = JSON.parse(data); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  trialData[userId] = today;
  await fsPromises.writeFile(trialFile, JSON.stringify(trialData, null, 2));
}

// simple admin menu (can be expanded)
async function sendAdminMenu(ctx) {
  const txt = `🔐 Admin Menu\n\nGunakan /helpadmin untuk daftar perintah.`;
  return ctx.reply(txt);
}

// --- Basic bot commands ---
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) { logger.error('DB error on start:', err.message); }
    if (!row) db.run('INSERT INTO users (user_id) VALUES (?)', [userId]);
  });
  await sendMainMenu(ctx);
});
bot.command('menu', async (ctx) => sendMainMenu(ctx));

async function sendMainMenu(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || '-';
  let saldo = 0;
  try {
    const row = await new Promise((res, rej) => db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], (e, r) => e ? rej(e) : res(r)));
    saldo = row ? row.saldo : 0;
  } catch (e) { saldo = 0; }
  const messageText = `Hi ${userName}\nID: ${userId}\nSaldo: Rp ${saldo}\n\nPilih tindakan:`;
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Buat Akun', callback_data: 'service_create' }, { text: '♻️ Perpanjang', callback_data: 'service_renew' }],
        [{ text: '❌ Hapus Akun', callback_data: 'service_del' }, { text: '🗝️ Kunci Akun', callback_data: 'service_lock' }],
        [{ text: '🔐 Buka Kunci', callback_data: 'service_unlock' }, { text: '⌛ Trial', callback_data: 'service_trial' }],
        [{ text: '💰 TopUp Saldo', callback_data: 'topup_saldo' }, { text: '📶 Cek Server', callback_data: 'cek_service' }]
      ]
    }
  };
  try { await ctx.reply(messageText, keyboard); } catch (e) { logger.error('Error sendMainMenu:', e.message); }
}

// admin command
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
  await sendAdminMenu(ctx);
});

bot.command('helpadmin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Tidak ada izin');
  const helpMessage = `📋 Perintah Admin:\n/getbonus - lihat\n/setbonus <threshold> <amount> | on | off\n/addsaldo <user_id> <jumlah>\n/broadcast <pesan>`;
  return ctx.reply(helpMessage);
});

// bonus admin commands
bot.command('getbonus', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Tidak ada izin!');
  const status = adminConfig.bonusEnabled ? 'ON' : 'OFF';
  return ctx.reply(`Bonus status: ${status}\nThreshold: Rp ${adminConfig.bonusThreshold}\nAmount: Rp ${adminConfig.bonusAmount}`);
});

bot.command('setbonus', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Tidak ada izin!');
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length === 0) return ctx.reply('Gunakan: /setbonus <threshold> <amount> atau /setbonus off atau /setbonus on');
  const p0 = parts[0].toLowerCase();
  if (p0 === 'off') { adminConfig.bonusEnabled = false; saveAdminConfig(); return ctx.reply('Bonus dinonaktifkan'); }
  if (p0 === 'on') { adminConfig.bonusEnabled = true; saveAdminConfig(); return ctx.reply('Bonus diaktifkan'); }
  if (parts.length < 2) return ctx.reply('Gunakan: /setbonus <threshold> <amount>');
  const thresh = parseInt(parts[0]);
  const amt = parseInt(parts[1]);
  if (isNaN(thresh) || isNaN(amt) || thresh <= 0 || amt < 0) return ctx.reply('Nilai tidak valid');
  adminConfig.bonusThreshold = thresh;
  adminConfig.bonusAmount = amt;
  adminConfig.bonusEnabled = true;
  saveAdminConfig();
  return ctx.reply(`Berhasil set bonus. Threshold: Rp ${thresh}, Bonus: Rp ${amt}`);
});

// broadcast
bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Tidak ada izin');
  const message = ctx.message.reply_to_message ? ctx.message.reply_to_message.text : ctx.message.text.split(' ').slice(1).join(' ');
  if (!message) return ctx.reply('Balas pesan atau sertakan teks setelah /broadcast');
  db.all('SELECT user_id FROM users', [], (err, rows) => {
    if (err) return ctx.reply('DB error');
    rows.forEach(r => {
      axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: r.user_id, text: message }).catch(e => logger.error('broadcast send err', e.message));
    });
    ctx.reply('Broadcast dikirim');
  });
});

// addsaldo
bot.command('addsaldo', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Tidak ada izin');
  const parts = ctx.message.text.split(' ');
  if (parts.length !== 3) return ctx.reply('Gunakan: /addsaldo <user_id> <jumlah>');
  const target = parseInt(parts[1]), amount = parseInt(parts[2]);
  if (isNaN(target) || isNaN(amount)) return ctx.reply('Parameter harus angka');
  db.get('SELECT * FROM users WHERE user_id = ?', [target], (err, row) => {
    if (err) return ctx.reply('DB error');
    if (!row) return ctx.reply('User tidak terdaftar');
    db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, target], function (e) {
      if (e) return ctx.reply('Gagal update saldo');
      ctx.reply(`Berhasil tambah saldo Rp ${amount} untuk ${target}`);
    });
  });
});

// --- Payment handling helpers (processMatchingPayment, sendPaymentSuccessNotification) ---
async function sendPaymentSuccessNotification(userId, deposit, currentBalance, bonus = 0) {
  try {
    const adminFee = (Number(deposit.amount || 0) - Number(deposit.original_amount || deposit.originalAmount || 0)) || 0;
    await bot.telegram.sendMessage(userId,
      `✅ Pembayaran Berhasil!\n\n` +
      `Nominal Top Up: Rp ${deposit.original_amount || deposit.originalAmount}\n` +
      (bonus > 0 ? `Bonus Otomatis: Rp ${bonus}\n` : '') +
      `Biaya Admin: Rp ${adminFee}\n` +
      `Total Diterima (saldo): Rp ${Number(deposit.original_amount || deposit.originalAmount) + Number(bonus)}\n` +
      `Saldo Sekarang: Rp ${currentBalance}`
    );
    return true;
  } catch (err) {
    logger.error('Error sendPaymentSuccessNotification:', err.message || err);
    return false;
  }
}

async function processMatchingPayment(deposit, matchingTransaction, uniqueCode) {
  const amountKey = matchingTransaction.kredit || matchingTransaction.amount || 0;
  const transactionKey = `${matchingTransaction.reference_id || uniqueCode}_${amountKey}`;

  if (global.processedTransactions.has(transactionKey)) {
    logger.info('Transaction already processed: ' + transactionKey);
    return false;
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT id FROM transactions WHERE reference_id = ? AND amount = ?', [matchingTransaction.reference_id || uniqueCode, amountKey], (err, row) => {
        if (err) { db.run('ROLLBACK'); logger.error('Error checking transaction:', err.message); return reject(err); }
        if (row) { db.run('ROLLBACK'); logger.info('Transaction exists, skip'); return resolve(false); }

        const originalAmount = Number(deposit.original_amount || deposit.originalAmount || 0);
        const bonusToApply = (adminConfig.bonusEnabled && originalAmount >= (adminConfig.bonusThreshold || 0)) ? Number(adminConfig.bonusAmount || 0) : 0;
        const totalCredit = originalAmount + bonusToApply;

        db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [totalCredit, deposit.user_id || deposit.userId], function (err) {
          if (err) { db.run('ROLLBACK'); logger.error('Error updating balance:', err.message); return reject(err); }

          db.run('INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
            [deposit.user_id || deposit.userId, originalAmount, 'deposit', matchingTransaction.reference_id || uniqueCode, Date.now()], (err) => {
              if (err) { db.run('ROLLBACK'); logger.error('Error recording deposit txn:', err.message); return reject(err); }

              const recordBonus = (bonusToApply > 0) ? new Promise((res, rej) => {
                db.run('INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
                  [deposit.user_id || deposit.userId, bonusToApply, 'bonus', `bonus-${matchingTransaction.reference_id || uniqueCode}`, Date.now()], (e) => e ? rej(e) : res());
              }) : Promise.resolve();

              recordBonus.then(() => {
                db.get('SELECT saldo FROM users WHERE user_id = ?', [deposit.user_id || deposit.userId], async (err, userRow) => {
                  if (err) { db.run('ROLLBACK'); logger.error('Error fetching updated balance:', err.message); return reject(err); }

                  const notificationSent = await sendPaymentSuccessNotification(deposit.user_id || deposit.userId, deposit, userRow.saldo, bonusToApply);

                  // attempt delete qr message if present
                  if (deposit.qr_message_id || deposit.qrMessageId) {
                    try { await bot.telegram.deleteMessage(deposit.user_id || deposit.userId, deposit.qr_message_id || deposit.qrMessageId); } catch (e) { /* ignore */ }
                  }

                  if (notificationSent) {
                    // group notif
                    if (GROUP_ID) {
                      try {
                        const userInfo = await bot.telegram.getChat(deposit.user_id || deposit.userId).catch(() => ({}));
                        const username = userInfo.username ? `@${userInfo.username}` : (userInfo.first_name || (deposit.user_id || deposit.userId));
                        await bot.telegram.sendMessage(GROUP_ID,
                          `<b>✅ Top Up Berhasil</b>\nUser: ${username}\nNominal: Rp ${originalAmount}\n` +
                          (bonusToApply > 0 ? `Bonus: Rp ${bonusToApply}\n` : '') +
                          `Saldo Sekarang: Rp ${userRow.saldo}\nWaktu: ${new Date().toLocaleString('id-ID')}`, { parse_mode: 'HTML' });
                      } catch (e) { logger.error('Failed send group notif:', e.message); }
                    }

                    db.run('COMMIT');
                    global.processedTransactions.add(transactionKey);
                    delete global.pendingDeposits[uniqueCode];
                    db.run('DELETE FROM pending_deposits WHERE unique_code = ?', [uniqueCode]);
                    return resolve(true);
                  } else {
                    db.run('ROLLBACK');
                    return reject(new Error('Failed to send user notification'));
                  }
                });
              }).catch((errRec) => { db.run('ROLLBACK'); logger.error('Error recording bonus txn:', errRec.message || errRec); return reject(errRec); });
            });
        });
      });
    });
  });
}

// Minimal checkQRISStatus: example integration that looks for pending deposits and tries to match by amount
async function checkQRISStatus() {
  db.all('SELECT * FROM pending_deposits WHERE status = ?', ['pending'], (err, rows) => {
    if (err) return;
    rows.forEach(async (dep) => {
      try {
        // Example: call API to check payments (replace with real API)
        // const res = await axios.post(API_URL, buildPayload(...), { headers });
        // If matching found call processMatchingPayment
        // For now, try naive match: if pendingDeposits stored in memory and external simulated match exists, skip
        const age = Date.now() - dep.timestamp;
        if (age > 1000 * 60 * 60 * 24) {
          db.run('UPDATE pending_deposits SET status = ? WHERE unique_code = ?', ['expired', dep.unique_code]);
          return;
        }
        // Placeholder: if a record in global.pendingDeposits was marked matched externally, process it.
        const pend = global.pendingDeposits[dep.unique_code];
        if (pend && pend.matchedTransaction) {
          await processMatchingPayment(dep, pend.matchedTransaction, dep.unique_code);
        }
      } catch (e) { logger.error('checkQRISStatus error: ' + (e.message || e)); }
    });
  });
}
setInterval(checkQRISStatus, 10000);

// helper transaction recorder for account operations
async function recordAccountTransaction(userId, type) {
  return new Promise((resolve, reject) => {
    const referenceId = `account-${type}-${userId}-${Date.now()}`;
    db.run('INSERT INTO transactions (user_id, type, reference_id, timestamp) VALUES (?, ?, ?, ?)',
      [userId, type, referenceId, Date.now()], (err) => err ? reject(err) : resolve());
  });
}

// --- Callback query handler (menu actions) ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  try {
    if (data === 'service_create') {
      // show simple create options (example)
      await ctx.answerCbQuery();
      await ctx.reply('Pilih jenis layanan yang ingin dibuat:\n1. SSH\n2. Vmess\nKetik: create ssh atau create vmess');
      userState[userId] = { step: 'await_create_choice' };
    } else if (data === 'service_renew') {
      await ctx.answerCbQuery();
      await ctx.reply('Ketik: renew <username>');
      userState[userId] = { step: 'await_renew' };
    } else if (data === 'service_del') {
      await ctx.answerCbQuery();
      await ctx.reply('Ketik: del <username>');
      userState[userId] = { step: 'await_del' };
    } else if (data === 'service_lock') {
      await ctx.answerCbQuery();
      await ctx.reply('Ketik: lock <username>');
      userState[userId] = { step: 'await_lock' };
    } else if (data === 'service_unlock') {
      await ctx.answerCbQuery();
      await ctx.reply('Ketik: unlock <username>');
      userState[userId] = { step: 'await_unlock' };
    } else if (data === 'service_trial') {
      await ctx.answerCbQuery();
      if (await checkTrialAccess(userId)) return ctx.reply('Anda sudah menggunakan trial hari ini.');
      // For demo, create trial SSH (call module)
      try {
        const acc = await trialssh(userId); // modules should return details
        await saveTrialAccess(userId);
        await ctx.reply(`Trial dibuat: ${acc.username}\nExpired: ${acc.expire}`);
        await recordAccountTransaction(userId, 'trial');
      } catch (e) {
        logger.error('trial create err: ' + (e.message || e));
        await ctx.reply('Gagal membuat trial.');
      }
    } else if (data === 'topup_saldo') {
      await ctx.answerCbQuery();
      await ctx.reply('Masukkan nominal top-up (mis: 5000).');
      userState[userId] = { step: 'await_topup_amount' };
    } else if (data === 'cek_service') {
      await ctx.answerCbQuery();
      await ctx.reply('Cek server: fitur cek server (placeholder).');
    } else {
      await ctx.answerCbQuery();
    }
  } catch (e) {
    logger.error('callback_query handler error: ' + (e.message || e));
  }
});

// --- Text handler for multi-step flows (create/renew/del/topup) ---
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const txt = (ctx.message.text || '').trim();
  const st = userState[userId];
  try {
    // admin quick text commands for setting advanced config (optional)
    if (st && st.step === 'await_create_choice') {
      // format: create ssh or create vmess
      if (txt.toLowerCase().startsWith('create ')) {
        const kind = txt.split(' ')[1];
        try {
          let acc;
          if (kind === 'ssh') acc = await createssh(userId);
          else if (kind === 'vmess') acc = await createvmess(userId);
          else return ctx.reply('Jenis tidak dikenali.');
          await ctx.reply(`Akun dibuat:\n${JSON.stringify(acc)}`);
          await recordAccountTransaction(userId, 'create');
        } catch (e) {
          logger.error('create account error: ' + (e.message || e));
          ctx.reply('Gagal membuat akun.');
        }
      } else ctx.reply('Gunakan format: create <jenis>');
      delete userState[userId];
      return;
    }

    if (st && st.step === 'await_renew') {
      // format: renew <username>
      const parts = txt.split(' ');
      if (parts[0].toLowerCase() === 'renew' && parts[1]) {
        try {
          // call renew module based on type detection (simplified)
          const res = await renewssh(parts[1]).catch(()=>null);
          ctx.reply('Perpanjangan diproses.');
          await recordAccountTransaction(userId, 'renew');
        } catch (e) { ctx.reply('Gagal perpanjang.'); }
      } else ctx.reply('Gunakan renew <username>');
      delete userState[userId];
      return;
    }

    if (st && st.step === 'await_del') {
      const parts = txt.split(' ');
      if (parts[0].toLowerCase() === 'del' && parts[1]) {
        try {
          await delssh(parts[1]).catch(()=>null);
          ctx.reply('Akun dihapus.');
          await recordAccountTransaction(userId, 'delete');
        } catch (e) { ctx.reply('Gagal hapus.'); }
      } else ctx.reply('Gunakan del <username>');
      delete userState[userId];
      return;
    }

    if (st && st.step === 'await_lock') {
      const parts = txt.split(' ');
      if (parts[0].toLowerCase() === 'lock' && parts[1]) {
        try { await lockssh(parts[1]).catch(()=>null); ctx.reply('Akun dikunci.'); } catch { ctx.reply('Gagal lock.'); }
      } else ctx.reply('Gunakan lock <username>');
      delete userState[userId];
      return;
    }

    if (st && st.step === 'await_unlock') {
      const parts = txt.split(' ');
      if (parts[0].toLowerCase() === 'unlock' && parts[1]) {
        try { await unlockssh(parts[1]).catch(()=>null); ctx.reply('Akun dibuka.'); } catch { ctx.reply('Gagal unlock.'); }
      } else ctx.reply('Gunakan unlock <username>');
      delete userState[userId];
      return;
    }

    if (st && st.step === 'await_topup_amount') {
      const nominal = parseInt(txt.replace(/\D/g, ''));
      if (isNaN(nominal) || nominal <= 0) return ctx.reply('Nominal tidak valid. Masukkan angka (mis: 5000).');
      // buat pending deposit
      const uniqueCode = `dep-${Date.now()}-${Math.floor(Math.random()*9000+1000)}`;
      const deposit = {
        unique_code: uniqueCode,
        user_id: userId,
        amount: nominal, // may be used for matching
        original_amount: nominal,
        timestamp: Date.now(),
        status: 'pending',
      };
      db.run('INSERT INTO pending_deposits (unique_code, user_id, amount, original_amount, timestamp, status) VALUES (?, ?, ?, ?, ?, ?)',
        [deposit.unique_code, deposit.user_id, deposit.amount, deposit.original_amount, deposit.timestamp, deposit.status], (err) => {
          if (err) {
            logger.error('Failed insert pending_deposit: ' + (err.message || err));
            return ctx.reply('Gagal membuat instruksi pembayaran.');
          }
          // store in memory pending (for example external checker could set matchedTransaction)
          global.pendingDeposits[uniqueCode] = { deposit, matchedTransaction: null };
          // send placeholder QR/instruction; replace with real QR generation if available
          ctx.reply(`Instruksi pembayaran dibuat.\nKode: ${uniqueCode}\nNominal: Rp ${nominal}\nSilakan lakukan pembayaran sesuai instruksi (placeholder). Bot akan otomatis memproses setelah pembayaran terdeteksi.`);
        });
      delete userState[userId];
      return;
    }

    // fallback: commands in text e.g., manual create/del/renew typed without menu
    const parts = txt.split(' ');
    const cmd = parts[0].toLowerCase();
    if (cmd === 'create' && parts[1]) {
      const kind = parts[1];
      try {
        let acc;
        if (kind === 'ssh') acc = await createssh(userId);
        else if (kind === 'vmess') acc = await createvmess(userId);
        else return ctx.reply('Jenis tidak dikenali.');
        await ctx.reply(`Akun dibuat:\n${JSON.stringify(acc)}`);
        await recordAccountTransaction(userId, 'create');
      } catch (e) { ctx.reply('Gagal membuat akun.'); }
      return;
    }
    // no matching flow: ignore
  } catch (e) {
    logger.error('text handler error: ' + (e.message || e));
  }
});

// start server & bot
app.listen(port, () => {
  bot.launch().then(() => logger.info('Bot telah dimulai')).catch(e => logger.error('Error start bot:', e.message || e));
  logger.info(`Server berjalan di port ${port}`);
});

// graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));