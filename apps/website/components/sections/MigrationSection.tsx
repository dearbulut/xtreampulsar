'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Terminal } from '@/components/ui/Terminal';

const STEPS = [
  { title: 'Lisans satın al', desc: 'Seçtiğin pakete göre ödeme yap, lisans anahtarın anında email\'e gelir.' },
  { title: 'Sunucunda tek komut çalıştır', desc: 'Ubuntu 22.04/24.04 üzerinde tek satır komut — Docker, FFmpeg, panel hepsi otomatik kurulur.' },
  { title: 'Eski panelden DB dump al', desc: 'Mevcut XtreamUI, XUI.ONE veya Xtream-Masters\'dan kullanıcı ve içerik dışa aktarımı yap.' },
  { title: 'Migration wizard\'a yükle', desc: 'Panel içi sihirbaz dosyayı işler, önizleme gösterir, onay verince aktar.' },
  { title: 'Yayındasın!', desc: 'Kullanıcıların aynı Xtream Codes bilgileriyle bağlanmaya devam eder. Sıfır kesinti.' },
];

const TERMINAL_LINES = [
  '$ curl -fsSL https://install.xtreampulsar.io | bash -s -- --key XP-XXXX-YYYY',
  '',
  '# XtreamPulsar Installer v1.0',
  '[1/9] Sistem hazırlanıyor...              ✓',
  '[2/9] Docker kuruluyor...                 ✓',
  '[3/9] FFmpeg kuruluyor...                 ✓',
  '[4/9] Lisans doğrulanıyor...              ✓',
  '[5/9] XtreamPulsar indiriliyor...         ✓',
  '[6/9] Veritabanı başlatılıyor...          ✓',
  '[7/9] Servisler başlatılıyor...           ✓',
  '[8/9] SSL sertifikası alınıyor...         ✓',
  '[9/9] Firewall yapılandırılıyor...        ✓',
  '',
  '✓ XtreamPulsar hazır!',
  '  Panel URL  : https://panel.domain.com',
  '  Xtream API : http://panel.domain.com:25461',
  '  Admin şifre: (email\'e gönderildi)',
];

export function MigrationSection() {
  return (
    <section id="migration" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SectionHeader
            badge="Migration"
            title={<>Geçiş <span className="gradient-text">30 Dakika</span> Sürer</>}
            subtitle="Yıllar boyunca topladığınız kullanıcı tabanını kaybetmeden, sıfır kesinti ile geçin."
          />
        </motion.div>

        <div className="mt-16 grid lg:grid-cols-2 gap-12 items-start">
          {/* Steps */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-0"
          >
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-4 group">
                {/* Connector */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-surface border-2 border-border group-hover:border-primary flex items-center justify-center flex-shrink-0 transition-colors duration-300">
                    <CheckCircle2 className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors duration-300" />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2 mb-2 min-h-[32px]" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-text-muted font-mono">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-base font-semibold text-text-base group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Terminal */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Terminal lines={TERMINAL_LINES} speed={30} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
