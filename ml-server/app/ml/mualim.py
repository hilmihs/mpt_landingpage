"""
Muat dan jalankan Mu'alim v3_2.

DIVERIFIKASI 6 Agustus 2026 di T4 Jakarta. Catatan di bawah adalah hasil
pengamatan langsung, bukan dugaan.

KENAPA TORCHSCRIPT, BUKAN TRANSFORMERS
Repo `obadx/muaalem-model-v3_2` memuat bobot dengan `model_type: multi_level_ctc`
dan `architectures: [Wav2Vec2BertForMultilevelCTC]`, tetapi `auto_map` di
config.json bernilai None — artinya repo TIDAK membawa kode arsitekturnya.
Akibatnya `AutoModel.from_pretrained(..., trust_remote_code=True)` gagal dengan
"Transformers does not recognize this architecture", dan tidak ada versi
transformers mana pun yang memperbaikinya; yang hilang memang kodenya.

Penulis menerbitkan varian TorchScript di repo terpisah
`obadx/muaalem-v3_2-torchscript-v1`. TorchScript membawa grafnya sendiri, jadi
tidak butuh kelas Python apa pun. Itulah yang dipakai di sini.

BENTUK KELUARAN (hasil pengamatan)
    forward(input_features, attention_mask) -> (Dict[str, Tensor],)

Perhatikan tuple berisi satu elemen — bukan dict langsung. Isinya sebelas level:
`phonemes` (vocab 43) ditambah sepuluh level sifat. Level sifat inilah sumber
lahn khafiy; sebelum ini modul mencatatnya sebagai TODO, padahal modelnya sudah
menyediakannya sejak awal.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.ml.alfatihah import SIFA_LEVELS

log = logging.getLogger(__name__)

REPO_TORCHSCRIPT = "obadx/muaalem-v3_2-torchscript-v1"
REPO_VOCAB = "obadx/muaalem-model-v3_2"

# fp16 dipilih karena T4 punya tensor core untuk itu dan bobotnya separuh fp32.
# Ganti ke model_fp32.pt kalau menjalankan di CPU — fp16 di CPU justru lambat.
BOBOT_DEFAULT = "model_fp16.pt"


class MualimEngine:
    def __init__(self, model_id: str = REPO_TORCHSCRIPT, bobot: str = BOBOT_DEFAULT):
        self.model_id = model_id
        self.bobot = bobot
        self.model: Any = None
        self.processor: Any = None
        self.id2tok: dict[str, dict[int, str]] = {}
        self.device = "cpu"

    async def load(self) -> None:
        await asyncio.to_thread(self._load_sync)

    def _load_sync(self) -> None:
        import torch
        from huggingface_hub import hf_hub_download, snapshot_download
        from transformers import AutoFeatureExtractor

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        if self.device == "cpu" and self.bobot == "model_fp16.pt":
            log.warning("Tidak ada GPU; fp16 di CPU sangat lambat. Pakai model_fp32.pt.")

        log.info("Memuat TorchScript %s/%s ke %s", self.model_id, self.bobot, self.device)
        path = hf_hub_download(self.model_id, self.bobot)
        self.model = torch.jit.load(path, map_location=self.device).eval()

        proc_dir = snapshot_download(self.model_id, allow_patterns=["processor/*"])
        self.processor = AutoFeatureExtractor.from_pretrained(f"{proc_dir}/processor")

        # Vocab tinggal di repo transformers, bukan di repo TorchScript.
        vocab_path = hf_hub_download(REPO_VOCAB, "vocab.json")
        with open(vocab_path, encoding="utf8") as f:
            vocab = json.load(f)
        self.id2tok = {lvl: {i: t for t, i in toks.items()} for lvl, toks in vocab.items()}
        log.info("Model siap. Level: %s", sorted(self.id2tok))

    async def predict(self, audio) -> dict:
        return await asyncio.to_thread(self._predict_sync, audio)

    def _predict_sync(self, audio) -> dict:
        import torch

        if self.model is None:
            raise RuntimeError("Model belum dimuat")

        feats = self.processor(audio, sampling_rate=16000, return_tensors="pt")
        x = feats["input_features"]
        mask = feats["attention_mask"]
        if self.device == "cuda":
            x, mask = x.half().cuda(), mask.cuda()

        with torch.no_grad():
            keluaran = self.model(x, mask)
        # TorchScript membungkus dict-nya dalam tuple satu elemen.
        if isinstance(keluaran, tuple):
            keluaran = keluaran[0]

        fonem = self._decode(keluaran["phonemes"], "phonemes")
        sifa = {
            lvl: self._decode(keluaran[lvl], lvl)
            for lvl in SIFA_LEVELS
            if lvl in keluaran
        }
        return {
            "phonemes": fonem,
            "sifa": sifa or None,
            "timestamps": None,
            "confidence": self._confidence(keluaran["phonemes"]),
        }

    def _decode(self, logits, level: str) -> list[str]:
        """CTC greedy: ambil argmax, buang blank (id 0) dan pengulangan."""
        peta = self.id2tok.get(level, {})
        ids = logits.argmax(-1).squeeze(0).tolist()
        keluar: list[str] = []
        sebelumnya = None
        for i in ids:
            if i != sebelumnya and i != 0:
                keluar.append(peta.get(i, f"<{i}>"))
            sebelumnya = i
        return keluar

    def _confidence(self, logits) -> float:
        import torch

        probs = torch.softmax(logits.float(), dim=-1)
        return float(probs.max(dim=-1).values.mean())
