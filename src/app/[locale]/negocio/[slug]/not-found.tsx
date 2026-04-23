import Link from "next/link";

export default function NegocioNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] px-6">
      <div className="max-w-md text-center">
        <h1 className="mb-3 font-display text-[32px] text-[#1A1A1A]">
          Negocio no encontrado
        </h1>
        <p className="mb-6 text-sm text-[#6B6B6B]">
          Este perfil de negocio no existe o ha sido eliminado.
        </p>
        <Link
          href="/es/buscar"
          className="rounded-full bg-[#E8824A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
        >
          Volver a la búsqueda
        </Link>
      </div>
    </div>
  );
}
