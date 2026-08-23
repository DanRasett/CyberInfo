export type PcStatus = 'free' | 'busy' | 'reserved' | 'offline';

export type PcSeat = {
  id: string;
  name: string;
  position: number | null;
  group: 'pc' | 'console';
  status: PcStatus;
  isActive: boolean;
  isInfiniteSession: boolean;
  remainingMinutes: number | null;
  sessionEndsAt: string | null;
  bookingStartsAt: string | null;
  pricePerHour: number;
};

export type Tariff = {
  id: string;
  title: string;
  durationHours: number;
  price: number;
  description: string;
};

export type ShiftOperator = {
  id: string | null;
  displayName: string;
  phone: string;
};

type SmartShellHost = {
  id: number;
  group_id?: number;
  type_id?: number;
  alias?: string | null;
  position?: number | null;
  in_service?: boolean | null;
  online?: boolean | null;
  locked?: boolean | null;
  shell_mode?: string | null;
  comment?: string | null;
  client_sessions?: SmartShellClientSession[] | null;
  bookings?: Array<{ id?: number; status?: string | null; from?: string | null; to?: string | null }> | null;
};

type SmartShellClientSession = {
  id?: number;
  duration?: number | null;
  elapsed?: number | null;
  time_left?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
};

type SmartShellTariff = {
  id: number;
  title?: string | null;
  duration?: number | null;
  description?: string | null;
  is_active?: boolean | null;
  show_in_shell?: boolean | null;
  show_in_billing?: boolean | null;
  price_list?: Array<{
    cost_map?: Array<{ title?: string | null; value?: number | null }> | null;
  }> | null;
};

type SmartShellShiftWorker = {
  id?: number | string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  phone?: string | null;
};

type SmartShellActiveShift = {
  worker?: SmartShellShiftWorker | null;
};

const fallbackSeats: PcSeat[] = [
  {
    id: 'pc-01',
    name: 'PC 01',
    position: 1,
    group: 'pc',
    status: 'free',
    isActive: false,
    isInfiniteSession: false,
    remainingMinutes: null,
    sessionEndsAt: null,
    bookingStartsAt: null,
    pricePerHour: 80,
  },
  {
    id: 'pc-02',
    name: 'PC 02',
    position: 2,
    group: 'pc',
    status: 'busy',
    isActive: true,
    isInfiniteSession: false,
    remainingMinutes: 42,
    sessionEndsAt: null,
    bookingStartsAt: null,
    pricePerHour: 80,
  },
  {
    id: 'pc-03',
    name: 'PC 03',
    position: 3,
    group: 'pc',
    status: 'busy',
    isActive: true,
    isInfiniteSession: false,
    remainingMinutes: 118,
    sessionEndsAt: null,
    bookingStartsAt: null,
    pricePerHour: 80,
  },
  {
    id: 'pc-04',
    name: 'PC 04',
    position: 4,
    group: 'pc',
    status: 'reserved',
    isActive: false,
    isInfiniteSession: false,
    remainingMinutes: null,
    sessionEndsAt: null,
    bookingStartsAt: new Date().toISOString(),
    pricePerHour: 80,
  },
  {
    id: 'pc-05',
    name: 'PC 05',
    position: 5,
    group: 'pc',
    status: 'offline',
    isActive: false,
    isInfiniteSession: false,
    remainingMinutes: null,
    sessionEndsAt: null,
    bookingStartsAt: null,
    pricePerHour: 80,
  },
  {
    id: 'pc-06',
    name: 'PC 06',
    position: 6,
    group: 'pc',
    status: 'free',
    isActive: false,
    isInfiniteSession: false,
    remainingMinutes: null,
    sessionEndsAt: null,
    bookingStartsAt: null,
    pricePerHour: 80,
  },
];

const fallbackTariffs: Tariff[] = [
  {
    id: 'hour',
    title: '1 час',
    durationHours: 1,
    price: 80,
    description: 'Быстрый старт для игры после учебы или работы.',
  },
  {
    id: 'pack-3',
    title: '3 часа',
    durationHours: 3,
    price: 220,
    description: 'Оптимальный пакет для рейтинговых матчей.',
  },
  {
    id: 'night',
    title: 'Ночной пакет',
    durationHours: 6,
    price: 420,
    description: 'Длинная игровая сессия с максимальной выгодой.',
  },
];

const fallbackShiftOperator: ShiftOperator = {
  id: null,
  displayName: 'Сотрудник не определен',
  phone: '',
};

const requestLocalApi = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Local SmartShell API error ${response.status}`);
  }

  return (await response.json()) as T;
};

const normalizeShiftOperator = (shift: SmartShellActiveShift | null): ShiftOperator => {
  const worker = shift?.worker;
  const displayName = [worker?.first_name, worker?.last_name, worker?.middle_name].filter(Boolean).join(' ').trim();

  return {
    id: worker?.id != null ? String(worker.id) : null,
    displayName: displayName || worker?.nickname || 'Сотрудник не определен',
    phone: worker?.phone ?? '',
  };
};

const activeSession = (sessions?: SmartShellClientSession[] | null) => sessions?.[0] ?? null;

const bookingIsActive = (bookings?: SmartShellHost['bookings']) =>
  Boolean(bookings?.length) &&
  (bookings?.some((booking) => ['ACTIVE', 'REDEEMED'].includes(String(booking.status ?? ''))) ?? true);

const activeBooking = (bookings?: SmartShellHost['bookings']) =>
  bookings?.find((booking) => ['ACTIVE', 'REDEEMED'].includes(String(booking.status ?? '')) || !booking.status) ?? null;

const isInfiniteSessionHost = (host: SmartShellHost) => {
  const mode = String(host.shell_mode ?? '').toUpperCase();
  return mode === 'DISABLED' || mode === 'HIGH_ACCESS';
};

const hostStatus = (host: SmartShellHost, session: SmartShellClientSession | null): PcStatus => {
  if (host.in_service) return 'offline';
  if (session || isInfiniteSessionHost(host)) return 'busy';
  if (bookingIsActive(host.bookings)) return 'reserved';
  return 'free';
};

const hostGroup = (host: SmartShellHost): PcSeat['group'] => {
  const value = `${host.alias ?? ''}`.toLowerCase();
  return value.includes('console') || value.includes('ps') || value.includes('playstation') ? 'console' : 'pc';
};

const pickTariffPrice = (tariff: SmartShellTariff) => {
  const costMaps = tariff.price_list?.flatMap((item) => item.cost_map ?? []) ?? [];
  const guestPrice = costMaps.find((item) => item.title === 'DEFAULT')?.value;
  const anyPrice = costMaps.find((item) => typeof item.value === 'number')?.value;
  return Number(guestPrice ?? anyPrice ?? 0);
};

const normalizeTariff = (tariff: SmartShellTariff): Tariff => ({
  id: String(tariff.id),
  title: tariff.title ?? `Тариф ${tariff.id}`,
  durationHours: Math.max(1, Math.round((tariff.duration ?? 3600) / 3600)),
  price: pickTariffPrice(tariff),
  description: tariff.description ?? 'Игровой тариф CyberStreet.',
});

const normalizeHost = (host: SmartShellHost): PcSeat => {
  const session = activeSession(host.client_sessions);
  const remainingMinutes =
    typeof session?.time_left === 'number' ? Math.max(0, Math.ceil(session.time_left / 60)) : null;
  const status = hostStatus(host, session);
  const isInfiniteSession = !session && isInfiniteSessionHost(host);

  return {
    id: String(host.id),
    name: host.alias || `PC ${host.position ?? host.id}`,
    position: typeof host.position === 'number' ? host.position : null,
    group: hostGroup(host),
    status,
    isActive: status === 'busy',
    isInfiniteSession,
    remainingMinutes,
    sessionEndsAt: session?.finished_at ?? null,
    bookingStartsAt: activeBooking(host.bookings)?.from ?? null,
    pricePerHour: 80,
  };
};

const hostSortValue = (host: SmartShellHost) => {
  if (typeof host.position === 'number') return host.position;

  const numberFromAlias = String(host.alias ?? '').match(/\d+/)?.[0];
  if (numberFromAlias) return Number(numberFromAlias);

  return host.id;
};

const sortHosts = (hosts: SmartShellHost[]) =>
  [...hosts].sort((a, b) => {
    const groupDiff = hostGroup(a).localeCompare(hostGroup(b));
    if (groupDiff !== 0) return groupDiff;
    return hostSortValue(a) - hostSortValue(b);
  });

export const getDetailedWorkers = async (): Promise<PcSeat[]> => {
  try {
    const hosts = await requestLocalApi<SmartShellHost[]>('/api/smartshell/hosts');
    return sortHosts(hosts).map(normalizeHost);
  } catch {
    return fallbackSeats;
  }
};

export const getTariffs = async (): Promise<Tariff[]> => {
  try {
    const tariffs = await requestLocalApi<SmartShellTariff[]>('/api/smartshell/tariffs');
    return tariffs
      .filter((tariff) => tariff.is_active !== false)
      .filter((tariff) => tariff.show_in_shell !== false || tariff.show_in_billing !== false)
      .map(normalizeTariff);
  } catch {
    return fallbackTariffs;
  }
};

export const getShiftOperator = async (): Promise<ShiftOperator> => {
  try {
    const shift = await requestLocalApi<SmartShellActiveShift | null>('/api/smartshell/shift');
    return normalizeShiftOperator(shift);
  } catch {
    return fallbackShiftOperator;
  }
};
