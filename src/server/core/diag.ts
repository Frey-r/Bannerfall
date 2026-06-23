import { context as devvitContext } from '@devvit/web/server';

/**
 * Diagnóstico TEMPORAL (quitar cuando se resuelva el bug de contexto).
 *
 * Registra qué headers `devvit-*` llegan a un request y qué campos de contexto
 * Devvit se resuelven. Sirve para distinguir la causa de los fallos gRPC
 * ("undefined undefined: undefined" / "No context found"):
 *
 *   • Si un request de cliente (/api/*) muestra headers + contexto completos y
 *     funciona, pero un request interno (/internal/menu, /internal/on-install)
 *     muestra MENOS headers (le falta la auth/metadata) → el problema es que los
 *     endpoints internos no reciben la metadata de auth de Devvit.
 *   • Si AMBOS muestran lo mismo y aun así fallan los gRPC → el problema es
 *     global (transporte/bundle), no específico de los endpoints internos.
 */
export function logDevvitDiag(label: string, req: { headers?: Record<string, unknown> }): void {
  const headerKeys = Object.keys(req?.headers ?? {})
    .filter((h) => h.toLowerCase().startsWith('devvit-'))
    .sort();

  const ctx: Record<string, unknown> = {};
  for (const field of ['subredditId', 'subredditName', 'userId', 'appName', 'appVersion'] as const) {
    try {
      ctx[field] = (devvitContext as Record<string, unknown>)[field];
    } catch (err) {
      ctx[field] = `<err: ${(err as Error)?.message ?? String(err)}>`;
    }
  }

  console.log(`[diag:${label}] devvit-headers(${headerKeys.length}): [${headerKeys.join(', ')}]`);
  console.log(`[diag:${label}] context: ${JSON.stringify(ctx)}`);
}
