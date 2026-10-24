
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const API_URL = "https://smart-laundry-system-2.onrender.com";
const TOKEN_KEY = "laura_admin_token";

const STATUSES = ["Waiting", "Washing", "Drying", "Ready", "Completed"];
const PICKUP_STATUSES = ["Not Ready", "Ready for Pickup", "Picked Up"];

type AdminUser = {
  username?: string;
  name?: string;
  role?: string;
};

type Order = {
  queue_number: number;
  tracking_id: string;
  customer_name: string;
  phone: string;
  service: string;
  status: string;
  pickup_status: string;
  clothes?: number;
  clothes_count?: number;
  total_clothes?: number;
  created_at?: string;
  booked_at?: string;
};

function messageFrom(data: any): string {
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  return "Please try again.";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function normalizeOrders(data: any): Order[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.orders)
      ? data.orders
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return list.map((item: any) => ({
    ...item,
    queue_number: Number(item.queue_number),
    tracking_id: String(item.tracking_id ?? ""),
    customer_name: String(item.customer_name ?? "Customer"),
    phone: String(item.phone ?? ""),
    service: String(item.service ?? "Laundry"),
    status: String(item.status ?? "Waiting"),
    pickup_status: String(item.pickup_status ?? "Not Ready"),
    clothes: item.clothes ?? item.clothes_count ?? item.total_clothes ?? 0,
  }));
}

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAdminUser(null);
    setOrders([]);
  }, []);

  const loadOrders = useCallback(
    async (authToken: string) => {
      if (!authToken) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/orders`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken.trim()}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
          clearSession();
          throw new Error(
            "Your admin session was rejected. Please sign in again."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Could not load orders (HTTP ${response.status}): ${messageFrom(data)}`
          );
        }

        setOrders(normalizeOrders(data));
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    const savedToken = sessionStorage.getItem(TOKEN_KEY);

    if (savedToken) {
      setToken(savedToken);
      void loadOrders(savedToken);
    }

    setAuthChecking(false);
  }, [loadOrders]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          `Login failed (HTTP ${response.status}): ${messageFrom(data)}`
        );
      }

      const receivedToken = data.access_token || data.token;

      if (typeof receivedToken !== "string" || !receivedToken.trim()) {
        throw new Error("The server did not return an admin token.");
      }

      sessionStorage.setItem(TOKEN_KEY, receivedToken);
      setToken(receivedToken);
      setAdminUser(data.user || { username: username.trim() });
      setPassword("");
      setNotice("Login successful.");

      await loadOrders(receivedToken);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setError("");
    setNotice("You have been logged out.");
    setPassword("");
  };

  const updateOrder = async (
    order: Order,
    field: "status" | "pickup_status",
    value: string
  ) => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }

    if (
      field === "pickup_status" &&
      value === "Picked Up" &&
      order.status !== "Ready" &&
      order.status !== "Completed"
    ) {
      setError("Set the laundry status to Ready before pickup.");
      return;
    }

    const endpoint =
      field === "status"
        ? `${API_URL}/api/orders/${order.queue_number}/status`
        : `${API_URL}/api/orders/${order.queue_number}/pickup`;

    setBusyId(order.queue_number);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ status: value }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        clearSession();
        throw new Error("Admin session expired. Please sign in again.");
      }

      if (!response.ok) {
        throw new Error(
          `Update failed (HTTP ${response.status}): ${messageFrom(data)}`
        );
      }

      setNotice("Order status updated successfully.");
      await loadOrders(token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      order.tracking_id.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.phone.includes(query);

    return (
      matchesSearch &&
      (statusFilter === "All" || order.status === statusFilter)
    );
  });

  const activeCount = orders.filter(
    (order) => order.status !== "Completed"
  ).length;

  const readyCount = orders.filter(
    (order) =>
      order.status === "Ready" &&
      order.pickup_status === "Ready for Pickup"
  ).length;

  const completedCount = orders.filter(
    (order) => order.status === "Completed"
  ).length;

  if (authChecking) {
    return (
      <main className="adminPage">
        <p className="empty">Checking admin session…</p>
      </main>
    );
  }

  return (
    <main className="adminPage">
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
          LAUNDRY OPERATIONS
          {token && (
            <button className="secondaryButton" onClick={handleLogout}>
              Log out
            </button>
          )}
          <a className="secondaryButton" href="/">
            Customer site ↗
          </a>
        </div>
      </header>

      <section className="mainContent">
        {!token ? (
          <section className="loginWrap">
            <div className="loginCard">
              <p className="eyebrow">L&apos;AURA / SECURE ACCESS</p>
              <h1>Welcome <span>back.</span></h1>
              <p className="subtitle">
                Sign in to manage laundry orders and pickup progress.
              </p>

              {error && <div className="error" role="alert">{error}</div>}
              {notice && <div className="notice" role="status">{notice}</div>}

              <form onSubmit={handleLogin} className="loginForm">
                <label htmlFor="admin-username">Admin username</label>
                <input
                  id="admin-username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter username"
                  required
                />

                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />

                <button className="primaryButton" type="submit" disabled={loggingIn}>
                  {loggingIn ? "Signing in…" : "Sign in to dashboard"}
                </button>
              </form>

              <p className="footnote">Authorised administrator access only.</p>
            </div>
          </section>
        ) : (
          <>
            <div className="intro">
              <div>
                <p className="eyebrow">CONTROL CENTRE / OVERVIEW</p>
                <h1>Order <span>management.</span></h1>
                <p className="subtitle">
                  View bookings and manage washing and pickup progress.
                </p>
                <p className="signedIn">
                  Signed in as {adminUser?.username || adminUser?.name || username}
                </p>
              </div>

              <button
                className="primaryButton"
                onClick={() => void loadOrders(token)}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "↻ Refresh orders"}
              </button>
            </div>

            <div className="stats">
              <article className="stat">
                <span>TOTAL ORDERS</span>
                <strong>{orders.length}</strong>
                <small>All bookings</small>
              </article>
              <article className="stat">
                <span>IN PROGRESS</span>
                <strong>{activeCount}</strong>
                <small>Not completed</small>
              </article>
              <article className="stat">
                <span>READY FOR PICKUP</span>
                <strong>{readyCount}</strong>
                <small>Awaiting collection</small>
              </article>
              <article className="stat">
                <span>COMPLETED</span>
                <strong>{completedCount}</strong>
                <small>Finished orders</small>
              </article>
            </div>

            {notice && <div className="notice" role="status">{notice}</div>}
            {error && <div className="error" role="alert">{error}</div>}

            <section className="ordersPanel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">CUSTOMER BOOKINGS</p>
                  <h2>All orders ({filteredOrders.length})</h2>
                </div>

                <div className="filters">
                  <input
                    aria-label="Search orders"
                    placeholder="Search name, phone or tracking ID"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <select
                    aria-label="Filter orders by status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="All">All statuses</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && orders.length === 0 ? (
                <div className="empty">Loading orders…</div>
              ) : filteredOrders.length === 0 ? (
                <div className="empty">
                  <strong>{orders.length ? "No matching orders" : "No orders found"}</strong>
                  <p>
                    {orders.length
                      ? "Try another search or filter."
                      : "Bookings will appear here when the API returns them."}
                  </p>
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
                        <tr key={order.tracking_id || order.queue_number}>
                          <td>
                            <strong>{order.tracking_id || "—"}</strong>
                            <small>
                              Queue #{order.queue_number} · {order.clothes ?? 0} clothes
                            </small>
                          </td>
                          <td>
                            <strong>{order.customer_name}</strong>
                            <small>{order.phone || "—"}</small>
                          </td>
                          <td>{order.service}</td>
                          <td>{dateLabel(order.created_at || order.booked_at)}</td>
                          <td>
                            <select
                              className="statusSelect"
                              aria-label={`Laundry status for ${order.tracking_id}`}
                              value={order.status}
                              disabled={busyId === order.queue_number}
                              onChange={(event) =>
                                void updateOrder(order, "status", event.target.value)
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="statusSelect"
                              aria-label={`Pickup status for ${order.tracking_id}`}
                              value={order.pickup_status}
                              disabled={busyId === order.queue_number}
                              onChange={(event) =>
                                void updateOrder(order, "pickup_status", event.target.value)
                              }
                            >
                              {PICKUP_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            {busyId === order.queue_number && <small>Saving…</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <footer className="footer">
        L&apos;AURA · Smart Laundry Queue &amp; Pickup Manager
        <span>Admin dashboard</span>
      </footer>

      <style jsx>{`
        .adminPage {
          --ink: #29243a;
          --muted: #827b91;
          --accent: #7562a6;
          --line: #e9e3f1;
          min-height: 100vh;
          color: var(--ink);
          background: linear-gradient(135deg, #fbf9ff, #f2ecfa 48%, #fffaf5);
          font-family: Arial, Helvetica, sans-serif;
        }
        * { box-sizing: border-box; }
        .topbar, .mainContent, .footer {
          width: min(1440px, calc(100% - 40px));
          margin: 0 auto;
        }
        .topbar {
          min-height: 84px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid var(--line);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }
        .brandMark {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          color: white;
          background: var(--accent);
          font-family: Georgia, serif;
          font-size: 25px;
        }
        .brand strong { display: block; font-family: Georgia, serif; letter-spacing: 3px; font-size: 20px; }
        .brand small { display: block; margin-top: 4px; color: var(--muted); letter-spacing: 2px; font-size: 10px; }
        .topbarRight { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: 11px; }
        .liveDot { width: 8px; height: 8px; border-radius: 50%; background: #6a9a81; }
        .secondaryButton {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 13px;
          background: #fff;
          color: var(--ink);
          text-decoration: none;
          font-size: 12px;
          cursor: pointer;
        }
        .mainContent { padding: 46px 0 60px; }
        .loginWrap { min-height: 65vh; display: grid; place-items: center; }
        .loginCard {
          width: min(100%, 440px);
          padding: 34px;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: rgba(255,255,255,.86);
          box-shadow: 0 18px 50px #78638e17;
        }
        .eyebrow { margin: 0 0 12px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 2px; }
        h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(34px, 4vw, 52px); font-weight: 400; letter-spacing: -1.5px; }
        h1 span { color: var(--accent); font-style: italic; }
        .subtitle { color: var(--muted); font-size: 14px; line-height: 1.7; }
        .loginForm { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
        label { font-size: 13px; font-weight: 700; }
        input, select { min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: white; color: var(--ink); font: inherit; }
        input:focus, select:focus { outline: 2px solid #d9c9ef; outline-offset: 1px; }
        .primaryButton {
          border: 0;
          border-radius: 11px;
          padding: 13px 18px;
          background: var(--accent);
          color: white;
          font-size: 13px;
          cursor: pointer;
        }
        .primaryButton:disabled { opacity: .6; cursor: wait; }
        .loginForm .primaryButton { margin-top: 12px; }
        .signedIn { color: var(--muted); font-size: 12px; }
        .intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin-bottom: 26px; }
        .stat { padding: 22px; border: 1px solid var(--line); border-radius: 16px; background: rgba(255,255,255,.8); }
        .stat span { display: block; color: var(--muted); font-size: 10px; letter-spacing: 1.5px; }
        .stat strong { display: block; margin: 13px 0 8px; font-size: 34px; }
        .stat small, td small { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; }
        .notice, .error { padding: 13px 15px; margin-bottom: 15px; border-radius: 10px; font-size: 13px; overflow-wrap: anywhere; }
        .notice { color: #386b49; background: #edf6ee; border: 1px solid #d4e9d8; }
        .error { color: #963c5a; background: #fff1f4; border: 1px solid #f0ccd8; }
        .ordersPanel { overflow: hidden; border: 1px solid var(--line); border-radius: 17px; background: rgba(255,255,255,.9); }
        .panelHeader { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 23px; border-bottom: 1px solid var(--line); }
        .panelHeader h2 { margin: 0; font-size: 24px; }
        .filters { display: flex; gap: 10px; }
        .filters input { width: min(340px, 100%); }
        .tableWrap { overflow-x: auto; }
        table { width: 100%; min-width: 900px; border-collapse: collapse; text-align: left; }
        th { padding: 15px; background: #faf6fd; color: var(--muted); font-size: 10px; letter-spacing: 1px; white-space: nowrap; }
        td { padding: 16px 15px; border-top: 1px solid #f0e8f5; font-size: 13px; vertical-align: middle; }
        td strong { font-size: 13px; }
        .statusSelect { width: 155px; padding: 9px; font-size: 12px; }
        .statusSelect:disabled { opacity: .6; }
        .empty { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; text-align: center; color: var(--muted); }
        .empty p { font-size: 12px; }
        .footer { display: flex; justify-content: space-between; gap: 15px; padding: 20px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
        @media (max-width: 850px) {
          .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .panelHeader, .intro { align-items: stretch; flex-direction: column; }
          .filters { flex-direction: column; }
          .filters input { width: 100%; }
        }
        @media (max-width: 560px) {
          .topbar, .mainContent, .footer { width: calc(100% - 28px); }
          .topbar { align-items: flex-start; padding: 14px 0; }
          .topbarRight { justify-content: flex-end; }
          .loginCard { padding: 25px 20px; }
          .stat { padding: 15px; }
          .stat strong { font-size: 28px; }
          .footer { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
