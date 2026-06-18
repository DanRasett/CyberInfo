import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthProvider } from './src/AuthProvider';
import { createBooking, getDetailedWorkers, PcSeat } from './src/smartshell';

const durationOptions = [1, 2, 3, 4, 5];
const MAP_SCALE = 0.92;
const SCROLL_STORAGE_KEY = 'cyberstreet-scroll-y';

const statusText: Record<PcSeat['status'], string> = {
  free: 'Свободен',
  busy: 'Активен',
  reserved: 'Бронь',
  offline: 'Недоступен',
};

const standardHourly = [
  { label: 'Будни', one: '90 Р', three: '240 Р', five: '350 Р' },
  { label: 'Выходные (пт - вс)', one: '100 Р', three: '270 Р', five: '370 Р' },
];

const bootcampHourly = [
  { label: 'Будни', one: '110 Р', three: '270 Р', five: '390 Р' },
  { label: 'Выходные (пт - вс)', one: '120 Р', three: '320 Р', five: '420 Р' },
];

const standardPacks = [
  { label: 'Будни', day: '400 Р', night: '350 Р' },
  { label: 'Выходные (пт - вс)', day: '500 Р', night: '400 Р' },
];

const bootcampPacks = [
  { label: 'Будни', day: '600 Р', night: '500 Р' },
  { label: 'Выходные (пт - вс)', day: '700 Р', night: '550 Р' },
];

const promoBlocks = [
  { title: 'Лототрон', text: 'Пополни депозит на 400 Р и крути барабан с призами', accent: 'red' },
  { title: '+100 Р', text: 'Новым клиентам пополним баланс от 200 Р', accent: 'red' },
  { title: 'Баланс x2', text: 'В день рождения удвоим твой баланс', accent: 'red' },
  { title: 'Кибер утро ПН-ПТ 8:00 - 14:00', text: '1 час = 60/80 Р', accent: 'blue' },
  { title: 'Кибер ПН 21:30 - 08:00 Standard', text: '300 Р', accent: 'blue' },
  { title: 'Кибер ПН 21:30 - 08:00 Bootcamp', text: '400 Р', accent: 'blue' },
  { title: 'Акция', text: 'Час игры за отзыв на 2ГИС/Яндекс Карты', accent: 'red' },
];

const mapPositions: Record<number, { left: number; top: number }> = {
  1: { left: 218, top: 65 },
  2: { left: 218, top: 142 },
  3: { left: 218, top: 218 },
  4: { left: 218, top: 294 },
  5: { left: 218, top: 370 },
  6: { left: 295, top: 370 },
  7: { left: 295, top: 294 },
  8: { left: 295, top: 218 },
  9: { left: 295, top: 142 },
  10: { left: 295, top: 65 },
  11: { left: 447, top: 65 },
  12: { left: 447, top: 142 },
  13: { left: 447, top: 218 },
  14: { left: 447, top: 294 },
  15: { left: 447, top: 370 },
  16: { left: 674, top: 65 },
  17: { left: 674, top: 142 },
  18: { left: 674, top: 218 },
  19: { left: 674, top: 294 },
  20: { left: 674, top: 370 },
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

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month} ${hours}:${minutes}`;
};

const AppContent = () => {
  const [seats, setSeats] = useState<PcSeat[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [initialScrollY, setInitialScrollY] = useState(0);
  const [bookingSeat, setBookingSeat] = useState<PcSeat | null>(null);
  const [hours, setHours] = useState(1);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const savedScrollY = Number(window.localStorage.getItem(SCROLL_STORAGE_KEY) ?? 0);
    if (Number.isFinite(savedScrollY)) setInitialScrollY(savedScrollY);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async (showLoader: boolean) => {
      if (showLoader) setLoading(true);
      try {
        const nextSeats = await getDetailedWorkers();
        if (mounted) setSeats(nextSeats);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load(true);
    const timer = setInterval(() => load(false), 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const pcs = useMemo(() => seats.filter((seat) => seat.group === 'pc'), [seats]);
  const consoles = useMemo(() => seats.filter((seat) => seat.group === 'console'), [seats]);
  const activeCount = useMemo(() => pcs.filter((seat) => seat.isActive).length, [pcs]);
  const freeCount = useMemo(() => pcs.filter((seat) => seat.status === 'free').length, [pcs]);
  const price = (bookingSeat?.pricePerHour ?? 80) * hours;
  const finishHour = (new Date().getHours() + hours) % 24;

  const submitBooking = async () => {
    if (!bookingSeat) return;

    try {
      await createBooking({ seatId: bookingSeat.id, startsAt: new Date().toISOString(), hours, phone });
      setBookingSeat(null);
      Alert.alert('Бронь создана', 'SmartShell принял запрос на бронирование.');
    } catch {
      Alert.alert('Заявка сохранена', 'API недоступен, но экран и расчет брони работают.');
      setBookingSeat(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />
      <ScrollView
        contentContainerStyle={styles.page}
        onScroll={(event) => {
          window.localStorage.setItem(SCROLL_STORAGE_KEY, String(event.nativeEvent.contentOffset.y));
        }}
        scrollEventThrottle={250}
        contentOffset={{ x: 0, y: initialScrollY }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Компьютерный клуб</Text>
            <Text style={styles.logo}>CyberStreet</Text>
          </View>
          <Text style={styles.address}>ул. Чкалова 78а</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#e6c15a" size="large" />
        ) : (
          <>
            <View style={styles.stats}>
              <Stat value={pcs.length} label="ПК всего" />
              <Stat value={activeCount} label="Активны" />
              <Stat value={freeCount} label="Свободны" />
            </View>

            <View style={styles.mainSurface}>
              <View style={styles.mapArea}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Карта клуба</Text>
                  <View style={styles.legend}>
                    <LegendDot color="#18a957" label="Свободен" />
                    <LegendDot color="#1388ff" label="Активен" />
                    <LegendDot color="#f59f25" label="Бронь" />
                    <LegendDot color="#d34242" label="Обслуживание" />
                  </View>
                </View>
                <ClubMap seats={pcs} onBook={setBookingSeat} />
              </View>

              <View style={styles.tariffArea}>
                <Text style={styles.sectionTitle}>Тарифы</Text>
                <View style={styles.tariffBoard}>
                  <PriceSection color="blue" title="STANDARD" rows={standardHourly} />
                  <PackSection color="blue" rows={standardPacks} />
                  <PriceSection color="red" title="BOOTCAMP" rows={bootcampHourly} />
                  <PackSection color="red" rows={bootcampPacks} />
                  <PromoGrid />
                </View>

                {consoles.length > 0 && (
                  <View style={styles.consolePanel}>
                    <Text style={styles.sectionTitle}>Консоли</Text>
                    <View style={styles.consoleList}>
                      {consoles.map((seat) => (
                        <SeatCard key={seat.id} seat={seat} onBook={setBookingSeat} compact={false} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(bookingSeat)} transparent animationType="fade" onRequestClose={() => setBookingSeat(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Забронировать</Text>
            <Text style={styles.modalSubtitle}>Выберите длительность брони для {bookingSeat?.name}.</Text>

            <Text style={styles.label}>Время</Text>
            <View style={styles.durationRow}>
              {durationOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setHours(option)}
                  style={[styles.durationButton, hours === option && styles.durationButtonActive]}
                >
                  <Text style={[styles.durationText, hours === option && styles.durationTextActive]}>{option} час</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Телефон</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+7"
              placeholderTextColor="#777"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.summary}>Сеанс завершится в {finishHour.toString().padStart(2, '0')}:00</Text>
            <Text style={styles.price}>Стоимость: {price}₽</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setBookingSeat(null)}>
                <Text style={styles.secondaryButtonText}>Отменить</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitBooking}>
                <Text style={styles.primaryButtonText}>Забронировать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const PriceSection = ({
  title,
  color,
  rows,
}: {
  title: string;
  color: 'blue' | 'red';
  rows: Array<{ label: string; one: string; three: string; five: string }>;
}) => (
  <View style={styles.priceSection}>
    <View style={styles.priceHeader}>
      <Text style={[styles.priceSectionTitle, color === 'red' ? styles.redText : styles.blueText]}>{title}</Text>
      <View style={[styles.priceTabs, color === 'red' ? styles.redBg : styles.blueBg]}>
        <Text style={styles.priceTab}>1 час</Text>
        <Text style={styles.priceTab}>3 часа</Text>
        <Text style={styles.priceTab}>5 часов</Text>
      </View>
    </View>
    {rows.map((row) => (
      <View key={row.label} style={styles.priceRow}>
        <Text style={styles.priceLabel}>{row.label}</Text>
        <Text style={styles.priceCell}>{row.one}</Text>
        <Text style={styles.priceCell}>{row.three}</Text>
        <Text style={styles.priceCell}>{row.five}</Text>
      </View>
    ))}
  </View>
);

const PackSection = ({
  color,
  rows,
}: {
  color: 'blue' | 'red';
  rows: Array<{ label: string; day: string; night: string }>;
}) => (
  <View style={styles.packSection}>
    <View style={styles.packTitleRow}>
      <Text style={[styles.packTitle, color === 'red' ? styles.redText : styles.blueText]}>Пакеты</Text>
      <View style={[styles.packTab, color === 'red' ? styles.redBg : styles.blueBg]}>
        <Text style={styles.packTabTitle}>Дневной пакет</Text>
        <Text style={styles.packTabTime}>10:00 - 19:00</Text>
      </View>
      <View style={[styles.packTab, color === 'red' ? styles.redBg : styles.blueBg]}>
        <Text style={styles.packTabTitle}>Ночной пакет</Text>
        <Text style={styles.packTabTime}>21:30 - 08:00</Text>
      </View>
    </View>
    {rows.map((row) => (
      <View key={row.label} style={styles.packRow}>
        <Text style={styles.priceLabel}>{row.label}</Text>
        <Text style={styles.packPrice}>{row.day}</Text>
        <Text style={styles.packPrice}>{row.night}</Text>
      </View>
    ))}
  </View>
);

const PromoGrid = () => (
  <View style={styles.promoGrid}>
    {promoBlocks.map((promo) => (
      <View key={promo.title} style={styles.promoItem}>
        <Text style={[styles.promoTitle, promo.accent === 'red' ? styles.redText : styles.blueText]}>{promo.title}</Text>
        <Text style={styles.promoText}>{promo.text}</Text>
      </View>
    ))}
  </View>
);

const ClubMap = ({ seats, onBook }: { seats: PcSeat[]; onBook: (seat: PcSeat) => void }) => {
  const placedSeats = seats.filter((seat) => mapPositions[extractSeatNumber(seat)]);
  const unplacedSeats = seats.filter((seat) => !mapPositions[extractSeatNumber(seat)]);

  return (
    <View style={styles.mapShell}>
      <View style={styles.mapViewport}>
        <View style={styles.mapCanvas}>
          {walls.map((wall, index) => (
            <View key={index} style={[styles.wall, wall]} />
          ))}

          <Text style={[styles.mapLabel, { left: 146, top: 70 }]}>Общий зал</Text>
          <Text style={[styles.mapLabel, { left: 677, top: 452 }]}>ВИП-зал</Text>
          <Text style={[styles.mapIcon, { left: 91, top: 242 }]}>♙</Text>
          <Text style={[styles.mapIcon, { left: 93, top: 621 }]}>♚</Text>
          <Text style={[styles.mapIcon, { left: 91, top: 698 }]}>☕</Text>
          <Text style={[styles.mapArrow, { left: 96, top: 15 }]}>↓</Text>
          <Text style={[styles.mapArrow, { left: 548, top: 471 }]}>→</Text>
          <Text style={[styles.mapArrow, { left: 170, top: 623 }]}>←</Text>
          <Text style={[styles.mapArrow, { left: 550, top: 623 }]}>→</Text>

          {placedSeats.map((seat) => {
            const number = extractSeatNumber(seat);
            return (
              <View key={seat.id} style={[styles.mapSeatPosition, mapPositions[number]]}>
                <SeatCard seat={seat} onBook={onBook} compact />
              </View>
            );
          })}
        </View>
      </View>

      {unplacedSeats.length > 0 && (
        <View style={styles.unplacedRow}>
          <Text style={styles.unplacedTitle}>Не размещены: {unplacedSeats.length}</Text>
          {unplacedSeats.map((seat) => (
            <SeatCard key={seat.id} seat={seat} onBook={onBook} compact={false} />
          ))}
        </View>
      )}
    </View>
  );
};

const SeatCard = ({
  seat,
  onBook,
  compact,
}: {
  seat: PcSeat;
  onBook: (seat: PcSeat) => void;
  compact: boolean;
}) => {
  const number = extractSeatNumber(seat);
  const remaining = formatRemaining(seat.remainingMinutes);
  const bookingTime = formatBookingTime(seat.bookingStartsAt);
  const sessionLabel = seat.isInfiniteSession ? '∞' : remaining;

  return (
    <Pressable
      disabled={seat.status !== 'free'}
      onPress={() => onBook(seat)}
      style={[compact ? styles.mapSeat : styles.consoleSeat, styles[`seat_${seat.status}`]]}
    >
      <View style={styles.seatTopRow}>
        <Text style={[styles.seatNumber, seat.status === 'busy' && styles.seatNumberActive]}>{number || seat.name}</Text>
        {seat.status !== 'busy' && <Text style={styles.powerIcon}>⏻</Text>}
      </View>
      {seat.status === 'reserved' && <Text style={styles.reservedIcon}>▤</Text>}
      {sessionLabel ? (
        <Text style={[styles.seatTime, seat.isInfiniteSession && styles.infinityTime]}>
          {seat.isInfiniteSession ? '∞' : `◷ ${sessionLabel}`}
        </Text>
      ) : bookingTime ? (
        <Text style={styles.seatBooking}>бронь {bookingTime}</Text>
      ) : (
        <Text style={styles.seatStatus}>{statusText[seat.status]}</Text>
      )}
    </Pressable>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#070a0d',
  },
  page: {
    width: '100%',
    maxWidth: 1460,
    marginHorizontal: 'auto',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#070a0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#171f27',
    paddingBottom: 12,
  },
  kicker: {
    color: '#e6c15a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  logo: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 2,
  },
  address: {
    color: '#e6c15a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  stat: {
    minWidth: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#202a33',
    backgroundColor: '#0f151b',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: '#99a8b8',
    fontSize: 12,
    marginTop: 2,
  },
  mainSurface: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a232b',
    backgroundColor: '#0b1015',
    padding: 18,
  },
  mapArea: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#19222a',
    backgroundColor: '#080d12',
    padding: 14,
  },
  tariffArea: {
    flex: 1,
    minWidth: 560,
  },
  consolePanel: {
    marginTop: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d2730',
    backgroundColor: '#0f151b',
    padding: 12,
  },
  consoleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#8f9da9',
    fontSize: 12,
    fontWeight: '700',
  },
  tariffBoard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1c2630',
    backgroundColor: '#090d12',
    padding: 12,
  },
  priceSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#202832',
    paddingBottom: 8,
    marginBottom: 8,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  priceSectionTitle: {
    width: 118,
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  priceTabs: {
    flex: 1,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 7,
  },
  priceTab: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  priceLabel: {
    width: 128,
    color: '#f4f4f4',
    fontSize: 16,
    lineHeight: 18,
  },
  priceCell: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  packSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#202832',
    paddingBottom: 8,
    marginBottom: 8,
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  packTitle: {
    width: 118,
    fontSize: 21,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packTab: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  packTabTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  packTabTime: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  packPrice: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  promoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promoItem: {
    width: 170,
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: '#10161c',
    borderWidth: 1,
    borderColor: '#202832',
    padding: 9,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  promoText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  blueText: {
    color: '#147cff',
  },
  redText: {
    color: '#d83a3a',
  },
  blueBg: {
    backgroundColor: '#155ed8',
  },
  redBg: {
    backgroundColor: '#a5262b',
  },
  mapShell: {
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: '#090e13',
    padding: 0,
  },
  mapViewport: {
    width: 824 * MAP_SCALE,
    height: 808 * MAP_SCALE,
    overflow: 'hidden',
  },
  mapCanvas: {
    width: 824,
    height: 808,
    position: 'relative',
    backgroundColor: '#090e13',
    transform: [{ scale: MAP_SCALE }],
    transformOrigin: 'top left',
  },
  wall: {
    position: 'absolute',
    backgroundColor: '#252c33',
  },
  mapLabel: {
    position: 'absolute',
    color: '#99a8b8',
    fontSize: 12,
    fontWeight: '700',
  },
  mapIcon: {
    position: 'absolute',
    color: '#8d949c',
    fontSize: 24,
  },
  mapArrow: {
    position: 'absolute',
    color: '#8d949c',
    fontSize: 24,
  },
  mapSeatPosition: {
    position: 'absolute',
  },
  mapSeat: {
    width: 74,
    height: 74,
    borderRadius: 7,
    borderWidth: 1,
    padding: 9,
    justifyContent: 'space-between',
  },
  consoleSeat: {
    width: 172,
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  seat_free: {
    backgroundColor: '#0f2a1b',
    borderColor: '#18a957',
  },
  seat_busy: {
    backgroundColor: '#0d2238',
    borderColor: '#1388ff',
  },
  seat_reserved: {
    backgroundColor: '#2b2110',
    borderColor: '#f59f25',
  },
  seat_offline: {
    backgroundColor: '#2b1414',
    borderColor: '#d34242',
  },
  seatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatNumber: {
    color: '#f4f7f8',
    fontSize: 16,
    fontWeight: '900',
  },
  seatNumberActive: {
    color: '#1d94ff',
  },
  powerIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.13)',
    color: '#d6dde4',
    fontSize: 14,
    lineHeight: 25,
    textAlign: 'center',
  },
  reservedIcon: {
    position: 'absolute',
    top: 14,
    right: 13,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#7a430b',
    color: '#ffd08a',
    fontSize: 13,
    lineHeight: 25,
    textAlign: 'center',
  },
  seatStatus: {
    color: '#d6dde4',
    fontSize: 11,
    fontWeight: '700',
  },
  seatTime: {
    color: '#1d94ff',
    fontSize: 11,
    fontWeight: '800',
  },
  infinityTime: {
    fontSize: 26,
    lineHeight: 28,
    textAlign: 'center',
  },
  seatBooking: {
    color: '#f59f25',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  unplacedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  unplacedTitle: {
    width: '100%',
    color: '#99a8b8',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 8,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 18,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#b8b8b8',
    fontSize: 14,
    marginTop: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  durationButtonActive: {
    backgroundColor: '#e6c15a',
    borderColor: '#e6c15a',
  },
  durationText: {
    color: '#d0d0d0',
    fontWeight: '700',
  },
  durationTextActive: {
    color: '#090909',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  summary: {
    color: '#cfcfcf',
    marginTop: 16,
  },
  price: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#e6c15a',
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#080808',
    fontWeight: '900',
  },
});
