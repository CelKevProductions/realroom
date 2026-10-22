import { runDesign, validateDesignInput } from "./model.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (body, status = 200) => Response.json(body, { status, headers });
const models = new Set(["gpt-6-astra", "gpt-6.1-sol"]);
async function bodyLimited(request, max = 9e6) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Demande vide.");
  let bytes = 0,
    parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      throw Object.assign(Error("Projet trop volumineux."), { status: 413 });
    }
    parts.push(value);
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
export function createDesignHandlers(config, runner = runDesign) {
  return {
    async GET() {
      const c = config();
      return json({
        configured: !!(c.key && c.accessCode),
        model: c.model || "gpt-6-astra",
        requiresCode: !!(c.key && c.accessCode),
        sessionKeySupported: true,
      });
    },
    async POST(request) {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return json({ error: "Origine refusée." }, 403);
      let input;
      try {
        input = validateDesignInput(await bodyLimited(request));
      } catch (e) {
        return json(
          { error: e instanceof SyntaxError ? "Projet illisible." : e.message },
          e.status || 400,
        );
      }
      const cfg = config(),
        sessionKey = request.headers.get("x-realroom-key"),
        code = request.headers.get("x-realroom-code");
      if (sessionKey && (sessionKey.length > 512 || /[\r\n]/.test(sessionKey)))
        return json({ error: "Clé invalide." }, 400);
      const key =
        sessionKey ||
        (cfg.accessCode && code === cfg.accessCode ? cfg.key : null);
      if (!key)
        return json(
          {
            code: "MODEL_NOT_CONFIGURED",
            error:
              cfg.key && cfg.accessCode
                ? "Saisissez le code de la démo ou votre clé API."
                : "La génération IA attend une connexion. Ajoutez une clé dans Connexion IA.",
          },
          503,
        );
      const requested = request.headers.get("x-realroom-model"),
        model = models.has(requested) ? requested : cfg.model || "gpt-6-astra";
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.signal.addEventListener("abort", abort, { once: true });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(c) {
          let closed = false;
          const emit = (event) => {
            if (!closed)
              try {
                c.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
              } catch {
                closed = true;
                controller.abort();
              }
          };
          const heartbeat = setInterval(
            () => emit({ type: "heartbeat" }),
            15000,
          );
          try {
            await runner(input, {
              key,
              model,
              emit,
              signal: controller.signal,
            });
          } catch (e) {
            emit({
              type: "error",
              error:
                e.name === "AbortError"
                  ? "Génération annulée."
                  : e.message || "La génération a échoué.",
            });
          } finally {
            clearInterval(heartbeat);
            request.signal.removeEventListener("abort", abort);
            if (!closed) {
              closed = true;
              c.close();
            }
          }
        },
        cancel() {
          controller.abort();
        },
      });
      return new Response(stream, {
        headers: {
          ...headers,
          "Content-Type": "application/x-ndjson; charset=utf-8",
        },
      });
    },
  };
}
