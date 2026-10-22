"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  roomFromPiece,
  sceneFromPiece,
  briefFromPiece,
  pieceFromScene,
} from "@/lib/design-adapter.mjs";
import { evaluate } from "@/lib/validation.mjs";
import { assess } from "@/lib/design-quality.mjs";
import { CATALOG } from "@/lib/catalog.mjs";
import { EXAMPLE_SCENE, EXAMPLE_ROOM } from "@/lib/examples.mjs";
import { exportDXF } from "@/lib/dxf.mjs";
import {
  piece as localPiece,
  ecrire,
  publique,
} from "@/components/demo/magasin.js";
import Plan from "@/components/Plan.jsx";
import Editeur3D from "./Editeur3D.js";
import {
  getDesignConnection,
  setDesignConnection,
  designHeaders,
  designRequest,
  captureCandidateViews,
  inspirationViews,
} from "./design-client.js";
import s from "./DesignerIA.module.css";
const fingerprint = (p) => JSON.stringify([p.modele, p.agencement]);
const clone = (x) => structuredClone(x);
const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function useDesignerIA({
  piece,
  items,
  setPiece,
  onBusy,
  onMessage,
  onImport,
}) {
  const [active, setActive] = useState(false),
    [modal, setModal] = useState(null),
    [verified, setVerified] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [bundle, setBundle] = useState(null),
    [selected, setSelected] = useState(0),
    [history, setHistory] = useState([]),
    [undo, setUndo] = useState([]),
    [input, setInput] = useState(""),
    [settings, setSettings] = useState(getDesignConnection),
    [server, setServer] = useState(null),
    [autoReview, setAutoReview] = useState(true);
  const abort = useRef(null),
    state = useRef(null);
  state.current = { piece, items };
  const currentReport = useMemo(() => {
    if (!piece.proposition?.design) return null;
    try {
      return assess(
        roomFromPiece(piece),
        sceneFromPiece(piece, items),
        piece.proposition.design.brief || briefFromPiece(piece),
        evaluate,
      );
    } catch (e) {
      return { errors: 1, warnings: 0, reason: e.message };
    }
  }, [piece.modele, piece.proposition, items]);
  const roomKey = JSON.stringify([
    piece.modele?.dims,
    piece.modele?.contour,
    Object.entries(piece.modele?.murs || {}).map(([id, m]) => [
      id,
      m.ouvertures,
    ]),
  ]);
  useEffect(() => {
    setActive(/^\/[a-z]{2}\/demo(\/|$)/.test(location.pathname));
    fetch("/api/design")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => {});
    return () => abort.current?.abort();
  }, []);
  useEffect(() => setVerified(false), [roomKey]);
  const occupied = (value) => {
    setBusy(value);
    onBusy(value);
  };
  const event = (e) => {
    if (e.type === "progress") setStatus(e.stage);
  };
  function source() {
    return clone(
      localPiece(piece.id) || {
        ...state.current.piece,
        agencement: state.current.items,
      },
    );
  }
  function fail(e) {
    setError(
      e.name === "AbortError"
        ? "Calcul annulé."
        : e.message || "La demande a échoué.",
    );
    if (e.code === "MODEL_NOT_CONFIGURED") setModal("settings");
  }
  async function generate(choices = {}, message = "") {
    if (busy) return;
    setError("");
    setModal("results");
    setStatus("Lecture du plan et du brief…");
    setBundle(null);
    if (!verified) {
      setError(
        "Vérifiez le plan et cochez la confirmation des dimensions avant de lancer la composition.",
      );
      return;
    }
    const c = new AbortController();
    abort.current = c;
    occupied(true);
    try {
      const original = source(),
        room = roomFromPiece(original, true),
        brief = briefFromPiece(original, choices),
        kept =
          choices.mode === "partiel"
            ? original.agencement
                .filter((i) => !choices.aRemplacer?.includes(i.id))
                .map((i) => i.id)
            : choices.garder || [],
        scene = sceneFromPiece(original, original.agencement, kept);
      const messages = message
        ? [...history, { role: "user", content: message }].slice(-12)
        : [];
      if (message) setHistory(messages);
      let result = await designRequest(
        {
          operation: message ? "edit" : "create",
          room,
          brief,
          scene,
          message,
          history: messages,
          images: await inspirationViews(original),
        },
        { signal: c.signal, onEvent: event },
      );
      const next = {
        ...result,
        room,
        brief,
        original,
        fingerprint: fingerprint(original),
      };
      setBundle(next);
      setSelected(0);
      if (autoReview && result.candidates.some((x) => x.report.valid)) {
        setStatus("Préparation des vues des propositions…");
        // Wait for React to mount the exact plan SVGs before taking snapshots.
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const candidates = result.candidates.slice(0, 3),
          images = await captureCandidateViews(
            candidates,
            original,
            room,
            c.signal,
          );
        if (images.length) {
          const reviewed = await designRequest(
            {
              operation: "review",
              room,
              brief,
              scene,
              candidates,
              images,
              message,
              history: messages,
            },
            { signal: c.signal, onEvent: event },
          );
          const best = reviewed.candidates[0];
          if (best.report.valid) {
            result = {
              ...reviewed,
              candidates: [best, ...result.candidates].slice(0, 4),
            };
            setBundle({ ...next, ...result });
          } else
            setError(
              "La révision conserve des conflits. Les propositions initiales restent disponibles.",
            );
        }
      }
      if (message)
        setHistory((h) =>
          [...h, { role: "assistant", content: result.message }].slice(-12),
        );
      setStatus(
        "Propositions prêtes. Consultez les contrôles avant d’appliquer.",
      );
    } catch (e) {
      fail(e);
    } finally {
      occupied(false);
      abort.current = null;
    }
  }
  function persist(next) {
    const p = localPiece(piece.id);
    if (!p)
      throw Error("Cette intégration est disponible dans la démo RealRoom.");
    ecrire(() =>
      Object.assign(p, next, {
        maj_le: new Date().toISOString(),
        version_scene: (p.version_scene || 0) + 1,
      }),
    );
    setPiece(publique(p));
  }
  function apply() {
    try {
      const candidate = bundle?.candidates[selected];
      if (!candidate?.report.valid)
        throw Error(
          "Cette proposition contient des conflits et ne peut pas être appliquée.",
        );
      const now = source();
      if (fingerprint(now) !== bundle.fingerprint)
        throw Error(
          "La pièce a changé pendant la conception. Relancez pour préserver vos dernières modifications.",
        );
      const report = assess(
        bundle.room,
        candidate.scene,
        bundle.brief,
        evaluate,
      );
      if (!report.valid)
        throw Error("Les contrôles doivent être résolus avant application.");
      setUndo((u) => [...u, now].slice(-8));
      persist(pieceFromScene(now, candidate.scene, report, bundle.brief));
      setModal(null);
      onMessage(
        "Composition appliquée. Vous pouvez la retoucher dans la barre de commande.",
      );
    } catch (e) {
      fail(e);
    }
  }
  function restore() {
    try {
      const previous = undo.at(-1);
      if (!previous) return;
      persist(previous);
      setUndo((u) => u.slice(0, -1));
      setBundle(null);
      onMessage("Composition précédente rétablie.");
    } catch (e) {
      fail(e);
    }
  }
  function example() {
    try {
      const original = source(),
        room = roomFromPiece(original, true);
      if (JSON.stringify(room.polygon) !== JSON.stringify(EXAMPLE_ROOM.polygon))
        throw Error(
          "Cet exemple correspond uniquement au plan témoin de 7,20 × 5,60 m.",
        );
      const scene = clone(EXAMPLE_SCENE),
        brief = {
          roomType: "salon",
          activities: ["lecture", "musique"],
          wishes: "Exemple préparé manuellement",
          budget: 0,
          seats: 4,
        };
      setBundle({
        room,
        brief,
        original,
        fingerprint: fingerprint(original),
        message:
          "Exemple composé manuellement pour tester l’éditeur, les contrôles et les exports. Aucune IA n’a été appelée.",
        candidates: [
          { scene, report: assess(room, scene, brief, evaluate), changes: [] },
        ],
      });
      setSelected(0);
      setModal("results");
      setError("");
    } catch (e) {
      fail(e);
    }
  }
  function exportProject(type) {
    try {
      const current = source(),
        room = roomFromPiece(current),
        scene = sceneFromPiece(current),
        brief = briefFromPiece(current),
        report = assess(room, scene, brief, evaluate);
      if (type === "dxf")
        download(
          "realroom-amenage.dxf",
          exportDXF(room, scene),
          "application/dxf",
        );
      else
        download(
          "realroom-projet.json",
          JSON.stringify(
            { version: "realroom-design-v1", room, scene, brief, report },
            null,
            2,
          ),
          "application/json",
        );
    } catch (e) {
      fail(e);
      setModal("settings");
    }
  }
  const panel = active && (
    <div className={s.panel}>
      <b>Conception IA · atelier expérimental</b>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={verified}
          disabled={busy}
          onChange={(e) => setVerified(e.target.checked)}
        />
        J’ai vérifié les cotes, les portes, les fenêtres et la hauteur.
      </label>
      <p className="discret petit">
        Le plan reste fixe. Les meubles du catalogue conservent leurs
        dimensions.
      </p>
      <div className={s.tools}>
        <button
          type="button"
          onClick={() => {
            setError("");
            setModal("settings");
          }}
        >
          Connexion IA
        </button>
        <button type="button" onClick={onImport} disabled={busy}>
          Importer un DXF
        </button>
        <button type="button" disabled={!undo.length || busy} onClick={restore}>
          Annuler la retouche
        </button>
        <button type="button" onClick={() => exportProject("dxf")}>
          Exporter DXF
        </button>
        <button type="button" onClick={() => exportProject("json")}>
          Exporter le projet
        </button>
      </div>
      {!getDesignConnection().key && !server?.configured && (
        <p className={s.note}>
          Connexion IA à ajouter. L’exemple et l’éditeur sont disponibles.
        </p>
      )}
      <a
        href="/examples/salon-lecture-musique.dxf"
        download
        className="btn btn--lien btn--petit"
      >
        Télécharger le DXF témoin
      </a>
      <button
        type="button"
        className="btn btn--lien btn--petit"
        onClick={example}
      >
        Voir l’exemple aménagé · sans IA
      </button>
    </div>
  );
  const dialog = active && modal && (
    <DesignerDialog
      modal={modal}
      close={() => {
        if (!busy) setModal(null);
      }}
      {...{
        error,
        status,
        busy,
        bundle,
        selected,
        setSelected,
        apply,
        settings,
        setSettings,
        server,
        autoReview,
        setAutoReview,
        history,
        input,
        setInput,
      }}
      cancel={() => abort.current?.abort()}
      configure={async () => {
        setError("");
        setDesignConnection(settings);
        if (!settings.key) {
          setStatus(
            settings.code
              ? "Code conservé pour cette session."
              : "Connexion effacée.",
          );
          return;
        }
        try {
          const r = await fetch("/api/connection", {
            method: "POST",
            headers: designHeaders(),
          });
          const body = await r.json();
          if (!r.ok) throw Error(body.error);
          setStatus(
            "Connexion vérifiée. Vous pouvez fermer cette fenêtre et composer.",
          );
        } catch (e) {
          fail(e);
        }
      }}
      send={() => {
        if (input.trim()) {
          const text = input.trim();
          setInput("");
          generate({}, text);
        }
      }}
      openSettings={() => setModal("settings")}
    />
  );
  return {
    active,
    currentReport,
    panel,
    dialog,
    busy,
    generate,
    command: (text) => {
      generate({}, text);
      return true;
    },
  };
}

function DesignerDialog({
  modal,
  close,
  error,
  status,
  busy,
  bundle,
  selected,
  setSelected,
  apply,
  settings,
  setSettings,
  server,
  autoReview,
  setAutoReview,
  configure,
  cancel,
  history,
  input,
  setInput,
  send,
  openSettings,
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  const candidate = bundle?.candidates[selected],
    preview = candidate
      ? pieceFromScene(bundle.original, candidate.scene)
      : null;
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="designer-title"
    >
      <header>
        <h2 id="designer-title">
          {modal === "settings"
            ? "Connexion à votre modèle"
            : "Votre pièce, vos propositions"}
        </h2>
        <button
          type="button"
          onClick={close}
          disabled={busy}
          aria-label="Fermer"
        >
          ×
        </button>
      </header>
      {modal === "settings" ? (
        <div className={s.settings}>
          <p>
            La clé est utilisée uniquement pendant cet onglet. Elle est envoyée
            au serveur de cette démo, puis à OpenAI. Les appels utilisent les
            crédits de votre compte API.
          </p>
          <label>
            Modèle
            <select
              value={settings.model}
              onChange={(e) =>
                setSettings((v) => ({ ...v, model: e.target.value }))
              }
            >
              <option value="gpt-6-astra">GPT‑6 Astra</option>
              <option value="gpt-6.1-sol">GPT‑6.1 Sol</option>
            </select>
          </label>
          <label>
            Clé API de session
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={settings.key}
              onChange={(e) =>
                setSettings((v) => ({ ...v, key: e.target.value }))
              }
              placeholder="Clé API"
            />
          </label>
          {server?.requiresCode && (
            <label>
              Code de la démo
              <input
                type="password"
                autoComplete="off"
                value={settings.code}
                onChange={(e) =>
                  setSettings((v) => ({ ...v, code: e.target.value }))
                }
              />
            </label>
          )}
          <label className={s.check}>
            <input
              type="checkbox"
              checked={autoReview}
              onChange={(e) => setAutoReview(e.target.checked)}
            />
            Comparer et réviser les propositions à partir des plans et des vues
            3D disponibles.
          </label>
          <p className="discret petit">
            Une composition peut demander plusieurs appels : trois propositions,
            corrections géométriques, puis révision visuelle. Les vues 3D
            nécessitent WebGL.
          </p>
          <button className="btn btn--plein" type="button" onClick={configure}>
            {settings.key
              ? "Vérifier et utiliser cette clé"
              : "Enregistrer la connexion"}
          </button>
        </div>
      ) : (
        <>
          <p className={s.status} role="status">
            {status ||
              (bundle?.candidates.length === 1
                ? "Composition et contrôles."
                : "Trois partis pris, leurs plans et leurs contrôles.")}
          </p>
          {bundle && (
            <>
              <p>{bundle.message}</p>
              <div className={s.candidates}>
                {bundle.candidates.map((c, i) => (
                  <button
                    key={c.scene.id + "-" + i}
                    type="button"
                    className={selected === i ? s.selected : ""}
                    onClick={() => setSelected(i)}
                  >
                    <Plan
                      room={bundle.room}
                      scene={c.scene}
                      id={"design-candidate-" + i}
                    />
                    <b>{c.scene.title}</b>
                    <small>
                      {c.report.errors} conflit(s) · {c.report.warnings}{" "}
                      point(s) à vérifier
                    </small>
                  </button>
                ))}
              </div>
              {candidate && (
                <div className={s.detail}>
                  <div className={s.preview}>
                    <Editeur3D
                      key={selected}
                      modele={preview.modele}
                      items={preview.agencement}
                      vue="dessus"
                      erreurWebgl="La vue 3D requiert WebGL. Le plan coté reste disponible."
                    />
                  </div>
                  <div>
                    <h3>{candidate.scene.title}</h3>
                    <p>{candidate.scene.intent}</p>
                    <ul>
                      {candidate.scene.rationale.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <p className={s.note}>
                      {candidate.scene.provenance?.kind === "example"
                        ? "Exemple préparé manuellement"
                        : candidate.scene.provenance?.visualReview
                          ? "Révision sur plans et maquettes 3D effectuée"
                          : candidate.scene.provenance?.planReview
                            ? "Révision sur plans 2D effectuée"
                            : "Composition à examiner"}
                    </p>
                    <details open={!candidate.report.valid}>
                      <summary>Contrôles et limites</summary>
                      <p>{candidate.report.note}</p>
                      <ul>
                        {candidate.report.issues.map((x, i) => (
                          <li key={i}>{x.message}</li>
                        ))}
                        {candidate.scene.limitations.map((l, i) => (
                          <li key={"limit" + i}>{l}</li>
                        ))}
                      </ul>
                      <p>
                        {candidate.report.functional?.unpriced || 0}{" "}
                        référence(s) sans prix commercial confirmé.
                      </p>
                    </details>
                    {!!candidate.changes?.length && (
                      <details open>
                        <summary>Modifications proposées</summary>
                        <ul>
                          {candidate.changes.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <details>
                      <summary>
                        {candidate.scene.items.length} meubles et objets
                      </summary>
                      <ol>
                        {candidate.scene.items.map((i) => (
                          <li key={i.id}>
                            {CATALOG[i.sku].nom} ·{" "}
                            {CATALOG[i.sku].dim
                              .map((v) => Math.round(v * 100))
                              .join(" × ")}{" "}
                            cm
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                </div>
              )}
            </>
          )}
          {!!history.length && (
            <details className={s.chat} open>
              <summary>Conversation</summary>
              {history.map((m, i) => (
                <p key={i}>
                  <b>{m.role === "user" ? "Vous" : "RealRoom"} · </b>
                  {m.content}
                </p>
              ))}
            </details>
          )}
          <form
            className={s.chatForm}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              aria-label="Retoucher la pièce"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={5000}
              placeholder="Une ambiance plus chaleureuse, un coin musique…"
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Proposer la retouche
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {modal === "settings" && status && <p role="status">{status}</p>}
      <footer>
        {busy ? (
          <button type="button" onClick={cancel}>
            Annuler le calcul
          </button>
        ) : (
          <button type="button" onClick={close}>
            Fermer
          </button>
        )}
        {modal !== "settings" && (
          <>
            <button type="button" onClick={openSettings} disabled={busy}>
              Connexion IA
            </button>
            <button
              className="btn btn--plein"
              type="button"
              disabled={busy || !candidate?.report.valid}
              onClick={apply}
            >
              Appliquer cette proposition
            </button>
          </>
        )}
      </footer>
    </dialog>
  );
}
