import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ActivityIcon, ChevronDownIcon, GlobeIcon, LifeBuoyIcon } from './icons';

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'https://postq.space';
const CABINET_URL = 'https://web.postq.space';

// Kept in sync with postq-site's src/components/Header.tsx NAV_LINKS/USEFUL_LINKS
// (re-checked 2026-07-17 against the live postq.space build, since the local
// /root/postq-site git clone was stale — "Статус серверов" moved out of the
// nav row into the "Полезное" dropdown, with its own description).
const NAV_LINKS = [
  { label: 'Цены', href: `${MARKETING_URL}/#pricing` },
  { label: 'Как подключить', href: `${MARKETING_URL}/#howto` },
  { label: 'FAQ', href: `${MARKETING_URL}/#faq` },
];

const USEFUL_LINKS = [
  {
    label: 'Справочный центр',
    description: 'Инструкции и ответы на частые вопросы',
    href: `${MARKETING_URL}/help`,
    icon: LifeBuoyIcon,
  },
  {
    label: 'Статус серверов',
    description: 'Доступность серверов в реальном времени',
    href: 'https://status.postq.space',
    icon: ActivityIcon,
  },
  {
    label: 'Узнать мой IP',
    description: 'Проверьте свой текущий IP-адрес',
    href: `${MARKETING_URL}/ip`,
    icon: GlobeIcon,
  },
];

interface SiteHeaderProps {
  appName: string;
  logoUrl: string | null;
  appLogo: string;
  hasCustomLogo: boolean;
}

function PersonalAccountButton() {
  return (
    <motion.a
      href={CABINET_URL}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="mkt-font-display inline-flex items-center justify-center px-5 py-2 no-underline focus:outline-none"
      style={{
        fontSize: '13px',
        fontWeight: 400,
        letterSpacing: '0.06em',
        borderRadius: '9px',
        textShadow: '0 0 8px rgba(207, 0, 163, 0.6)',
        border: '1.5px solid rgba(207, 0, 163, 0.7)',
        background:
          'linear-gradient(135deg, rgba(207, 0, 163, 0.15) 0%, rgba(147, 27, 121, 0.1) 100%)',
        boxShadow: '0 0 15px rgba(207, 0, 163, 0.3), inset 0 0 15px rgba(207, 0, 163, 0.05)',
        color: 'rgb(255, 255, 255)',
        transition:
          'color, background-color, border-color, box-shadow, transform, opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      Личный кабинет
    </motion.a>
  );
}

export default function SiteHeader({ appName, logoUrl, appLogo, hasCustomLogo }: SiteHeaderProps) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [usefulOpen, setUsefulOpen] = useState(false);
  const [usefulPos, setUsefulPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const usefulRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openUseful() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    const rect = usefulRef.current?.getBoundingClientRect();
    if (rect) {
      setUsefulPos({ top: rect.bottom + 22, left: rect.left + rect.width / 2 });
    }
    setUsefulOpen(true);
  }

  useEffect(() => {
    if (!usefulOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (usefulRef.current && !usefulRef.current.contains(e.target as Node)) {
        setUsefulOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [usefulOpen]);

  return (
    <header
      className="fixed left-0 right-0 z-50"
      style={{ top: 0, padding: '8px 8px 0', transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="mx-auto max-w-6xl">
        <div
          style={{
            position: 'relative',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(207,0,163,0.07)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            overflow: 'visible',
          }}
        >
          <div className="flex h-14 items-center justify-between px-3">
            {/* Logo */}
            <motion.a
              href={MARKETING_URL}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2.5 no-underline"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-bold text-accent-400 transition-opacity duration-200 ${hasCustomLogo && logoLoaded ? 'opacity-0' : 'opacity-100'}`}
                >
                  {appLogo}
                </span>
                {hasCustomLogo && logoUrl && (
                  <img
                    src={logoUrl}
                    alt={appName || 'Logo'}
                    className={`absolute h-full w-full object-contain transition-opacity duration-200 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setLogoLoaded(true)}
                  />
                )}
              </div>
              <span
                className="mkt-font-display"
                style={{ fontSize: '16px', color: 'rgb(var(--color-dark-50))' }}
              >
                {appName}
              </span>
            </motion.a>

            {/* Desktop nav */}
            <motion.nav
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="hidden items-center gap-9 md:flex"
            >
              {NAV_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="mkt-nav-link">
                  {link.label}
                </a>
              ))}

              {/* Useful links dropdown */}
              <div
                ref={usefulRef}
                style={{ position: 'relative' }}
                onMouseEnter={openUseful}
                onMouseLeave={() => {
                  hoverCloseTimer.current = setTimeout(() => setUsefulOpen(false), 150);
                }}
              >
                <button
                  className="mkt-nav-link"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'default',
                  }}
                  aria-expanded={usefulOpen}
                >
                  Полезное
                  <motion.span
                    animate={{ rotate: usefulOpen ? 180 : 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ display: 'inline-flex' }}
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </motion.span>
                </button>

                {mounted &&
                  createPortal(
                    <AnimatePresence>
                      {usefulOpen && usefulPos && (
                        <div
                          onMouseEnter={openUseful}
                          onMouseLeave={() => {
                            hoverCloseTimer.current = setTimeout(() => setUsefulOpen(false), 150);
                          }}
                          style={{
                            position: 'fixed',
                            top: usefulPos.top,
                            left: usefulPos.left,
                            transform: 'translateX(-50%)',
                            zIndex: 60,
                          }}
                        >
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            style={{
                              minWidth: 360,
                              padding: 10,
                              borderRadius: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              background: 'rgba(255,255,255,0.04)',
                              backdropFilter: 'blur(40px)',
                              WebkitBackdropFilter: 'blur(40px)',
                              border: '1px solid rgba(207,0,163,0.07)',
                              boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                            }}
                          >
                            {USEFUL_LINKS.map((link) => {
                              const Icon = link.icon;
                              return (
                                <a
                                  key={link.href}
                                  href={link.href}
                                  onClick={() => setUsefulOpen(false)}
                                  className="mkt-useful-link-row"
                                >
                                  <span className="mkt-useful-link-icon">
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <span>
                                    <span className="mkt-useful-link-title">{link.label}</span>
                                    <span className="mkt-useful-link-desc">{link.description}</span>
                                  </span>
                                </a>
                              );
                            })}
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>,
                    document.body,
                  )}
              </div>
            </motion.nav>

            {/* Right: account button + burger */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3"
            >
              <div className="hidden md:block">
                <PersonalAccountButton />
              </div>

              <button
                className="md:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Меню"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '5px',
                    width: 24,
                    height: 24,
                  }}
                >
                  <motion.span
                    animate={
                      mobileOpen
                        ? { rotate: 45, y: 6.5, backgroundColor: 'rgba(207,0,163,0.9)' }
                        : { rotate: 0, y: 0, backgroundColor: 'rgba(215,194,240,0.7)' }
                    }
                    transition={{ duration: 0.22 }}
                    style={{
                      display: 'block',
                      height: 1.5,
                      borderRadius: 2,
                      transformOrigin: 'center',
                    }}
                  />
                  <motion.span
                    animate={
                      mobileOpen
                        ? { scaleX: 0, opacity: 0 }
                        : { scaleX: 1, opacity: 1, backgroundColor: 'rgba(215,194,240,0.7)' }
                    }
                    transition={{ duration: 0.15 }}
                    style={{
                      display: 'block',
                      height: 1.5,
                      borderRadius: 2,
                      transformOrigin: 'center',
                    }}
                  />
                  <motion.span
                    animate={
                      mobileOpen
                        ? { rotate: -45, y: -6.5, backgroundColor: 'rgba(207,0,163,0.9)' }
                        : { rotate: 0, y: 0, backgroundColor: 'rgba(215,194,240,0.7)' }
                    }
                    transition={{ duration: 0.22 }}
                    style={{
                      display: 'block',
                      height: 1.5,
                      borderRadius: 2,
                      transformOrigin: 'center',
                    }}
                  />
                </div>
              </button>
            </motion.div>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    padding: '8px 20px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    borderTop: '1px solid rgba(207,0,163,0.1)',
                  }}
                >
                  {NAV_LINKS.map((link, i) => (
                    <motion.a
                      key={link.label}
                      href={link.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setMobileOpen(false)}
                      className="mkt-nav-link"
                      style={{
                        fontSize: '15px',
                        color: 'rgba(215,194,240,0.65)',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(207,0,163,0.06)',
                        textAlign: 'left',
                        width: '100%',
                        borderRadius: 0,
                        display: 'block',
                      }}
                    >
                      {link.label}
                    </motion.a>
                  ))}

                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: NAV_LINKS.length * 0.05 }}
                    className="mkt-font-text"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(215,194,240,0.3)',
                      margin: '14px 0 4px',
                    }}
                  >
                    Полезное
                  </motion.p>
                  {USEFUL_LINKS.map((link, i) => (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (NAV_LINKS.length + i) * 0.05 }}
                      onClick={() => setMobileOpen(false)}
                      className="mkt-nav-link"
                      style={{
                        display: 'block',
                        fontSize: '15px',
                        color: 'rgba(215,194,240,0.65)',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(207,0,163,0.06)',
                        textAlign: 'left',
                        width: '100%',
                        borderRadius: 0,
                      }}
                    >
                      {link.label}
                    </motion.a>
                  ))}

                  <div style={{ marginTop: '12px' }}>
                    <PersonalAccountButton />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
