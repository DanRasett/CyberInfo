import { AUTH_TOKEN_KEY, storage } from './storage';

type ViteEnv = {
  VITE_SMARTSHELL_GRAPHQL_URL?: string;
  VITE_SMARTSHELL_COMPANY_ID?: string;
};

const env = ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) as ViteEnv;

export type SmartShellCredentials = {
  login: string;
  password: string;
  companyId?: number;
};

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

export type BookingPayload = {
  seatId: string;
  startsAt: string;
  hours: number;
  phone?: string;
  clientId?: number;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
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
  status?: string | null;
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
  online_booking_enabled?: boolean | null;
  price_list?: Array<{
    cost_map?: Array<{ title?: string | null; value?: number | null }> | null;
  }> | null;
};

type SmartShellTariffsResponse = {
  data: SmartShellTariff[];
};

const GRAPHQL_URLS = env.VITE_SMARTSHELL_GRAPHQL_URL
  ? [env.VITE_SMARTSHELL_GRAPHQL_URL]
  : [
      'https://billing.smartshell.gg/api/graphql',
      'https://owner.smartshell.gg/api/graphql',
      'https://mobile-auth.smartshell.gg/api/graphql',
      'https://host.smartshell.gg/api/graphql',
    ];
const COMPANY_ID = env.VITE_SMARTSHELL_COMPANY_ID ? Number(env.VITE_SMARTSHELL_COMPANY_ID) : undefined;
let workingGraphqlUrl: string | null = null;

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

const requestLocalApi = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Local SmartShell API error ${response.status}`);
  }

  return (await response.json()) as T;
};

const graphqlAt = async <T>(url: string, query: string, variables?: Record<string, unknown>): Promise<T> => {
  const token = await storage.get<string>(AUTH_TOKEN_KEY);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`SmartShell API error ${response.status}`);
  }

  const payload = (await response.json()) as GraphqlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('SmartShell API returned empty data');
  }

  return payload.data;
};

const graphql = async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
  const urls = workingGraphqlUrl ? [workingGraphqlUrl, ...GRAPHQL_URLS.filter((url) => url !== workingGraphqlUrl)] : GRAPHQL_URLS;
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const data = await graphqlAt<T>(url, query, variables);
      workingGraphqlUrl = url;
      return data;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join('\n'));
};

const graphqlString = (value: string) => JSON.stringify(value);

const formatSmartShellDate = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
};

const activeSession = (sessions?: SmartShellClientSession[] | null) => sessions?.[0] ?? null;

const bookingIsActive = (bookings?: SmartShellHost['bookings']) =>
  Boolean(bookings?.length) &&
  (bookings?.some((booking) => ['ACTIVE', 'REDEEMED'].includes(String(booking.status ?? ''))) ?? true);

const activeBooking = (bookings?: SmartShellHost['bookings']) =>
  bookings?.find((booking) => ['ACTIVE', 'REDEEMED'].includes(String(booking.status ?? '')) || !booking.status) ?? null;

const hostStatus = (host: SmartShellHost, session: SmartShellClientSession | null): PcStatus => {
  if (host.in_service) return 'offline';
  if (session || isInfiniteSessionHost(host)) return 'busy';
  if (bookingIsActive(host.bookings)) return 'reserved';
  return 'free';
};

const isInfiniteSessionHost = (host: SmartShellHost) => {
  const mode = String(host.shell_mode ?? '').toLowerCase();
  const comment = String(host.comment ?? '').toLowerCase();
  const text = `${mode} ${comment}`;

  return (
    host.locked === true ||
    text.includes('shell') ||
    text.includes('high') ||
    text.includes('access') ||
    text.includes('снят') ||
    text.includes('шел') ||
    text.includes('высок')
  );
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

export const loginToSmartShell = async (credentials: SmartShellCredentials) => {
  const companyId = credentials.companyId ?? COMPANY_ID;
  const companyPart = companyId ? `company_id:${companyId}` : '';
  const data = await graphql<{
    login: {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
    };
  }>(`
    mutation login {
      login(input:{
        login:${graphqlString(credentials.login)}
        password:${graphqlString(credentials.password)}
        ${companyPart}
      }) {
        access_token
        token_type
        refresh_token
        expires_in
      }
    }
  `);

  await storage.set(AUTH_TOKEN_KEY, data.login.access_token);
  return data.login;
};

export const logoutFromSmartShell = async () => {
  await storage.remove(AUTH_TOKEN_KEY);
};

export const getDetailedWorkers = async (): Promise<PcSeat[]> => {
  try {
    const hosts = await requestLocalApi<SmartShellHost[]>('/api/smartshell/hosts');
    return sortHosts(hosts).map(normalizeHost);
  } catch {
    try {
      const data = await graphql<{ hostsOverview: SmartShellHost[] }>(`
        query hosts {
          hostsOverview {
            id
            group_id
            type_id
            alias
            position
            in_service
            online
            locked
            shell_mode
            comment
            bookings {
              id
              status
              from
              to
            }
            client_sessions {
              id
              duration
              elapsed
              time_left
              started_at
              finished_at
            }
          }
        }
      `);

      return sortHosts(data.hostsOverview).map(normalizeHost);
    } catch {
      return fallbackSeats;
    }
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
    try {
      const data = await graphql<{ tariffs: SmartShellTariffsResponse }>(`
        query tariffs {
          tariffs(page:1) {
            data {
              id
              title
              duration
              description
              is_active
              show_in_shell
              show_in_billing
              online_booking_enabled
              price_list {
                cost_map {
                  title
                  value
                }
              }
            }
          }
        }
      `);

      return data.tariffs.data
        .filter((tariff) => tariff.is_active !== false)
        .filter((tariff) => tariff.show_in_shell !== false || tariff.show_in_billing !== false)
        .map(normalizeTariff);
    } catch {
      return fallbackTariffs;
    }
  }
};

export const createBooking = async (payload: BookingPayload) => {
  const from = new Date(payload.startsAt);
  const to = new Date(from.getTime() + payload.hours * 60 * 60 * 1000);
  const clientPart = payload.clientId ? `client:${payload.clientId}` : '';
  const commentPart = payload.phone ? `comment:${graphqlString(`Телефон: ${payload.phone}`)}` : '';

  return graphql(`
    mutation createBooking {
      createBooking(input:{
        hosts:[${Number(payload.seatId)}]
        from:${graphqlString(formatSmartShellDate(from))}
        to:${graphqlString(formatSmartShellDate(to))}
        ${clientPart}
        ${commentPart}
      }) {
        id
        hosts
        from
        to
        status
        startsIn
        group
      }
    }
  `);
};

export const getUserRole = async () => {
  return graphql(`
    query roles {
      roles {
        id
        title
      }
    }
  `);
};

export const getGoodsLogs = async () => {
  return graphql(`
    query goods {
      goods {
        id
        title
        amount
      }
    }
  `);
};
