import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const sections = [
  {
    title: "1. Titolare del trattamento",
    content: "NutriCoach AI è sviluppata e gestita da Thomas Scapini. Per qualsiasi richiesta relativa alla privacy: privacy@nutricoach.app",
  },
  {
    title: "2. Dati che raccogliamo",
    content: "Raccogliamo i seguenti dati personali:",
    list: [
      "Account: indirizzo email, foto profilo (tramite Google OAuth)",
      "Profilo: età, peso, altezza, sesso, livello di attività, obiettivi",
      "Diari alimentari: pasti, calorie, macronutrienti, peso corporeo",
      "Esercizi: tipo di esercizio, durata, calorie bruciate",
      "Benessere: umore, energia, qualità del sonno, stress",
      "Utilizzo: messaggi con il coach AI, streak, punteggi settimanali",
    ],
  },
  {
    title: "3. Come usiamo i dati",
    content: "I tuoi dati vengono utilizzati per:",
    list: [
      "Fornirti il servizio di tracking nutrizionale e il coach AI",
      "Calcolare i tuoi progressi e mostrarti statistiche personali",
      "Mostrare la classifica settimanale (solo nome e punteggio)",
      "Migliorare il servizio",
    ],
  },
  {
    title: "4. Condivisione dei dati",
    list: [
      "Anthropic (Claude AI): i tuoi messaggi vengono elaborati dall'API di Anthropic per generare le risposte del coach. Anthropic non conserva i dati per addestrare i modelli.",
      "Supabase: i tuoi dati sono salvati su Supabase (database cloud con sede in EU - Ireland).",
      "Vercel: l'app è ospitata su Vercel (USA) con trasferimento dati conforme GDPR.",
      "Non vendiamo mai i tuoi dati a terzi.",
    ],
  },
  {
    title: "5. Classifica settimanale",
    content: "La classifica mostra pubblicamente il tuo display name e punteggio settimanale agli altri utenti. Puoi cambiare il tuo display name nel profilo in qualsiasi momento.",
  },
  {
    title: "6. Conservazione dei dati",
    content: "I tuoi dati vengono conservati finché il tuo account è attivo. Puoi eliminare il tuo account e tutti i dati associati in qualsiasi momento dalla pagina Profilo.",
  },
  {
    title: "7. I tuoi diritti (GDPR)",
    content: "Hai il diritto di:",
    list: [
      "Accedere ai tuoi dati",
      "Correggere dati inesatti",
      "Eliminare il tuo account e tutti i dati",
      "Opporti al trattamento",
      "Portabilità dei dati",
    ],
    footer: "Per esercitare questi diritti: privacy@nutricoach.app",
  },
  {
    title: "8. Cookie e tracking",
    content: "NutriCoach non utilizza cookie di tracciamento o pubblicità. Utilizziamo solo cookie tecnici necessari per il funzionamento dell'app.",
  },
  {
    title: "9. Minori",
    content: "NutriCoach non è destinata a minori di 16 anni. Non raccogliamo consapevolmente dati di minori.",
  },
  {
    title: "10. Modifiche",
    content: "Ci riserviamo il diritto di aggiornare questa privacy policy. In caso di modifiche significative ti avviseremo tramite l'app.",
  },
];

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "white" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "24px" }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "14px", padding: "0 0 20px 0", fontFamily: "inherit" }}
        >
          <ChevronLeft style={{ width: "18px", height: "18px" }} />
          Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: "#16a34a", marginBottom: "4px" }}>🥗 NutriCoach AI</p>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>Privacy Policy</h1>
          <p style={{ fontSize: "13px", color: "#9ca3af" }}>Last updated: April 2026</p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {sections.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", marginBottom: "8px" }}>{s.title}</h2>
              {s.content && (
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: s.list ? "8px" : 0 }}>{s.content}</p>
              )}
              {s.list && (
                <ul style={{ paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "5px" }}>
                  {s.list.map((item, i) => (
                    <li key={i} style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>{item}</li>
                  ))}
                </ul>
              )}
              {s.footer && (
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginTop: "8px" }}>{s.footer}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: "0.5px solid #e5e7eb", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#9ca3af" }}>© 2026 NutriCoach AI · Thomas Scapini · privacy@nutricoach.app</p>
        </div>

      </div>
    </div>
  );
}
