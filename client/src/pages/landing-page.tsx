import { Link } from "wouter";
import { FileText, Sparkles, ShieldCheck, BarChart3, Lock, ScrollText, CheckCircle2, ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(-2deg); }
        }
        .gradient-text {
          background: linear-gradient(135deg, #4F46E5, #7C3AED, #4F46E5);
          background-size: 200% 200%;
          animation: gradient-shift 6s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-bg {
          background: radial-gradient(ellipse at 30% 20%, rgba(79, 70, 229, 0.08) 0%, transparent 50%),
                      radial-gradient(ellipse at 70% 80%, rgba(124, 58, 237, 0.06) 0%, transparent 50%),
                      radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.04) 0%, transparent 70%);
        }
        .float-shape-1 { animation: float-slow 8s ease-in-out infinite; }
        .float-shape-2 { animation: float-slower 10s ease-in-out infinite; }
      `}</style>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <FileText className="h-7 w-7 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">Turbo Contract</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#funzionalita" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Funzionalità</a>
              <a href="#sicurezza" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Sicurezza</a>
              <a href="#come-funziona" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Come Funziona</a>
            </div>

            <div className="hidden md:block">
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-200 cursor-pointer">
                  Accedi
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
            <a href="#funzionalita" className="block text-sm font-medium text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Funzionalità</a>
            <a href="#sicurezza" className="block text-sm font-medium text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Sicurezza</a>
            <a href="#come-funziona" className="block text-sm font-medium text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Come Funziona</a>
            <Link href="/auth">
              <span className="block w-full text-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl cursor-pointer">Accedi</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center hero-bg pt-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="float-shape-1 absolute top-1/4 left-[10%] w-72 h-72 bg-indigo-100/40 rounded-full blur-3xl" />
          <div className="float-shape-2 absolute bottom-1/4 right-[10%] w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
          <div className="float-shape-1 absolute top-1/2 right-[30%] w-48 h-48 bg-purple-100/20 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center py-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-8 border border-indigo-100">
            <Sparkles className="h-4 w-4" />
            Piattaforma AI per contratti digitali
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6">
            Contratti Digitali.{" "}
            <span className="gradient-text">Semplici. Sicuri.</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Gestisci template intelligenti, genera contratti con AI, raccogli firme digitali OTP. 
            Tutto in un'unica piattaforma sicura e conforme GDPR.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-indigo-200 transition-all text-lg cursor-pointer">
                Inizia Ora
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
            <a
              href="#funzionalita"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all text-lg"
            >
              Scopri di più
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funzionalita" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tutto ciò che ti serve per i <span className="gradient-text">tuoi contratti</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Strumenti avanzati per creare, gestire e firmare contratti digitali in modo professionale.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles className="h-7 w-7" />,
                title: "Generazione AI",
                description: "Template intelligenti generati con AI integrata. Crea contratti complessi in pochi secondi con clausole personalizzate.",
                color: "indigo",
              },
              {
                icon: <ShieldCheck className="h-7 w-7" />,
                title: "Firma Digitale OTP",
                description: "Firma sicura con verifica SMS tramite codice OTP. Validità legale garantita con audit trail completo.",
                color: "violet",
              },
              {
                icon: <BarChart3 className="h-7 w-7" />,
                title: "Dashboard Premium",
                description: "Analytics avanzate e gestione completa. Monitora lo stato dei contratti, scadenze e rinnovi automatici.",
                color: "purple",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300"
              >
                <div className={`inline-flex p-3 rounded-xl mb-6 ${
                  feature.color === "indigo" ? "bg-indigo-50 text-indigo-600" :
                  feature.color === "violet" ? "bg-violet-50 text-violet-600" :
                  "bg-purple-50 text-purple-600"
                }`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-indigo-600 transition-colors">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="come-funziona" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Come <span className="gradient-text">funziona</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Tre semplici passaggi per digitalizzare i tuoi contratti.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-purple-200" />

            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                { step: "01", title: "Crea il Template", description: "Progetta template personalizzati con campi dinamici e clausole modulari.", icon: <ScrollText className="h-6 w-6" /> },
                { step: "02", title: "Genera il Contratto", description: "Compila automaticamente i dati e genera contratti professionali con AI.", icon: <FileText className="h-6 w-6" /> },
                { step: "03", title: "Firma Digitale", description: "Il cliente firma con OTP via SMS. Documento certificato e archiviato.", icon: <CheckCircle2 className="h-6 w-6" /> },
              ].map((item, i) => (
                <div key={i} className="text-center relative">
                  <div className="relative z-10 inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white mb-6 shadow-lg shadow-indigo-200">
                    <div className="text-center">
                      <div className="text-xs font-medium opacity-70">STEP</div>
                      <div className="text-2xl font-bold">{item.step}</div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="sicurezza" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Sicurezza di <span className="gradient-text">livello enterprise</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              I tuoi contratti sono protetti con i più alti standard di sicurezza.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: <ShieldCheck className="h-8 w-8" />, title: "GDPR Compliant", description: "Piena conformità al regolamento europeo sulla protezione dei dati personali." },
              { icon: <Lock className="h-8 w-8" />, title: "Crittografia End-to-End", description: "Tutti i dati sono cifrati in transito e a riposo con standard AES-256." },
              { icon: <ScrollText className="h-8 w-8" />, title: "Audit Trail Completo", description: "Tracciamento di ogni azione con timestamp certificato e non modificabile." },
            ].map((badge, i) => (
              <div key={i} className="text-center p-8 bg-white rounded-2xl border border-gray-100">
                <div className="inline-flex p-4 rounded-2xl bg-indigo-50 text-indigo-600 mb-5">
                  {badge.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{badge.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="float-shape-1 absolute top-0 left-[20%] w-64 h-64 bg-white/5 rounded-full blur-2xl" />
          <div className="float-shape-2 absolute bottom-0 right-[20%] w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Pronto a digitalizzare i tuoi contratti?
          </h2>
          <p className="text-lg text-white/80 mb-10">
            Registra la tua azienda in pochi minuti e inizia subito a creare contratti digitali professionali.
          </p>
          <Link href="/auth">
            <span className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 font-semibold rounded-xl hover:shadow-2xl transition-all text-lg cursor-pointer">
              Registra la tua Azienda
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" />
              <span className="font-semibold text-white">Turbo Contract</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#funzionalita" className="hover:text-white transition-colors">Funzionalità</a>
              <a href="#sicurezza" className="hover:text-white transition-colors">Sicurezza</a>
              <a href="#come-funziona" className="hover:text-white transition-colors">Come Funziona</a>
              <Link href="/auth"><span className="hover:text-white transition-colors cursor-pointer">Accedi</span></Link>
            </div>
            <p className="text-sm">© 2026 Turbo Contract. Tutti i diritti riservati.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}