import { Header } from "@/components/Header";
import { Cotizador } from "@/components/Cotizador";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <Cotizador />
    </div>
  );
}
