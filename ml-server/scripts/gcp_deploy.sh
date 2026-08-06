#!/bin/bash
# Deploy ML server ke GCP VM + GPU T4 di JAKARTA (asia-southeast2).
#
# Prerequisites:
# - gcloud CLI installed & authenticated
# - GPU quota di asia-southeast2. Diperiksa 6 Agustus 2026 di project
#   pendidikan-muhajir: PREEMPTIBLE_NVIDIA_T4_GPUS limit 8, usage 0 — cukup.
#   T4 tersedia di asia-southeast2-a dan -b.
#   Cek ulang: gcloud compute regions describe asia-southeast2 --format="json(quotas)"
# - Cek T4 availability: gcloud compute accelerator-types list --filter="zone:asia-southeast2"
#
# Cost-saving: Spot VM (sampai 75% lebih murah, bisa di-stop kapan saja)
# + persistent disk untuk model cache (tidak re-download 2.4 GB tiap restart).

set -e

# Project yang benar-benar ada dan billing-nya aktif. Sebelumnya di sini tertulis
# "muhajir-tilawah" — project itu tidak pernah dibuat, jadi setiap perintah di
# skrip ini gagal dengan pesan yang menyesatkan (permission, bukan not-found).
PROJECT_ID="${GCP_PROJECT_ID:-pendidikan-muhajir}"
ZONE="${GCP_ZONE:-asia-southeast2-a}"   # JAKARTA — data residency Indonesia (UU PDP)
INSTANCE_NAME="muhajir-ml-server"
MACHINE_TYPE="n1-standard-4"
GPU_TYPE="nvidia-tesla-t4"
BOOT_DISK_SIZE="100GB"
# Family "pytorch-latest-gpu" sudah dihapus Google. Deep Learning VM sekarang
# memberi nama per-versi, jadi family HARUS dipilih eksplisit dan akan basi
# suatu saat. Cek yang tersedia:
#   gcloud compute images list --project=deeplearning-platform-release \
#     --filter="family~pytorch" --format="value(family)" | sort -u
IMAGE_FAMILY="${GCP_IMAGE_FAMILY:-pytorch-2-9-cu129-ubuntu-2204-nvidia-580}"

# ── Mati sendiri ─────────────────────────────────────────────────────────────
# VM GPU yang lupa dimatikan adalah cara termudah membakar anggaran: T4 Spot +
# n1-standard-4 ≈ $0,17/jam, jadi satu akhir pekan terlupakan ≈ $28. Dua lapis
# pengaman, karena keduanya gagal dengan cara yang berbeda:
#
#   1. MAX_RUN_HOURS — batas keras dari sisi GCE. Tetap berlaku sekalipun VM
#      hang, kernel panic, atau watchdog di dalamnya mati. Tidak tahu apa-apa
#      soal pekerjaan yang sedang jalan, jadi angkanya harus longgar.
#   2. IDLE_MINUTES — watchdog di dalam VM. Mati begitu GPU menganggur sekian
#      menit, jadi tidak menunggu batas keras kalau pekerjaan selesai lebih
#      cepat. Tidak berguna kalau VM-nya sendiri bermasalah — itu tugas lapis 1.
#
# Keduanya STOP, bukan DELETE: disk model 2,4 GB tetap ada, jadi menyalakan
# kembali tidak perlu unduh ulang. Disk yang berhenti tetap ditagih (~$0,01/jam
# untuk 100 GB) — hapus VM-nya kalau proyek sudah selesai.
MAX_RUN_HOURS="${GCP_MAX_RUN_HOURS:-8}"
IDLE_MINUTES="${GCP_IDLE_MINUTES:-30}"

echo "Deploying ML server ke GCP Jakarta..."
echo "  Project: $PROJECT_ID"
echo "  Zone: $ZONE"
echo "  Machine: $MACHINE_TYPE + 1x $GPU_TYPE (Spot)"
echo "  Mati sendiri: maks ${MAX_RUN_HOURS} jam, atau ${IDLE_MINUTES} menit menganggur"
echo

if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    echo "Instance sudah ada. Start dengan:"
    echo "  gcloud compute instances start $INSTANCE_NAME --zone=$ZONE"
    exit 0
fi

# Watchdog menganggur. Dijalankan tiap boot lewat startup-script.
#
# Ukurannya utilisasi GPU, bukan koneksi masuk: inferensi Mu'alim membebani GPU
# selama ia berjalan, sedangkan koneksi HTTP yang menganggur bisa terbuka
# berjam-jam tanpa pekerjaan apa pun. Penghitung direset setiap kali GPU
# terpakai, jadi rentetan permintaan tidak akan terpotong di tengah.
WATCHDOG_FILE="$(mktemp)"
trap 'rm -f "$WATCHDOG_FILE"' EXIT
cat > "$WATCHDOG_FILE" <<WD
#!/bin/bash
IDLE_LIMIT=$IDLE_MINUTES
COUNT=0
# Beri waktu boot + unduh model sebelum mulai menghitung.
sleep 900
while true; do
    UTIL=\$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1)
    # nvidia-smi gagal = driver belum siap. Jangan matikan VM karena itu.
    if [ -z "\$UTIL" ]; then COUNT=0; sleep 60; continue; fi
    if [ "\$UTIL" -lt 5 ]; then COUNT=\$((COUNT+1)); else COUNT=0; fi
    if [ "\$COUNT" -ge "\$IDLE_LIMIT" ]; then
        logger -t ml-idle-watchdog "GPU menganggur \$IDLE_LIMIT menit — mematikan VM"
        shutdown -h now
        exit 0
    fi
    sleep 60
done
WD

gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --accelerator="type=$GPU_TYPE,count=1" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="deeplearning-platform-release" \
    --boot-disk-size="$BOOT_DISK_SIZE" \
    --boot-disk-type="pd-balanced" \
    --maintenance-policy="TERMINATE" \
    --provisioning-model="SPOT" \
    --instance-termination-action="STOP" \
    --max-run-duration="${MAX_RUN_HOURS}h" \
    --metadata="install-nvidia-driver=True" \
    --metadata-from-file="startup-script=$WATCHDOG_FILE" \
    --tags="ml-server"

echo
echo "Instance created. Mati sendiri setelah ${MAX_RUN_HOURS} jam"
echo "atau ${IDLE_MINUTES} menit GPU menganggur (mana yang lebih dulu)."
echo
echo "Langkah berikutnya:"
echo "  1. SSH:  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "  2. git clone <repo> && cd ml-server"
echo "  3. cp .env.example .env && nano .env   # set API_KEY"
echo "  4. docker compose up -d --build"
echo "  5. Firewall: allow HTTPS dari Vercel saja kalau bisa, atau pakai"
echo "     reverse proxy (caddy/nginx) dengan TLS. JANGAN expose port 8000 plain HTTP publik."
echo
echo "⚠️  Setelah testing, STOP VM: gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE"
