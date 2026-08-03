#!/bin/bash
# Deploy ML server ke GCP VM + GPU T4 di JAKARTA (asia-southeast2).
#
# Prerequisites:
# - gcloud CLI installed & authenticated
# - GPU quota di asia-southeast2 sudah di-request (default project baru = 0!)
#   Cek: gcloud compute regions describe asia-southeast2 --format="table(quotas)"
# - Cek T4 availability: gcloud compute accelerator-types list --filter="zone:asia-southeast2"
#
# Cost-saving: Spot VM (sampai 75% lebih murah, bisa di-stop kapan saja)
# + persistent disk untuk model cache (tidak re-download 2.4 GB tiap restart).

set -e

PROJECT_ID="${GCP_PROJECT_ID:-muhajir-tilawah}"
ZONE="${GCP_ZONE:-asia-southeast2-a}"   # JAKARTA — data residency Indonesia (UU PDP)
INSTANCE_NAME="muhajir-ml-server"
MACHINE_TYPE="n1-standard-4"
GPU_TYPE="nvidia-tesla-t4"
BOOT_DISK_SIZE="100GB"

echo "Deploying ML server ke GCP Jakarta..."
echo "  Project: $PROJECT_ID"
echo "  Zone: $ZONE"
echo "  Machine: $MACHINE_TYPE + 1x $GPU_TYPE (Spot)"
echo

if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    echo "Instance sudah ada. Start dengan:"
    echo "  gcloud compute instances start $INSTANCE_NAME --zone=$ZONE"
    exit 0
fi

gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --accelerator="type=$GPU_TYPE,count=1" \
    --image-family="pytorch-latest-gpu" \
    --image-project="deeplearning-platform-release" \
    --boot-disk-size="$BOOT_DISK_SIZE" \
    --boot-disk-type="pd-balanced" \
    --maintenance-policy="TERMINATE" \
    --provisioning-model="SPOT" \
    --instance-termination-action="STOP" \
    --metadata="install-nvidia-driver=True" \
    --tags="ml-server"

echo
echo "Instance created. Langkah berikutnya:"
echo "  1. SSH:  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "  2. git clone <repo> && cd ml-server"
echo "  3. cp .env.example .env && nano .env   # set API_KEY"
echo "  4. docker compose up -d --build"
echo "  5. Firewall: allow HTTPS dari Vercel saja kalau bisa, atau pakai"
echo "     reverse proxy (caddy/nginx) dengan TLS. JANGAN expose port 8000 plain HTTP publik."
echo
echo "⚠️  Setelah testing, STOP VM: gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE"
