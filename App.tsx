import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { getDetailedWorkersWithStatus, getShiftOperatorWithStatus, PcSeat, ShiftOperator } from './src/smartshell';

const REFRESH_INTERVAL_MS = 30000;
const STORAGE_PREFIX = 'cyberstreet-';
const LEGACY_MAP_GRID_SIZE = 73;
const MAP_GRID_SIZE = 96;
const MAP_COLUMNS = 14;
const MAP_ROWS = 11;
const MAP_WIDTH = MAP_COLUMNS * MAP_GRID_SIZE;
const MAP_HEIGHT = MAP_ROWS * MAP_GRID_SIZE;
const EDITOR_ZOOM_STEPS = [0.75, 1, 1.25, 1.5];
const STORAGE_MAP = `${STORAGE_PREFIX}map-layout`;
const STORAGE_THEME = `${STORAGE_PREFIX}theme`;
const STORAGE_PHONE = `${STORAGE_PREFIX}transfer-phone`;
const STORAGE_BANK = `${STORAGE_PREFIX}transfer-bank`;
const STORAGE_OPERATOR = `${STORAGE_PREFIX}transfer-operator`;

const hourlyPrices = {
  standard: [
    { period: 'Будни', one: '90 ₽', three: '240 ₽', five: '350 ₽' },
    { period: 'Пт - Вс', one: '100 ₽', three: '270 ₽', five: '370 ₽' },
  ],
  bootcamp: [
    { period: 'Будни', one: '110 ₽', three: '270 ₽', five: '390 ₽' },
    { period: 'Пт - Вс', one: '120 ₽', three: '320 ₽', five: '420 ₽' },
  ],
};

const packagePrices = {
  standard: [
    { period: 'Будни', day: '400 ₽', night: '350 ₽' },
    { period: 'Пт - Вс', day: '500 ₽', night: '400 ₽' },
  ],
  bootcamp: [
    { period: 'Будни', day: '600 ₽', night: '500 ₽' },
    { period: 'Пт - Вс', day: '700 ₽', night: '550 ₽' },
  ],
};

const promos = [
  { title: 'Лототрон', text: 'Пополнение от 400 ₽ дает вращение барабана с призами', tone: 'warm' },
  { title: '+100 ₽ новым', text: 'Бонус при первом пополнении от 200 ₽', tone: 'cool' },
  { title: 'Баланс x2', text: 'В день рождения удваивается сумма пополнения', tone: 'warm' },
  { title: 'Утро Пн-Пт', text: 'С 08:00 до 14:00 стоимость от 60 ₽ в час', tone: 'cool' },
];

type Theme = 'light' | 'dark';
type DataStatus = 'loading' | 'live' | 'fallback' | 'error';
type ViewMode = 'dashboard' | 'editor';
type SeatPosition = { left: number; top: number };
type WallKind = 'horizontal' | 'vertical' | 'corner' | 'tee';
type MapWall = { id: string; kind: WallKind; left: number; top: number; rotation?: number };
type WallGeometry = Omit<MapWall, 'id'>;
type MapText = { id: string; text: string; left: number; top: number };
type EditorTool = 'select' | 'text' | 'erase' | 'wall-horizontal' | 'wall-vertical' | 'wall-corner' | 'wall-tee';
const STORAGE_MAP_WALLS = `${STORAGE_PREFIX}map-walls`;
const STORAGE_MAP_TEXT = `${STORAGE_PREFIX}map-text`;
const statusText: Record<PcSeat['status'], string> = {
  free: 'Свободен',
  busy: 'Занят',
  reserved: 'Бронь',
  offline: 'Сервис',
};

const statusLabel: Record<PcSeat['status'], string> = {
  free: 'Свободно',
  busy: 'Занято',
  reserved: 'Бронь',
  offline: 'Сервис',
};

const defaultMapPositions: Record<number, SeatPosition> = {
  1: { left: 4 * MAP_GRID_SIZE, top: 2 * MAP_GRID_SIZE },
  2: { left: 4 * MAP_GRID_SIZE, top: 3 * MAP_GRID_SIZE },
  3: { left: 4 * MAP_GRID_SIZE, top: 4 * MAP_GRID_SIZE },
  4: { left: 4 * MAP_GRID_SIZE, top: 5 * MAP_GRID_SIZE },
  5: { left: 4 * MAP_GRID_SIZE, top: 6 * MAP_GRID_SIZE },
  6: { left: 5 * MAP_GRID_SIZE, top: 6 * MAP_GRID_SIZE },
  7: { left: 5 * MAP_GRID_SIZE, top: 5 * MAP_GRID_SIZE },
  8: { left: 5 * MAP_GRID_SIZE, top: 4 * MAP_GRID_SIZE },
  9: { left: 5 * MAP_GRID_SIZE, top: 3 * MAP_GRID_SIZE },
  10: { left: 5 * MAP_GRID_SIZE, top: 2 * MAP_GRID_SIZE },
  11: { left: 7 * MAP_GRID_SIZE, top: 2 * MAP_GRID_SIZE },
  12: { left: 7 * MAP_GRID_SIZE, top: 3 * MAP_GRID_SIZE },
  13: { left: 7 * MAP_GRID_SIZE, top: 4 * MAP_GRID_SIZE },
  14: { left: 7 * MAP_GRID_SIZE, top: 5 * MAP_GRID_SIZE },
  15: { left: 7 * MAP_GRID_SIZE, top: 6 * MAP_GRID_SIZE },
  16: { left: 10 * MAP_GRID_SIZE, top: 2 * MAP_GRID_SIZE },
  17: { left: 10 * MAP_GRID_SIZE, top: 3 * MAP_GRID_SIZE },
  18: { left: 10 * MAP_GRID_SIZE, top: 4 * MAP_GRID_SIZE },
  19: { left: 10 * MAP_GRID_SIZE, top: 5 * MAP_GRID_SIZE },
  20: { left: 10 * MAP_GRID_SIZE, top: 6 * MAP_GRID_SIZE },
};

const storageGet = (key: string) => (typeof window === 'undefined' ? '' : window.localStorage.getItem(key) ?? '');
const storageSet = (key: string, value: string) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
};

const normalizeWallRotation = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return ((Math.round(value) % 4) + 4) % 4;
};

const usesLegacyMapGrid = (items: Array<{ left?: unknown; top?: unknown }>) => items.some((item) => {
  const coordinates = [item.left, item.top].filter((value): value is number => typeof value === 'number');
  return coordinates.some((value) => value % LEGACY_MAP_GRID_SIZE === 0 && value % MAP_GRID_SIZE !== 0);
});

const snapMapCoordinate = (value: number, sourceGridSize: number, max: number) => Math.max(
  0,
  Math.min(max, Math.round(value / sourceGridSize) * MAP_GRID_SIZE),
);

const readStoredArray = <T,>(key: string): T[] => {
  try {
    const value = JSON.parse(storageGet(key));
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
};

const readMapWalls = (): MapWall[] => {
  const storedWalls = readStoredArray<Record<string, unknown>>(STORAGE_MAP_WALLS);
  const sourceGridSize = usesLegacyMapGrid(storedWalls) ? LEGACY_MAP_GRID_SIZE : MAP_GRID_SIZE;
  return storedWalls.flatMap((wall, index) => {
  const { left, top } = wall;
  if (typeof left !== 'number' || typeof top !== 'number') return [];
  const kind: WallKind = wall.kind === 'vertical' || wall.kind === 'corner' || wall.kind === 'tee'
    ? wall.kind
    : 'horizontal';
  return [{
    id: typeof wall.id === 'string' ? wall.id : `legacy-wall-${index}`,
    kind,
    rotation: normalizeWallRotation(wall.rotation),
    left: snapMapCoordinate(left, sourceGridSize, MAP_WIDTH - MAP_GRID_SIZE),
    top: snapMapCoordinate(top, sourceGridSize, MAP_HEIGHT - MAP_GRID_SIZE),
  }];
  });
};

const readMapTexts = (): MapText[] => {
  const storedTexts = readStoredArray<MapText>(STORAGE_MAP_TEXT);
  const sourceGridSize = usesLegacyMapGrid(storedTexts) ? LEGACY_MAP_GRID_SIZE : MAP_GRID_SIZE;
  return storedTexts.flatMap((annotation, index) => {
  if (typeof annotation.text !== 'string' || typeof annotation.left !== 'number' || typeof annotation.top !== 'number') return [];
  return [{
    id: typeof annotation.id === 'string' ? annotation.id : `legacy-text-${index}`,
    text: annotation.text,
    left: snapMapCoordinate(annotation.left, sourceGridSize, MAP_WIDTH - MAP_GRID_SIZE),
    top: snapMapCoordinate(annotation.top, sourceGridSize, MAP_HEIGHT - MAP_GRID_SIZE),
  }];
  });
};

const wallSegments = (wall: Pick<MapWall, 'kind'>) => {
  const wallThickness = 16;
  const wallCenter = (MAP_GRID_SIZE - wallThickness) / 2;
  const cornerArmLength = MAP_GRID_SIZE / 2;
  const cornerSpan = cornerArmLength + wallThickness / 2;
  if (wall.kind === 'vertical') return [{ left: wallCenter, top: 0, width: wallThickness, height: MAP_GRID_SIZE }];
  if (wall.kind === 'corner') return [
    { left: wallCenter, top: 0, width: wallThickness, height: cornerSpan },
    { left: wallCenter, top: wallCenter, width: cornerSpan, height: wallThickness },
  ];
  if (wall.kind === 'tee') return [
    { left: 0, top: wallCenter, width: MAP_GRID_SIZE, height: wallThickness },
    { left: wallCenter, top: 0, width: wallThickness, height: wallCenter + wallThickness },
  ];
  return [{ left: 0, top: wallCenter, width: MAP_GRID_SIZE, height: wallThickness }];
};

const getMapTextLayout = (text: string) => {
  const contentWidth = MAP_GRID_SIZE - 8;
  const contentHeight = MAP_GRID_SIZE - 8;
  const maxFontSize = 16;
  const minFontSize = 7;
  const lineHeightRatio = 1.2;
  const lines = text.split(/\r?\n/);

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const charsPerLine = Math.max(1, Math.floor(contentWidth / (fontSize * 0.56)));
    const estimatedLineCount = lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    const lineHeight = Math.ceil(fontSize * lineHeightRatio);
    const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
    if (estimatedLineCount <= maxLines) return { fontSize, lineHeight, maxLines };
  }

  const lineHeight = Math.ceil(minFontSize * lineHeightRatio);
  return { fontSize: minFontSize, lineHeight, maxLines: Math.max(1, Math.floor(contentHeight / lineHeight)) };
};

const readMapPositions = (): Record<number, SeatPosition> => {
  try {
    const value = JSON.parse(storageGet(STORAGE_MAP));
    if (!value || typeof value !== 'object') return defaultMapPositions;
    const storedPositions = Object.values(value) as Array<Partial<SeatPosition>>;
    const sourceGridSize = usesLegacyMapGrid(storedPositions)
      ? LEGACY_MAP_GRID_SIZE
      : MAP_GRID_SIZE;
    return Object.fromEntries(Object.entries(value).flatMap(([number, position]) => {
      if (!position || typeof position !== 'object') return [];
      const { left, top } = position as SeatPosition;
      if (typeof left !== 'number' || typeof top !== 'number') return [];
      return [[Number(number), {
        left: snapMapCoordinate(left, sourceGridSize, MAP_WIDTH - MAP_GRID_SIZE),
        top: snapMapCoordinate(top, sourceGridSize, MAP_HEIGHT - MAP_GRID_SIZE),
      }]];
    }));
  } catch {
    return defaultMapPositions;
  }
};

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
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const formatBookingTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
};

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits.startsWith('7') ? digits : `7${digits}`;
  const local = normalized.slice(1, 11);
  let result = '+7';
  if (local.length > 0) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
};

const App = () => {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<ViewMode>('dashboard');
  const [theme, setTheme] = useState<Theme>(() => (storageGet(STORAGE_THEME) === 'light' ? 'light' : 'dark'));
  const [seats, setSeats] = useState<PcSeat[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [shiftOperator, setShiftOperator] = useState<ShiftOperator>({ id: null, displayName: 'Оператор не определён', phone: '' });
  const [mapPositions, setMapPositions] = useState<Record<number, SeatPosition>>(readMapPositions);
  const [mapWalls, setMapWalls] = useState<MapWall[]>(readMapWalls);
  const [mapTexts, setMapTexts] = useState<MapText[]>(readMapTexts);
  const [editorTool, setEditorTool] = useState<EditorTool>('select');
  const [mapTextValue, setMapTextValue] = useState('Текст');
  const [transferPhone, setTransferPhone] = useState(() => formatPhoneNumber(storageGet(STORAGE_PHONE)));
  const [transferBank, setTransferBank] = useState(() => storageGet(STORAGE_BANK));
  const [operatorName, setOperatorName] = useState(() => storageGet(STORAGE_OPERATOR));
  const [draggingSeat, setDraggingSeat] = useState<number | null>(null);
  const [draggingOffset, setDraggingOffset] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(0.88);
  const [editorZoom, setEditorZoom] = useState(1);
  const transferRef = useRef<View>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
        setDataStatus('loading');
      }
      try {
        const [seatResult, operatorResult] = await Promise.all([getDetailedWorkersWithStatus(), getShiftOperatorWithStatus()]);
        if (mounted) {
          setSeats(seatResult.data);
          setShiftOperator(operatorResult.data);
          setDataStatus(seatResult.source === 'fallback' || operatorResult.source === 'fallback' ? 'fallback' : 'live');
          setLastSyncAt(new Date());
        }
      } catch {
        if (mounted) setDataStatus('error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load(true);
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') load();
    }, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refreshToken]);

  useEffect(() => {
    const horizontalPadding = width < 900 ? 68 : 116;
    const heightBudget = Math.max(520, height - 250);
    const nextScale = Math.max(0.2, Math.min(0.9, (width - horizontalPadding) / MAP_WIDTH, heightBudget / MAP_HEIGHT));
    setMapScale(nextScale);
  }, [height, width]);

  const editorMapScale = mapScale * editorZoom;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (draggingSeat === null) return;
      const map = document.getElementById('club-map');
      if (!map) return;
      const rect = map.getBoundingClientRect();
      const next = {
        left: Math.max(0, Math.min(MAP_WIDTH - MAP_GRID_SIZE, Math.round(((event.clientX - rect.left) / editorMapScale - draggingOffset.x) / MAP_GRID_SIZE) * MAP_GRID_SIZE)),
        top: Math.max(0, Math.min(MAP_HEIGHT - MAP_GRID_SIZE, Math.round(((event.clientY - rect.top) / editorMapScale - draggingOffset.y) / MAP_GRID_SIZE) * MAP_GRID_SIZE)),
      };
      const occupiedByWall = mapWalls.some((wall) => wall.left === next.left && wall.top === next.top);
      const occupiedByText = mapTexts.some((annotation) => annotation.left === next.left && annotation.top === next.top);
      const occupiedBySeat = Object.entries(mapPositions).some(([number, position]) => Number(number) !== draggingSeat && position.left === next.left && position.top === next.top);
      if (occupiedByWall || occupiedByText || occupiedBySeat) return;
      setMapPositions((current) => ({ ...current, [draggingSeat]: next }));
    };
    const onPointerUp = () => {
      if (draggingSeat !== null) {
        setMapPositions((current) => {
          storageSet(STORAGE_MAP, JSON.stringify(current));
          return current;
        });
      }
      setDraggingSeat(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingOffset.x, draggingOffset.y, draggingSeat, mapPositions, mapWalls, mapTexts, editorMapScale]);

  const pcs = useMemo(() => seats.filter((seat) => seat.group === 'pc'), [seats]);
  const consoles = useMemo(() => seats.filter((seat) => seat.group === 'console'), [seats]);
  const isPhone = width < 900;
  const isWeekend = [0, 5, 6].includes(now.getDay());
  const paletteClass = theme === 'light' ? 'theme-light' : 'theme-dark';
  const dashboardMapWidth = isPhone ? width - 68 : (width - 112) * 0.54 - 32;
  const dashboardMapScale = Math.max(0.2, Math.min(mapScale, dashboardMapWidth / MAP_WIDTH));
  const freeSeats = pcs.filter((seat) => seat.status === 'free').length;
  const syncLabel = lastSyncAt
    ? `Проверено в ${lastSyncAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : 'Данные ещё не проверены';

  const isMapCellOccupied = (column: number, row: number) => {
    const left = column * MAP_GRID_SIZE;
    const top = row * MAP_GRID_SIZE;
    return mapWalls.some((wall) => wall.left === left && wall.top === top)
      || mapTexts.some((annotation) => annotation.left === left && annotation.top === top)
      || Object.values(mapPositions).some((position) => position.left === left && position.top === top);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    storageSet(STORAGE_THEME, next);
  };

  const updateMapDrag = (event: any, number: number) => {
    if (mode !== 'editor' || editorTool !== 'select') return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setDraggingSeat(number);
    setDraggingOffset({ x: (event.clientX - rect.left) / editorMapScale, y: (event.clientY - rect.top) / editorMapScale });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleMapCellPointerDown = (event: any, column: number, row: number) => {
    if (mode !== 'editor') return;
    const left = column * MAP_GRID_SIZE;
    const top = row * MAP_GRID_SIZE;
    if (isMapCellOccupied(column, row)) return;
    if (editorTool === 'text') {
      const text = mapTextValue.trim();
      if (!text) return;
      setMapTexts((current) => {
        const nextTexts = [...current, { id: `${Date.now()}-${current.length}`, text, left, top }];
        storageSet(STORAGE_MAP_TEXT, JSON.stringify(nextTexts));
        return nextTexts;
      });
      return;
    }
    if (editorTool.startsWith('wall-')) {
      const kind: WallKind = editorTool === 'wall-vertical' ? 'vertical' : editorTool === 'wall-corner' ? 'corner' : editorTool === 'wall-tee' ? 'tee' : 'horizontal';
      setMapWalls((current) => {
        const nextWalls = [...current, { id: `${Date.now()}-${current.length}`, kind, left, top }];
        storageSet(STORAGE_MAP_WALLS, JSON.stringify(nextWalls));
        return nextWalls;
      });
    }
  };

  const removeMapWall = (id: string) => setMapWalls((current) => {
    const nextWalls = current.filter((wall) => wall.id !== id);
    storageSet(STORAGE_MAP_WALLS, JSON.stringify(nextWalls));
    return nextWalls;
  });

  const rotateMapWall = (id: string) => setMapWalls((current) => {
    const nextWalls = current.map((wall) => wall.id === id
      ? { ...wall, rotation: ((wall.rotation ?? 0) + 1) % 4 }
      : wall);
    storageSet(STORAGE_MAP_WALLS, JSON.stringify(nextWalls));
    return nextWalls;
  });

  const removeMapText = (id: string) => setMapTexts((current) => {
    const nextTexts = current.filter((annotation) => annotation.id !== id);
    storageSet(STORAGE_MAP_TEXT, JSON.stringify(nextTexts));
    return nextTexts;
  });

  return (
    <SafeAreaView style={[styles.safe, theme === 'light' ? styles.safeLight : styles.safeDark]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} backgroundColor={theme === 'light' ? '#C6CDFF' : '#0F6BAE'} />
      <View style={[styles.appRoot, styles[paletteClass]]}>
        {mode === 'dashboard' ? <KioskHeader now={now} onEdit={() => setMode('editor')} /> : <Header mode={mode} setMode={setMode} theme={theme} toggleTheme={toggleTheme} now={now} />}
        <ScrollView contentContainerStyle={[styles.page, isPhone && styles.pagePhone]} showsVerticalScrollIndicator={false}>
          {mode === 'dashboard' ? (
            <>
              <KioskStatus
                freeSeats={freeSeats}
                totalSeats={pcs.length}
                status={dataStatus}
                syncLabel={syncLabel}
                onRetry={() => setRefreshToken((current) => current + 1)}
              />
              <View style={[styles.kioskGrid, isPhone && styles.mainGridPhone]}>
                <View style={styles.kioskMapColumn}>
                  <View style={styles.kioskSectionHeading}><Text style={styles.kioskSectionTitle}>Карта зала</Text><Text style={styles.kioskSectionNote}>Выберите зону по расположению</Text></View>
                  <View style={styles.kioskMapPanel}>
                    {isLoading ? <LoadingState /> : <ClubMap seats={pcs} positions={mapPositions} scale={dashboardMapScale} editable={false} extraWalls={mapWalls} annotations={mapTexts} />}
                    <View style={styles.kioskLegend}><Legend /></View>
                  </View>
                </View>
                <View style={styles.kioskInfoColumn}>
                  <PriceBoard isWeekend={isWeekend} />
                  <TransferCard
                    transferRef={transferRef}
                    phone={transferPhone}
                    bank={transferBank}
                    operator={operatorName}
                    onPhoneChange={(value) => { const next = formatPhoneNumber(value); setTransferPhone(next); storageSet(STORAGE_PHONE, next); }}
                    onBankChange={(value) => { setTransferBank(value); storageSet(STORAGE_BANK, value); }}
                    onOperatorChange={(value) => { setOperatorName(value); storageSet(STORAGE_OPERATOR, value); }}
                  />
                  {consoles.length > 0 && <ConsoleCard consoles={consoles} />}
                </View>
              </View>
            </>
          ) : (
            <EditorPage
              seats={pcs}
              positions={mapPositions}
              scale={editorMapScale}
              zoom={editorZoom}
              onZoomOut={() => setEditorZoom((current) => EDITOR_ZOOM_STEPS[Math.max(0, EDITOR_ZOOM_STEPS.indexOf(current) - 1)])}
              onZoomReset={() => setEditorZoom(1)}
              onZoomIn={() => setEditorZoom((current) => EDITOR_ZOOM_STEPS[Math.min(EDITOR_ZOOM_STEPS.length - 1, EDITOR_ZOOM_STEPS.indexOf(current) + 1)])}
              tool={editorTool}
              setTool={setEditorTool}
              textValue={mapTextValue}
              setTextValue={setMapTextValue}
              extraWalls={mapWalls}
              annotations={mapTexts}
              onCellPointerDown={handleMapCellPointerDown}
              onPointerDown={updateMapDrag}
              onDeleteWall={removeMapWall}
              onRotateWall={rotateMapWall}
              onDeleteText={removeMapText}
              onUndoWall={() => setMapWalls((current) => {
                const nextWalls = current.slice(0, -1);
                storageSet(STORAGE_MAP_WALLS, JSON.stringify(nextWalls));
                return nextWalls;
              })}
              onReset={() => {
                setMapPositions(defaultMapPositions);
                storageSet(STORAGE_MAP, JSON.stringify(defaultMapPositions));
                setMapWalls([]);
                setMapTexts([]);
                storageSet(STORAGE_MAP_WALLS, '[]');
                storageSet(STORAGE_MAP_TEXT, '[]');
              }}
              onBack={() => setMode('dashboard')}
            />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const HoverSweepButton = ({ label, accessibilityLabel, onPress, style, textStyle }: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  style: any;
  textStyle: any;
}) => {
  const [hovered, setHovered] = useState(false);

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onPress={onPress}
    style={[styles.hoverSweepButton, style]}
  >
    <View pointerEvents="none" style={[styles.hoverSweepLayer, { transform: [{ translateY: hovered ? 14 : 96 }] }]} />
    <Text style={[styles.hoverSweepText, textStyle]}>{label}</Text>
  </Pressable>;
};

const Header = ({ mode, setMode, theme, toggleTheme, now }: { mode: ViewMode; setMode: (mode: ViewMode) => void; theme: Theme; toggleTheme: () => void; now: Date }) => (
  <View style={styles.header}>
    <View style={styles.headerBrand}>
      <View style={styles.logoMark}><Text style={styles.logoMarkText}>C</Text></View>
      <View><Text style={styles.brandName}>CyberStreet</Text><Text style={styles.brandSub}>Компьютерный клуб</Text></View>
    </View>
    <View style={styles.headerNav}>
      <Pressable style={[styles.navButton, mode === 'dashboard' && styles.navButtonActive]} onPress={() => setMode('dashboard')} accessibilityRole="button"><Text style={styles.navButtonText}>Обзор клуба</Text></Pressable>
      <Pressable style={[styles.navButton, mode === 'editor' && styles.navButtonActive]} onPress={() => setMode('editor')} accessibilityRole="button"><Text style={styles.navButtonText}>Редактор карты</Text></Pressable>
      <Pressable style={styles.themeButton} onPress={toggleTheme} accessibilityRole="button"><Text style={styles.themeButtonText}>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</Text></Pressable>
      <Text style={styles.headerClock}>{now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>
  </View>
);

const KioskHeader = ({ now, onEdit }: { now: Date; onEdit: () => void }) => (
  <View style={styles.kioskHeader}>
    <View style={styles.kioskBrand}><View style={styles.kioskBrandMark}><Text style={styles.kioskBrandMarkText}>C</Text></View><View><Text style={styles.kioskBrandName}>CyberStreet</Text><Text style={styles.kioskBrandSub}>КОМПЬЮТЕРНЫЙ КЛУБ</Text></View></View>
    <HoverSweepButton label="РЕДАКТОР КАРТЫ" accessibilityLabel="Открыть редактор карты" onPress={onEdit} style={styles.kioskEditButton} textStyle={styles.kioskEditButtonText} />
    <View style={styles.kioskDateTime}><Text style={styles.kioskClock}>{now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text><Text style={styles.kioskDate}>{now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}</Text></View>
  </View>
);

const KioskStatus = ({ freeSeats, totalSeats, status, syncLabel, onRetry }: {
  freeSeats: number;
  totalSeats: number;
  status: DataStatus;
  syncLabel: string;
  onRetry: () => void;
}) => {
  const statusTitle = status === 'live'
    ? 'Данные SmartShell актуальны'
    : status === 'fallback'
      ? 'Показаны резервные данные'
      : status === 'error'
        ? 'Не удалось обновить данные'
        : 'Проверяем состояние клуба';

  return (
    <View style={styles.kioskStatusRow} accessibilityLiveRegion="polite">
      <View>
        <Text style={styles.kioskEyebrow}>СВОБОДНЫЕ МЕСТА</Text>
        <View style={styles.kioskFreeLine}>
          <Text style={styles.kioskFreeCount}>{status === 'loading' ? '—' : freeSeats}</Text>
          <Text style={styles.kioskFreeTotal}> / {totalSeats || '—'}</Text>
        </View>
      </View>
      <View style={styles.kioskStatus}>
        <View style={[styles.kioskLiveDot, status !== 'live' && styles.kioskLiveDotMuted]} />
        <View>
          <Text style={styles.kioskStatusTitle}>{statusTitle}</Text>
          <Text style={styles.kioskStatusMeta}>{syncLabel}</Text>
        </View>
      </View>
      <View style={styles.kioskStatusActions}>
        <Text style={styles.kioskRefresh}>Обновление каждые 30 сек</Text>
        <HoverSweepButton label="Обновить" accessibilityLabel="Обновить данные" onPress={onRetry} style={styles.kioskRetryButton} textStyle={styles.kioskRetryText} />
      </View>
    </View>
  );
};


const Legend = () => (
  <View style={styles.legend}>{(['free', 'busy', 'reserved', 'offline'] as PcSeat['status'][]).map((status) => <View key={status} style={styles.legendItem}><View style={[styles.legendDot, styles[`dot_${status}`]]} /><Text style={styles.legendText}>{statusLabel[status]}</Text></View>)}</View>
);

const LoadingState = () => <View style={styles.loading}><ActivityIndicator color="#248BD6" size="large" /><Text style={styles.loadingText}>Загружаем карту клуба…</Text></View>;

const MapObjectControls = ({ visible, deleteLabel, onDelete, rotateLabel, onRotate }: {
  visible: boolean;
  deleteLabel: string;
  onDelete: () => void;
  rotateLabel?: string;
  onRotate?: () => void;
}) => (
  <View
    pointerEvents={visible ? 'auto' : 'none'}
    accessibilityElementsHidden={!visible}
    style={[styles.mapObjectControls, { opacity: visible ? 1 : 0 }]}
  >
    {onRotate && <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotateLabel}
      onPointerDown={(event: any) => event.stopPropagation()}
      onPress={(event: any) => { event.stopPropagation(); onRotate(); }}
      style={styles.mapObjectRotateButton}
    ><WallToolIcon kind="rotate" /></Pressable>}
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={deleteLabel}
      onPointerDown={(event: any) => event.stopPropagation()}
      onPress={(event: any) => { event.stopPropagation(); onDelete(); }}
      style={styles.mapObjectDeleteButton}
    ><Text style={styles.mapDeleteGlyph}>×</Text></Pressable>
  </View>
);

const MapWallObject = ({ wall, editable, tool, onCellPointerDown, onDeleteWall, onRotateWall }: {
  wall: MapWall;
  editable: boolean;
  tool?: EditorTool;
  onCellPointerDown?: (event: any, column: number, row: number) => void;
  onDeleteWall?: (id: string) => void;
  onRotateWall?: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);

  return <View
    accessibilityLabel={`Стена: ${wall.kind}`}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onPointerDown={editable ? (event: any) => {
      if (tool === 'erase') { event.stopPropagation(); onDeleteWall?.(wall.id); }
      else if (tool?.startsWith('wall-')) onCellPointerDown?.(event, Math.floor(wall.left / MAP_GRID_SIZE), Math.floor(wall.top / MAP_GRID_SIZE));
    } : undefined}
    style={[styles.mapWallCell, { left: wall.left, top: wall.top }, tool === 'erase' && styles.deletableMapElement]}
  >
    <View style={[styles.mapWallShape, { transform: [{ rotate: `${(wall.rotation ?? 0) * 90}deg` }], transformOrigin: 'center' as any }]}>{wallSegments(wall).map((segment, index) => <View key={index} style={[styles.mapWallSegment, segment]} />)}</View>
    {editable && <MapObjectControls
      visible={hovered}
      deleteLabel="Удалить стену"
      onDelete={() => onDeleteWall?.(wall.id)}
      rotateLabel="Повернуть стену на 90 градусов"
      onRotate={() => onRotateWall?.(wall.id)}
    />}
  </View>;
};

const MapTextObject = ({ annotation, editable, tool, onCellPointerDown, onDeleteText }: {
  annotation: MapText;
  editable: boolean;
  tool?: EditorTool;
  onCellPointerDown?: (event: any, column: number, row: number) => void;
  onDeleteText?: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const textLayout = getMapTextLayout(annotation.text);

  return <View
    accessibilityLabel={`Подпись: ${annotation.text}`}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onPointerDown={editable ? (event: any) => {
      if (tool === 'erase') { event.stopPropagation(); onDeleteText?.(annotation.id); }
      else onCellPointerDown?.(event, Math.floor(annotation.left / MAP_GRID_SIZE), Math.floor(annotation.top / MAP_GRID_SIZE));
    } : undefined}
    style={[styles.mapTextCell, { left: annotation.left, top: annotation.top }, tool === 'erase' && styles.deletableMapElement, editable && tool !== 'erase' && styles.mapObjectPassThrough]}
  >
    <Text
      adjustsFontSizeToFit
      ellipsizeMode="tail"
      minimumFontScale={0.5}
      numberOfLines={textLayout.maxLines}
      style={[styles.mapAnnotation, { fontSize: textLayout.fontSize, lineHeight: textLayout.lineHeight }]}
    >{annotation.text}</Text>
    {editable && <MapObjectControls
      visible={hovered}
      deleteLabel="Удалить подпись"
      onDelete={() => onDeleteText?.(annotation.id)}
    />}
  </View>;
};

const ClubMap = ({ seats, positions, scale, editable, onPointerDown, onCellPointerDown, extraWalls = [], annotations = [], tool, onDeleteWall, onRotateWall, onDeleteText }: {
  seats: PcSeat[];
  positions: Record<number, SeatPosition>;
  scale: number;
  editable: boolean;
  onPointerDown?: (event: any, number: number) => void;
  onCellPointerDown?: (event: any, column: number, row: number) => void;
  extraWalls?: MapWall[];
  annotations?: MapText[];
  tool?: EditorTool;
  onDeleteWall?: (id: string) => void;
  onRotateWall?: (id: string) => void;
  onDeleteText?: (id: string) => void;
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ column: number; row: number } | null>(null);
  const handleMapPointerMove = (event: any) => {
    if (!editable) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const column = Math.floor((event.clientX - rect.left) / (MAP_GRID_SIZE * scale));
    const row = Math.floor((event.clientY - rect.top) / (MAP_GRID_SIZE * scale));
    if (column < 0 || column >= MAP_COLUMNS || row < 0 || row >= MAP_ROWS) {
      setHoveredCell(null);
      return;
    }
    setHoveredCell((current) => current?.column === column && current.row === row ? current : { column, row });
  };

  return <View style={styles.mapViewport}>
    <View nativeID="club-map" style={[styles.mapCanvas, { width: MAP_WIDTH * scale, height: MAP_HEIGHT * scale }]}>
      <View
        onPointerMove={editable ? handleMapPointerMove : undefined}
        onPointerLeave={() => setHoveredCell(null)}
        style={[styles.mapInner, { transform: [{ scale }] }]}
      >
        {editable && Array.from({ length: MAP_COLUMNS * MAP_ROWS }, (_, index) => {
          const column = index % MAP_COLUMNS;
          const row = Math.floor(index / MAP_COLUMNS);
          return <View
            key={`cell-${column}-${row}`}
            accessibilityLabel={`Клетка ${column + 1}-${row + 1}`}
            onPointerDown={editable ? (event: any) => onCellPointerDown?.(event, column, row) : undefined}
            style={[styles.mapCell, { left: column * MAP_GRID_SIZE, top: row * MAP_GRID_SIZE }, hoveredCell?.column === column && hoveredCell.row === row && styles.mapCellHovered]}
          >{editable && <Text style={styles.mapCellPlus}>+</Text>}</View>;
        })}
        {extraWalls.map((wall) => <MapWallObject key={wall.id} wall={wall} editable={editable} tool={tool} onCellPointerDown={onCellPointerDown} onDeleteWall={onDeleteWall} onRotateWall={onRotateWall} />)}
        {annotations.map((annotation) => <MapTextObject key={annotation.id} annotation={annotation} editable={editable} tool={tool} onCellPointerDown={onCellPointerDown} onDeleteText={onDeleteText} />)}
        {seats.map((seat) => {
          const number = extractSeatNumber(seat);
          const position = positions[number] ?? { left: 0, top: 0 };
          return <View key={seat.id} onPointerDown={(event: any) => {
            if (!editable || tool === 'select') onPointerDown?.(event, number);
            else if (tool !== 'erase') onCellPointerDown?.(event, Math.floor(position.left / MAP_GRID_SIZE), Math.floor(position.top / MAP_GRID_SIZE));
          }} style={[styles.mapSeatPosition, position, editable && styles.mapSeatEditable]}><SeatCard seat={seat} compact /></View>;
        })}
      </View>
    </View>
  </View>;
};

const SeatCard = ({ seat, compact }: { seat: PcSeat; compact: boolean }) => {
  const number = extractSeatNumber(seat);
  const remaining = formatRemaining(seat.remainingMinutes);
  const booking = formatBookingTime(seat.bookingStartsAt);
  if (compact) {
    const detail = remaining || (booking ? booking.slice(-5) : statusText[seat.status]);
    return <View accessibilityLabel={`Компьютер ${number || seat.name}: ${statusText[seat.status]}${detail ? `, ${detail}` : ''}`} style={[styles.mapSeat, styles[`mapSeat_${seat.status}`]]}>
      <View style={styles.mapSeatHeader}><Text style={styles.mapSeatNumber}>{number || seat.name}</Text><View style={[styles.mapSeatDot, styles[`dot_${seat.status}`]]} /></View>
      <View style={styles.mapSeatDetailRow}><Text style={styles.mapSeatClock}>◷</Text><Text style={styles.mapSeatDetail}>{detail}</Text></View>
    </View>;
  }
  return <View style={[styles.consoleSeat, styles[`seat_${seat.status}`]]}><View style={styles.seatTopRow}><Text style={styles.seatNumber}>{number || seat.name}</Text><Text style={styles.seatBadge}>{statusText[seat.status]}</Text></View><Text style={styles.seatStatus}>{remaining ? `Осталось ${remaining}` : booking ? `Бронь ${booking}` : statusText[seat.status]}</Text></View>;
};

const PriceBoard = ({ isWeekend }: { isWeekend: boolean }) => {
  const renderZone = (name: string, tone: 'standard' | 'bootcamp') => (
    <View key={name} style={[styles.zoneCard, tone === 'bootcamp' && styles.zoneCardBootcamp]}>
      <View style={styles.zoneHeading}><Text style={styles.zoneName}>{name}</Text><View style={[styles.zoneAccent, tone === 'bootcamp' && styles.zoneAccentBootcamp]} /></View>
      <Text style={styles.zoneSubheading}>ПОЧАСОВЫЕ</Text>
      <View style={styles.zoneTableHeader}><Text style={styles.zoneCell}>ПЕРИОД</Text><Text style={styles.zoneCell}>1Ч</Text><Text style={styles.zoneCell}>3Ч</Text><Text style={styles.zoneCell}>5Ч</Text></View>
      {hourlyPrices[tone].map((row) => {
        const isCurrent = (isWeekend && row.period === 'Пт - Вс') || (!isWeekend && row.period === 'Будни');
        return <View key={row.period} style={[styles.zoneRow, isCurrent ? (tone === 'bootcamp' ? styles.zoneRowActiveBootcamp : styles.zoneRowActive) : styles.zoneRowMuted]}><Text style={styles.zonePeriod}>{row.period}</Text><Text style={styles.zonePrice}>{row.one}</Text><Text style={styles.zonePrice}>{row.three}</Text><Text style={styles.zonePrice}>{row.five}</Text></View>;
      })}
      <Text style={styles.zoneSubheading}>ПАКЕТЫ</Text>
      <View style={styles.zoneTableHeader}><Text style={styles.zoneCell}>ПЕРИОД</Text><Text style={styles.zoneCell}>ДЕНЬ</Text><Text style={styles.zoneCell}>НОЧЬ</Text></View>
      {packagePrices[tone].map((row) => {
        const isCurrent = (isWeekend && row.period === 'Пт - Вс') || (!isWeekend && row.period === 'Будни');
        return <View key={row.period} style={[styles.zoneRow, isCurrent ? (tone === 'bootcamp' ? styles.zoneRowActiveBootcamp : styles.zoneRowActive) : styles.zoneRowMuted]}><Text style={styles.zonePeriod}>{row.period}</Text><Text style={styles.zonePrice}>{row.day}</Text><Text style={styles.zonePrice}>{row.night}</Text></View>;
      })}
    </View>
  );

  return <View style={styles.priceBoard}>
    <View style={styles.priceBoardHeading}><View><Text style={styles.priceEyebrow}>PRICE BOARD</Text><Text style={styles.priceBoardTitle}>Тарифы и пакеты</Text></View><Text style={styles.priceBoardNote}>Цены для быстрого ответа у стойки администратора</Text></View>
    <View style={styles.zoneGrid}>{renderZone('STANDARD', 'standard')}{renderZone('BOOTCAMP', 'bootcamp')}</View>
    <View style={styles.promoGrid}>{promos.map((promo) => <View key={promo.title} style={[styles.promoCard, promo.tone === 'warm' ? styles.promoWarm : styles.promoCool]}><Text style={styles.promoTitle}>{promo.title}</Text><Text style={styles.promoText}>{promo.text}</Text></View>)}</View>
  </View>;
};

const TransferCard = ({ transferRef, phone, bank, operator, onPhoneChange, onBankChange, onOperatorChange }: {
  transferRef: React.RefObject<View | null>;
  phone: string;
  bank: string;
  operator: string;
  onPhoneChange: (value: string) => void;
  onBankChange: (value: string) => void;
  onOperatorChange: (value: string) => void;
}) => (
  <View ref={transferRef} style={styles.transferCard}>
    <View style={styles.transferLine} />
    <Text style={styles.transferEyebrow}>TRANSFER</Text>
    <Text style={styles.transferTitle}>Номер для перевода</Text>
    <View style={styles.transferFields}>
      <View><Text style={styles.detailLabel}>ОТОБРАЖАЕМОЕ ИМЯ</Text><TextInput accessibilityLabel="Отображаемое имя получателя" value={operator} onChangeText={onOperatorChange} placeholder="Например, Иван" placeholderTextColor="#708294" style={styles.transferInput} /></View>
      <View><Text style={styles.detailLabel}>НОМЕР ТЕЛЕФОНА</Text><TextInput accessibilityLabel="Номер телефона для перевода" value={phone} onChangeText={onPhoneChange} keyboardType="phone-pad" placeholder="+7 (___) ___-__-__" placeholderTextColor="#708294" style={styles.transferInput} /></View>
      <View><Text style={styles.detailLabel}>БАНК ДЛЯ ПЕРЕВОДА</Text><TextInput accessibilityLabel="Банк для перевода" value={bank} onChangeText={onBankChange} placeholder="Например, Сбер или Т-Банк" placeholderTextColor="#708294" style={styles.transferInput} /></View>
    </View>
  </View>
);

const ConsoleCard = ({ consoles }: { consoles: PcSeat[] }) => <View style={styles.consoleCard}><Text style={styles.consoleTitle}>Консольная зона</Text><View style={styles.consoleList}>{consoles.map((seat) => <SeatCard key={seat.id} seat={seat} compact={false} />)}</View></View>;

const EditorZoomControls = ({ zoom, onZoomOut, onZoomReset, onZoomIn }: {
  zoom: number;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
}) => <View style={styles.editorZoomControls}>
  <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить масштаб карты" onPress={onZoomOut} style={styles.editorZoomButton}><Text style={styles.editorZoomGlyph}>−</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Сбросить масштаб карты" onPress={onZoomReset} style={styles.editorZoomValue}><Text style={styles.editorZoomValueText}>{Math.round(zoom * 100)}%</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Увеличить масштаб карты" onPress={onZoomIn} style={styles.editorZoomButton}><Text style={styles.editorZoomGlyph}>+</Text></Pressable>
</View>;

const EditorPage = ({ seats, positions, scale, zoom, onZoomOut, onZoomReset, onZoomIn, onPointerDown, onCellPointerDown, onReset, onBack, tool, setTool, textValue, setTextValue, extraWalls, annotations, onUndoWall, onDeleteWall, onRotateWall, onDeleteText }: {
  seats: PcSeat[];
  positions: Record<number, SeatPosition>;
  scale: number;
  zoom: number;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onPointerDown: (event: any, number: number) => void;
  onCellPointerDown: (event: any, column: number, row: number) => void;
  onReset: () => void;
  onBack: () => void;
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  textValue: string;
  setTextValue: (text: string) => void;
  extraWalls: MapWall[];
  annotations: MapText[];
  onUndoWall: () => void;
  onDeleteWall: (id: string) => void;
  onRotateWall: (id: string) => void;
  onDeleteText: (id: string) => void;
}) => <View>
  <View style={styles.editorHeading}>
    <View><Text style={styles.editorTitle}>Редактор карты</Text><Text style={styles.editorDescription}>Выберите инструмент, чтобы расставлять места, стены и подписи.</Text></View>
    <View style={styles.editorActions}>
      <Pressable style={styles.outlineButton} onPress={onReset} accessibilityRole="button"><Text style={styles.outlineButtonText}>Сбросить</Text></Pressable>
      <Pressable style={styles.primaryButton} onPress={onBack} accessibilityRole="button"><Text style={styles.primaryButtonText}>Вернуться к обзору</Text></Pressable>
    </View>
  </View>
  <View style={styles.editorToolbar}>
    <View style={styles.editorToolGroup}>
      <EditorToolButton label="Выбор и перемещение" icon="↖" selected={tool === 'select'} onPress={() => setTool('select')} />
      <EditorToolButton label="Текстовая подпись" icon="T" selected={tool === 'text'} onPress={() => setTool('text')} />
    </View>
    <View style={styles.editorToolDivider} />
    <View style={styles.editorToolGroup}>
      <EditorToolButton label="Горизонтальная стена" icon={<WallToolIcon kind="horizontal" />} selected={tool === 'wall-horizontal'} onPress={() => setTool('wall-horizontal')} />
      <EditorToolButton label="Вертикальная стена" icon={<WallToolIcon kind="vertical" />} selected={tool === 'wall-vertical'} onPress={() => setTool('wall-vertical')} />
      <EditorToolButton label="Угловая стена" icon={<WallToolIcon kind="corner" />} selected={tool === 'wall-corner'} onPress={() => setTool('wall-corner')} />
      <EditorToolButton label="Т-образная стена" icon={<WallToolIcon kind="tee" />} selected={tool === 'wall-tee'} onPress={() => setTool('wall-tee')} />
      <EditorToolButton label="Отменить последнюю стену" icon="↶" selected={false} onPress={onUndoWall} />
    </View>
    <View style={styles.editorToolDivider} />
    <EditorToolButton label="Удалить стену или текст" icon="⌫" selected={tool === 'erase'} onPress={() => setTool('erase')} />
    <View style={styles.editorToolDivider} />
    <TextInput accessibilityLabel="Текст для размещения на карте" value={textValue} onChangeText={setTextValue} placeholder="Текст подписи" placeholderTextColor="#71808d" style={styles.editorTextInput} />
    <View style={styles.editorToolDivider} />
    <EditorZoomControls zoom={zoom} onZoomOut={onZoomOut} onZoomReset={onZoomReset} onZoomIn={onZoomIn} />
  </View>
  <View style={styles.editorPanel}>
    <ClubMap seats={seats} positions={positions} scale={scale} editable tool={tool} onPointerDown={onPointerDown} onCellPointerDown={onCellPointerDown} onDeleteWall={onDeleteWall} onRotateWall={onRotateWall} onDeleteText={onDeleteText} extraWalls={extraWalls} annotations={annotations} />
  </View>
</View>;

const WallToolIcon = ({ kind }: { kind: 'horizontal' | 'vertical' | 'corner' | 'tee' | 'rotate' }) => {
  if (kind === 'rotate') {
    return <Text style={styles.wallIconRotateGlyph}>↺</Text>;
  }

  return <View style={styles.wallIcon}>
    {kind === 'horizontal' && <View style={[styles.wallIconLine, styles.wallIconHorizontal]} />}
    {kind === 'vertical' && <View style={[styles.wallIconLine, styles.wallIconVertical]} />}
    {kind === 'corner' && <><View style={[styles.wallIconLine, styles.wallIconCornerVertical]} /><View style={[styles.wallIconLine, styles.wallIconCornerHorizontal]} /></>}
    {kind === 'tee' && <><View style={[styles.wallIconLine, styles.wallIconTeeVertical]} /><View style={[styles.wallIconLine, styles.wallIconTeeHorizontal]} /></>}
  </View>;
};

const EditorToolButton = ({ label, icon, selected, onPress }: { label: string; icon: React.ReactNode; selected: boolean; onPress: () => void }) => {
  const [hovered, setHovered] = useState(false);

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onPress={onPress}
    style={[styles.editorToolButton, selected && styles.editorToolButtonSelected, hovered && styles.editorToolButtonHovered]}
  >
    {typeof icon === 'string' ? <Text style={[styles.editorToolIcon, selected && styles.editorToolIconSelected]}>{icon}</Text> : icon}
  </Pressable>;
};

export default App;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeDark: { backgroundColor: '#0B1118' },
  safeLight: { backgroundColor: '#C6CDFF' },
  appRoot: { flex: 1 },
  'theme-dark': { backgroundColor: '#0B1118', color: '#fff' },
  'theme-light': { backgroundColor: '#C6CDFF', color: '#000' },
  page: { width: '100%', maxWidth: 1920, alignSelf: 'center', paddingHorizontal: 42, paddingBottom: 12, gap: 14 },
  pagePhone: { paddingHorizontal: 18, paddingBottom: 24 },
  header: { minHeight: 82, paddingHorizontal: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, backgroundColor: '#0F6BAE' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  logoMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C6CDFF' },
  logoMarkText: { color: '#0F6BAE', fontSize: 26, fontWeight: '900' },
  brandName: { color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  brandSub: { marginTop: 2, color: '#C6CDFF', fontSize: 12, fontWeight: '600' },
  headerNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 11, backgroundColor: '#248BD6' },
  navButtonActive: { backgroundColor: '#83B8FF' },
  navButtonText: { color: '#000', fontSize: 13, fontWeight: '800' },
  themeButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 11, backgroundColor: '#C6CDFF' },
  themeButtonText: { color: '#0F6BAE', fontSize: 13, fontWeight: '900' },
  headerClock: { minWidth: 58, color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  heroRow: { minHeight: 170, padding: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, backgroundColor: '#C6CDFF', borderRadius: 26 },
  heroCopy: { maxWidth: 790 },
  heroTitle: { color: '#0F6BAE', fontSize: 52, lineHeight: 56, fontWeight: '900', letterSpacing: -1.7 },
  heroText: { marginTop: 12, maxWidth: 620, color: '#000', fontSize: 17, lineHeight: 25, fontWeight: '600' },
  heroStatus: { minWidth: 300, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#83B8FF', borderRadius: 16 },
  statusMark: { width: 13, height: 13, borderRadius: 99, backgroundColor: '#0F6BAE' },
  statusTitle: { color: '#000', fontSize: 14, fontWeight: '900' },
  statusText: { marginTop: 4, color: '#0F6BAE', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statsRowPhone: { flexWrap: 'wrap' },
  metricCard: { flex: 1, minWidth: 130, padding: 18, backgroundColor: '#fff', borderRadius: 18 },
  metric_blue: { backgroundColor: '#248BD6' },
  metric_sky: { backgroundColor: '#83B8FF' },
  metric_pale: { backgroundColor: '#C6CDFF' },
  metricValue: { color: '#000', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  metricLabel: { marginTop: 6, color: '#0F6BAE', fontSize: 13, fontWeight: '800' },
  mainGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 26 },
  mainGridPhone: { flexDirection: 'column' },
  mapColumn: { flex: 1.25, minWidth: 0 },
  sidebarColumn: { flex: 0.75, minWidth: 360, gap: 14 },
  sectionTitle: { marginBottom: 12 },
  sectionHeading: { color: '#fff', fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
  sectionHeadingLight: { color: '#000' },
  sectionDescription: { marginTop: 4, color: '#C6CDFF', fontSize: 14, fontWeight: '600' },
  sectionDescriptionLight: { color: '#0F6BAE' },
  mapPanel: { minHeight: 600, justifyContent: 'center', backgroundColor: '#111821', borderRadius: 14, overflow: 'hidden' },
  mapViewport: { alignSelf: 'center', padding: 16 },
  mapCanvas: { position: 'relative', overflow: 'hidden', backgroundColor: '#0d1217' },
  mapCanvasEditable: { cursor: 'crosshair' as any },
  mapInner: { width: MAP_WIDTH, height: MAP_HEIGHT, position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  mapCell: { position: 'absolute', width: MAP_GRID_SIZE, height: MAP_GRID_SIZE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1217', borderWidth: 1, borderColor: '#ffffff1a', borderRadius: 8, transition: 'border-color 180ms ease, background-color 180ms ease' as any },
  mapCellHovered: { borderColor: '#248BD6', backgroundColor: '#101c28' },
  mapCellPlus: { color: '#ffffff4d', fontSize: 23, fontWeight: '400' },
  mapWallCell: { position: 'absolute', width: MAP_GRID_SIZE, height: MAP_GRID_SIZE },
  mapWallShape: { position: 'absolute', left: 0, top: 0, width: MAP_GRID_SIZE, height: MAP_GRID_SIZE },
  mapWallSegment: { position: 'absolute', backgroundColor: '#343d46' },
  mapObjectControls: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 4, zIndex: 2, transition: 'opacity 180ms ease' as any, willChange: 'opacity' as any },
  mapObjectRotateButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#248BD6' },
  mapObjectDeleteButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#7D3037' },
  mapDeleteGlyph: { color: '#F5F8FB', fontSize: 24, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  mapObjectPassThrough: { pointerEvents: 'none' as any },
  deletableMapElement: { cursor: 'pointer' as any, opacity: 0.7 },
  mapTextCell: { position: 'absolute', width: MAP_GRID_SIZE, height: MAP_GRID_SIZE, alignItems: 'center', justifyContent: 'center', padding: 4 },
  mapAnnotation: { color: '#E2EAF0', fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  mapSeatPosition: { position: 'absolute' },
  mapSeatEditable: { cursor: 'grab' as any },
  mapSeat: { width: MAP_GRID_SIZE, height: MAP_GRID_SIZE, minHeight: MAP_GRID_SIZE, padding: 5, justifyContent: 'space-between', borderRadius: 8, borderWidth: 1 },
  mapSeat_free: { borderColor: '#248BFF', backgroundColor: '#101b25' },
  mapSeat_busy: { borderColor: '#7D3037', backgroundColor: '#21171a' },
  mapSeat_reserved: { borderColor: '#A96D17', backgroundColor: '#211d15' },
  mapSeat_offline: { borderColor: '#743239', backgroundColor: '#20171a' },
  mapSeatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapSeatNumber: { color: '#83B8FF', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  mapSeatDot: { width: 12, height: 12, borderRadius: 99, borderWidth: 2, borderColor: '#53616d' },
  mapSeatDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mapSeatClock: { color: '#83B8FF', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  mapSeatDetail: { color: '#83B8FF', fontSize: 12, lineHeight: 14, fontWeight: '800' },
  consoleSeat: { minWidth: 180, minHeight: 84, padding: 14, justifyContent: 'space-between', borderRadius: 14, borderWidth: 3, backgroundColor: '#fff' },
  seat_free: { borderColor: '#24B47E' },
  seat_busy: { borderColor: '#EF5350' },
  seat_reserved: { borderColor: '#F5A623' },
  seat_offline: { borderColor: '#EF5350' },
  seatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 5 },
  seatNumber: { color: '#000', fontSize: 17, fontWeight: '900' },
  seatBadge: { color: '#0F6BAE', fontSize: 13, fontWeight: '900' },
  seatStatus: { marginTop: 8, color: '#0F6BAE', fontSize: 14, lineHeight: 17, fontWeight: '800' },
  legend: { paddingTop: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 13, height: 13, borderRadius: 99 },
  dot_free: { backgroundColor: '#24B47E' },
  dot_busy: { backgroundColor: '#EF5350' },
  dot_reserved: { backgroundColor: '#F5A623' },
  dot_offline: { backgroundColor: '#EF5350' },
  legendText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  loading: { height: 520, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: '#DCE6ED', fontSize: 15, fontWeight: '800' },
  priceBoard: { padding: 12, backgroundColor: '#0B1118', borderRadius: 14, borderWidth: 1, borderColor: '#263544', gap: 9 },
  priceBoardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceEyebrow: { color: '#65C9EF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  priceBoardTitle: { marginTop: 3, color: '#F5F8FB', fontSize: 26, lineHeight: 30, fontWeight: '900' },
  priceBoardNote: { maxWidth: 190, color: '#91A4B4', fontSize: 12, lineHeight: 16, textAlign: 'right' },
  zoneGrid: { flexDirection: 'row', gap: 12 },
  zoneCard: { flex: 1, minWidth: 0, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#17465B', backgroundColor: '#071923', gap: 3 },
  zoneCardBootcamp: { borderColor: '#5A3C0A', backgroundColor: '#201606' },
  zoneHeading: { marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zoneName: { color: '#F5F8FB', fontSize: 20, fontWeight: '900' },
  zoneAccent: { width: 34, height: 6, borderRadius: 4, backgroundColor: '#36BCEB' },
  zoneAccentBootcamp: { backgroundColor: '#F5A000' },
  zoneSubheading: { marginTop: 3, color: '#DCE6ED', fontSize: 12, fontWeight: '900' },
  zoneTableHeader: { paddingVertical: 3, flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderBottomColor: '#243541' },
  zoneCell: { flex: 1, color: '#8298A9', fontSize: 10, fontWeight: '800' },
  zoneRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneRowMuted: { opacity: 0.42 },
  zoneRowActive: { paddingHorizontal: 4, borderRadius: 5, backgroundColor: '#15384A' },
  zoneRowActiveBootcamp: { paddingHorizontal: 4, borderRadius: 5, backgroundColor: '#3D2A0A' },
  zonePeriod: { flex: 1.35, color: '#F5F8FB', fontSize: 12, fontWeight: '800' },
  zonePrice: { flex: 1, color: '#F5F8FB', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  promoGrid: { flexDirection: 'row', gap: 9 },
  promoCard: { flex: 1, minWidth: 0, minHeight: 74, padding: 9, borderRadius: 11, borderWidth: 1, justifyContent: 'flex-start' },
  promoWarm: { backgroundColor: '#2B170D', borderColor: '#5A2A0C' },
  promoCool: { backgroundColor: '#0B1C29', borderColor: '#173B52' },
  promoTitle: { color: '#F5F8FB', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  promoText: { marginTop: 4, color: '#B9C9D4', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  transferCard: { position: 'relative', overflow: 'hidden', padding: 14, backgroundColor: '#101820', borderRadius: 16, borderWidth: 1, borderColor: '#263544', gap: 6 },
  transferSweep: { position: 'absolute', top: -90, bottom: -90, left: 0, width: 120, borderRadius: 80, backgroundColor: '#C6CDFF' },
  transferHalo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#C6CDFF' },
  transferLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#248BD6' },
  transferEyebrow: { color: '#65C9EF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  transferTitle: { color: '#F5F8FB', fontSize: 25, lineHeight: 30, fontWeight: '900' },
  transferFields: { gap: 7 },
  detailLabel: { marginBottom: 5, color: '#8298A9', fontSize: 11, fontWeight: '900' },
  transferInput: { height: 42, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: '#263544', backgroundColor: '#07111A', color: '#F5F8FB', fontSize: 15, fontWeight: '700', outlineStyle: 'none' as any },
  consoleCard: { padding: 18, backgroundColor: '#C6CDFF', borderRadius: 20 },
  consoleTitle: { color: '#0F6BAE', fontSize: 21, fontWeight: '900' },
  consoleList: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  editorHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 },
  editorTitle: { color: '#fff', fontSize: 40, lineHeight: 44, fontWeight: '900' },
  editorDescription: { marginTop: 8, maxWidth: 670, color: '#C6CDFF', fontSize: 15, fontWeight: '600' },
  editorActions: { flexDirection: 'row', gap: 9 },
  outlineButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 11, backgroundColor: '#C6CDFF' },
  outlineButtonText: { color: '#0F6BAE', fontSize: 13, fontWeight: '900' },
  primaryButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 11, backgroundColor: '#83B8FF' },
  primaryButtonText: { color: '#000', fontSize: 13, fontWeight: '900' },
  editorToolbar: { marginTop: 18, minHeight: 48, padding: 5, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#111821', borderRadius: 8, borderWidth: 1, borderColor: '#263544' },
  editorToolGroup: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editorToolButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent', transition: 'border-color 180ms ease' as any },
  editorToolButtonSelected: { backgroundColor: '#248BFF' },
  editorToolButtonHovered: { borderColor: '#248BD6' },
  editorToolIcon: { color: '#B8C2CB', fontSize: 19, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  editorToolIconSelected: { color: '#fff' },
  editorToolDivider: { width: 1, height: 30, backgroundColor: '#2B3741' },
  editorZoomControls: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editorZoomButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: '#18232D' },
  editorZoomGlyph: { color: '#DCE6ED', fontSize: 22, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  editorZoomValue: { minWidth: 52, height: 34, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: '#263544' },
  editorZoomValueText: { color: '#F5F8FB', fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  editorTextInput: { width: 180, height: 38, paddingHorizontal: 10, borderWidth: 1, borderColor: '#263544', borderRadius: 4, backgroundColor: '#0B1118', color: '#F5F8FB', fontSize: 13, outlineStyle: 'none' as any },
  wallIcon: { width: 28, height: 28, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  wallIconLine: { position: 'absolute', backgroundColor: '#B8C2CB', borderRadius: 2 },
  wallIconHorizontal: { width: 24, height: 4 },
  wallIconVertical: { width: 4, height: 24 },
  wallIconCornerVertical: { right: 4, top: 2, width: 4, height: 24 },
  wallIconCornerHorizontal: { right: 4, bottom: 2, width: 22, height: 4 },
  wallIconTeeVertical: { top: 2, width: 4, height: 18 },
  wallIconTeeHorizontal: { bottom: 4, width: 24, height: 4 },
  wallIconRotateGlyph: { color: '#F5F8FB', fontSize: 26, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  editorPanel: { marginTop: 12, minHeight: 680, justifyContent: 'center', backgroundColor: '#111821', borderRadius: 14, borderWidth: 1, borderColor: '#263544' },
  editorHint: { marginTop: 12, color: '#8291A0', fontSize: 13, fontWeight: '600' },
  kioskHeader: { height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 52, borderBottomWidth: 1, borderBottomColor: '#263544', backgroundColor: '#0B1118' },
  kioskBrand: { flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 320 },
  kioskBrandMark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#248BD6' },
  kioskBrandMarkText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  kioskBrandName: { color: '#fff', fontSize: 23, fontWeight: '900' },
  kioskBrandSub: { marginTop: 3, color: '#83B8FF', fontSize: 12, fontWeight: '800' },
  hoverSweepButton: { position: 'relative', overflow: 'hidden' },
  hoverSweepLayer: { position: 'absolute', left: -8, right: -8, bottom: 0, height: 96, borderRadius: 999, backgroundColor: '#ffffff26', zIndex: 0, transition: 'transform 300ms ease-out' as any, willChange: 'transform' as any },
  hoverSweepText: { position: 'relative', zIndex: 1 },
  kioskEditButton: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, backgroundColor: '#111821', borderWidth: 1, borderColor: '#263544' },
  kioskEditButtonText: { color: '#83B8FF', fontSize: 13, fontWeight: '800' },
  kioskDateTime: { minWidth: 320, alignItems: 'flex-end' },
  kioskClock: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  kioskDate: { marginTop: 2, color: '#83B8FF', fontSize: 17, fontWeight: '700' },
  kioskStatusRow: { height: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#111821', borderWidth: 1, borderColor: '#263544' },
  kioskEyebrow: { color: '#83B8FF', fontSize: 17, fontWeight: '800' },
  kioskFreeLine: { flexDirection: 'row', alignItems: 'baseline' },
  kioskFreeCount: { marginTop: 1, color: '#24B47E', fontSize: 52, lineHeight: 56, fontWeight: '900' },
  kioskFreeTotal: { color: '#66788A', fontSize: 29, fontWeight: '700' },
  kioskStatus: { flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 320 },
  kioskLiveDot: { width: 18, height: 18, borderRadius: 99, backgroundColor: '#24B47E' },
  kioskLiveDotMuted: { backgroundColor: '#F5A623' },
  kioskStatusTitle: { color: '#fff', fontSize: 23, fontWeight: '900' },
  kioskStatusMeta: { marginTop: 4, color: '#AAB8C5', fontSize: 17, fontWeight: '600' },
  kioskRefresh: { color: '#8291A0', fontSize: 15, fontWeight: '600' },
  kioskStatusActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kioskRetryButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#248BD6' },
  kioskRetryText: { color: '#000', fontSize: 13, fontWeight: '900' },
  kioskGrid: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'stretch', gap: 28 },
  kioskMapColumn: { flex: 1.08, minWidth: 0 },
  kioskInfoColumn: { flex: 0.92, minWidth: 0, gap: 14 },
  kioskSectionHeading: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kioskSectionTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  kioskSectionNote: { color: '#8291A0', fontSize: 15, fontWeight: '600' },
  kioskMapPanel: { flex: 1, minHeight: 530, position: 'relative', justifyContent: 'center', overflow: 'hidden', borderRadius: 14, backgroundColor: '#111821', borderWidth: 1, borderColor: '#263544' },
  kioskLegend: { position: 'absolute', top: 16, right: 18, padding: 11, borderRadius: 9, backgroundColor: '#0B1118' },
});
