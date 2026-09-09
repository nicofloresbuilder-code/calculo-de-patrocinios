import { Alert, Card, LinkButton } from "@/components/ui";
import { PageBody } from "@/components/shell";

export const metadata = { title: "No se pudo iniciar sesión" };

export default function AuthErrorPage() {
  return (
    <PageBody>
      <div className="mx-auto max-w-lg pt-10">
        <Card title="Inicio de sesión">
          <Alert tone="danger" title="No se pudo iniciar sesión">
            El proveedor rechazó la autenticación o el enlace expiró. Vuelve a
            intentarlo desde la pantalla principal.
          </Alert>
          <div className="mt-4">
            <LinkButton href="/" variant="primary" size="sm" icon="chevronLeft">
              Volver a Aforo
            </LinkButton>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}
