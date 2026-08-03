"""
Mu'alim model loader & inference.

Pre-trained: obadx/muaalem-model-v3_2 (Hugging Face, ~2.4 GB).

⚠️ KOREKSI DARI SPEC ⚠️
Spec menyebut "TorchScript ready" — itu KELIRU. Model card HF menunjukkan ini
model TRANSFORMERS (wav2vec2-BERT, arsitektur custom `Wav2Vec2BertForMultilevelCTC`,
safetensors), bukan TorchScript. Loading pakai transformers + trust_remote_code,
BUKAN torch.jit.load.

⚠️ STATUS: BEST-EFFORT, BELUM TERVERIFIKASI TANPA GPU + MODEL ⚠️
Kode di bawah ditulis dari model card, tapi BELUM dijalankan dengan model asli.
Output multi-level CTC (phoneme + sifa) butuh investigasi runtime. Sebelum wire
ke produksi, smoke test:  python scripts/test_inference.py path/to/audio.webm
lalu sesuaikan _decode_outputs() ke struktur output model yang sebenarnya.
"""
from __future__ import annotations

import logging

import torch
from huggingface_hub import snapshot_download

from app.config import settings

log = logging.getLogger(__name__)


class MualimEngine:
    def __init__(self, model_id: str | None = None):
        self.model_id = model_id or settings.mualim_model_id
        self.model = None
        self.processor = None
        self.device: torch.device | None = None

    def _resolve_device(self) -> torch.device:
        if settings.device == "cuda":
            return torch.device("cuda")
        if settings.device == "cpu":
            return torch.device("cpu")
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    async def load(self):
        log.info(f"Loading Mualim model: {self.model_id}")
        self.device = self._resolve_device()
        log.info(f"Using device: {self.device}")

        model_path = snapshot_download(
            repo_id=self.model_id,
            cache_dir=settings.mualim_cache_dir,
        )
        log.info(f"Model files at: {model_path}")

        # Processor / feature extractor (wav2vec2-BERT → SeamlessM4TFeatureExtractor
        # atau AutoProcessor; coba berurutan).
        self.processor = self._load_processor(model_path)

        # Model: arsitektur custom multi-level CTC → butuh trust_remote_code.
        self.model = self._load_model(model_path)
        self.model.to(self.device).eval()
        log.info(f"Mualim loaded OK: {type(self.model).__name__}")

    def _load_processor(self, model_path: str):
        from transformers import AutoFeatureExtractor, AutoProcessor

        for loader, name in (
            (AutoProcessor, "AutoProcessor"),
            (AutoFeatureExtractor, "AutoFeatureExtractor"),
        ):
            try:
                proc = loader.from_pretrained(model_path, trust_remote_code=True)
                log.info(f"Processor loaded via {name}")
                return proc
            except Exception as e:  # noqa: BLE001
                log.warning(f"{name} gagal: {e}")
        raise RuntimeError(
            "Tidak bisa load processor/feature-extractor Mu'alim. "
            "Cek model card HF untuk preprocessing yang benar."
        )

    def _load_model(self, model_path: str):
        # Strategi 1: AutoModel + trust_remote_code (custom Wav2Vec2BertForMultilevelCTC)
        try:
            from transformers import AutoModel

            m = AutoModel.from_pretrained(model_path, trust_remote_code=True)
            log.info("Model loaded via AutoModel(trust_remote_code=True)")
            return m
        except Exception as e:  # noqa: BLE001
            log.warning(f"AutoModel gagal: {e}")

        # Strategi 2: AutoModelForCTC
        try:
            from transformers import AutoModelForCTC

            m = AutoModelForCTC.from_pretrained(model_path, trust_remote_code=True)
            log.info("Model loaded via AutoModelForCTC")
            return m
        except Exception as e:  # noqa: BLE001
            log.warning(f"AutoModelForCTC gagal: {e}")

        raise RuntimeError(
            "Tidak bisa load model Mu'alim dengan strategi yang ada. "
            "Investigasi struktur repo (lihat scripts/download_model.py output) "
            "dan model card https://huggingface.co/obadx/muaalem-model-v3_2"
        )

    @torch.inference_mode()
    async def predict(self, audio: torch.Tensor) -> dict:
        """
        Args:
            audio: 1D float32 tensor @ 16000 Hz

        Returns dict:
            - phonemes: list[str]
            - timestamps: list[tuple[float, float]] | None (frame→time, untuk word map)
            - sifa: list[dict] | None
            - confidence: float
        """
        if self.model is None or self.processor is None:
            raise RuntimeError("Model belum di-load")

        inputs = self.processor(
            audio.numpy(),
            sampling_rate=settings.target_sample_rate,
            return_tensors="pt",
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        outputs = self.model(**inputs)
        return self._decode_outputs(outputs)

    def _decode_outputs(self, outputs) -> dict:
        """
        Decode output model → phoneme sequence (+ sifa + confidence).

        ⚠️ TODO (sesi GPU): struktur `outputs` untuk multi-level CTC belum pasti.
        Asumsi sementara: outputs.logits [B, T, V] untuk level phoneme. Greedy CTC
        decode + collapse blank/repeat. Vocab id→token diambil dari processor /
        tokenizer model. SESUAIKAN setelah lihat output asli.
        """
        logits = getattr(outputs, "logits", None)
        if logits is None and isinstance(outputs, (tuple, list)):
            logits = outputs[0]
        if logits is None:
            raise RuntimeError(
                "Output model tidak punya .logits — multi-level CTC mungkin balas "
                "dict/struct lain. Investigasi runtime lalu sesuaikan _decode_outputs()."
            )

        probs = torch.softmax(logits, dim=-1)
        conf, ids = probs.max(dim=-1)  # [B, T]
        ids_seq = ids[0].tolist()
        confidence = float(conf[0].mean().item())

        blank_id = getattr(self.model.config, "pad_token_id", 0) or 0
        collapsed: list[int] = []
        prev = None
        for tok_id in ids_seq:
            if tok_id != prev and tok_id != blank_id:
                collapsed.append(tok_id)
            prev = tok_id

        phonemes = self._ids_to_tokens(collapsed)
        return {
            "phonemes": phonemes,
            "timestamps": None,  # TODO: derive dari frame index × hop bila perlu word-level akurat
            "sifa": None,        # TODO: ekstrak dari level sifa multi-CTC
            "confidence": confidence,
        }

    def _ids_to_tokens(self, ids: list[int]) -> list[str]:
        """Map token id → string via tokenizer/processor. Fallback: str(id)."""
        tok = getattr(self.processor, "tokenizer", None) or getattr(self.processor, "decoder", None)
        if tok is not None and hasattr(tok, "convert_ids_to_tokens"):
            try:
                return [str(t) for t in tok.convert_ids_to_tokens(ids)]
            except Exception:  # noqa: BLE001
                pass
        return [str(i) for i in ids]

    async def cleanup(self):
        if self.model is not None:
            del self.model
            self.model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
