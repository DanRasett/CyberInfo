import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { getDetailedWorkers, getShiftOperator, PcSeat, ShiftOperator } from './src/smartshell';

const REFRESH_INTERVAL_MS = 30000;
const TRANSFER_PHONE_STORAGE_KEY = 'cyberstreet-transfer-phone';
const TRANSFER_BANK_STORAGE_KEY = 'cyberstreet-transfer-bank';

const statusText: Record<PcSeat['status'], string> = {
  free: 'Свободен',
  busy: 'Занят',
  reserved: 'Бронь',
  offline: 'Недоступен',
};

const standardHourly = [
  { label: 'Будни', one: '90 ₽', three: '240 ₽', five: '350 ₽' },
  { label: 'Пт - Вс', one: '100 ₽', three: '270 ₽', five: '370 ₽' },
];

const bootcampHourly = [
  { label: 'Будни', one: '110 ₽', three: '270 ₽', five: '390 ₽' },
  { label: 'Пт - Вс', one: '120 ₽', three: '320 ₽', five: '420 ₽' },
];

const standardPacks = [
  { label: 'Будни', day: '400 ₽', night: '350 ₽' },
  { label: 'Пт - Вс', day: '500 ₽', night: '400 ₽' },
];

const bootcampPacks = [
  { label: 'Будни', day: '600 ₽', night: '500 ₽' },
  { label: 'Пт - Вс', day: '700 ₽', night: '550 ₽' },
];

const promoBlocks = [
  { title: 'Лототрон', text: 'Пополнение от 400 ₽ дает вращение барабана с призами', tone: 'warm' },
  { title: '+100 ₽ новым', text: 'Бонус при первом пополнении от 200 ₽', tone: 'cool' },
  { title: 'Баланс x2', text: 'В день рождения удваивается сумма пополнения', tone: 'warm' },
  { title: 'Утро Пн-Пт', text: 'С 08:00 до 14:00 стоимость от 60 ₽ в час', tone: 'cool' },
];

const mapPositions: Record<number, { left: number; top: number }> = {
  1: { left: 210, top: 65 },
  2: { left: 210, top: 158 },
  3: { left: 210, top: 251 },
  4: { left: 210, top: 344 },
  5: { left: 210, top: 437 },
  6: { left: 312, top: 437 },
  7: { left: 312, top: 344 },
  8: { left: 312, top: 251 },
  9: { left: 312, top: 158 },
  10: { left: 312, top: 65 },
  11: { left: 447, top: 65 },
  12: { left: 447, top: 158 },
  13: { left: 447, top: 251 },
  14: { left: 447, top: 344 },
  15: { left: 447, top: 437 },
  16: { left: 674, top: 65 },
  17: { left: 674, top: 158 },
  18: { left: 674, top: 251 },
  19: { left: 674, top: 344 },
  20: { left: 674, top: 437 },
};

const walls = [
  { left: 16, top: 16, width: 42, height: 16 },
  { left: 143, top: 16, width: 524, height: 16 },
  { left: 674, top: 16, width: 68, height: 16 },
  { left: 751, top: 16, width: 42, height: 16 },
  { left: 18, top: 65, width: 16, height: 675 },
  { left: 777, top: 65, width: 16, height: 675 },
  { left: 548, top: 65, width: 16, height: 372 },
  { left: 33, top: 548, width: 152, height: 16 },
  { left: 168, top: 565, width: 16, height: 24 },
  { left: 548, top: 522, width: 16, height: 68 },
  { left: 564, top: 548, width: 214, height: 16 },
  { left: 18, top: 775, width: 775, height: 16 },
  { left: 168, top: 672, width: 16, height: 68 },
  { left: 548, top: 672, width: 16, height: 68 },
];

const extractSeatNumber = (seat: PcSeat) => {
  if (typeof seat.position === 'number') {
    if (seat.position >= 1 && seat.position <= 20) return seat.position;
    if (seat.position >= 0 && seat.position <= 19) return seat.position + 1;
  }

  return Number(seat.name.match(/\d+/)?.[0] ?? 0);
};

const formatRemaining = (minutes: number | null) => {
  if (minutes === null) return '';
  if (minutes <= 0) return '00:00';

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
};

const formatBookingTime = (value: string | null) => {
  if (!value) return '';

  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatClock = (value: Date) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(value);

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(value);

const formatTimestamp = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(value)
    : 'нет данных';

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits.startsWith('7') ? digits : `7${digits}`;
  const limited = normalized.slice(0, 11);
  const local = limited.slice(1);

  let result = '+7';

  if (local.length > 0) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += local.slice(3, 6);
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;

  return result;
};

const storageGet = (key: string) => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
};

const storageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
};

const App = () => {
  const { width, height } = useWindowDimensions();
  const [seats, setSeats] = useState<PcSeat[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [shiftOperator, setShiftOperator] = useState<ShiftOperator>({
    id: null,
    displayName: 'Сотрудник не определен',
    phone: '',
  });
  const [transferPhone, setTransferPhone] = useState(() => formatPhoneNumber(storageGet(TRANSFER_PHONE_STORAGE_KEY)));
  const [transferBank, setTransferBank] = useState(() => storageGet(TRANSFER_BANK_STORAGE_KEY));
  const [operatorName, setOperatorName] = useState(() => storageGet(TRANSFER_BANK_STORAGE_KEY));
  const transferSweep = React.useRef(new Animated.Value(0)).current;
  const transferPulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(transferSweep, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(120),
      ]),
      { resetBeforeIteration: true },
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(transferPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(transferPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    sweep.start();
    pulse.start();

    return () => {
      sweep.stop();
      pulse.stop();
    };
  }, [transferPulse, transferSweep]);

  useEffect(() => {
    let mounted = true;

    const load = async (showLoader: boolean) => {
      if (showLoader && mounted) setLoading(true);

      try {
        const [nextSeats, nextShiftOperator] = await Promise.all([getDetailedWorkers(), getShiftOperator()]);
        if (mounted) {
          setSeats(nextSeats);
          setShiftOperator(nextShiftOperator);
          setLastUpdatedAt(new Date());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load(false);
    };

    load(true);
    const timer = setInterval(poll, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const isCompact = width < 1500;
  const isStacked = width < 1240;
  const isPhone = width < 900;
  const mapScale = useMemo(() => {
    if (width >= 1850 && height >= 1000) return 0.96;
    if (width >= 1600) return 0.9;
    if (width >= 1360) return 0.82;
    if (width >= 1080) return 0.72;
    return 0.58;
  }, [height, width]);

  const pcs = useMemo(() => seats.filter((seat) => seat.group === 'pc'), [seats]);
  const consoles = useMemo(() => seats.filter((seat) => seat.group === 'console'), [seats]);
  const freeCount = useMemo(() => pcs.filter((seat) => seat.status === 'free').length, [pcs]);
  const busyCount = useMemo(() => pcs.filter((seat) => seat.status === 'busy').length, [pcs]);
  const reservedCount = useMemo(() => pcs.filter((seat) => seat.status === 'reserved').length, [pcs]);
  const isWeekend = [0, 5, 6].includes(now.getDay());
  const occupancy = pcs.length ? Math.round((busyCount / pcs.length) * 100) : 0;

  const pagePadding = isPhone ? 14 : isCompact ? 20 : 26;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#091017" />
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            minHeight: height,
            paddingHorizontal: pagePadding,
            paddingTop: isPhone ? 12 : 18,
            paddingBottom: isPhone ? 12 : 18,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerShell, isStacked && styles.headerShellStacked]}>
          <View style={styles.headerPrimary}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>ADMIN DESK</Text>
            </View>
            <Text style={[styles.logo, isPhone && styles.logoPhone]}>CyberStreet</Text>
            <Text style={[styles.subtitle, isPhone && styles.subtitlePhone]}>
              Карта клуба, занятость хостов и ключевые тарифы на одном экране
            </Text>
          </View>

          <View style={[styles.headerMeta, isPhone && styles.headerMetaPhone]}>
            <View style={styles.liveCard}>
              <View style={styles.liveDot} />
              <View>
                <Text style={styles.liveLabel}>Обновление данных</Text>
                <Text style={styles.liveValue}>каждые 30 секунд</Text>
              </View>
            </View>
            <View style={styles.clockBlock}>
              <Text style={[styles.clockValue, isPhone && styles.clockValuePhone]}>{formatClock(now)}</Text>
              <Text style={styles.clockDate}>{formatDate(now)}</Text>
              <Text style={styles.clockMeta}>Последнее обновление: {formatTimestamp(lastUpdatedAt)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statsRow, isStacked && styles.statsRowStacked]}>
          <MetricCard value={pcs.length} label="Всего ПК" tone="neutral" />
          <MetricCard value={freeCount} label="Свободно" tone="success" />
          <MetricCard value={busyCount} label="Занято" tone="info" />
          <MetricCard value={reservedCount} label="Бронь" tone="warning" />
          <MetricCard value={`${occupancy}%`} label="Загрузка" tone="accent" />
        </View>

        <View style={[styles.mainGrid, isStacked && styles.mainGridStacked]}>
          <View style={styles.leftColumn}>
            <View style={styles.panel}>
              <View style={[styles.panelHeader, isPhone && styles.panelHeaderStacked]}>
                <View>
                  <Text style={styles.panelEyebrow}>LIVE MAP</Text>
                  <Text style={styles.panelTitle}>Карта зала</Text>
                </View>
                <View style={[styles.legend, isPhone && styles.legendWrap]}>
                  <LegendDot color="#4ade80" label="Свободен" />
                  <LegendDot color="#38bdf8" label="Занят" />
                  <LegendDot color="#f59e0b" label="Бронь" />
                  <LegendDot color="#f87171" label="Сервис" />
                </View>
              </View>

              {isLoading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator color="#7dd3fc" size="large" />
                  <Text style={styles.loaderText}>Загружаем актуальную схему клуба...</Text>
                </View>
              ) : (
                <ClubMap seats={pcs} mapScale={mapScale} compact={isCompact} />
              )}
            </View>
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.panel}>
              <View style={[styles.panelHeader, styles.priceHeaderMain, isPhone && styles.panelHeaderStacked]}>
                <View>
                  <Text style={styles.panelEyebrow}>PRICE BOARD</Text>
                  <Text style={styles.panelTitle}>Тарифы и пакеты</Text>
                </View>
                <Text style={styles.panelMeta}>Цены для быстрого ответа у стойки администратора</Text>
              </View>

              <View style={[styles.tariffPanels, isCompact && styles.tariffPanelsCompact]}>
                <TariffPanel title="Standard" accent="cyan" isWeekend={isWeekend} rows={standardHourly} packs={standardPacks} />
                <TariffPanel title="Bootcamp" accent="amber" isWeekend={isWeekend} rows={bootcampHourly} packs={bootcampPacks} />
              </View>

              <View style={[styles.promoGrid, isPhone && styles.promoGridPhone]}>
                {promoBlocks.map((promo) => (
                  <View
                    key={promo.title}
                    style={[styles.promoCard, promo.tone === 'cool' ? styles.promoCool : styles.promoWarm]}
                  >
                    <Text style={styles.promoTitle}>{promo.title}</Text>
                    <Text style={styles.promoText}>{promo.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.bottomRow}>
              <View style={[styles.panel, styles.summaryPanel, styles.transferHighlightShell]}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.transferSweep,
                    {
                      opacity: transferSweep.interpolate({
                        inputRange: [0, 0.1, 0.9, 1],
                        outputRange: [0, 0.34, 0.34, 0],
                      }),
                      transform: [
                        {
                          translateX: transferSweep.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-240, 380],
                          }),
                        },
                        { rotate: '18deg' },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.transferHalo,
                    {
                      opacity: transferPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.22, 0.48],
                      }),
                    },
                  ]}
                />
                <Text style={styles.panelEyebrow}>TRANSFER</Text>
                <Text style={styles.panelTitle}>Номер для перевода</Text>
                <View style={styles.transferForm}>
                  <FieldBlock label="Сотрудник на смене" value={operatorName} />
                  <FieldBlock
                    label="Номер телефона"
                    value={transferPhone}
                    onChangeText={(value) => {
                      const formattedValue = formatPhoneNumber(value);
                      setTransferPhone(formattedValue);
                      storageSet(TRANSFER_PHONE_STORAGE_KEY, formattedValue);
                    }}
                    placeholder="+7 (___) ___-__-__"
                    keyboardType="phone-pad"
                  />
                  <FieldBlock
                    label="Банк для перевода"
                    value={transferBank}
                    onChangeText={(value) => {
                      setTransferBank(value);
                      storageSet(TRANSFER_BANK_STORAGE_KEY, value);
                    }}
                    placeholder="Например, Сбер или Т-Банк"
                  />
                </View>
              </View>

              {consoles.length > 0 && (
                <View style={[styles.panel, styles.consolePanel]}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelEyebrow}>CONSOLES</Text>
                      <Text style={styles.panelTitle}>Консольная зона</Text>
                    </View>
                  </View>
                  <View style={styles.consoleList}>
                    {consoles.map((seat) => (
                      <SeatCard key={seat.id} seat={seat} compact={false} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const MetricCard = ({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'info' | 'warning' | 'accent';
  value: number | string;
}) => (
  <View style={[styles.metricCard, styles[`metric_${tone}`]]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const FieldBlock = ({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  readonly = false,
  value,
}: {
  keyboardType?: 'default' | 'phone-pad';
  label: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  value: string;
}) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {readonly ? (
      <View style={[styles.fieldShell, styles.fieldReadonlyShell]}>
        <Text style={styles.fieldReadonlyValue}>{value || 'Не заполнено'}</Text>
      </View>
    ) : (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#6f8798"
        style={styles.fieldInput}
      />
    )}
  </View>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const TariffPanel = ({
  title,
  accent,
  isWeekend,
  rows,
  packs,
}: {
  title: string;
  accent: 'cyan' | 'amber';
  isWeekend: boolean;
  rows: Array<{ label: string; one: string; three: string; five: string }>;
  packs: Array<{ label: string; day: string; night: string }>;
}) => (
  <View style={[styles.tariffPanel, accent === 'cyan' ? styles.tariffCyan : styles.tariffAmber]}>
    <View style={styles.tariffPanelHeader}>
      <Text style={styles.tariffTitle}>{title}</Text>
      <View style={[styles.tariffAccent, accent === 'cyan' ? styles.accentCyan : styles.accentAmber]} />
    </View>

    <Text style={styles.tariffBlockTitle}>Почасовые</Text>
    <View style={styles.rateHeader}>
      <Text style={styles.rateHeaderLabel}>Период</Text>
      <Text style={styles.rateHeaderCell}>1ч</Text>
      <Text style={styles.rateHeaderCell}>3ч</Text>
      <Text style={styles.rateHeaderCell}>5ч</Text>
    </View>
    {rows.map((row) => {
      const active = row.label === (isWeekend ? 'Пт - Вс' : 'Будни');

      return (
        <View key={row.label} style={styles.rateRow}>
          <Text style={[styles.rateLabel, active ? styles.rateLabelActive : styles.rateLabelInactive]}>{row.label}</Text>
          <Text style={[styles.rateValue, active ? styles.rateValueActive : styles.rateValueInactive]}>{row.one}</Text>
          <Text style={[styles.rateValue, active ? styles.rateValueActive : styles.rateValueInactive]}>{row.three}</Text>
          <Text style={[styles.rateValue, active ? styles.rateValueActive : styles.rateValueInactive]}>{row.five}</Text>
        </View>
      );
    })}

    <Text style={[styles.tariffBlockTitle, styles.tariffBlockGap]}>Пакеты</Text>
    <View style={styles.rateHeader}>
      <Text style={styles.rateHeaderLabel}>Период</Text>
      <Text style={styles.rateHeaderCell}>День</Text>
      <Text style={styles.rateHeaderCell}>Ночь</Text>
    </View>
    {packs.map((row) => {
      const active = row.label === (isWeekend ? 'Пт - Вс' : 'Будни');

      return (
        <View key={row.label} style={styles.packRow}>
          <Text style={[styles.rateLabel, active ? styles.rateLabelActive : styles.rateLabelInactive]}>{row.label}</Text>
          <Text style={[styles.packValue, active ? styles.rateValueActive : styles.rateValueInactive]}>{row.day}</Text>
          <Text style={[styles.packValue, active ? styles.rateValueActive : styles.rateValueInactive]}>{row.night}</Text>
        </View>
      );
    })}
  </View>
);const ClubMap = ({
  seats,
  mapScale,
  compact,
}: {
  seats: PcSeat[];
  mapScale: number;
  compact: boolean;
}) => {
  const placedSeats = seats.filter((seat) => mapPositions[extractSeatNumber(seat)]);
  const unplacedSeats = seats.filter((seat) => !mapPositions[extractSeatNumber(seat)]);

  return (
    <View>
      <View style={styles.mapShell}>
        <View style={[styles.mapViewport, { width: 824 * mapScale, height: 808 * mapScale }]}>
          <View style={[styles.mapCanvas, { transform: [{ scale: mapScale }] }]}>
            {walls.map((wall, index) => (
              <View key={index} style={[styles.wall, wall]} />
            ))}

            <Text style={[styles.mapLabel, { left: 146, top: 70 }]}>Общий зал</Text>
            <Text style={[styles.mapLabel, { left: 662, top: 545 }]}>VIP-зал</Text>
            <Text style={[styles.mapMark, { left: 62, top: 620 }]}>ADMIN DESK</Text>
            <Text style={[styles.mapMark, { left: 90, top: 704 }]}>BAR</Text>
            <Text style={[styles.mapMark, { left: 666, top: 704 }]}>WC</Text>

            {placedSeats.map((seat) => {
              const number = extractSeatNumber(seat);
              return (
                <View key={seat.id} style={[styles.mapSeatPosition, mapPositions[number]]}>
                  <SeatCard seat={seat} compact />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {unplacedSeats.length > 0 && (
        <View style={styles.unplacedShell}>
          <Text style={styles.unplacedTitle}>Хосты вне схемы: {unplacedSeats.length}</Text>
          <View style={[styles.unplacedRow, compact && styles.unplacedRowCompact]}>
            {unplacedSeats.map((seat) => (
              <SeatCard key={seat.id} seat={seat} compact={false} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const SeatCard = ({ seat, compact }: { seat: PcSeat; compact: boolean }) => {
  const number = extractSeatNumber(seat);
  const remaining = formatRemaining(seat.remainingMinutes);
  const bookingTime = formatBookingTime(seat.bookingStartsAt);
  const sessionLabel = seat.isInfiniteSession ? 'Безлимит' : remaining;

  return (
    <View style={[compact ? styles.mapSeat : styles.consoleSeat, styles[`seat_${seat.status}`]]}>
      <View style={styles.seatTopRow}>
        <Text style={[styles.seatNumber, seat.status === 'busy' && styles.seatNumberBusy]}>
          {number || seat.name}
        </Text>
        <View style={[styles.seatBadge, styles[`badge_${seat.status}`]]}>
          <Text style={styles.seatBadgeText}>{statusText[seat.status]}</Text>
        </View>
      </View>

      {sessionLabel ? (
        <Text style={[styles.seatTime, seat.isInfiniteSession && styles.seatInfinite]}>
          {seat.isInfiniteSession ? sessionLabel : `Осталось ${sessionLabel}`}
        </Text>
      ) : bookingTime ? (
        <Text style={styles.seatBooking}>Бронь {bookingTime}</Text>
      ) : (
        <Text style={styles.seatStatus}>{statusText[seat.status]}</Text>
      )}
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#081018',
  },
  page: {
    width: '100%',
    maxWidth: 1920,
    marginHorizontal: 'auto',
    gap: 18,
  },
  headerShell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 18,
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.12)',
    backgroundColor: 'rgba(7, 16, 24, 0.88)',
  },
  headerShellStacked: {
    flexDirection: 'column',
  },
  headerPrimary: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 138,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#123044',
    borderWidth: 1,
    borderColor: '#20506f',
  },
  brandBadgeText: {
    color: '#7dd3fc',
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '800',
  },
  logo: {
    marginTop: 14,
    color: '#f8fafc',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  logoPhone: {
    fontSize: 40,
    lineHeight: 44,
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 720,
    color: '#9eb4c5',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
  },
  subtitlePhone: {
    fontSize: 15,
    lineHeight: 22,
  },
  headerMeta: {
    width: 420,
    gap: 14,
    alignItems: 'stretch',
  },
  headerMetaPhone: {
    width: '100%',
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 30, 45, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#4ade80',
  },
  liveLabel: {
    color: '#8fb2c7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liveValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  clockBlock: {
    flex: 1,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#111f2c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
  },
  clockValue: {
    color: '#f8fafc',
    fontSize: 48,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -1,
  },
  clockValuePhone: {
    fontSize: 40,
    lineHeight: 42,
  },
  clockDate: {
    marginTop: 8,
    color: '#8fb2c7',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  clockMeta: {
    marginTop: 12,
    color: '#c4d5e2',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statsRowStacked: {
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  metric_neutral: {
    backgroundColor: '#101a24',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metric_success: {
    backgroundColor: 'rgba(10, 43, 31, 0.92)',
    borderColor: 'rgba(74, 222, 128, 0.24)',
  },
  metric_info: {
    backgroundColor: 'rgba(9, 34, 53, 0.92)',
    borderColor: 'rgba(56, 189, 248, 0.24)',
  },
  metric_warning: {
    backgroundColor: 'rgba(52, 34, 10, 0.92)',
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  metric_accent: {
    backgroundColor: 'rgba(26, 23, 46, 0.92)',
    borderColor: 'rgba(129, 140, 248, 0.24)',
  },
  metricLabel: {
    color: '#8fb2c7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 10,
    color: '#f8fafc',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900',
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  mainGridStacked: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 1.2,
  },
  rightColumn: {
    flex: 1,
    gap: 18,
  },
  panel: {
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 16, 24, 0.92)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  panelHeaderStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  panelEyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  panelTitle: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  panelMeta: {
    color: '#9eb4c5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    maxWidth: 240,
  },
  loaderWrap: {
    height: 540,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loaderText: {
    color: '#8fb2c7',
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendWrap: {
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: '#c4d5e2',
    fontSize: 13,
    fontWeight: '700',
  },
  mapShell: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#09131c',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.08)',
  },
  mapViewport: {
    overflow: 'hidden',
    borderRadius: 18,
    alignSelf: 'center',
  },
  mapCanvas: {
    width: 824,
    height: 808,
    position: 'relative',
    backgroundColor: '#081018',
    transformOrigin: 'top left',
  },
  wall: {
    position: 'absolute',
    backgroundColor: '#22313f',
  },
  mapLabel: {
    position: 'absolute',
    color: '#8fb2c7',
    fontSize: 13,
    fontWeight: '700',
  },
  mapMark: {
    position: 'absolute',
    color: '#4fd1c5',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  mapSeatPosition: {
    position: 'absolute',
  },
  mapSeat: {
    width: 94,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  consoleSeat: {
    flex: 1,
    minWidth: 182,
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  seat_free: {
    backgroundColor: 'rgba(9, 45, 28, 0.96)',
    borderColor: 'rgba(74, 222, 128, 0.28)',
  },
  seat_busy: {
    backgroundColor: 'rgba(7, 34, 51, 0.96)',
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  seat_reserved: {
    backgroundColor: 'rgba(57, 35, 8, 0.96)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  seat_offline: {
    backgroundColor: 'rgba(57, 17, 20, 0.96)',
    borderColor: 'rgba(248, 113, 113, 0.28)',
  },
  seatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  seatNumber: {
    color: '#f8fafc',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  seatNumberBusy: {
    color: '#bfe8ff',
  },
  seatBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badge_free: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
  },
  badge_busy: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  badge_reserved: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  badge_offline: {
    backgroundColor: 'rgba(248, 113, 113, 0.16)',
  },
  seatBadgeText: {
    color: '#e2edf5',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seatTime: {
    marginTop: 10,
    color: '#d8edf8',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  seatInfinite: {
    color: '#86efac',
  },
  seatStatus: {
    marginTop: 10,
    color: '#d8edf8',
    fontSize: 12,
    fontWeight: '700',
  },
  seatBooking: {
    marginTop: 10,
    color: '#fde68a',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  unplacedShell: {
    marginTop: 16,
  },
  unplacedTitle: {
    color: '#8fb2c7',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  unplacedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unplacedRowCompact: {
    flexDirection: 'column',
  },
  priceHeaderMain: {
    marginBottom: 18,
  },
  tariffPanels: {
    flexDirection: 'row',
    gap: 14,
  },
  tariffPanelsCompact: {
    flexDirection: 'column',
  },
  tariffPanel: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  tariffCyan: {
    backgroundColor: 'rgba(8, 24, 36, 0.96)',
    borderColor: 'rgba(56, 189, 248, 0.18)',
  },
  tariffAmber: {
    backgroundColor: 'rgba(34, 23, 8, 0.96)',
    borderColor: 'rgba(245, 158, 11, 0.18)',
  },
  tariffPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  tariffTitle: {
    color: '#f8fafc',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    textTransform: 'uppercase',
  },
  tariffAccent: {
    width: 44,
    height: 8,
    borderRadius: 999,
  },
  accentCyan: {
    backgroundColor: '#38bdf8',
  },
  accentAmber: {
    backgroundColor: '#f59e0b',
  },
  tariffBlockTitle: {
    color: '#dce8f1',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tariffBlockGap: {
    marginTop: 16,
  },
  rateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  rateHeaderLabel: {
    flex: 1.3,
    color: '#88a4b7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rateHeaderCell: {
    flex: 1,
    color: '#88a4b7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  rateLabel: {
    flex: 1.3,
    color: '#51606d',
    fontSize: 14,
    fontWeight: '700',
  },
  rateLabelActive: {
    color: '#f8fafc',
  },
  rateLabelInactive: {
    color: '#31404c',
  },
  rateValue: {
    flex: 1,
    color: '#51606d',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  rateValueActive: {
    color: '#f8fafc',
  },
  rateValueInactive: {
    color: '#31404c',
  },
  packValue: {
    flex: 1,
    color: '#51606d',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  promoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  promoGridPhone: {
    flexDirection: 'column',
  },
  promoCard: {
    flex: 1,
    minWidth: 170,
    minHeight: 90,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  promoCool: {
    backgroundColor: 'rgba(11, 28, 45, 0.96)',
    borderColor: 'rgba(56, 189, 248, 0.16)',
  },
  promoWarm: {
    backgroundColor: 'rgba(48, 23, 10, 0.96)',
    borderColor: 'rgba(245, 158, 11, 0.16)',
  },
  promoTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  promoText: {
    marginTop: 8,
    color: '#cfe0eb',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  summaryPanel: {
    flex: 0.86,
    minWidth: 280,
  },
  transferHighlightShell: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: 'rgba(125, 211, 252, 0.18)',
    shadowColor: '#fffb00',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  transferHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(125, 211, 252, 0.06)',
  },
  transferSweep: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 150,
    left: 0,
    borderRadius: 80,
    backgroundColor: 'rgba(221, 250, 4, 0.67)',
    shadowColor: '#e1e106',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  consolePanel: {
    flex: 1.14,
    minWidth: 320,
  },
  transferForm: {
    marginTop: 10,
    gap: 14,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: '#8fb2c7',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldShell: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  fieldReadonlyShell: {
    backgroundColor: 'rgba(16, 28, 39, 0.94)',
    borderColor: 'rgba(125, 211, 252, 0.14)',
  },
  fieldReadonlyValue: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  fieldInput: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(8, 18, 28, 0.98)',
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  consoleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
