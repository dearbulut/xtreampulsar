'use client';

import { motion } from 'framer-motion';
import { Play, ArrowRight, Shield, Zap, Activity, Users, Server, Tv } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GradientText } from '@/components/ui/GradientText';

// ── Dashboard Mockup ──────────────────────────────────────────────────────────
function DashboardMockup() {
  const stats = [
    { label: 'Aktif Kullanıcı', value: '3,847', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Canlı Stream', value: '1,204', icon: Tv, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Sunucu', value: '8', icon: Server, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Uptime', value: '99.9%', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const sidebarItems = [
    { icon: Activity, label: 'Dashboard', active: true },
    { icon: Tv, label: 'Streams', active: false },
    { icon: Users, label: 'Kullanıcılar', active: false },
    { icon: Server, label: 'Sunucular', active: false },
    { icon: Shield, label: 'Güvenlik', active: false },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-b from-indigo-500/20 via-purple-500/10 to-transparent rounded-2xl blur-2xl" />

      {/* Browser chrome */}
      <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-2xl shadow-black/50">
        {/* Address bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#080810] border-b border-border/60">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28ca41]" />
          </div>
          <div className="flex-1 bg-surface rounded-md px-3 py-1 text-xs text-text-muted font-mono">
            panel.yourdomain.com/dashboard
          </div>
        </div>

        {/* App content */}
        <div className="flex bg-[#070710] h-[380px]">
          {/* Sidebar */}
          <div className="w-14 bg-[#0a0a14] border-r border-border/50 flex flex-col items-center py-4 gap-3 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            {sidebarItems.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                title={label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  active ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-base hover:bg-surface-2'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-text-muted">Hoş geldiniz</p>
                <h3 className="text-sm font-semibold text-text-base">Dashboard</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium">Tüm sistemler normal</span>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {stats.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-surface/80 border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-text-muted">{label}</span>
                    <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                  </div>
                  <span className="text-lg font-bold text-text-base">{value}</span>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="bg-surface/80 border border-border/60 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-text-muted font-medium">Bant Genişliği (24s)</span>
                <span className="text-[10px] text-cyan-400">↑ 12.4 Gbps</span>
              </div>
              <div className="flex items-end gap-1 h-14">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 72, 92, 68, 85, 78, 95, 82, 98].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600/60 to-cyan-500/40"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
export function HeroSection() {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 overflow-hidden mesh-bg">
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-cyan-600/5 blur-3xl"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center gap-6 mb-16"
        >
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <Badge variant="cyan" className="text-sm px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Xtream Codes API %100 Uyumlu
            </Badge>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight text-balance max-w-4xl"
          >
            IPTV Operatörlerinin
            <br />
            <GradientText>Yeni Güç Merkezi</GradientText>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-text-muted max-w-2xl leading-relaxed text-balance"
          >
            XtreamUI, XUI.ONE ve Xtream-Masters&apos;ı geride bırakın. Modern arayüz, gerçek destek,
            tek tık migration. 30 dakikada yayında olun.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-3">
            <Button size="lg" className="w-full sm:w-auto glow-primary">
              30 Gün Ücretsiz Başla
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto group">
              <Play className="w-4 h-4 group-hover:text-primary transition-colors" />
              Demo İzle
            </Button>
          </motion.div>

          {/* Trust signals */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Kredi kartı gerekmez
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              30 dakikada kurulum
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              99.9% uptime SLA
            </span>
          </motion.div>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
