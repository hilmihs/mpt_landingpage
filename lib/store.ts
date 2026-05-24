import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FormData } from "@/types";

interface AssessmentState {
  consentGiven: boolean;
  audioBlob: Blob | null;
  audioDurationSec: number;
  formData: Partial<FormData>;
  submissionId: string | null;
  rapotSlug: string | null;
  setConsent: (v: boolean) => void;
  setAudio: (blob: Blob, durationSec: number) => void;
  clearAudio: () => void;
  setFormData: (data: Partial<FormData>) => void;
  setSubmission: (submissionId: string, rapotSlug: string) => void;
  reset: () => void;
}

// sessionStorage instead of localStorage — privacy: audio gone when tab closed
const sessionStorageProvider = () => {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage;
};

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      consentGiven: false,
      audioBlob: null,
      audioDurationSec: 0,
      formData: {},
      submissionId: null,
      rapotSlug: null,
      setConsent: (v) => set({ consentGiven: v }),
      setAudio: (blob, durationSec) =>
        set({ audioBlob: blob, audioDurationSec: durationSec }),
      clearAudio: () => set({ audioBlob: null, audioDurationSec: 0 }),
      setFormData: (data) =>
        set((s) => ({ formData: { ...s.formData, ...data } })),
      setSubmission: (submissionId, rapotSlug) =>
        set({ submissionId, rapotSlug }),
      reset: () =>
        set({
          consentGiven: false,
          audioBlob: null,
          audioDurationSec: 0,
          formData: {},
          submissionId: null,
          rapotSlug: null,
        }),
    }),
    {
      name: "mptilawah-assessment",
      storage: createJSONStorage(sessionStorageProvider as never),
      // Don't persist Blob (cannot serialize)
      partialize: (state) => ({
        consentGiven: state.consentGiven,
        formData: state.formData,
        submissionId: state.submissionId,
        rapotSlug: state.rapotSlug,
      }),
    },
  ),
);
