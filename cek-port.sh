#!/bin/bash

# Daftar server (bisa kamu ganti sesuai list)
servers=(
  "sgvip.domainmu.web.id"
  "sgvvip.domainmu.web.id"
  "sgvvip2.domainmu.web.id"
  "sgvvip3.domainmu.web.id"
  "team1.domainmu.web.id"
  "team2.domainmu.web.id"
  "idnusa.domainmu.web.id"
  "idnusa2.domainmu.web.id"
  "idnusastb.domainmu.web.id"
)

# Daftar port yang ingin dicek
ports=(22 80 443)

# Warna
green="\e[32m"
red="\e[31m"
nc="\e[0m"

echo "🔍 Cek status server pada port 22, 80, dan 443"
echo "-------------------------------------------"

# Loop setiap server
for server in "${servers[@]}"; do
  echo -e "\n🌐 Server: $server"
  for port in "${ports[@]}"; do
    timeout 2 bash -c "</dev/tcp/$server/$port" &>/dev/null
    if [[ $? -eq 0 ]]; then
      echo -e "  Port $port: ${green}OPEN${nc}"
    else
      echo -e "  Port $port: ${red}CLOSED${nc}"
    fi
  done
done

