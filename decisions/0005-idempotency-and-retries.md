# ADR-0005: Idempotencia y reintentos

## Status
Accepted

## Context
La red móvil reintenta peticiones tras timeouts. Sin protección, un reintento podría acuñar dos
generales, acreditar dos veces una victoria o reclamar dos veces la recompensa diaria. El servidor
es serverless y puede recibir el mismo efecto desde dos invocaciones.

## Decision
- **Token de idempotencia obligatorio** en todo endpoint mutador (submit run, resolver batalla,
  reclamar diario, subir consejero). El cliente genera el token una vez por acción lógica y lo
  reusa en los reintentos.
- **Guarda con `SETNX idemp:{token}` + TTL.** Si la clave no existía, se procesa y se cachea el
  resultado asociado al token; si ya existía, se devuelve el resultado cacheado sin re-aplicar.
- **Claves de efecto naturales** cuando aplica: un reclamo se ancla a `user:{id}:daily:{fecha}` y
  un crédito de batalla a `battle:{bid}`, de modo que la unicidad no dependa solo del token de
  transporte sino del dominio.
- **Reintento del cliente** con backoff exponencial acotado ante errores transitorios.

## Consequences
- Reintentos seguros: efecto único garantizado por la combinación token + clave de dominio.
- Los resultados deben ser serializables y cacheables por token durante el TTL.
- El TTL de idempotencia debe cubrir la ventana realista de reintentos sin inflar Redis.

## Alternatives considered
- **Detección por hash del payload**: frágil ante payloads que cambian entre reintentos. Rechazado
  en favor de tokens explícitos.
- **Sin idempotencia, confiar en que el cliente no reintente**: irreal en móvil. Rechazado.
