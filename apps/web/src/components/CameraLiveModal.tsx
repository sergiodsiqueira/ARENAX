import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getCameraLive } from "../lib/api";
import { useModalEscape } from "../hooks/use-modal-escape";
import { ModalCloseButton } from "./ui/modal-close-button";

type CameraLiveModalProps = {
  cameraId: string;
  cameraName: string;
  spaceName: string;
  onClose: () => void;
};

export function CameraLiveModal({ cameraId, cameraName, spaceName, onClose }: CameraLiveModalProps) {
  useModalEscape(true, onClose);
  const live = useQuery({
    queryKey: ["camera-live", cameraId],
    queryFn: () => getCameraLive(cameraId),
    retry: 1,
  });

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 px-4">
    <section className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white" role="dialog" aria-modal="true" aria-label={`Transmissão ao vivo de ${cameraName}`}>
      <header className="flex justify-between p-4">
        <div><h2 className="font-semibold">{cameraName} · Ao vivo</h2><p className="text-sm text-slate-500">{spaceName}</p></div>
        <ModalCloseButton onClick={onClose} label="Fechar transmissão ao vivo" />
      </header>
      {live.data ? <iframe className="aspect-video w-full bg-black" src={live.data.url} allow="autoplay; fullscreen" title={`Transmissão ao vivo de ${cameraName}`} /> : <div className="grid aspect-video place-items-center bg-slate-950 text-white">{live.isLoading ? "Conectando…" : live.error instanceof Error ? live.error.message : "Indisponível"}</div>}
      {live.data && <a className="flex items-center gap-1 p-3 text-sm text-emerald-700" href={live.data.url} target="_blank" rel="noreferrer">Abrir em nova aba <ExternalLink size={14} /></a>}
    </section>
  </div>;
}
