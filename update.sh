 #!/bin/bash  

dpkg-statoverride --remove /var/spool/exim4
dpkg --configure -a
apt -f install -y
mv /var/lib/dpkg/statoverride /var/lib/dpkg/statoverride.old
touch /var/lib/dpkg/statoverride

cd /root/BotVPN
    timedatectl set-timezone Asia/Jakarta || echo -e "${red}Failed to set timezone to Jakarta${neutral}"

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || echo -e "${red}Failed to download Node.js setup${neutral}"
apt-get install -y nodejs || echo -e "${red}Failed to install Node.js${neutral}"
        
    if [ ! -f /root/BotVPN/app.js ]; then
        git clone https://github.com/arivpnstores/BotVPN.git /root/BotVPN
    fi

npm install -g npm@latest
npm install -g pm2

    if ! npm list --prefix /root/BotVPN express telegraf axios moment sqlite3 >/dev/null 2>&1; then
        npm install --prefix /root/BotVPN sqlite3 express crypto telegraf axios dotenv
    fi
    
    if [ -n "$(ls -A /root/BotVPN)" ]; then
        chmod +x /root/BotVPN/*
    fi

# === PERUBAHAN DI SINI ===
# Membuat folder modules jika belum ada, untuk memastikan wget berhasil
mkdir -p /root/BotVPN/modules

# Download file-file terbaru dari repository
wget -O /root/BotVPN/ecosystem.config.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/ecosystem.config.js"
wget -O /root/BotVPN/app.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/app.js"
wget -O /root/BotVPN/api-cekpayment-orkut.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/api-cekpayment-orkut.js"
# Menambahkan perintah untuk update del.js di dalam folder modules
wget -O /root/BotVPN/modules/del.js "https://raw.githubusercontent.com/nexus-bot-dev/BotVPN/main/modules/del.js"
# === AKHIR PERUBAHAN ===


# stop dulu servicenya
systemctl stop sellvpn.service

# nonaktifkan supaya tidak jalan saat boot
systemctl disable sellvpn.service

# hapus file service dari systemd
rm -f /etc/systemd/system/sellvpn.service

# reload systemd biar bersih
systemctl daemon-reload
systemctl reset-failed


pm2 start ecosystem.config.js
pm2 save

cat >/usr/bin/backup_sellvpn <<'EOF'
#!/bin/bash
VARS_FILE="/root/BotVPN/.vars.json"
DB_FILE="/root/BotVPN/sellvpn.db"

if [ ! -f "$VARS_FILE" ]; then
    echo "❌ File $VARS_FILE tidak ditemukan"
    exit 1
fi

# Ambil nilai dari .vars.json
BOT_TOKEN=$(jq -r '.BOT_TOKEN' "$VARS_FILE")
USER_ID=$(jq -r '.USER_ID' "$VARS_FILE")

if [ -z "$BOT_TOKEN" ] || [ -z "$USER_ID" ]; then
    echo "❌ BOT_TOKEN atau USER_ID kosong di $VARS_FILE"
    exit 1
fi

# Kirim database ke Telegram
if [ -f "$DB_FILE" ]; then
    curl -s -F chat_id="$USER_ID" \
         -F document=@"$DB_FILE" \
         "https://api.telegram.org/bot$BOT_TOKEN/sendDocument" >/dev/null 2>&1
    echo "✅ Backup terkirim ke Telegram"
else
    echo "❌ Database $DB_FILE tidak ditemukan"
fi
EOF

# bikin cron job tiap 1 jam
cat >/etc/cron.d/backup_sellvpn <<'EOF'
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 0 * * * root /usr/bin/backup_sellvpn
EOF

chmod +x /usr/bin/backup_sellvpn
service cron restart
cd