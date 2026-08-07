#!/bin/bash
# Satu putaran inferensi batch: nyalakan GPU, proses yang menumpuk, matikan.
#
# GPU T4 Spot yang jalan terus ≈ $125/bulan untuk pekerjaan beberapa menit
# sehari. Skrip ini membuat biayanya sekitar $0,20 per putaran.
#
# VM DIMATIKAN APA PUN YANG TERJADI — `trap` di bawah berjalan walau inferensi
# gagal di tengah, atau skrip ini dihentikan Ctrl-C. Itu pengaman lapis
# pertama; dua lapis lainnya (batas keras GCE dan watchdog nganggur di dalam
# VM) ada di gcp_deploy.sh, dan sengaja tidak saling menggantikan karena
# ketiganya gagal dengan cara yang berbeda.
#
# Lihat docs/BATCH_INFERENSI.md.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-pendidikan-muhajir}"
ZONE="${GCP_ZONE:-asia-southeast2-a}"
INSTANCE_NAME="${GCP_INSTANCE:-muhajir-ml-server}"
LIMIT="${BATCH_LIMIT:-0}"

G=(gcloud --project="$PROJECT_ID" --quiet)

matikan() {
  local status=$?
  echo
  echo "→ Mematikan VM…"
  # || true: kegagalan mematikan tidak boleh menutupi galat aslinya, tapi
  # HARUS terlihat — VM yang tertinggal hidup itu yang membakar anggaran.
  "${G[@]}" compute instances stop "$INSTANCE_NAME" --zone="$ZONE" >/dev/null 2>&1 || {
    echo "  ⚠️  GAGAL MEMATIKAN VM. Matikan manual sekarang:"
    echo "     gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID"
  }
  echo "→ Selesai (status $status)"
}
trap matikan EXIT

echo "Batch inferensi — $INSTANCE_NAME @ $ZONE"

# Dicoba beberapa kali sebelum menyimpulkan VM-nya tidak ada. Sebelumnya satu
# kegagalan sesaat dari gcloud — jaringan atau token — terbaca sama persis
# dengan "VM tidak ditemukan", dan skrip berhenti dengan saran keliru supaya
# operator membuat VM yang sebenarnya sudah ada.
ADA=""
for i in 1 2 3; do
  if HASIL="$("${G[@]}" compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --format='value(status)' 2>&1)"; then
    ADA="$HASIL"
    break
  fi
  case "$HASIL" in
    *"was not found"*|*"NOT_FOUND"*)
      echo "VM belum ada. Buat dulu: ml-server/scripts/gcp_deploy.sh" >&2
      trap - EXIT   # tidak ada yang perlu dimatikan
      exit 1
      ;;
  esac
  echo "  gagal memeriksa VM (percobaan $i): ${HASIL##*$'\n'}" >&2
  sleep 5
done
if [ -z "$ADA" ]; then
  echo "Tidak bisa memastikan keadaan VM setelah 3 percobaan. Berhenti." >&2
  trap - EXIT
  exit 1
fi
echo "  keadaan VM: $ADA"

echo "→ Menyalakan VM…"
"${G[@]}" compute instances start "$INSTANCE_NAME" --zone="$ZONE" >/dev/null

echo "→ Menunggu SSH siap…"
for i in $(seq 1 40); do
  if "${G[@]}" compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="true" >/dev/null 2>&1; then
    echo "  siap (percobaan $i)"
    break
  fi
  sleep 15
  [ "$i" = 40 ] && { echo "  SSH tidak pernah siap" >&2; exit 1; }
done

# Kredensial diambil dari Secret Manager di sini, bukan disimpan di VM: VM ini
# sekali pakai dan bisa dihapus kapan saja, sedangkan rahasia yang menetap di
# disk-nya akan ikut tertinggal.
echo "→ Mengambil kredensial…"
DB_URL="$("${G[@]}" secrets versions access latest --secret=DATABASE_URL)"
# Nama bucket HARUS sama dengan GCS_BUCKET di Cloud Run — di sanalah audio
# peserta ditulis. Sempat tertulis "mpt-audio" (mengikuti docs/DEPLOY_GCP.md,
# yang memakai nama contoh), dan batch tidak menemukan satu berkas pun.
BUCKET="${GCS_BUCKET:-mpt-audio-pendidikan-muhajir}"
INSTANCE_CONN="${PROJECT_ID}:${ZONE%-*}:mpt-pg"

# DSN di Secret Manager menunjuk unix socket milik Cloud Run, yang tidak ada di
# VM. Cloud SQL juga hanya punya IP publik — menambahkan IP VM ke
# authorized-networks berarti mengubah konfigurasi basis data produksi hanya
# demi VM sekali pakai. Cloud SQL Auth Proxy memakai IAM, tidak menyentuh
# konfigurasi itu sama sekali, dan mati bersama VM-nya.
DB_URL_VM="$(python3 - "$DB_URL" <<'PY'
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1])
print(u.urlunparse(p._replace(netloc=f"{p.username}:{u.quote(p.password or '', safe='')}@127.0.0.1:5433")))
PY
)"

# Service account VM sengaja tidak diberi cakupan cloud-platform — cakupan itu
# hanya bisa diubah saat VM mati, dan memberi VM sekali pakai hak seluas itu
# tidak sepadan. Token sesaat dari operator sudah cukup: berlaku sekitar satu
# jam, jauh lebih lama dari satu putaran batch, dan hilang bersama VM.
TOKEN="$("${G[@]}" auth print-access-token)"

# Perintah jarak jauh ditulis ke berkas, bukan dirangkai jadi satu baris
# --command yang panjang. Dua alasan, keduanya sudah pernah menggigit:
#
#   1. Kutipan. Merangkai skrip multi-baris ke dalam --command="…" membuat
#      gcloud memecahnya jadi argumen begitu ada tanda kutip di dalamnya.
#   2. RAHASIA. Kalau perintahnya gagal, gcloud MENGGEMAKAN seluruh baris
#      perintah ke layar — termasuk DATABASE_URL berikut passwordnya. Lewat
#      berkas + stdin, yang tergema hanya nama berkasnya.
#
# Proxy dimatikan lewat PID, BUKAN `pkill -f cloud-sql-proxy`: pola itu ikut
# mencocokkan baris perintah SSH-nya sendiri, sehingga membunuh shell induknya
# dan sesi mati dengan "Connection reset" tanpa keluaran apa pun.
REMOTE="$(mktemp)"
cat > "$REMOTE" <<'REMOTE_EOF'
set -e
cd ~/ml
if [ ! -x ~/cloud-sql-proxy ]; then
  curl -sSL -o ~/cloud-sql-proxy \
    https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
  chmod +x ~/cloud-sql-proxy
fi
~/cloud-sql-proxy --port 5433 --token "$SQL_TOKEN" "$SQL_CONN" >/tmp/sqlproxy.log 2>&1 &
PROXY=$!
trap 'kill $PROXY 2>/dev/null || true' EXIT
for i in $(seq 1 30); do ss -ltn | grep -q 5433 && break; sleep 1; done
MUALIM_CACHE_DIR=$HOME/models python3 scripts/batch_infer.py --limit "$BATCH_LIMIT"
REMOTE_EOF

echo "→ Menjalankan inferensi…"
"${G[@]}" compute scp "$REMOTE" "$INSTANCE_NAME:/tmp/batch_remote.sh" --zone="$ZONE" >/dev/null
rm -f "$REMOTE"

# Rahasia dikirim lewat stdin, bukan argumen: argumen terlihat di `ps` milik
# pengguna lain di VM dan ikut tergema kalau perintahnya gagal.
printf 'SQL_TOKEN=%s\nSQL_CONN=%s\nDATABASE_URL=%s\nGCS_BUCKET=%s\nBATCH_LIMIT=%s\n' \
  "$TOKEN" "$INSTANCE_CONN" "$DB_URL_VM" "$BUCKET" "$LIMIT" \
  | "${G[@]}" compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="\
      set -a; . /dev/stdin; set +a; bash /tmp/batch_remote.sh; rm -f /tmp/batch_remote.sh"

echo
echo "Temuan mentah sudah masuk ai_inference_raw."
echo "Langkah berikutnya — proyeksikan jadi ai_evaluations:"
echo "  curl -H \"x-worker-secret: \$WORKER_SECRET\" https://<situs>/api/worker"
echo "(atau tunggu cron harian di vercel.json)"
