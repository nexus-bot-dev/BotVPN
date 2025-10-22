 #!/bin/bash

# Konfigurasi warna untuk output
red='\033[0;31m'
green='\033[0;32m'
neutral='\033[0m'

echo -e "${green}Memulai skrip update dan instalasi BotVPN...${neutral}"

# 1. Perbaikan sistem dan dependensi dasar
echo -e "\n${green}1. Memperbaiki paket manager dan dependensi dasar...${neutral}"
dpkg-statoverride --remove /var/spool/exim4 > /dev/null 2>&1
dpkg --configure -a > /dev/null 2>&1
apt -f install -y > /dev/null 2>&1
if [ -f /var/lib/dpkg/statoverride ]; then
    mv /var/lib/dpkg/statoverride /var/lib/dpkg/statoverride.old
fi
touch /var/lib/dpkg/statoverride
apt-get install -y jq curl > /dev/null 2>&1

# 2. Pengaturan Zona Waktu dan Node.js
echo -e "\n${green}2. Mengatur zona waktu dan menginstal Node.js v20...${neutral}"
timedatectl set-timezone Asia/Jakarta
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
apt-get install -y nodejs || { echo -e "${red}Gagal menginstal Node.js${neutral}"; exit 1; }

# 3. Persiapan Folder dan Repository Bot
echo -e "\n${green}3. Mempersiapkan direktori BotVPN...${neutral}"
mkdir -p /root/BotVPN
cd /root/BotVPN || { echo -e "${red}Gagal masuk ke direktori /root/BotVPN${neutral}"; exit 1; }

# Clone repo hanya jika folder masih kosong (atau app.js tidak ada)
if [ ! -f /root/BotVPN/app.js ]; then
    echo "Folder kosong, mengkloning repository awal..."
    git clone https://github.com/arivpnstores/BotVPN.git .
fi

# 4. Instalasi dan Update Dependensi Node.js
echo -e "\n${green}4. Menginstal PM2 dan dependensi bot...${neutral}"
npm install -g npm@latest > /dev/null 2>&1
npm install -g pm2 > /dev/null 2>&1
npm install sqlite3 express crypto telegraf axios dotenv > /dev/null 2>&1

# 5. Mengunduh File Bot Versi Terbaru (TERMASUK PERBAIKAN)
echo -e "\n${green}5. Mengunduh file bot versi terbaru yang sudah diperbaiki...${neutral}"
wget -q -O /root/BotVPN/ecosystem.config.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/ecosystem.config.js"
wget -q -O /root/BotVPN/app.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/app.js"
wget -q -O /root/BotVPN/api-cekpayment-orkut.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/api-cekpayment-orkut.js"
# Pastikan folder modules ada dan unduh del.js yang sudah diperbaiki
mkdir -p /root/BotVPN/modules
wget -q -O /root/BotVPN/modules/del.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/modules/del.js"
echo "File app.js dan modules/del.js telah diperbarui."

# 6. Menghapus Service Lama (systemd) dan Setup PM2
echo -e "\n${green}6. Menghapus service lama dan menjalankan bot dengan PM2...${neutral}"
if systemctl is-active --quiet sellvpn.service; then
    systemctl stop sellvpn.service
    systemctl disable sellvpn.service
    rm -f /etc/systemd/system/sellvpn.service
    systemctl daemon-reload
    systemctl reset-failed
fi
pm2 start ecosystem.config.js
pm2 save

# 7. Pengaturan Backup Otomatis
echo -e "\n${green}7. Mengatur backup database otomatis...${neutral}"
cat >/usr/bin/backup_sellvpn <<'EOF'
#!/bin/bash
VARS_FILE="/root/BotVPN/.vars.json"
DB_FILE="/root/BotVPN/sellvpn.db"

if [ ! -f "$VARS_FILE" ]; then
    echo "❌ File .vars.json tidak ditemukan"
    exit 1
fi

BOT_TOKEN=$(jq -r '.BOT_TOKEN' "$VARS_FILE")
# Mengambil hanya ID pertama dari array USER_ID
USER_ID=$(jq -r '.USER_ID[0]' "$VARS_FILE")

if [ -z "$BOT_TOKEN" ] || [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
    echo "❌ BOT_TOKEN atau USER_ID kosong di .vars.json"
    exit 1
fi

if [ -f "$DB_FILE" ]; then
    curl -s -F chat_id="$USER_ID" -F document=@"$DB_FILE" "https://api.telegram.org/bot$BOT_TOKEN/sendDocument" >/dev/null
    echo "✅ Backup terkirim ke Telegram"
else
    echo "❌ Database $DB_FILE tidak ditemukan"
fi
EOF

cat >/etc/cron.d/backup_sellvpn <<'EOF'
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
# Backup setiap 6 jam
0 */6 * * * root bash /usr/bin/backup_sellvpn
EOF

chmod +x /usr/bin/backup_sellvpn
service cron restart > /dev/null 2>&1

echo -e "\n${green}✅ SEMUA SELESAI. Bot Anda telah diperbarui dan berjalan dengan PM2.${neutral}"
echo -e "${green}Fitur notifikasi refund otomatis yang detail sudah aktif.${neutral}"
