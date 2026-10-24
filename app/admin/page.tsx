"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "https://smart-laundry-system-2.onrender.com";

type Order = {
  queue_number: number;
  tracking_id: string;
  customer_name: string;
  phone: string;
  clothes: number;
  service: string;
  status: string;
  pickup_status: string;
  created_at?: string;
  completed_at?: string | null;
  picked_up_at?: string | null;
};

const STATUSES = ["Waiting", "Washing", "Drying", "Ready", "Completed"];
const PICKUP_STATUSES = ["Not Ready", "Ready for Pickup", "Picked Up"];

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/orders`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load orders (HTTP ${response.status}).`);
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : (data.orders || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the laundry backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const updateOrder = async (
    order: Order,
    field: "status" | "pickup_status",
    value: string
  ) => {
    const previous = orders;
    setBusyId(order.tracking_id);
    setNotice("");
    setError("");

    // Optimistically update the display, then restore it if the API rejects the request.
    setOrders((current) =>
      current.map((item) =>
        item.tracking_id === order.tracking_id ? { ...item, [field]: value } : item
      )
    );

    try {
      const response = await fetch(
        `${API_URL}/api/orders/${encodeURIComponent(order.tracking_id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Status update failed (HTTP ${response.status}). Your backend may use a different update endpoint. ${detail.slice(0, 160)}`
        );
      }

      setNotice(`Updated ${order.tracking_id}.`);
      await loadOrders();
    } catch (err) {
      setOrders(previous);
      setError(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setBusyId("");
    }
  };

  const filteredOrders = orders.filter((order) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.tracking_id.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.phone.includes(query);
    const matchesStatus = statusFilter === "All" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = orders.filter((order) => order.status !== "Completed").length;
  const readyCount = orders.filter(
    (order) => order.pickup_status === "Ready for Pickup"
  ).length;
  const completedCount = orders.filter((order) => order.status === "Completed").length;

  return (
    <main className="adminPage">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <a className="brand" href="/">
          <span className="brandMark">L</span>
          <span>
            <strong>L&apos;AURA</strong>
            <small>ADMIN CONSOLE</small>
          </span>
        </a>
        <div className="topbarRight">
          <span className="liveDot" />
          <span className="liveText">LAUNDRY OPERATIONS</span>
          <a className="siteLink" href="/">Customer site ↗</a>
        </div>
      </header>

      <section className="mainContent">
        <div className="intro">
          <div>
            <p className="eyebrow">CONTROL CENTRE / OVERVIEW</p>
            <h1>Order <span>management.</span></h1>
            <p className="subtitle">
              View every laundry booking and manage washing and pickup progress.
            </p>
          </div>
          <button className="refreshButton" onClick={() => void loadOrders()} disabled={loading}>
            <span className={loading ? "refreshIcon spinning" : "refreshIcon"}>↻</span>
            {loading ? "Refreshing…" : "Refresh orders"}
          </button>
        </div>

        <div className="stats">
          <article className="stat">
            <span className="statLabel">TOTAL ORDERS</span>
            <strong>{orders.length}</strong>
            <span className="statHint">All bookings</span>
          </article>
          <article className="stat">
            <span className="statLabel">IN PROGRESS</span>
            <strong>{activeCount}</strong>
            <span className="statHint">Not completed</span>
          </article>
          <article className="stat">
            <span className="statLabel">READY FOR PICKUP</span>
            <strong>{readyCount}</strong>
            <span className="statHint">Awaiting collection</span>
          </article>
          <article className="stat">
            <span className="statLabel">COMPLETED</span>
            <strong>{completedCount}</strong>
            <span className="statHint">Finished orders</span>
          </article>
        </div>

        {notice && <div className="notice" role="status">{notice}</div>}
        {error && <div className="error" role="alert">{error}</div>}

        <section className="ordersPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">CUSTOMER BOOKINGS</p>
              <h2>All orders <span>({filteredOrders.length})</span></h2>
            </div>
            <div className="filters">
              <input
                aria-label="Search orders"
                placeholder="Search name, phone or tracking ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter by order status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>All</option>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {loading && orders.length === 0 ? (
            <div className="empty">Loading orders from the backend…</div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty">
              <span className="emptySpark">✧</span>
              <strong>{orders.length ? "No matching orders" : "No orders found"}</strong>
              <p>{orders.length ? "Try a different search or status filter." : "New customer bookings will appear here when the API returns them."}</p>
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>SERVICE</th>
                    <th>BOOKED</th>
                    <th>LAUNDRY STATUS</th>
                    <th>PICKUP STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.tracking_id}>
                      <td>
                        <strong className="tracking">{order.tracking_id}</strong>
                        <span className="subline">Queue #{order.queue_number} · {order.clothes} clothes</span>
                      </td>
                      <td>
                        <strong>{order.customer_name}</strong>
                        <span className="subline">{order.phone}</span>
                      </td>
                      <td>{order.service}</td>
                      <td>{dateLabel(order.created_at)}</td>
                      <td>
                        <select
                          className="statusSelect"
                          aria-label={`Laundry status for ${order.tracking_id}`}
                          value={order.status}
                          disabled={busyId === order.tracking_id}
                          onChange={(event) => void updateOrder(order, "status", event.target.value)}
                        >
                          {STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="statusSelect pickupSelect"
                          aria-label={`Pickup status for ${order.tracking_id}`}
                          value={order.pickup_status}
                          disabled={busyId === order.tracking_id}
                          onChange={(event) => void updateOrder(order, "pickup_status", event.target.value)}
                        >
                          {!PICKUP_STATUSES.includes(order.pickup_status) && (
                            <option>{order.pickup_status}</option>
                          )}
                          {PICKUP_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        {busyId === order.tracking_id && <span className="subline">Saving…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="footnote">
          L&apos;AURA · Smart Laundry Queue & Pickup Manager
          <span>Admin dashboard</span>
        </p>
      </section>

      <style jsx global>{`
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        body { background: #fbf9ff; color: #40364f; font-family: Arial, Helvetica, sans-serif; }
        button, input, select { font: inherit; }
        button, a, select { -webkit-tap-highlight-color: transparent; }
        .adminPage {
          min-height: 100vh; position: relative; overflow: hidden;
          background: linear-gradient(135deg, #fbf9ff 0%, #f2ecfa 48%, #fffaf5 100%);
          color: #40364f; isolation: isolate;
        }
        .ambient { position: absolute; width: 390px; height: 390px; border-radius: 50%; filter: blur(95px); opacity: .26; pointer-events: none; z-index: -1; }
        .ambientOne { top: 80px; left: -180px; background: #ddcbed; }
        .ambientTwo { top: 380px; right: -180px; background: #f1dbea; }
        .topbar {
          height: 82px; padding: 0 clamp(20px, 5vw, 76px); display: flex;
          justify-content: space-between; align-items: center; gap: 20px;
          border-bottom: 1px solid #e9def2; background: rgba(255, 252, 255, .8);
          backdrop-filter: blur(18px); position: relative;
        }
        .brand { display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
        .brandMark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: linear-gradient(140deg, #f4eafb, #ded0ed); border: 1px solid #dfd0ec; color: #79648e; font-size: 23px; font-weight: 800; }
        .brand strong { display: block; font-size: 18px; letter-spacing: 4px; }
        .brand small { display: block; color: #9888a5; font-size: 9px; letter-spacing: 2px; margin-top: 4px; }
        .topbarRight { display: flex; align-items: center; gap: 10px; color: #897a98; font-size: 10px; letter-spacing: 1.5px; }
        .liveDot { width: 7px; height: 7px; background: #a4c6ad; border-radius: 50%; box-shadow: 0 0 0 4px #e8f2e9; }
        .siteLink { margin-left: 12px; text-decoration: none; color: #6f5a84; background: #f4edf9; border: 1px solid #e4d7ef; border-radius: 10px; padding: 11px 14px; letter-spacing: 0; font-size: 12px; transition: .25s ease; }
        .siteLink:hover { transform: translateY(-2px); background: #eee3f7; }
        .mainContent { width: min(1440px, 100%); margin: 0 auto; padding: 54px clamp(18px, 5vw, 76px) 32px; }
        .intro { display: flex; justify-content: space-between; align-items: end; gap: 25px; margin-bottom: 32px; }
        .eyebrow { margin: 0 0 14px; font-size: 10px; font-weight: 700; letter-spacing: 2.3px; color: #9a87ac; }
        .intro h1 { font-size: clamp(38px, 5vw, 62px); letter-spacing: -2.8px; line-height: 1; margin: 0; font-weight: 700; }
        .intro h1 span, .panelHeader h2 span { color: #aa95bf; }
        .subtitle { color: #8b7d98; margin: 14px 0 0; font-size: 14px; line-height: 1.7; }
        .refreshButton { border: 1px solid #e1d2ed; border-radius: 12px; background: linear-gradient(135deg, #f5effa, #e7d9f2); color: #5b486d; padding: 13px 17px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: .25s ease; box-shadow: 0 5px 15px #bca7d31c; }
        .refreshButton:hover { transform: translateY(-2px); box-shadow: 0 9px 22px #bca7d333; }
        .refreshButton:disabled { opacity: .65; cursor: wait; }
        .refreshIcon { display: inline-block; font-size: 17px; margin-right: 8px; vertical-align: -1px; }
        .spinning { animation: rotate 1s linear infinite; }
        .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
        .stat { min-height: 135px; padding: 23px; border: 1px solid #e8def2; border-radius: 17px; background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(250,245,253,.82)); box-shadow: 0 10px 30px #977eb512; position: relative; overflow: hidden; transition: transform .3s ease, box-shadow .3s ease; }
        .stat:after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 25%, #ffffff65 48%, transparent 68%); background-size: 220% 100%; animation: gleam 9s ease-in-out infinite; pointer-events: none; }
        .stat:hover { transform: translateY(-3px); box-shadow: 0 15px 32px #977eb526; }
        .statLabel { display: block; color: #9584a4; font-size: 9px; letter-spacing: 1.7px; font-weight: 700; }
        .stat strong { display: block; margin-top: 14px; font-size: 34px; line-height: 1; letter-spacing: -1px; }
        .statHint { display: block; margin-top: 9px; color: #aa9db5; font-size: 11px; }
        .notice, .error { border-radius: 11px; padding: 13px 16px; margin-bottom: 16px; font-size: 13px; }
        .notice { background: #edf6ee; color: #4d7856; border: 1px solid #d8eadb; }
        .error { background: #fff1f4; color: #963c5a; border: 1px solid #f0ccd8; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ordersPanel { border: 1px solid #e7dcef; border-radius: 19px; background: rgba(255, 253, 255, .88); box-shadow: 0 15px 45px #977eb512; overflow: hidden; }
        .panelHeader { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 25px 25px 22px; border-bottom: 1px solid #eee4f4; }
        .panelHeader .eyebrow { margin-bottom: 9px; }
        .panelHeader h2 { margin: 0; font-size: 25px; letter-spacing: -.8px; }
        .filters { display: flex; gap: 10px; min-width: min(540px, 58%); }
        .filters input, .filters select { min-width: 0; border: 1px solid #e1d3ed; border-radius: 10px; padding: 11px 12px; background: #fffaff; color: #51415f; outline: none; }
        .filters input { flex: 1; }
        .filters input::placeholder { color: #b0a3bb; }
        .filters input:focus, .filters select:focus, .statusSelect:focus { border-color: #b9a4d6; box-shadow: 0 0 0 3px #b9a4d624; }
        .tableWrap { width: 100%; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 1000px; text-align: left; }
        th { background: #faf6fd; color: #9988a8; font-size: 9px; letter-spacing: 1.5px; font-weight: 700; padding: 15px 17px; white-space: nowrap; }
        td { padding: 18px 17px; border-top: 1px solid #f0e8f5; font-size: 12px; color: #766783; vertical-align: middle; }
        tbody tr { transition: background .2s ease; }
        tbody tr:hover { background: #fcf8ff; }
        td strong { display: block; color: #51415f; font-size: 12px; font-weight: 700; }
        td .tracking { color: #806797; letter-spacing: .3px; }
        .subline { display: block; color: #aa9db5; font-size: 10px; margin-top: 6px; }
        .statusSelect { max-width: 165px; width: 100%; border: 1px solid #e1d3ed; border-radius: 9px; padding: 9px 27px 9px 10px; background: #f8f2fc; color: #69547c; font-size: 11px; outline: none; cursor: pointer; transition: .2s ease; }
        .pickupSelect { background: #fbf5fb; }
        .statusSelect:disabled { opacity: .6; cursor: wait; }
        .empty { min-height: 230px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 35px; text-align: center; color: #9c8bab; }
        .emptySpark { font-size: 32px; color: #b9a4d6; margin-bottom: 10px; }
        .empty strong { color: #5a4869; font-size: 15px; }
        .empty p { font-size: 12px; line-height: 1.7; margin-bottom: 0; }
        .footnote { display: flex; justify-content: space-between; gap: 15px; color: #a393b1; font-size: 10px; letter-spacing: .3px; margin: 23px 2px 0; }
        .footnote span { letter-spacing: 1px; }
        @keyframes gleam { 0%, 70% { background-position: 180% 0; } 100% { background-position: -180% 0; } }
        @keyframes rotate { to { transform: rotate(360deg); } }
        @media (max-width: 1000px) { .stats { grid-template-columns: repeat(2, minmax(0,1fr)); } .panelHeader { align-items: stretch; flex-direction: column; } .filters { min-width: 0; width: 100%; } }
        @media (max-width: 620px) { .topbar { height: auto; min-height: 75px; padding: 14px 18px; align-items: flex-start; } .topbarRight { flex-wrap: wrap; justify-content: flex-end; font-size: 8px; } .liveText { display: none; } .siteLink { margin-left: 0; padding: 9px 10px; } .mainContent { padding-top: 35px; } .intro { align-items: flex-start; flex-direction: column; } .intro h1 { letter-spacing: -1.8px; } .stats { gap: 10px; } .stat { padding: 17px; min-height: 120px; } .stat strong { font-size: 29px; } .filters { flex-direction: column; } .panelHeader { padding: 20px; } .footnote { flex-direction: column; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
      `}</style>
    </main>
  );
}
