import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminTasksApi,
  adminTaskPartnerChannelsApi,
  type Task,
  type TaskCreateRequest,
  type TaskListItem,
  type TaskPartnerChannel,
  type TaskPartnerChannelCreateRequest,
  type TaskRewardType,
  type TaskType,
  type TaskUserAudience,
} from '../api/adminTasks';
import { tariffsApi, type TariffListItem } from '../api/tariffs';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TASK_TYPES: { value: TaskType; labelKey: string }[] = [
  { value: 'purchase_tariff', labelKey: 'admin.tasks.types.purchase_tariff' },
  { value: 'subscribe_channel', labelKey: 'admin.tasks.types.subscribe_channel' },
  { value: 'traffic_used', labelKey: 'admin.tasks.types.traffic_used' },
  { value: 'referrals_invited', labelKey: 'admin.tasks.types.referrals_invited' },
  { value: 'purchase_period', labelKey: 'admin.tasks.types.purchase_period' },
  { value: 'spend_amount', labelKey: 'admin.tasks.types.spend_amount' },
  { value: 'multi_tariff', labelKey: 'admin.tasks.types.multi_tariff' },
  { value: 'gift_purchased', labelKey: 'admin.tasks.types.gift_purchased' },
  { value: 'gifts_count', labelKey: 'admin.tasks.types.gifts_count' },
];

const REWARD_TYPES: { value: TaskRewardType; labelKey: string }[] = [
  { value: 'balance', labelKey: 'admin.tasks.rewards.balance' },
  { value: 'subscription_days', labelKey: 'admin.tasks.rewards.subscription_days' },
];

const AUDIENCES: { value: TaskUserAudience; labelKey: string }[] = [
  { value: 'both', labelKey: 'admin.tasks.audience.both' },
  { value: 'telegram', labelKey: 'admin.tasks.audience.telegram' },
  { value: 'email', labelKey: 'admin.tasks.audience.email' },
];

const POPULAR_EMOJIS = ['🎯', '⭐', '🎁', '💰', '🏆', '🚀', '💎', '🔥', '⚡', '🎉'];

// Task types that don't need a target_value field (always 1)
const HIDDEN_TARGET_VALUE_TYPES: TaskType[] = ['subscribe_channel', 'gift_purchased'];

// ─────────────────────────────────────────────────────────────────────────────
// Partner channel form state
// ─────────────────────────────────────────────────────────────────────────────

interface PartnerChannelFormState {
  id: number | null;
  channel_id: string;
  title: string;
  channel_link: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const emptyPartnerForm: PartnerChannelFormState = {
  id: null,
  channel_id: '',
  title: '',
  channel_link: '',
  description: '',
  is_active: true,
  sort_order: 0,
};

function fromPartnerChannel(ch: TaskPartnerChannel): PartnerChannelFormState {
  return {
    id: ch.id,
    channel_id: ch.channel_id,
    title: ch.title,
    channel_link: ch.channel_link || '',
    description: ch.description || '',
    is_active: ch.is_active,
    sort_order: ch.sort_order,
  };
}

function toPartnerPayload(form: PartnerChannelFormState): TaskPartnerChannelCreateRequest {
  return {
    channel_id: form.channel_id.trim(),
    title: form.title.trim(),
    channel_link: form.channel_link.trim() || null,
    description: form.description.trim() || null,
    is_active: form.is_active,
    sort_order: form.sort_order,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task form state — structured (no JSON)
// ─────────────────────────────────────────────────────────────────────────────

interface TaskFormState {
  id: number | null;
  title_ru: string;
  title_en: string;
  description_ru: string;
  description_en: string;
  icon: string;
  is_active: boolean;
  task_type: TaskType;
  // target_value is decoupled from the target_meta for clarity.
  // For spend_amount we store rubles in form (and convert to kopeks on submit).
  target_value: number;
  spend_amount_rubles: number;
  // target meta dedicated fields
  target_tariff_id: number | null;
  target_channel_id: string;
  target_period_days: number;
  // reward
  reward_type: TaskRewardType;
  reward_value: number; // for balance — rubles in form (×100 on submit); for days — direct
  reward_use_tariff_bonus: boolean; // toggles `{ tariff_id }` reward_meta for subscription_days
  reward_tariff_id: number | null;
  // misc
  allow_user_choice: boolean;
  user_audience: TaskUserAudience;
  promo_group_id: number | null;
  parent_task_id: number | null;
  level: number;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

const emptyForm: TaskFormState = {
  id: null,
  title_ru: '',
  title_en: '',
  description_ru: '',
  description_en: '',
  icon: '',
  is_active: true,
  task_type: 'referrals_invited',
  target_value: 5,
  spend_amount_rubles: 100,
  target_tariff_id: null,
  target_channel_id: '',
  target_period_days: 30,
  reward_type: 'balance',
  reward_value: 100, // rubles for balance, days for subscription_days
  reward_use_tariff_bonus: false,
  reward_tariff_id: null,
  allow_user_choice: false,
  user_audience: 'both',
  promo_group_id: null,
  parent_task_id: null,
  level: 1,
  starts_at: '',
  ends_at: '',
  sort_order: 0,
};

function pickNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Конвертирует UTC ISO datetime в формат для `<input type="datetime-local">` в локальной TZ
 * пользователя. Без этого UTC-строка `2026-05-06T07:00:00Z` интерпретируется как локальная,
 * и при каждом edit время уходит на UTC offset.
 */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // toISOString вернёт UTC; нужен local. Получаем компоненты вручную.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromTask(task: Task): TaskFormState {
  const targetMeta = (task.target_meta || {}) as Record<string, unknown>;
  const rewardMeta = (task.reward_meta || {}) as Record<string, unknown>;
  const rewardTariffIdRaw = pickNum(rewardMeta.tariff_id);

  // Для spend_amount — копейки → рубли с сохранением точности до 0.01 (не округляем
  // до целых, иначе round-trip 100.50 ₽ → 101 ₽ при каждом редактировании).
  const spendRubles = task.task_type === 'spend_amount' ? (task.target_value || 0) / 100 : 100;

  // Для balance — копейки → рубли с той же 0.01 precision.
  const formRewardValue =
    task.reward_type === 'balance' ? (task.reward_value || 0) / 100 : (task.reward_value ?? 0);

  return {
    id: task.id,
    title_ru: task.title?.ru || '',
    title_en: task.title?.en || '',
    description_ru: task.description?.ru || '',
    description_en: task.description?.en || '',
    icon: task.icon || '',
    is_active: task.is_active,
    task_type: task.task_type,
    target_value: task.target_value,
    spend_amount_rubles: spendRubles,
    target_tariff_id: pickNum(targetMeta.tariff_id),
    target_channel_id: pickString(targetMeta.channel_id),
    target_period_days: pickNum(targetMeta.period_days) ?? 30,
    reward_type: task.reward_type,
    reward_value: formRewardValue,
    reward_use_tariff_bonus: task.reward_type === 'subscription_days' && rewardTariffIdRaw !== null,
    reward_tariff_id: rewardTariffIdRaw,
    allow_user_choice: task.allow_user_choice,
    user_audience: task.user_audience,
    promo_group_id: task.promo_group_id ?? null,
    parent_task_id: task.parent_task_id ?? null,
    level: task.level,
    starts_at: isoToDatetimeLocal(task.starts_at),
    ends_at: isoToDatetimeLocal(task.ends_at),
    sort_order: task.sort_order,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrors {
  title?: string;
  target_tariff_id?: string;
  target_channel_id?: string;
  target_period_days?: string;
  target_value?: string;
  spend_amount_rubles?: string;
  reward_value?: string;
  reward_tariff_id?: string;
}

function validateForm(form: TaskFormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.title_ru.trim() && !form.title_en.trim()) {
    errors.title = 'admin.tasks.errors.title_required';
  }

  switch (form.task_type) {
    case 'purchase_tariff':
      if (!form.target_tariff_id) {
        errors.target_tariff_id = 'admin.tasks.errors.tariff_required';
      }
      if (form.target_value < 1) {
        errors.target_value = 'admin.tasks.errors.target_value_min1';
      }
      break;
    case 'subscribe_channel':
      if (!form.target_channel_id.trim()) {
        errors.target_channel_id = 'admin.tasks.errors.channel_required';
      }
      break;
    case 'purchase_period':
      if (!form.target_period_days || form.target_period_days < 1) {
        errors.target_period_days = 'admin.tasks.errors.period_days_required';
      }
      if (form.target_value < 1) {
        errors.target_value = 'admin.tasks.errors.target_value_min1';
      }
      break;
    case 'spend_amount':
      if (!form.spend_amount_rubles || form.spend_amount_rubles < 1) {
        errors.spend_amount_rubles = 'admin.tasks.errors.spend_min1';
      }
      break;
    case 'multi_tariff':
      if (form.target_value < 2) {
        errors.target_value = 'admin.tasks.errors.multi_tariff_min2';
      }
      break;
    case 'gifts_count':
    case 'traffic_used':
    case 'referrals_invited':
      if (form.target_value < 1) {
        errors.target_value = 'admin.tasks.errors.target_value_min1';
      }
      break;
    case 'gift_purchased':
      // target_value is fixed to 1 — no validation needed
      break;
  }

  // Reward validation. Backend требует:
  //   balance: reward_value > 0
  //   subscription_days: reward_value > 0 OR reward_meta.tariff_id указан
  if (form.reward_type === 'balance') {
    if (form.reward_value <= 0) {
      errors.reward_value = 'admin.tasks.errors.balance_reward_min1';
    }
  } else if (form.reward_type === 'subscription_days') {
    if (form.reward_use_tariff_bonus && !form.reward_tariff_id) {
      errors.reward_tariff_id = 'admin.tasks.errors.reward_tariff_required';
    }
    if (form.reward_value < 0) {
      errors.reward_value = 'admin.tasks.errors.reward_negative';
    } else if (!form.reward_use_tariff_bonus && form.reward_value <= 0) {
      // Без bonus-tariff требуется явное число дней > 0
      errors.reward_value = 'admin.tasks.errors.subscription_days_or_tariff_required';
    }
  }

  return errors;
}

function toPayload(form: TaskFormState): TaskCreateRequest {
  // Build target_meta based on task type
  const targetMeta: Record<string, unknown> = {};
  let computedTargetValue = Math.max(1, form.target_value || 1);

  switch (form.task_type) {
    case 'purchase_tariff':
      if (form.target_tariff_id) targetMeta.tariff_id = form.target_tariff_id;
      break;
    case 'subscribe_channel':
      targetMeta.channel_id = form.target_channel_id.trim();
      computedTargetValue = 1;
      break;
    case 'purchase_period':
      if (form.target_period_days) targetMeta.period_days = form.target_period_days;
      break;
    case 'spend_amount':
      computedTargetValue = Math.max(1, Math.round((form.spend_amount_rubles || 0) * 100));
      break;
    case 'gift_purchased':
      computedTargetValue = 1;
      break;
    default:
      break;
  }

  // Build reward_meta
  const rewardMeta: Record<string, unknown> = {};
  if (
    form.reward_type === 'subscription_days' &&
    form.reward_use_tariff_bonus &&
    form.reward_tariff_id
  ) {
    rewardMeta.tariff_id = form.reward_tariff_id;
  }

  // Convert reward_value to wire format (balance: rubles → kopeks)
  const rewardValueWire =
    form.reward_type === 'balance'
      ? Math.max(0, Math.round((form.reward_value || 0) * 100))
      : Math.max(0, form.reward_value || 0);

  const title: Record<string, string> = {};
  if (form.title_ru.trim()) title.ru = form.title_ru.trim();
  if (form.title_en.trim()) title.en = form.title_en.trim();

  const description: Record<string, string> = {};
  if (form.description_ru.trim()) description.ru = form.description_ru.trim();
  if (form.description_en.trim()) description.en = form.description_en.trim();

  return {
    title,
    description,
    icon: form.icon || null,
    is_active: form.is_active,
    sort_order: form.sort_order,
    task_type: form.task_type,
    target_value: computedTargetValue,
    target_meta: targetMeta,
    reward_type: form.reward_type,
    reward_value: rewardValueWire,
    reward_meta: rewardMeta,
    allow_user_choice: form.allow_user_choice,
    user_audience: form.user_audience,
    promo_group_id: form.promo_group_id,
    parent_task_id: form.parent_task_id,
    level: Math.max(1, form.level || 1),
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminTasks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['admin', 'tasks'],
    queryFn: () => adminTasksApi.list(true),
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['admin', 'task-partner-channels'],
    queryFn: () => adminTaskPartnerChannelsApi.list(true),
  });

  const { data: tariffsResponse } = useQuery({
    queryKey: ['admin', 'tariffs', 'for-tasks'],
    queryFn: () => tariffsApi.getTariffs(true),
  });
  const tariffs: TariffListItem[] = tariffsResponse?.tariffs ?? [];

  const { data: promoGroups = [] } = useQuery({
    queryKey: ['admin', 'promo-groups', 'for-tasks'],
    queryFn: () => tariffsApi.getAvailablePromoGroups(),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: adminTasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      setForm(emptyForm);
      setEditing(false);
      setError(null);
      setFieldErrors({});
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail || err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReturnType<typeof toPayload> }) =>
      adminTasksApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      setForm(emptyForm);
      setEditing(false);
      setError(null);
      setFieldErrors({});
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail || err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminTasksApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] }),
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail || err.message);
    },
  });

  // ── Partner channels ──────────────────────────────────────────────────────
  const [partnerForm, setPartnerForm] = useState<PartnerChannelFormState>(emptyPartnerForm);
  const [partnerEditing, setPartnerEditing] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const partnerSectionRef = useRef<HTMLDivElement>(null);

  const partnerInvalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'task-partner-channels'] });

  const createPartnerMutation = useMutation({
    mutationFn: adminTaskPartnerChannelsApi.create,
    onSuccess: () => {
      partnerInvalidate();
      setPartnerForm(emptyPartnerForm);
      setPartnerEditing(false);
      setPartnerError(null);
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setPartnerError(err?.response?.data?.detail || err.message);
    },
  });

  const updatePartnerMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskPartnerChannelCreateRequest }) =>
      adminTaskPartnerChannelsApi.update(id, {
        title: payload.title,
        channel_link: payload.channel_link,
        description: payload.description,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      }),
    onSuccess: () => {
      partnerInvalidate();
      setPartnerForm(emptyPartnerForm);
      setPartnerEditing(false);
      setPartnerError(null);
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setPartnerError(err?.response?.data?.detail || err.message);
    },
  });

  const deletePartnerMutation = useMutation({
    mutationFn: adminTaskPartnerChannelsApi.remove,
    onSuccess: () => partnerInvalidate(),
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setPartnerError(err?.response?.data?.detail || err.message);
    },
  });

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError(null);
    const payload = toPartnerPayload(partnerForm);
    if (!payload.channel_id || !payload.title) {
      setPartnerError(t('admin.tasks.errors.channel_id_and_title_required'));
      return;
    }
    if (partnerForm.id) {
      updatePartnerMutation.mutate({ id: partnerForm.id, payload });
    } else {
      createPartnerMutation.mutate(payload);
    }
  };

  // ── Confirm dialog (focus trap, Esc, Tab cycling) ─────────────────────────
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const confirmLastFocusedRef = useRef<HTMLElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmState) return;
    confirmLastFocusedRef.current = document.activeElement as HTMLElement | null;
    confirmCancelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setConfirmState(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = confirmDialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      confirmLastFocusedRef.current?.focus?.();
    };
  }, [confirmState]);

  // ── Sorted tasks + parent/child grouping ──────────────────────────────────
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => a.level - b.level || a.sort_order - b.sort_order || a.id - b.id),
    [tasks],
  );

  // Build a tree-flat list: roots first, each followed immediately by its descendants
  const groupedTasks = useMemo(() => {
    const byParent = new Map<number | null, TaskListItem[]>();
    for (const item of sortedTasks) {
      const key = item.parent_task_id ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(item);
    }
    const result: { task: TaskListItem; depth: number }[] = [];
    const visit = (parent: number | null, depth: number) => {
      const children = byParent.get(parent) || [];
      for (const c of children) {
        result.push({ task: c, depth });
        visit(c.id, depth + 1);
      }
    };
    visit(null, 0);
    // Append orphan tasks whose parent isn't loaded (defensive)
    const seen = new Set(result.map((r) => r.task.id));
    for (const t of sortedTasks) {
      if (!seen.has(t.id)) result.push({ task: t, depth: 0 });
    }
    return result;
  }, [sortedTasks]);

  const tasksById = useMemo(() => {
    const map = new Map<number, TaskListItem>();
    for (const tk of sortedTasks) map.set(tk.id, tk);
    return map;
  }, [sortedTasks]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const startCreate = () => {
    setForm(emptyForm);
    setEditing(true);
    setError(null);
    setFieldErrors({});
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const startCreateChild = (parent: TaskListItem) => {
    setForm({
      ...emptyForm,
      parent_task_id: parent.id,
      level: parent.level + 1,
      user_audience: parent.user_audience,
      promo_group_id: parent.promo_group_id ?? null,
    });
    setEditing(true);
    setError(null);
    setFieldErrors({});
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleEdit = async (item: TaskListItem) => {
    try {
      const full = await adminTasksApi.get(item.id);
      setForm(fromTask(full));
      setEditing(true);
      setError(null);
      setFieldErrors({});
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Show the first error in the banner for clarity
      const firstKey = Object.values(errors)[0];
      if (firstKey) setError(t(firstKey));
      return;
    }
    const payload = toPayload(form);
    if (form.id) {
      updateMutation.mutate({ id: form.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateForm = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleParentChange = (parentId: number | null) => {
    if (parentId === null) {
      setForm((prev) => ({ ...prev, parent_task_id: null, level: 1 }));
      return;
    }
    const parent = tasksById.get(parentId);
    setForm((prev) => ({
      ...prev,
      parent_task_id: parentId,
      level: parent ? parent.level + 1 : prev.level,
    }));
  };

  const scrollToPartnerSection = () => {
    partnerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPartnerEditing(true);
    setPartnerForm(emptyPartnerForm);
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const labelClass = 'mb-1 block text-sm font-medium text-dark-300';
  const inputClass =
    'w-full rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-white outline-none focus:border-accent-500';
  const inputErrorClass =
    'w-full rounded-xl border border-error-500 bg-dark-800 px-3 py-2 text-sm text-white outline-none focus:border-error-400';
  const helpTextClass = 'mt-1 text-xs text-dark-400';
  const errorTextClass = 'mt-1 text-xs text-error-400';
  const sectionClass = 'rounded-2xl border border-dark-700 bg-dark-800/40 p-4';
  const sectionTitleClass = 'text-base font-semibold text-white';
  const sectionSubtitleClass = 'mt-0.5 text-xs text-dark-400';

  // ── Format helpers ────────────────────────────────────────────────────────
  const formatTaskTypeLabel = (type: TaskType): string =>
    t(`admin.tasks.types.${type}`, { defaultValue: type });

  const formatReward = (rewardType: TaskRewardType, rewardValue: number): string => {
    if (rewardType === 'balance') {
      return `${(rewardValue / 100).toFixed(2)} ₽`;
    }
    return t('admin.tasks.list.daysShort', { count: rewardValue });
  };

  const formatTarget = (item: TaskListItem): string => {
    if (HIDDEN_TARGET_VALUE_TYPES.includes(item.task_type)) {
      return '';
    }
    if (item.task_type === 'spend_amount') {
      return `${(item.target_value / 100).toFixed(2)} ₽`;
    }
    return String(item.target_value);
  };

  const formatTariff = (id: number | null): string => {
    if (!id) return '';
    const tar = tariffs.find((tk) => tk.id === id);
    return tar ? tar.name : `#${id}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('admin.tasks.title')}</h1>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-400"
        >
          {t('admin.tasks.create')}
        </button>
      </div>

      {/* Page-level error banners (shown when forms are closed) */}
      {!editing && error ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-error-500/40 bg-error-500/10 px-3 py-2 text-sm text-error-400">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs underline-offset-2 hover:underline"
          >
            {t('common.close')}
          </button>
        </div>
      ) : null}
      {!partnerEditing && partnerError ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-error-500/40 bg-error-500/10 px-3 py-2 text-sm text-error-400">
          <span>{partnerError}</span>
          <button
            type="button"
            onClick={() => setPartnerError(null)}
            className="text-xs underline-offset-2 hover:underline"
          >
            {t('common.close')}
          </button>
        </div>
      ) : null}

      {/* ── Task form ──────────────────────────────────────────────────── */}
      {editing ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mb-6 flex flex-col gap-4 rounded-2xl border border-dark-700 bg-dark-800/60 p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {form.id ? t('admin.tasks.formEditTitle') : t('admin.tasks.formCreateTitle')}
            </h2>
            {form.id ? (
              <span className="rounded-full bg-dark-700 px-2 py-0.5 text-xs text-dark-300">
                ID #{form.id}
              </span>
            ) : null}
          </div>

          {/* ── SECTION 1: Description ──────────────────────────────────── */}
          <div className={sectionClass}>
            <div className="mb-3">
              <h3 className={sectionTitleClass}>{t('admin.tasks.sections.description')}</h3>
              <p className={sectionSubtitleClass}>{t('admin.tasks.sections.descriptionHint')}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.title_ru')}</label>
                <input
                  className={fieldErrors.title ? inputErrorClass : inputClass}
                  value={form.title_ru}
                  onChange={(e) => updateForm('title_ru', e.target.value)}
                  placeholder={t('admin.tasks.placeholders.titleRu')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.title_en')}</label>
                <input
                  className={fieldErrors.title ? inputErrorClass : inputClass}
                  value={form.title_en}
                  onChange={(e) => updateForm('title_en', e.target.value)}
                  placeholder={t('admin.tasks.placeholders.titleEn')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.description_ru')}</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.description_ru}
                  onChange={(e) => updateForm('description_ru', e.target.value)}
                  placeholder={t('admin.tasks.placeholders.descRu')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.description_en')}</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.description_en}
                  onChange={(e) => updateForm('description_en', e.target.value)}
                  placeholder={t('admin.tasks.placeholders.descEn')}
                />
              </div>
            </div>
            {fieldErrors.title ? (
              <p className={errorTextClass}>{t(fieldErrors.title)}</p>
            ) : (
              <p className={helpTextClass}>{t('admin.tasks.help.titleAtLeastOne')}</p>
            )}

            {/* Emoji picker */}
            <div className="mt-3">
              <label className={labelClass}>{t('admin.tasks.fields.icon')}</label>
              <div className="flex flex-wrap items-center gap-2">
                {POPULAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateForm('icon', emoji)}
                    className={
                      'flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ' +
                      (form.icon === emoji
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-dark-700 bg-dark-800 hover:border-dark-600')
                    }
                    aria-label={t('admin.tasks.aria.pickEmoji', { emoji })}
                  >
                    {emoji}
                  </button>
                ))}
                <input
                  className={inputClass + ' max-w-[140px]'}
                  value={form.icon}
                  onChange={(e) => updateForm('icon', e.target.value)}
                  placeholder={t('admin.tasks.placeholders.emojiCustom')}
                  aria-label={t('admin.tasks.fields.icon')}
                />
                {form.icon ? (
                  <button
                    type="button"
                    onClick={() => updateForm('icon', '')}
                    className="text-xs text-dark-400 underline-offset-2 hover:underline"
                  >
                    {t('admin.tasks.actions.clearEmoji')}
                  </button>
                ) : null}
              </div>
              <p className={helpTextClass}>{t('admin.tasks.help.emoji')}</p>
            </div>
          </div>

          {/* ── SECTION 2: Goal & reward ────────────────────────────────── */}
          <div className={sectionClass}>
            <div className="mb-3">
              <h3 className={sectionTitleClass}>{t('admin.tasks.sections.goalReward')}</h3>
              <p className={sectionSubtitleClass}>{t('admin.tasks.sections.goalRewardHint')}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.task_type')}</label>
                <select
                  className={inputClass}
                  value={form.task_type}
                  onChange={(e) => updateForm('task_type', e.target.value as TaskType)}
                >
                  {TASK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
                <p className={helpTextClass}>{t(`admin.tasks.typeHints.${form.task_type}`)}</p>
              </div>

              {/* Conditional target_value (hidden for some types) */}
              {!HIDDEN_TARGET_VALUE_TYPES.includes(form.task_type) &&
              form.task_type !== 'spend_amount' ? (
                <div>
                  <label className={labelClass}>
                    {t(`admin.tasks.targetLabels.${form.task_type}`)}
                  </label>
                  <input
                    type="number"
                    min={form.task_type === 'multi_tariff' ? 2 : 1}
                    className={fieldErrors.target_value ? inputErrorClass : inputClass}
                    value={form.target_value}
                    onChange={(e) => updateForm('target_value', Number(e.target.value))}
                  />
                  {fieldErrors.target_value ? (
                    <p className={errorTextClass}>{t(fieldErrors.target_value)}</p>
                  ) : (
                    <p className={helpTextClass}>
                      {t(`admin.tasks.targetHints.${form.task_type}`)}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Conditional spend_amount as rubles */}
              {form.task_type === 'spend_amount' ? (
                <div>
                  <label className={labelClass}>
                    {t('admin.tasks.fields.spend_amount_rubles')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className={fieldErrors.spend_amount_rubles ? inputErrorClass : inputClass}
                    value={form.spend_amount_rubles}
                    onChange={(e) => updateForm('spend_amount_rubles', Number(e.target.value))}
                  />
                  {fieldErrors.spend_amount_rubles ? (
                    <p className={errorTextClass}>{t(fieldErrors.spend_amount_rubles)}</p>
                  ) : (
                    <p className={helpTextClass}>{t('admin.tasks.help.spendAmountRubles')}</p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Conditional target_meta UI per task_type */}
            {form.task_type === 'purchase_tariff' ? (
              <div className="mt-3">
                <label className={labelClass}>{t('admin.tasks.fields.target_tariff_id')}</label>
                <select
                  className={fieldErrors.target_tariff_id ? inputErrorClass : inputClass}
                  value={form.target_tariff_id ?? ''}
                  onChange={(e) =>
                    updateForm('target_tariff_id', e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">{t('admin.tasks.placeholders.selectTariff')}</option>
                  {tariffs.map((tar) => (
                    <option key={tar.id} value={tar.id}>
                      {tar.name}
                      {!tar.is_active ? ` — ${t('admin.tasks.inactive')}` : ''}
                      {tar.is_daily ? ` · ${t('admin.tasks.list.dailyBadge')}` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.target_tariff_id ? (
                  <p className={errorTextClass}>{t(fieldErrors.target_tariff_id)}</p>
                ) : (
                  <p className={helpTextClass}>{t('admin.tasks.help.selectTariff')}</p>
                )}
              </div>
            ) : null}

            {form.task_type === 'subscribe_channel' ? (
              <div className="mt-3 rounded-xl border border-accent-500/30 bg-accent-500/5 p-3">
                <label className={labelClass}>{t('admin.tasks.fields.target_channel_id')}</label>
                {channels.length > 0 ? (
                  <select
                    className={fieldErrors.target_channel_id ? inputErrorClass : inputClass}
                    value={form.target_channel_id}
                    onChange={(e) => updateForm('target_channel_id', e.target.value)}
                  >
                    <option value="">{t('admin.tasks.partnerChannels.selectPlaceholder')}</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.channel_id}>
                        {c.title} ({c.channel_id})
                        {!c.is_active ? ` — ${t('admin.tasks.inactive')}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-warning-300">
                    <span>{t('admin.tasks.partnerChannels.empty')}</span>
                    <button
                      type="button"
                      onClick={scrollToPartnerSection}
                      className="rounded-lg bg-warning-500/20 px-2 py-1 text-xs font-medium text-warning-200 hover:bg-warning-500/30"
                    >
                      {t('admin.tasks.partnerChannels.manage')}
                    </button>
                  </div>
                )}
                {fieldErrors.target_channel_id ? (
                  <p className={errorTextClass}>{t(fieldErrors.target_channel_id)}</p>
                ) : null}
              </div>
            ) : null}

            {form.task_type === 'purchase_period' ? (
              <div className="mt-3">
                <label className={labelClass}>{t('admin.tasks.fields.target_period_days')}</label>
                <input
                  type="number"
                  min={1}
                  placeholder="30"
                  className={fieldErrors.target_period_days ? inputErrorClass : inputClass}
                  value={form.target_period_days}
                  onChange={(e) => updateForm('target_period_days', Number(e.target.value))}
                />
                {fieldErrors.target_period_days ? (
                  <p className={errorTextClass}>{t(fieldErrors.target_period_days)}</p>
                ) : (
                  <p className={helpTextClass}>{t('admin.tasks.help.periodDays')}</p>
                )}
              </div>
            ) : null}

            {/* Reward block */}
            <div className="mt-4 rounded-xl border border-dark-700 bg-dark-900/40 p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className={labelClass}>{t('admin.tasks.fields.reward_type')}</label>
                  <select
                    className={inputClass}
                    value={form.reward_type}
                    onChange={(e) => {
                      const newType = e.target.value as TaskRewardType;
                      // When switching reward types, reset reward_value to a sensible default
                      setForm((prev) => ({
                        ...prev,
                        reward_type: newType,
                        reward_value: newType === 'balance' ? 100 : 7,
                        reward_use_tariff_bonus:
                          newType === 'subscription_days' ? prev.reward_use_tariff_bonus : false,
                      }));
                    }}
                  >
                    {REWARD_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    {form.reward_type === 'balance'
                      ? t('admin.tasks.fields.reward_value_rubles')
                      : t('admin.tasks.fields.reward_value_days')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={form.reward_type === 'balance' ? '0.01' : '1'}
                    className={fieldErrors.reward_value ? inputErrorClass : inputClass}
                    value={form.reward_value}
                    onChange={(e) => updateForm('reward_value', Number(e.target.value))}
                  />
                  {fieldErrors.reward_value ? (
                    <p className={errorTextClass}>{t(fieldErrors.reward_value)}</p>
                  ) : (
                    <p className={helpTextClass}>
                      {form.reward_type === 'balance'
                        ? t('admin.tasks.help.rewardRubles')
                        : form.reward_use_tariff_bonus
                          ? t('admin.tasks.help.rewardDaysWithBonus')
                          : t('admin.tasks.help.rewardDays')}
                    </p>
                  )}
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-dark-200">
                    <input
                      type="checkbox"
                      checked={form.allow_user_choice}
                      onChange={(e) => updateForm('allow_user_choice', e.target.checked)}
                    />
                    <span>{t('admin.tasks.fields.allow_user_choice')}</span>
                  </label>
                </div>
              </div>

              {form.reward_type === 'subscription_days' ? (
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm text-dark-200">
                    <input
                      type="checkbox"
                      checked={form.reward_use_tariff_bonus}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          reward_use_tariff_bonus: e.target.checked,
                          reward_tariff_id: e.target.checked ? prev.reward_tariff_id : null,
                        }))
                      }
                    />
                    <span>{t('admin.tasks.fields.reward_use_tariff_bonus')}</span>
                  </label>
                  <p className={helpTextClass}>{t('admin.tasks.help.rewardUseTariffBonus')}</p>
                  {form.reward_use_tariff_bonus ? (
                    <div className="mt-2">
                      <label className={labelClass}>
                        {t('admin.tasks.fields.reward_tariff_id')}
                      </label>
                      <select
                        className={fieldErrors.reward_tariff_id ? inputErrorClass : inputClass}
                        value={form.reward_tariff_id ?? ''}
                        onChange={(e) =>
                          updateForm(
                            'reward_tariff_id',
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">{t('admin.tasks.placeholders.selectTariff')}</option>
                        {tariffs.map((tar) => (
                          <option key={tar.id} value={tar.id}>
                            {tar.name}
                            {!tar.is_active ? ` — ${t('admin.tasks.inactive')}` : ''}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.reward_tariff_id ? (
                        <p className={errorTextClass}>{t(fieldErrors.reward_tariff_id)}</p>
                      ) : (
                        <p className={helpTextClass}>{t('admin.tasks.help.rewardTariffPick')}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── SECTION 3: Audience & schedule ──────────────────────────── */}
          <div className={sectionClass}>
            <div className="mb-3">
              <h3 className={sectionTitleClass}>{t('admin.tasks.sections.audienceSchedule')}</h3>
              <p className={sectionSubtitleClass}>
                {t('admin.tasks.sections.audienceScheduleHint')}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.user_audience')}</label>
                <select
                  className={inputClass}
                  value={form.user_audience}
                  onChange={(e) => updateForm('user_audience', e.target.value as TaskUserAudience)}
                >
                  {AUDIENCES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.promo_group_id')}</label>
                <select
                  className={inputClass}
                  value={form.promo_group_id ?? ''}
                  onChange={(e) =>
                    updateForm('promo_group_id', e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">{t('admin.tasks.placeholders.allUsersNoPromo')}</option>
                  {promoGroups.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.name}
                    </option>
                  ))}
                </select>
                <p className={helpTextClass}>{t('admin.tasks.help.promoGroup')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.parent_task_id')}</label>
                <select
                  className={inputClass}
                  value={form.parent_task_id ?? ''}
                  onChange={(e) =>
                    handleParentChange(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">{t('admin.tasks.placeholders.rootTask')}</option>
                  {sortedTasks
                    .filter((tk) => !form.id || tk.id !== form.id)
                    .map((tk) => (
                      <option key={tk.id} value={tk.id}>
                        {`#${tk.id} · L${tk.level} · ${tk.title?.ru || tk.title?.en || `#${tk.id}`}`}
                      </option>
                    ))}
                </select>
                <p className={helpTextClass}>{t('admin.tasks.help.parentTask')}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.level')}</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.level}
                  onChange={(e) => updateForm('level', Number(e.target.value))}
                />
                <p className={helpTextClass}>{t('admin.tasks.help.level')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.sort_order')}</label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.sort_order}
                  onChange={(e) => updateForm('sort_order', Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.starts_at')}</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.starts_at}
                  onChange={(e) => updateForm('starts_at', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.fields.ends_at')}</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.ends_at}
                  onChange={(e) => updateForm('ends_at', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-dark-200">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm('is_active', e.target.checked)}
                />
                <span>{t('admin.tasks.fields.is_active')}</span>
              </label>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-3 py-2 text-sm text-error-400">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-400 disabled:opacity-50"
            >
              {form.id ? t('admin.tasks.save') : t('admin.tasks.create')}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setEditing(false);
                setError(null);
                setFieldErrors({});
              }}
              className="rounded-xl bg-dark-700 px-4 py-2 text-sm font-medium text-white hover:bg-dark-600"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Partner channels section ───────────────────────────────────── */}
      <div
        ref={partnerSectionRef}
        className="mb-6 rounded-2xl border border-dark-700 bg-dark-800/40 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('admin.tasks.partnerChannels.title')}
            </h2>
            <p className="mt-1 text-xs text-dark-400">
              {t('admin.tasks.partnerChannels.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPartnerForm(emptyPartnerForm);
              setPartnerEditing(true);
              setPartnerError(null);
            }}
            className="rounded-xl bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-400"
          >
            {t('admin.tasks.partnerChannels.addChannel')}
          </button>
        </div>

        {partnerEditing ? (
          <form
            onSubmit={handlePartnerSubmit}
            className="mb-3 grid gap-3 rounded-xl border border-dark-700 bg-dark-900/40 p-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('admin.tasks.partnerChannels.channel_id')}</label>
                <input
                  className={inputClass}
                  value={partnerForm.channel_id}
                  disabled={partnerForm.id !== null}
                  onChange={(e) => setPartnerForm({ ...partnerForm, channel_id: e.target.value })}
                  placeholder="-1001234567890"
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.partnerChannels.title_field')}</label>
                <input
                  className={inputClass}
                  value={partnerForm.title}
                  onChange={(e) => setPartnerForm({ ...partnerForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t('admin.tasks.partnerChannels.channel_link')}
                </label>
                <input
                  className={inputClass}
                  value={partnerForm.channel_link}
                  onChange={(e) => setPartnerForm({ ...partnerForm, channel_link: e.target.value })}
                  placeholder="https://t.me/channel"
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.tasks.partnerChannels.sort_order')}</label>
                <input
                  type="number"
                  className={inputClass}
                  value={partnerForm.sort_order}
                  onChange={(e) =>
                    setPartnerForm({ ...partnerForm, sort_order: Number(e.target.value) })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>{t('admin.tasks.partnerChannels.description')}</label>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={partnerForm.description}
                  onChange={(e) => setPartnerForm({ ...partnerForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-dark-200">
                  <input
                    type="checkbox"
                    checked={partnerForm.is_active}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, is_active: e.target.checked })
                    }
                  />
                  {t('admin.tasks.partnerChannels.is_active')}
                </label>
              </div>
            </div>

            {partnerError ? (
              <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-3 py-2 text-sm text-error-400">
                {partnerError}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createPartnerMutation.isPending || updatePartnerMutation.isPending}
                className="rounded-xl bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-400 disabled:opacity-50"
              >
                {t('admin.tasks.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPartnerForm(emptyPartnerForm);
                  setPartnerEditing(false);
                  setPartnerError(null);
                }}
                className="rounded-xl bg-dark-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-dark-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : null}

        {channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-dark-700 p-4 text-center text-xs text-dark-400">
            {t('admin.tasks.partnerChannels.empty')}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-dark-700 bg-dark-900/30 p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{c.title}</span>
                    <span className="rounded-full bg-dark-700 px-2 py-0.5 font-mono text-xs text-dark-300">
                      {c.channel_id}
                    </span>
                    {!c.is_active ? (
                      <span className="rounded-full bg-error-500/20 px-2 py-0.5 text-xs text-error-400">
                        {t('admin.tasks.inactive')}
                      </span>
                    ) : null}
                  </div>
                  {c.channel_link ? (
                    <div className="mt-0.5 truncate text-xs text-dark-400">{c.channel_link}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPartnerForm(fromPartnerChannel(c));
                    setPartnerEditing(true);
                    setPartnerError(null);
                  }}
                  className="rounded-md bg-dark-700 px-2 py-1 text-xs font-medium text-white hover:bg-dark-600"
                >
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmState({
                      message: t('admin.tasks.partnerChannels.confirmDelete'),
                      onConfirm: () => deletePartnerMutation.mutate(c.id),
                    })
                  }
                  className="rounded-md bg-error-500/20 px-2 py-1 text-xs font-medium text-error-400 hover:bg-error-500/30"
                >
                  {t('common.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Tasks list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="text-center text-dark-300">{t('common.loading')}</div>
      ) : groupedTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-dark-700 p-8 text-center text-dark-300">
          {t('admin.tasks.emptyList')}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {groupedTasks.map(({ task, depth }) => {
            const parent = task.parent_task_id ? tasksById.get(task.parent_task_id) : null;
            const targetText = formatTarget(task);
            const targetTariffId = pickNum(task.target_meta?.['tariff_id']);
            const tariffName = targetTariffId ? formatTariff(targetTariffId) : '';
            return (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dark-700 bg-dark-800/60 p-3"
                style={{ marginLeft: depth * 16 }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">{task.icon || '⭐'}</span>
                    <span className="font-medium text-white">
                      {task.title?.ru || task.title?.en || `#${task.id}`}
                    </span>
                    <span className="rounded-full bg-dark-700 px-2 py-0.5 text-xs text-dark-300">
                      L{task.level}
                    </span>
                    <span className="rounded-full bg-dark-900/60 px-2 py-0.5 font-mono text-xs text-dark-400">
                      #{task.id}
                    </span>
                    {parent ? (
                      <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs text-accent-300">
                        {t('admin.tasks.list.afterParent', {
                          id: parent.id,
                          level: parent.level,
                        })}
                      </span>
                    ) : null}
                    {!task.is_active ? (
                      <span className="rounded-full bg-error-500/20 px-2 py-0.5 text-xs text-error-400">
                        {t('admin.tasks.inactive')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-400">
                    <span>{formatTaskTypeLabel(task.task_type)}</span>
                    {targetText ? (
                      <span>
                        {t('admin.tasks.target')} {targetText}
                      </span>
                    ) : null}
                    <span>
                      {t('admin.tasks.list.rewardLabel')}{' '}
                      {formatReward(task.reward_type, task.reward_value)}
                    </span>
                    {tariffName ? (
                      <span className="rounded-full bg-dark-700 px-2 py-0.5 text-dark-300">
                        {tariffName}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startCreateChild(task)}
                    className="rounded-lg bg-accent-500/15 px-3 py-1 text-xs font-medium text-accent-300 hover:bg-accent-500/25"
                  >
                    {t('admin.tasks.actions.createNextLevel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(task)}
                    className="rounded-lg bg-dark-700 px-3 py-1 text-xs font-medium text-white hover:bg-dark-600"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        message: t('admin.tasks.confirmDelete'),
                        onConfirm: () => deleteMutation.mutate(task.id),
                      })
                    }
                    className="rounded-lg bg-error-500/20 px-3 py-1 text-xs font-medium text-error-400 hover:bg-error-500/30"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Confirm dialog ─────────────────────────────────────────────── */}
      {confirmState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur"
          onClick={() => setConfirmState(null)}
          role="presentation"
        >
          <div
            ref={confirmDialogRef}
            className="w-full max-w-sm rounded-2xl border border-dark-700 bg-dark-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-tasks-confirm-title"
          >
            <h2 id="admin-tasks-confirm-title" className="text-base font-semibold text-white">
              {confirmState.message}
            </h2>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className="flex-1 rounded-xl bg-error-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-error-500"
              >
                {t('common.delete')}
              </button>
              <button
                ref={confirmCancelRef}
                type="button"
                onClick={() => setConfirmState(null)}
                className="flex-1 rounded-xl bg-dark-700 px-4 py-2 text-sm font-medium text-white hover:bg-dark-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
