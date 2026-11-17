import { useEffect, useRef, useState, type Dispatch, type DragEvent, type PointerEvent, type ReactNode, type SetStateAction } from "react";
import { getDetailedWorkersWithStatus, getTariffs, type PcSeat, type Tariff as SmartShellTariff } from "./src/smartshell";

type ItemType =
  | "computer"
  | "console"
  | "vr"
  | "simulator"
  | "billiards"
  | "chess"
  | "reception"
  | "cloakroom"
  | "wc"
  | "lounge"
  | "cafe"
  | "label";

type MapItem = {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  label: string;
  number?: number;
  status?: "free" | "busy" | "reserved" | "offline";
  remaining?: string;
};

type Point = { x: number; y: number };
type Wall = { id: string; points: Point[] };
type Tariff = { id: string; name: string; duration: string; day: string; night: string };
type Promotion = { id: string; title: string; description: string };
type EditorSection = "map" | "tariffs" | "promotions";
type EditorTool = "select" | "wall" | ItemType;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 720;

const computerPositions = [
  [155, 150],
  [245, 150],
  [335, 150],
  [155, 245],
  [245, 245],
  [335, 245],
  [155, 340],
  [245, 340],
  [335, 340],
  [650, 145],
  [740, 145],
  [830, 145],
  [650, 240],
  [740, 240],
  [830, 240],
  [650, 335],
  [740, 335],
  [830, 335],
  [920, 145],
  [920, 240],
];

const initialItems: MapItem[] = [
  ...computerPositions.map(([x, y], index) => ({
    id: `pc-${index + 1}`,
    type: "computer" as const,
    x,
    y,
    label: `Компьютер ${index + 1}`,
    number: index + 1,
    status: ([2, 5, 8, 11, 15, 17, 20].includes(index + 1) ? "free" : "busy") as "free" | "busy",
    remaining: ["01:42", "02:18", "00:36", "03:05"][index % 4],
  })),
  { id: "reception-1", type: "reception", x: 170, y: 565, label: "Администратор" },
  { id: "wc-1", type: "wc", x: 790, y: 580, label: "WC" },
  { id: "lounge-1", type: "lounge", x: 1030, y: 390, label: "Lounge" },
  { id: "console-1", type: "console", x: 1030, y: 485, label: "PlayStation" },
];

const initialWalls: Wall[] = [
  {
    id: "wall-1",
    points: [
      { x: 75, y: 85 },
      { x: 535, y: 85 },
      { x: 535, y: 470 },
      { x: 75, y: 470 },
      { x: 75, y: 85 },
    ],
  },
  {
    id: "wall-2",
    points: [
      { x: 585, y: 85 },
      { x: 985, y: 85 },
      { x: 985, y: 470 },
      { x: 585, y: 470 },
      { x: 585, y: 85 },
    ],
  },
  {
    id: "wall-3",
    points: [
      { x: 75, y: 515 },
      { x: 535, y: 515 },
      { x: 535, y: 665 },
      { x: 75, y: 665 },
      { x: 75, y: 515 },
    ],
  },
  {
    id: "wall-4",
    points: [
      { x: 585, y: 515 },
      { x: 985, y: 515 },
      { x: 985, y: 665 },
      { x: 585, y: 665 },
    ],
  },
];

const initialTariffs: Tariff[] = [
  { id: "t-1", name: "Стандарт", duration: "1 час", day: "150", night: "180" },
  { id: "t-2", name: "Стандарт", duration: "3 часа", day: "390", night: "450" },
  { id: "t-3", name: "Стандарт", duration: "5 часов", day: "590", night: "690" },
  { id: "t-4", name: "Bootcamp", duration: "3 часа", day: "490", night: "550" },
];

const initialPromotions: Promotion[] = [
  {
    id: "p-1",
    title: "Ночной пакет",
    description: "8 часов игры ежедневно с 22:00 до 08:00 за 990 ₽",
  },
  {
    id: "p-2",
    title: "+100 ₽ новым гостям",
    description: "Бонус при первом пополнении баланса от 500 ₽",
  },
];

const REFRESH_INTERVAL_MS = 30000;
const STORAGE_PREFIX = "cyberstreet-design-";

const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
};

const storeValue = (key: string, value: unknown) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  }
};

const formatRemaining = (minutes: number | null) => {
  if (minutes === null) return "";
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const rest = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${rest}`;
};

const positionForSeat = (seatNumber: number) => {
  const position = computerPositions[Math.max(0, seatNumber - 1) % computerPositions.length];
  return { x: position[0], y: position[1] };
};

const mapSeatToItem = (seat: PcSeat, existing?: MapItem): MapItem => {
  const seatNumber = seat.position ?? Number(seat.name.match(/\d+/)?.[0] ?? 0);
  const fallbackNumber = seatNumber > 0 ? seatNumber : 1;
  const position = existing ?? positionForSeat(fallbackNumber);
  return {
    id: `pc-${fallbackNumber}`,
    type: "computer",
    x: position.x,
    y: position.y,
    label: existing?.label ?? seat.name,
    number: fallbackNumber,
    status: seat.status,
    remaining: seat.status === "free" ? "Свободен" : formatRemaining(seat.remainingMinutes),
  };
};

const mergeSeatsIntoItems = (current: MapItem[], seats: PcSeat[]) => {
  const nonComputerItems = current.filter((item) => item.type !== "computer");
  const existingByNumber = new Map(
    current.filter((item) => item.type === "computer" && item.number).map((item) => [item.number, item]),
  );
  return [
    ...seats.filter((seat) => seat.group === "pc").map((seat) => {
      const number = seat.position ?? Number(seat.name.match(/\d+/)?.[0] ?? 0);
      return mapSeatToItem(seat, existingByNumber.get(number));
    }),
    ...nonComputerItems,
  ];
};

const mapSmartShellTariffs = (tariffs: SmartShellTariff[]): Tariff[] => tariffs.map((tariff) => ({
  id: tariff.id,
  name: tariff.title,
  duration: `${tariff.durationHours} ${tariff.durationHours === 1 ? "час" : "часа"}`,
  day: String(tariff.price),
  night: String(tariff.price),
}));

const palette: { type: ItemType; label: string }[] = [
  { type: "computer", label: "Компьютер" },
  { type: "console", label: "Консоль" },
  { type: "vr", label: "VR" },
  { type: "simulator", label: "Симулятор" },
  { type: "billiards", label: "Бильярд" },
  { type: "chess", label: "Настольные игры" },
  { type: "reception", label: "Ресепшен" },
  { type: "cloakroom", label: "Гардероб" },
  { type: "wc", label: "WC" },
  { type: "lounge", label: "Диван" },
  { type: "cafe", label: "Кафе" },
  { type: "label", label: "Подпись" },
];

function Icon({ type }: { type: EditorTool }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 };
  if (type === "select") return <path {...common} d="m5 3 14 10-6 1.2L10 20z" />;
  if (type === "wall") return <path {...common} d="M3 15 8 9l4 3 4-6 5 3" />;
  if (type === "computer") return <path {...common} d="M4 5h16v11H4zM9 20h6M12 16v4" />;
  if (type === "console")
    return (
      <path
        {...common}
        d="M7 9h10c2 0 3 2 3 5s-1 5-3 5l-3-3h-4l-3 3c-2 0-3-2-3-5s1-5 3-5Zm1 3v4m-2-2h4m6-1h.01m2 2h.01"
      />
    );
  if (type === "vr") return <path {...common} d="M3 8h18v9H15l-3-3-3 3H3z" />;
  if (type === "simulator")
    return <path {...common} d="M12 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 0v7m-6 1h6l5-3" />;
  if (type === "billiards")
    return (
      <>
        <circle {...common} cx="12" cy="12" r="9" />
        <text x="12" y="15" textAnchor="middle" fill="currentColor" fontSize="8">
          8
        </text>
      </>
    );
  if (type === "chess") return <path {...common} d="M8 4h8l-1 5-3 3-3-3zm2 8h4l2 7H8zM7 20h10" />;
  if (type === "reception") return <path {...common} d="M3 10h18v9H3zM7 10V7h10v3M7 14h4" />;
  if (type === "cloakroom") return <path {...common} d="M12 5a2 2 0 1 0-2-2M12 5v3L4 14h16l-8-6" />;
  if (type === "wc")
    return (
      <text x="12" y="15" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="700">
        WC
      </text>
    );
  if (type === "lounge")
    return <path {...common} d="M5 10v-2c0-2 1-3 3-3h8c2 0 3 1 3 3v2m-16 1v7h18v-7m-16 4h14" />;
  if (type === "cafe")
    return <path {...common} d="M5 5v7m3-7v7m-6-4h9M7 12v8m8-15v15m0-10c5 0 5-5 0-5" />;
  return (
    <>
      <path {...common} d="M5 5h14M12 5v15" />
      <path {...common} d="M9 20h6" />
    </>
  );
}

function MapObject({
  item,
  editor,
  selected,
  onSelect,
}: {
  item: MapItem;
  editor?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const isComputer = item.type === "computer";
  return (
    <button
      className={`map-object ${item.type} ${item.status ?? ""} ${selected ? "selected" : ""}`}
      style={{
        left: `${(item.x / CANVAS_WIDTH) * 100}%`,
        top: `${(item.y / CANVAS_HEIGHT) * 100}%`,
      }}
      draggable={editor}
      onDragStart={(event) => event.dataTransfer.setData("map-item-id", item.id)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      aria-label={item.label}
    >
      {isComputer ? (
        <>
          <span className="object-number">{String(item.number).padStart(2, "0")}</span>
          <i />
          <Icon type="computer" />
          <small>{item.status === "free" ? "Свободен" : item.remaining}</small>
        </>
      ) : (
        <>
          <Icon type={item.type} />
          <small>{item.label}</small>
        </>
      )}
    </button>
  );
}

function ClubMap({
  items,
  walls,
  className = "",
}: {
  items: MapItem[];
  walls: Wall[];
  className?: string;
}) {
  return (
    <div className={`club-map ${className}`}>
      <svg className="wall-layer" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
        {walls.map((wall) => (
          <polyline
            points={wall.points.map((point) => `${point.x},${point.y}`).join(" ")}
            key={wall.id}
          />
        ))}
      </svg>
      {items.map((item) => (
        <MapObject item={item} key={item.id} />
      ))}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"overview" | "editor">("overview");
  const [items, setItems] = useState<MapItem[]>(() => readStored("items", initialItems));
  const [walls, setWalls] = useState<Wall[]>(() => readStored("walls", initialWalls));
  const [tariffs, setTariffs] = useState<Tariff[]>(() => readStored("tariffs", initialTariffs));
  const [promotions, setPromotions] = useState<Promotion[]>(() => readStored("promotions", initialPromotions));
  const [isLoading, setIsLoading] = useState(true);
  const freeCount = items.filter(
    (item) => item.type === "computer" && item.status === "free",
  ).length;
  const computerCount = items.filter((item) => item.type === "computer").length;

  useEffect(() => {
    let mounted = true;

    const loadSeats = async () => {
      const result = await getDetailedWorkersWithStatus();
      if (!mounted) return;
      setItems((current) => mergeSeatsIntoItems(current, result.data));
      setIsLoading(false);
    };

    loadSeats();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") loadSeats();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getTariffs().then((result) => {
      if (mounted && result.length > 0) setTariffs(mapSmartShellTariffs(result));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const saveChanges = () => {
    storeValue("items", items);
    storeValue("walls", walls);
    storeValue("tariffs", tariffs);
    storeValue("promotions", promotions);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("overview")} aria-label="Cyberspace">
          <span className="brand-mark">C</span>
          <span>CYBERSPACE</span>
        </button>
        <div className="header-actions">
          <button
            className={view === "overview" ? "header-link active" : "header-link"}
            onClick={() => setView("overview")}
          >
            Обзор клуба
          </button>
          <button
            className={view === "editor" ? "header-link active" : "header-link"}
            onClick={() => setView("editor")}
          >
            Редактор
          </button>
          <span className="live-dot">СИСТЕМА ОНЛАЙН</span>
        </div>
      </header>

      {view === "editor" ? (
        <Editor
          items={items}
          setItems={setItems}
          walls={walls}
          setWalls={setWalls}
          tariffs={tariffs}
          setTariffs={setTariffs}
          promotions={promotions}
          setPromotions={setPromotions}
          onSave={saveChanges}
          onExit={() => setView("overview")}
        />
      ) : (
        <div className="overview">
          <section className="hero">
            <div>
              <p className="eyebrow">КАРТА КЛУБА</p>
              <h1>Выберите своё место</h1>
              <p>Единая схема зала и актуальная занятость компьютеров.</p>
            </div>
            <div className="availability">
              <span>{freeCount}</span>
              <div>
                <strong>мест свободно</strong>
                <small>из {computerCount} компьютеров</small>
              </div>
            </div>
          </section>

          <div className="overview-grid">
            <section className="map-panel" aria-busy={isLoading}>
              <div className="section-bar">
                <div>
                  <span>ПЛАНИРОВКА</span>
                  <h2>Весь клуб</h2>
                </div>
                <div className="legend">
                  <span>
                    <i className="free-key" />
                    Свободно
                  </span>
                  <span>
                    <i className="busy-key" />
                    Занято
                  </span>
                </div>
              </div>
              <ClubMap items={items} walls={walls} />
            </section>

            <aside className="overview-side">
              <section className="price-panel">
                <div className="section-bar">
                  <div>
                    <span>ТАРИФЫ</span>
                    <h2>Стоимость игры</h2>
                  </div>
                </div>
                <div className="tariff-list">
                  {tariffs.map((tariff) => (
                    <div className="tariff-line" key={tariff.id}>
                      <div>
                        <strong>{tariff.name}</strong>
                        <span>{tariff.duration}</span>
                      </div>
                      <div>
                        <small>ДЕНЬ</small>
                        <strong>{tariff.day} ₽</strong>
                      </div>
                      <div>
                        <small>НОЧЬ</small>
                        <strong>{tariff.night} ₽</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="promotions-panel">
                <p className="eyebrow">АКЦИИ КЛУБА</p>
                {promotions.map((promotion, index) => (
                  <article
                    className={index === 0 ? "promotion featured" : "promotion"}
                    key={promotion.id}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{promotion.title}</h3>
                      <p>{promotion.description}</p>
                    </div>
                  </article>
                ))}
              </section>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}

type EditorProps = {
  items: MapItem[];
  setItems: Dispatch<SetStateAction<MapItem[]>>;
  walls: Wall[];
  setWalls: Dispatch<SetStateAction<Wall[]>>;
  tariffs: Tariff[];
  setTariffs: Dispatch<SetStateAction<Tariff[]>>;
  promotions: Promotion[];
  setPromotions: Dispatch<SetStateAction<Promotion[]>>;
  onSave: () => void;
  onExit: () => void;
};

function Editor({
  items,
  setItems,
  walls,
  setWalls,
  tariffs,
  setTariffs,
  promotions,
  setPromotions,
  onSave,
  onExit,
}: EditorProps) {
  const [section, setSection] = useState<EditorSection>("map");
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [draft, setDraft] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedItem = items.find((item) => item.id === selectedId);

  const pointFromEvent = (event: PointerEvent<HTMLDivElement> | DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH),
      y: Math.round(((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT),
    };
  };

  const addItem = (type: ItemType, point: Point) => {
    const computerNumber =
      type === "computer"
        ? Math.max(0, ...items.filter((item) => item.number).map((item) => item.number ?? 0)) + 1
        : undefined;
    const paletteItem = palette.find((item) => item.type === type);
    const newItem: MapItem = {
      id: `${type}-${Date.now()}`,
      type,
      x: point.x,
      y: point.y,
      label: type === "computer" ? `Компьютер ${computerNumber}` : (paletteItem?.label ?? "Объект"),
      number: computerNumber,
      status: type === "computer" ? "free" : undefined,
    };
    setItems((current) => [...current, newItem]);
    setSelectedId(newItem.id);
    setTool("select");
  };

  const updateTariff = (id: string, field: keyof Tariff, value: string) =>
    setTariffs((current) =>
      current.map((tariff) => (tariff.id === id ? { ...tariff, [field]: value } : tariff)),
    );

  const updatePromotion = (id: string, field: keyof Promotion, value: string) =>
    setPromotions((current) =>
      current.map((promotion) =>
        promotion.id === id ? { ...promotion, [field]: value } : promotion,
      ),
    );

  return (
    <div className="editor">
      <div className="editor-titlebar">
        <div>
          <p className="eyebrow">УПРАВЛЕНИЕ КЛУБОМ</p>
          <h1>Редактор</h1>
          <p>Карта, тарифы и акции в одном рабочем пространстве.</p>
        </div>
        <div className="editor-actions">
          <button className="secondary-action" onClick={onExit}>
            Выйти
          </button>
          <button
            className="primary-action"
            onClick={() => {
              onSave();
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1600);
            }}
          >
            {saved ? "Изменения сохранены" : "Сохранить"}
          </button>
        </div>
      </div>

      <nav className="editor-nav">
        {(
          [
            ["map", "Карта клуба", `${items.length} объектов`],
            ["tariffs", "Тарифы", `${tariffs.length} позиций`],
            ["promotions", "Акции", `${promotions.length} активных`],
          ] as [EditorSection, string, string][]
        ).map(([id, label, count]) => (
          <button
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
            key={id}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </nav>

      {section === "map" && (
        <>
          <div className="editor-toolbar">
            <button
              className={tool === "select" ? "tool active" : "tool"}
              onClick={() => setTool("select")}
              title="Выбор"
            >
              <svg viewBox="0 0 24 24">
                <Icon type="select" />
              </svg>
              <span>Выбор</span>
            </button>
            <button
              className={tool === "wall" ? "tool active" : "tool"}
              onClick={() => setTool("wall")}
              title="Нарисовать стену"
            >
              <svg viewBox="0 0 24 24">
                <Icon type="wall" />
              </svg>
              <span>Стена</span>
            </button>
            <div className="toolbar-divider" />
            <div className="palette-scroll">
              {palette.map((item) => (
                <button
                  className={tool === item.type ? "palette-item active" : "palette-item"}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("new-item-type", item.type)}
                  onClick={() => setTool(item.type)}
                  title={`${item.label}: перетащите или выберите и нажмите на карту`}
                  key={item.type}
                >
                  <svg viewBox="0 0 24 24">
                    <Icon type={item.type} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="zoom-control">
              <button onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
              <span>{zoom}%</span>
              <button onClick={() => setZoom((value) => Math.min(160, value + 10))}>+</button>
            </div>
          </div>

          <div className="editor-workspace">
            <div className="canvas-viewport">
              <div
                className={`editor-canvas tool-${tool}`}
                style={{ width: `${(CANVAS_WIDTH * zoom) / 100}px` }}
                ref={canvasRef}
                onClick={(event) => {
                  if (tool !== "select" && tool !== "wall") addItem(tool, pointFromEvent(event));
                  else if (tool === "select") setSelectedId(null);
                }}
                onPointerDown={(event) => {
                  if (tool !== "wall") return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraft([pointFromEvent(event)]);
                  setDrawing(true);
                }}
                onPointerMove={(event) => {
                  if (!drawing || tool !== "wall") return;
                  const point = pointFromEvent(event);
                  setDraft((current) => {
                    const last = current[current.length - 1];
                    return !last || Math.hypot(point.x - last.x, point.y - last.y) >= 3
                      ? [...current, point]
                      : current;
                  });
                }}
                onPointerUp={() => {
                  if (draft.length > 1) {
                    setWalls((current) => [
                      ...current,
                      { id: `wall-${Date.now()}`, points: draft },
                    ]);
                  }
                  setDraft([]);
                  setDrawing(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const point = pointFromEvent(event);
                  const newType = event.dataTransfer.getData("new-item-type") as ItemType;
                  const itemId = event.dataTransfer.getData("map-item-id");
                  if (newType) addItem(newType, point);
                  if (itemId) {
                    setItems((current) =>
                      current.map((item) => (item.id === itemId ? { ...item, ...point } : item)),
                    );
                  }
                }}
              >
                <svg className="wall-layer" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
                  {walls.map((wall) => (
                    <polyline
                      points={wall.points.map((point) => `${point.x},${point.y}`).join(" ")}
                      key={wall.id}
                    />
                  ))}
                  {draft.length > 0 && (
                    <polyline
                      className="draft-wall"
                      points={draft.map((point) => `${point.x},${point.y}`).join(" ")}
                    />
                  )}
                </svg>
                {items.map((item) => (
                  <MapObject
                    item={item}
                    editor
                    selected={selectedId === item.id}
                    onSelect={() => {
                      setSelectedId(item.id);
                      setTool("select");
                    }}
                    key={item.id}
                  />
                ))}
              </div>
            </div>

            <aside className="inspector">
              <div className="inspector-head">
                <p className="eyebrow">ИНСПЕКТОР</p>
                <h2>{selectedItem ? selectedItem.label : "Схема зала"}</h2>
              </div>
              {selectedItem ? (
                <>
                  <div className="object-preview">
                    <svg viewBox="0 0 24 24">
                      <Icon type={selectedItem.type} />
                    </svg>
                    <div>
                      <strong>
                        {palette.find((item) => item.type === selectedItem.type)?.label ?? "Объект"}
                      </strong>
                      <span>
                        X {selectedItem.x} · Y {selectedItem.y}
                      </span>
                    </div>
                  </div>
                  <label className="field">
                    НАЗВАНИЕ
                    <input
                      value={selectedItem.label}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((item) =>
                            item.id === selectedItem.id
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="coordinate-row">
                    <label className="field">
                      X<input value={selectedItem.x} readOnly />
                    </label>
                    <label className="field">
                      Y<input value={selectedItem.y} readOnly />
                    </label>
                  </div>
                  <button
                    className="danger-action"
                    onClick={() => {
                      setItems((current) => current.filter((item) => item.id !== selectedItem.id));
                      setSelectedId(null);
                    }}
                  >
                    Удалить объект
                  </button>
                </>
              ) : (
                <div className="canvas-settings">
                  <p>Выберите объект на карте, чтобы изменить его параметры.</p>
                  <div>
                    <span>Размер схемы</span>
                    <strong>1200 × 720 px</strong>
                  </div>
                  <div>
                    <span>Объектов</span>
                    <strong>{items.length}</strong>
                  </div>
                  <div>
                    <span>Стен</span>
                    <strong>{walls.length}</strong>
                  </div>
                  <button
                    className="secondary-action full"
                    disabled={walls.length === 0}
                    onClick={() => setWalls((current) => current.slice(0, -1))}
                  >
                    Отменить последнюю стену
                  </button>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {section === "tariffs" && (
        <CollectionEditor
          eyebrow="ПРАЙС-ЛИСТ"
          title="Тарифы клуба"
          description="Добавляйте любое количество тарифов. Все позиции сразу появятся на клиентском экране."
          addLabel="Добавить тариф"
          onAdd={() =>
            setTariffs((current) => [
              ...current,
              {
                id: `t-${Date.now()}`,
                name: "Новый тариф",
                duration: "1 час",
                day: "0",
                night: "0",
              },
            ])
          }
        >
          <div className="data-table tariff-editor">
            <div className="data-head">
              <span>Название</span>
              <span>Длительность</span>
              <span>День, ₽</span>
              <span>Ночь, ₽</span>
              <span />
            </div>
            {tariffs.map((tariff) => (
              <div className="data-row" key={tariff.id}>
                <input
                  value={tariff.name}
                  onChange={(event) => updateTariff(tariff.id, "name", event.target.value)}
                />
                <input
                  value={tariff.duration}
                  onChange={(event) => updateTariff(tariff.id, "duration", event.target.value)}
                />
                <input
                  type="number"
                  value={tariff.day}
                  onChange={(event) => updateTariff(tariff.id, "day", event.target.value)}
                />
                <input
                  type="number"
                  value={tariff.night}
                  onChange={(event) => updateTariff(tariff.id, "night", event.target.value)}
                />
                <button
                  onClick={() =>
                    setTariffs((current) => current.filter((item) => item.id !== tariff.id))
                  }
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </CollectionEditor>
      )}

      {section === "promotions" && (
        <CollectionEditor
          eyebrow="МАРКЕТИНГ"
          title="Акции"
          description="Название и короткое описание объясняют гостю выгоду предложения."
          addLabel="Добавить акцию"
          onAdd={() =>
            setPromotions((current) => [
              ...current,
              {
                id: `p-${Date.now()}`,
                title: "Новая акция",
                description: "Кратко опишите выгоду для гостя",
              },
            ])
          }
        >
          <div className="promotion-editor">
            {promotions.map((promotion, index) => (
              <article key={promotion.id}>
                <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
                <label className="field">
                  НАЗВАНИЕ
                  <input
                    value={promotion.title}
                    onChange={(event) => updatePromotion(promotion.id, "title", event.target.value)}
                  />
                </label>
                <label className="field wide">
                  КРАТКОЕ ОПИСАНИЕ
                  <textarea
                    value={promotion.description}
                    onChange={(event) =>
                      updatePromotion(promotion.id, "description", event.target.value)
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    setPromotions((current) => current.filter((item) => item.id !== promotion.id))
                  }
                >
                  Удалить
                </button>
              </article>
            ))}
          </div>
        </CollectionEditor>
      )}
    </div>
  );
}

function CollectionEditor({
  eyebrow,
  title,
  description,
  addLabel,
  onAdd,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="collection-editor">
      <header>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="primary-action" onClick={onAdd}>
          + {addLabel}
        </button>
      </header>
      {children}
    </section>
  );
}
