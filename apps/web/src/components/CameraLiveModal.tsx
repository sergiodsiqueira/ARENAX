import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getCameraLive } from "../lib/api";
import { FormModal } from "./ui/form-modal";
import { ModalCloseButton } from "./ui/modal-close-button";

type CameraLiveModalProps = {
  cameraId: string;
  cameraName: string;
  spaceName: string;
  onClose: () => void;
};

export function CameraLiveModal({ cameraId, cameraName, spaceName, onClose }: CameraLiveModalProps) {
  const live = useQuery({
    queryKey: ["camera-live", cameraId],
    queryFn: () => getCameraLive(cameraId),
    retry: 1,
  });

  return <FormModal title={`Transmissão ao vivo de ${cameraName}`} onClose={onClose} size="xl">
    <section className="w-full overflow-hidden bg-card">
      <header className="flex justify-between p-4">
        <div><h2 className="font-semibold">{cameraName} · Ao vivo</h2><p className="text-sm text-muted-foreground">{spaceName}</p></div>
        <ModalCloseButton onClick={onClose} label="Fechar transmissão ao vivo" />
      </header>
      {live.data ? <iframe className="aspect-video w-full bg-media" src={live.data.url} allow="autoplay; fullscreen" title={`Transmissão ao vivo de ${cameraName}`} /> : <div className="grid aspect-video place-items-center bg-foreground text-primary-foreground">{live.isLoading ? "Conectando…" : live.error instanceof Error ? live.error.message : "Indisponível"}</div>}
      {live.data && <a className="flex items-center gap-1 p-3 text-sm text-primary" href={live.data.url} target="_blank" rel="noreferrer">Abrir em nova aba <ExternalLink size={14} /></a>}
    </section>
  </FormModal>;
}
