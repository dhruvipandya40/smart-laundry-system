"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const statusOptions = [
  "Waiting",
  "Washing",
  "Drying",
  "Ready",
  "Completed",
];

const pickupOptions = [
  "Not Ready",
  "Ready for Pickup",
  "Picked Up",
];

type Order = {
  queue_number: number;
  tracking_id?: string;
  customer_name: string;
  phone: string;
  clothes: number;
  service: string;
  status: string;
  pickup_status: string;
};

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);

  const [dashboard, setDashboard] = useState({
    total: 0,
    waiting: 0,
    washing: 0,
    drying: 0,
    ready: 0,
    completed: 0,
    pickup_ready: 0,
    picked_up: 0,
  });

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [pickupFilter, setPickupFilter] = useState("All");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  useEffect(() => {
    const savedLogin = localStorage.getItem(
      "laundry_admin_logged_in"
    );

    if (savedLogin === "true") {
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    loadData();

    const timer = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(timer);
  }, [loggedIn]);

  async function loadData() {
    try {
      const ordersResponse = await fetch(
        `${API_URL}/api/orders`
      );

      const ordersData = await ordersResponse.json();

      const dashboardResponse = await fetch(
        `${API_URL}/api/dashboard`
      );

      const dashboardData =
        await dashboardResponse.json();

      setOrders(ordersData.orders || []);
      setDashboard(dashboardData);
    } catch (error) {
      console.error(
        "Failed to load admin data:",
        error
      );
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (
      username === ADMIN_USERNAME &&
      password === ADMIN_PASSWORD
    ) {
      localStorage.setItem(
        "laundry_admin_logged_in",
        "true"
      );

      setLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError(
        "Invalid username or password"
      );
    }
  }

  function logout() {
    localStorage.removeItem(
      "laundry_admin_logged_in"
    );

    setLoggedIn(false);
    setUsername("");
    setPassword("");
  }

  async function updateStatus(
    queueNumber: number,
    newStatus: string
  ) {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/orders/${queueNumber}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Status update failed"
        );
      }

      await loadData();

      if (
        selectedOrder?.queue_number ===
        queueNumber
      ) {
        setSelectedOrder((previous) =>
          previous
            ? {
                ...previous,
                status: newStatus,
                pickup_status:
                  newStatus === "Ready"
                    ? "Ready for Pickup"
                    : newStatus === "Completed"
                    ? "Picked Up"
                    : previous.pickup_status,
              }
            : null
        );
      }
    } catch (error) {
      console.error(error);
      alert("Status update failed");
    } finally {
      setLoading(false);
    }
  }

  async function updatePickup(
    queueNumber: number,
    pickupStatus: string
  ) {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/orders/${queueNumber}/pickup`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: pickupStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Pickup update failed"
        );
      }

      await loadData();

      if (
        selectedOrder?.queue_number ===
        queueNumber
      ) {
        setSelectedOrder((previous) =>
          previous
            ? {
                ...previous,
                pickup_status: pickupStatus,
                status:
                  pickupStatus === "Picked Up"
                    ? "Completed"
                    : previous.status,
              }
            : null
        );
      }
    } catch (error) {
      console.error(error);
      alert(
        "Pickup status update failed"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const searchText =
      search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !searchText ||
        order.customer_name
          .toLowerCase()
          .includes(searchText) ||
        order.phone
          .toLowerCase()
          .includes(searchText) ||
        order.service
          .toLowerCase()
          .includes(searchText) ||
        String(order.queue_number).includes(
          searchText
        ) ||
        (order.tracking_id || "")
          .toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "All" ||
        order.status === statusFilter;

      const matchesPickup =
        pickupFilter === "All" ||
        order.pickup_status === pickupFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPickup
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    pickupFilter,
  ]);

  const totalClothes = useMemo(() => {
    return orders.reduce(
      (total, order) =>
        total + Number(order.clothes || 0),
      0
    );
  }, [orders]);

  const activeOrders =
    dashboard.waiting +
    dashboard.washing +
    dashboard.drying;

  const completedPercentage =
    dashboard.total > 0
      ? Math.round(
          (dashboard.completed /
            dashboard.total) *
            100
        )
      : 0;

  const pickupPending =
    dashboard.pickup_ready;

  function statusBadge(status: string) {
    const styles: Record<
      string,
      { background: string; color: string }
    > = {
      Waiting: {
        background:
          "rgba(255,193,7,0.12)",
        color: "#ffd76a",
      },
      Washing: {
        background:
          "rgba(80,160,255,0.12)",
        color: "#78b7ff",
      },
      Drying: {
        background:
          "rgba(180,120,255,0.12)",
        color: "#c49aff",
      },
      Ready: {
        background:
          "rgba(80,220,150,0.12)",
        color: "#72e3a5",
      },
      Completed: {
        background:
          "rgba(130,140,155,0.12)",
        color: "#aeb7c5",
      },
    };

    const style =
      styles[status] || styles.Waiting;

    return (
      <span
        style={{
          display: "inline-block",
          padding: "7px 10px",
          borderRadius: "999px",
          background: style.background,
          color: style.color,
          fontSize: "12px",
          fontWeight: "700",
        }}
      >
        {status}
      </span>
    );
  }

  if (!loggedIn) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, #172033 0%, #080b12 45%, #030407 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "430px",
            background:
              "rgba(15, 20, 31, 0.95)",
            border:
              "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            padding: "40px",
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                fontSize: "42px",
                marginBottom: "10px",
              }}
            >
              🧺
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                letterSpacing: "3px",
              }}
            >
              L&apos;AURA
            </h1>

            <p
              style={{
                color: "#8f9aaa",
                marginTop: "8px",
              }}
            >
              Laundry Management System
            </p>

            <div
              style={{
                display: "inline-block",
                marginTop: "12px",
                padding: "7px 14px",
                borderRadius: "20px",
                background:
                  "rgba(255,255,255,0.06)",
                color: "#aeb8c8",
                fontSize: "12px",
                letterSpacing: "1px",
              }}
            >
              ADMIN ACCESS
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#b8c0ce",
                fontSize: "14px",
              }}
            >
              Username
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Enter admin username"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "15px",
                borderRadius: "12px",
                border:
                  "1px solid #293241",
                background: "#0a0e15",
                color: "#fff",
                outline: "none",
                marginBottom: "18px",
                fontSize: "15px",
              }}
            />

            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#b8c0ce",
                fontSize: "14px",
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter admin password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "15px",
                borderRadius: "12px",
                border:
                  "1px solid #293241",
                background: "#0a0e15",
                color: "#fff",
                outline: "none",
                marginBottom: "18px",
                fontSize: "15px",
              }}
            />

            {loginError && (
              <div
                style={{
                  background:
                    "rgba(255,70,70,0.1)",
                  border:
                    "1px solid rgba(255,70,70,0.3)",
                  color: "#ff8b8b",
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "18px",
                  fontSize: "14px",
                }}
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "15px",
                border: "none",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#080b12",
                fontWeight: "700",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              LOGIN TO ADMIN
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #172033 0%, #080b12 40%, #030407 100%)",
        color: "#fff",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "35px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#8d99aa",
                fontSize: "12px",
                letterSpacing: "3px",
                marginBottom: "8px",
              }}
            >
              L&apos;AURA
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "36px",
              }}
            >
              Admin Dashboard
            </h1>

            <p
              style={{
                color: "#7f8a9b",
                marginTop: "8px",
              }}
            >
              Laundry Queue & Pickup Management
            </p>
          </div>

          <button
            onClick={logout}
            style={{
              background: "transparent",
              border:
                "1px solid #394353",
              color: "#d6dce5",
              padding: "11px 18px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {/* MAIN STATS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "15px",
            marginBottom: "30px",
          }}
        >
          {[
            ["Total Orders", dashboard.total],
            ["Waiting", dashboard.waiting],
            ["Washing", dashboard.washing],
            ["Drying", dashboard.drying],
            ["Ready", dashboard.ready],
            ["Completed", dashboard.completed],
            ["Pickup Ready", dashboard.pickup_ready],
            ["Picked Up", dashboard.picked_up],
          ].map(([title, value]) => (
            <div
              key={title}
              style={{
                background:
                  "rgba(16,21,32,0.9)",
                border:
                  "1px solid #202938",
                borderRadius: "18px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  color: "#7f8a9b",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                {title}
              </div>

              <div
                style={{
                  fontSize: "30px",
                  fontWeight: "700",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ANALYTICS */}

        <section
          style={{
            background:
              "rgba(10,14,21,0.92)",
            border:
              "1px solid #202938",
            borderRadius: "22px",
            padding: "25px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                color: "#8d99aa",
                fontSize: "11px",
                letterSpacing: "2px",
                marginBottom: "7px",
              }}
            >
              LIVE ANALYTICS
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "23px",
              }}
            >
              Laundry Performance
            </h2>

            <p
              style={{
                color: "#727d8e",
                margin:
                  "7px 0 0",
                fontSize: "13px",
              }}
            >
              Real-time overview of your
              laundry operations
            </p>
          </div>

          {/* ANALYTIC CARDS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "15px",
            }}
          >
            {/* CLOTHES */}

            <div
              style={{
                background:
                  "linear-gradient(145deg, #111722, #0c1119)",
                border:
                  "1px solid #252f3e",
                borderRadius: "18px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  marginBottom: "15px",
                }}
              >
                🧺
              </div>

              <div
                style={{
                  color: "#7d8999",
                  fontSize: "12px",
                }}
              >
                TOTAL CLOTHES
              </div>

              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                {totalClothes}
              </div>

              <div
                style={{
                  color: "#667283",
                  fontSize: "12px",
                  marginTop: "6px",
                }}
              >
                Items in all orders
              </div>
            </div>

            {/* ACTIVE */}

            <div
              style={{
                background:
                  "linear-gradient(145deg, #111722, #0c1119)",
                border:
                  "1px solid #252f3e",
                borderRadius: "18px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  marginBottom: "15px",
                }}
              >
                ⚡
              </div>

              <div
                style={{
                  color: "#7d8999",
                  fontSize: "12px",
                }}
              >
                ACTIVE ORDERS
              </div>

              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                {activeOrders}
              </div>

              <div
                style={{
                  color: "#667283",
                  fontSize: "12px",
                  marginTop: "6px",
                }}
              >
                Currently being processed
              </div>
            </div>

            {/* PICKUP */}

            <div
              style={{
                background:
                  "linear-gradient(145deg, #111722, #0c1119)",
                border:
                  "1px solid #252f3e",
                borderRadius: "18px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  marginBottom: "15px",
                }}
              >
                📦
              </div>

              <div
                style={{
                  color: "#7d8999",
                  fontSize: "12px",
                }}
              >
                PICKUP PENDING
              </div>

              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                {pickupPending}
              </div>

              <div
                style={{
                  color: "#667283",
                  fontSize: "12px",
                  marginTop: "6px",
                }}
              >
                Ready for customers
              </div>
            </div>

            {/* COMPLETION */}

            <div
              style={{
                background:
                  "linear-gradient(145deg, #111722, #0c1119)",
                border:
                  "1px solid #252f3e",
                borderRadius: "18px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  marginBottom: "15px",
                }}
              >
                ✓
              </div>

              <div
                style={{
                  color: "#7d8999",
                  fontSize: "12px",
                }}
              >
                COMPLETION RATE
              </div>

              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  marginTop: "8px",
                }}
              >
                {completedPercentage}%
              </div>

              <div
                style={{
                  height: "6px",
                  background:
                    "#202938",
                  borderRadius:
                    "99px",
                  marginTop: "12px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width:
                      `${completedPercentage}%`,
                    height: "100%",
                    background:
                      "#ffffff",
                    borderRadius:
                      "99px",
                    transition:
                      "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* STATUS DISTRIBUTION */}

          <div
            style={{
              marginTop: "25px",
              borderTop:
                "1px solid #202938",
              paddingTop: "25px",
            }}
          >
            <div
              style={{
                color: "#737e8e",
                fontSize: "12px",
                marginBottom: "15px",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "1px",
              }}
            >
              Current Order Distribution
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {statusOptions.map(
                (status) => {
                  const count =
                    dashboard[
                      status.toLowerCase() as keyof typeof dashboard
                    ] || 0;

                  const percentage =
                    dashboard.total > 0
                      ? Math.round(
                          (Number(count) /
                            dashboard.total) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={status}
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "90px 1fr 45px",
                        alignItems:
                          "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          color:
                            "#aeb7c5",
                          fontSize:
                            "13px",
                        }}
                      >
                        {status}
                      </div>

                      <div
                        style={{
                          height:
                            "8px",
                          background:
                            "#202938",
                          borderRadius:
                            "99px",
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            width:
                              `${percentage}%`,
                            height:
                              "100%",
                            background:
                              "#dce2ea",
                            borderRadius:
                              "99px",
                            transition:
                              "width 0.5s ease",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                          color:
                            "#7f8a9b",
                          fontSize:
                            "12px",
                        }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </section>

        {/* ORDER MANAGEMENT */}

        <section
          style={{
            background:
              "rgba(10,14,21,0.92)",
            border:
              "1px solid #202938",
            borderRadius: "22px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderBottom:
                "1px solid #202938",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "22px",
                  }}
                >
                  Order Management
                </h2>

                <p
                  style={{
                    color: "#727d8e",
                    margin:
                      "7px 0 0",
                    fontSize: "13px",
                  }}
                >
                  Search, filter and manage
                  every laundry order
                </p>
              </div>

              <button
                onClick={loadData}
                style={{
                  border:
                    "1px solid #303a4a",
                  background:
                    "#111722",
                  color:
                    "#dce2ea",
                  padding:
                    "10px 16px",
                  borderRadius:
                    "9px",
                  cursor:
                    "pointer",
                }}
              >
                Refresh
              </button>
            </div>

            {/* SEARCH */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(250px, 2fr) repeat(2, minmax(170px, 1fr))",
                gap: "12px",
                marginTop: "22px",
              }}
            >
              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search customer, phone, queue, service or tracking ID..."
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    "13px 15px",
                  borderRadius:
                    "11px",
                  border:
                    "1px solid #303a4a",
                  background:
                    "#0a0e15",
                  color:
                    "#fff",
                  outline:
                    "none",
                  fontSize:
                    "14px",
                }}
              />

              <select
                value={
                  statusFilter
                }
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "13px 15px",
                  borderRadius:
                    "11px",
                  border:
                    "1px solid #303a4a",
                  background:
                    "#0a0e15",
                  color:
                    "#fff",
                  outline:
                    "none",
                  fontSize:
                    "14px",
                }}
              >
                <option value="All">
                  All Laundry Status
                </option>

                {statusOptions.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  pickupFilter
                }
                onChange={(e) =>
                  setPickupFilter(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "13px 15px",
                  borderRadius:
                    "11px",
                  border:
                    "1px solid #303a4a",
                  background:
                    "#0a0e15",
                  color:
                    "#fff",
                  outline:
                    "none",
                  fontSize:
                    "14px",
                }}
              >
                <option value="All">
                  All Pickup Status
                </option>

                {pickupOptions.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                marginTop: "14px",
                color: "#687384",
                fontSize: "12px",
              }}
            >
              Showing{" "}
              <strong
                style={{
                  color:
                    "#cfd6df",
                }}
              >
                {
                  filteredOrders.length
                }
              </strong>{" "}
              of{" "}
              {orders.length}{" "}
              orders
            </div>
          </div>

          {filteredOrders.length ===
          0 ? (
            <div
              style={{
                padding:
                  "65px 20px",
                textAlign:
                  "center",
                color:
                  "#6e7888",
              }}
            >
              <div
                style={{
                  fontSize:
                    "35px",
                  marginBottom:
                    "12px",
                }}
              >
                🔎
              </div>

              <div
                style={{
                  color:
                    "#b8c0cc",
                  fontSize:
                    "16px",
                  marginBottom:
                    "6px",
                }}
              >
                No matching orders
              </div>

              <div
                style={{
                  fontSize:
                    "13px",
                }}
              >
                Try changing
                your search or
                filters.
              </div>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "1250px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      color:
                        "#737e8e",
                      fontSize:
                        "12px",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "1px",
                    }}
                  >
                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Queue
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Customer
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Service
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Clothes
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Laundry
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Pickup
                    </th>

                    <th
                      style={{
                        padding:
                          "18px",
                        textAlign:
                          "left",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => (
                      <tr
                        key={
                          order.queue_number
                        }
                        style={{
                          borderTop:
                            "1px solid #1c2430",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "20px 18px",
                            fontWeight:
                              "700",
                          }}
                        >
                          #
                          {
                            order.queue_number
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                "600",
                            }}
                          >
                            {
                              order.customer_name
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#727d8e",
                              fontSize:
                                "12px",
                              marginTop:
                                "5px",
                            }}
                          >
                            {order.phone}
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                          }}
                        >
                          {
                            order.service
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                            color:
                              "#9aa5b5",
                          }}
                        >
                          {
                            order.clothes
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                          }}
                        >
                          <select
                            value={
                              order.status
                            }
                            disabled={
                              loading
                            }
                            onChange={(
                              e
                            ) =>
                              updateStatus(
                                order.queue_number,
                                e.target
                                  .value
                              )
                            }
                            style={{
                              background:
                                "#111722",
                              color:
                                "#fff",
                              border:
                                "1px solid #303a4a",
                              borderRadius:
                                "9px",
                              padding:
                                "10px 12px",
                              cursor:
                                "pointer",
                            }}
                          >
                            {statusOptions.map(
                              (
                                status
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {
                                    status
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                          }}
                        >
                          <select
                            value={
                              order.pickup_status
                            }
                            disabled={
                              loading
                            }
                            onChange={(
                              e
                            ) =>
                              updatePickup(
                                order.queue_number,
                                e.target
                                  .value
                              )
                            }
                            style={{
                              background:
                                "#111722",
                              color:
                                "#fff",
                              border:
                                "1px solid #303a4a",
                              borderRadius:
                                "9px",
                              padding:
                                "10px 12px",
                              cursor:
                                "pointer",
                            }}
                          >
                            {pickupOptions.map(
                              (
                                status
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {
                                    status
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td
                          style={{
                            padding:
                              "20px 18px",
                          }}
                        >
                          <button
                            onClick={() =>
                              setSelectedOrder(
                                order
                              )
                            }
                            style={{
                              background:
                                "#fff",
                              color:
                                "#080b12",
                              border:
                                "none",
                              padding:
                                "10px 14px",
                              borderRadius:
                                "9px",
                              fontWeight:
                                "700",
                              cursor:
                                "pointer",
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ORDER DETAILS MODAL */}

      {selectedOrder && (
        <div
          onClick={() =>
            setSelectedOrder(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.72)",
            backdropFilter:
              "blur(8px)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "20px",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "600px",
              maxHeight:
                "90vh",
              overflowY:
                "auto",
              background:
                "#0c111a",
              border:
                "1px solid #293241",
              borderRadius:
                "24px",
              padding: "28px",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.65)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "15px",
                marginBottom:
                  "25px",
              }}
            >
              <div>
                <div
                  style={{
                    color:
                      "#778395",
                    fontSize:
                      "11px",
                    letterSpacing:
                      "2px",
                    marginBottom:
                      "7px",
                  }}
                >
                  ORDER DETAILS
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "28px",
                  }}
                >
                  Queue #
                  {
                    selectedOrder.queue_number
                  }
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelectedOrder(
                    null
                  )
                }
                style={{
                  width:
                    "38px",
                  height:
                    "38px",
                  borderRadius:
                    "50%",
                  border:
                    "1px solid #303a4a",
                  background:
                    "#111722",
                  color:
                    "#fff",
                  fontSize:
                    "20px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "12px",
                marginBottom:
                  "24px",
              }}
            >
              <div
                style={{
                  background:
                    "#111722",
                  border:
                    "1px solid #202938",
                  borderRadius:
                    "15px",
                  padding:
                    "17px",
                }}
              >
                <div
                  style={{
                    color:
                      "#737e8e",
                    fontSize:
                      "11px",
                    marginBottom:
                      "8px",
                  }}
                >
                  LAUNDRY STATUS
                </div>

                {statusBadge(
                  selectedOrder.status
                )}
              </div>

              <div
                style={{
                  background:
                    "#111722",
                  border:
                    "1px solid #202938",
                  borderRadius:
                    "15px",
                  padding:
                    "17px",
                }}
              >
                <div
                  style={{
                    color:
                      "#737e8e",
                    fontSize:
                      "11px",
                    marginBottom:
                      "8px",
                  }}
                >
                  PICKUP STATUS
                </div>

                <span
                  style={{
                    display:
                      "inline-block",
                    padding:
                      "7px 10px",
                    borderRadius:
                      "999px",
                    background:
                      selectedOrder.pickup_status ===
                      "Picked Up"
                        ? "rgba(80,220,150,0.12)"
                        : selectedOrder.pickup_status ===
                          "Ready for Pickup"
                        ? "rgba(80,160,255,0.12)"
                        : "rgba(255,193,7,0.12)",
                    color:
                      selectedOrder.pickup_status ===
                      "Picked Up"
                        ? "#72e3a5"
                        : selectedOrder.pickup_status ===
                          "Ready for Pickup"
                        ? "#78b7ff"
                        : "#ffd76a",
                    fontSize:
                      "12px",
                    fontWeight:
                      "700",
                  }}
                >
                  {
                    selectedOrder.pickup_status
                  }
                </span>
              </div>
            </div>

            <div
              style={{
                border:
                  "1px solid #202938",
                borderRadius:
                  "18px",
                padding:
                  "20px",
                marginBottom:
                  "18px",
              }}
            >
              <h3
                style={{
                  margin:
                    "0 0 18px",
                  fontSize:
                    "16px",
                }}
              >
                Customer Information
              </h3>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "18px",
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        "#687384",
                      fontSize:
                        "11px",
                      marginBottom:
                        "6px",
                    }}
                  >
                    CUSTOMER NAME
                  </div>

                  <div>
                    {
                      selectedOrder.customer_name
                    }
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color:
                        "#687384",
                      fontSize:
                        "11px",
                      marginBottom:
                        "6px",
                    }}
                  >
                    PHONE
                  </div>

                  <div>
                    {
                      selectedOrder.phone
                    }
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                border:
                  "1px solid #202938",
                borderRadius:
                  "18px",
                padding:
                  "20px",
                marginBottom:
                  "18px",
              }}
            >
              <h3
                style={{
                  margin:
                    "0 0 18px",
                  fontSize:
                    "16px",
                }}
              >
                Laundry Information
              </h3>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "18px",
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        "#687384",
                      fontSize:
                        "11px",
                      marginBottom:
                        "6px",
                    }}
                  >
                    SERVICE
                  </div>

                  <div>
                    {
                      selectedOrder.service
                    }
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color:
                        "#687384",
                      fontSize:
                        "11px",
                      marginBottom:
                        "6px",
                    }}
                  >
                    CLOTHES
                  </div>

                  <div>
                    {
                      selectedOrder.clothes
                    }{" "}
                    items
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background:
                  "#111722",
                border:
                  "1px solid #202938",
                borderRadius:
                  "18px",
                padding:
                  "20px",
                marginBottom:
                  "24px",
              }}
            >
              <div
                style={{
                  color:
                    "#687384",
                  fontSize:
                    "11px",
                  marginBottom:
                    "8px",
                }}
              >
                TRACKING ID
              </div>

              <div
                style={{
                  fontSize:
                    "20px",
                  fontWeight:
                    "700",
                  letterSpacing:
                    "2px",
                }}
              >
                {selectedOrder.tracking_id ||
                  "Not available"}
              </div>
            </div>

            <button
              onClick={() =>
                setSelectedOrder(
                  null
                )
              }
              style={{
                width: "100%",
                padding:
                  "14px",
                border:
                  "none",
                borderRadius:
                  "12px",
                background:
                  "#fff",
                color:
                  "#080b12",
                fontWeight:
                  "700",
                cursor:
                  "pointer",
              }}
            >
              CLOSE DETAILS
            </button>
          </div>
        </div>
      )}
    </main>
  );
}