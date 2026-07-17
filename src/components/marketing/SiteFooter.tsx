import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SendIcon } from '@/components/icons';

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'https://postq.space';
const CABINET_URL = 'https://web.postq.space';
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'postq_vpn_bot';

function Dot() {
  return (
    <span
      aria-hidden
      className="mkt-footer-dot"
      style={{ color: 'rgba(215,194,240,0.25)', fontSize: 12, userSelect: 'none' }}
    >
      ·
    </span>
  );
}

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Продукт',
    links: [
      { label: 'Цены', href: `${MARKETING_URL}/#pricing` },
      { label: 'Как подключить', href: `${MARKETING_URL}/#howto` },
      { label: 'FAQ', href: `${MARKETING_URL}/#faq` },
      { label: 'Личный кабинет', href: CABINET_URL },
      { label: 'Статус серверов', href: 'https://status.postq.space' },
    ],
  },
  {
    title: 'Помощь',
    links: [
      { label: 'Справочный центр', href: `${MARKETING_URL}/help` },
      { label: 'VPN на роутере', href: `${MARKETING_URL}/help/vpn-on-router` },
      { label: 'Генератор конфига XKeen', href: `${MARKETING_URL}/keys` },
      { label: 'Узнать мой IP', href: `${MARKETING_URL}/ip` },
      { label: 'Поддержка', href: 'https://t.me/postq_vpn_support_bot' },
    ],
  },
];

interface SiteFooterProps {
  appName: string;
  logoUrl: string | null;
  appLogo: string;
  hasCustomLogo: boolean;
  showLegalLinks: boolean;
}

export default function SiteFooter({
  appName,
  logoUrl,
  appLogo,
  hasCustomLogo,
  showLegalLinks,
}: SiteFooterProps) {
  const { t } = useTranslation();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mkt-site-footer"
    >
      <div className="mkt-footer-inner">
        <div className="mkt-footer-grid">
          <div className="mkt-footer-brand">
            <div className="mkt-footer-brand-row">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-bold text-accent-400 ${hasCustomLogo && logoUrl ? 'opacity-0' : 'opacity-100'}`}
                >
                  {appLogo}
                </span>
                {hasCustomLogo && logoUrl && (
                  <img
                    src={logoUrl}
                    alt={appName || 'Logo'}
                    className="absolute h-full w-full object-contain"
                  />
                )}
              </div>
              <span
                className="mkt-font-display"
                style={{ fontSize: '16px', color: 'rgb(var(--color-dark-50))' }}
              >
                {appName}
              </span>
            </div>
            <p className="mkt-footer-tagline">
              Шифрует весь трафик и открывает доступ к любым сайтам. Серверы по всему миру, без
              логов и слежки.
            </p>
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mkt-install-guide-btn"
            >
              <SendIcon className="h-3.5 w-3.5" /> @{TELEGRAM_BOT_USERNAME}
            </a>
            <div className="mkt-footer-socials">
              <a
                href="https://t.me/postq_news"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-nav-link"
              >
                Новости в Telegram
              </a>
              <Dot />
              <a
                href="https://www.threads.com/@postq_vpn"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-nav-link"
              >
                Threads
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} className="mkt-footer-col" aria-label={col.title}>
              <p className="mkt-footer-col-title">{col.title}</p>
              {col.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="mkt-footer-nav-link"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>

        {showLegalLinks && (
          <div className="mkt-footer-bottom">
            <span className="mkt-footer-link" style={{ cursor: 'default' }}>
              © {new Date().getFullYear()} {appName}
            </span>
            <div className="mkt-footer-bottom-links">
              <a
                href="/offer"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
              >
                {t('footer.offer', 'Публичная оферта')}
              </a>
              <Dot />
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
              >
                {t('footer.privacy', 'Политика конфиденциальности')}
              </a>
              <Dot />
              <a
                href="/recurrent-payments"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
              >
                {t('footer.recurrent', 'Рекуррентные платежи')}
              </a>
            </div>
          </div>
        )}
      </div>
    </motion.footer>
  );
}
