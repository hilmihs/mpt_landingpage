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

if ! "${G[@]}" compute instances describe "$INSTANCE_NAME" --zone="$ZONE" >/dev/null 2>&1; then
  echo "VM belum ada. Buat dulu: ml-server/scripts/gcp_deploy.sh" >&2
  trap - EXIT   # tidak ada yang perlu dimatikan
  exit 1
fi

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
BUCKET="${GCS_BUCKET:-mpt-audio}"

echo "→ Menjalankan inferensi…"
"${G[@]}" compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="\
  cd ~/ml && \
  DATABASE_URL='$DB_URL' GCS_BUCKET='$BUCKET' MUALIM_CACHE_DIR=\$HOME/models \
  python3 scripts/batch_infer.py --limit $LIMIT"

echo
echo "Temuan mentah sudah masuk ai_inference_raw."
echo "Langkah berikutnya — proyeksikan jadi ai_evaluations:"
echo "  curl -H \"x-worker-secret: \$WORKER_SECRET\" https://<situs>/api/worker"
echo "(atau tunggu cron harian di vercel.json)"
