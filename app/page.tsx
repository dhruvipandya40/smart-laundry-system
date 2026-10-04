"use client";

import { FormEvent, useEffect, useState } from "react";

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

const STATUS_STEPS = [
  "Waiting",
  "Washing",
  "Drying",
  "Ready",
  "Completed",
];

const MACHINES = [
  {
    name: "Washer 01",
    type: "Washing Machine",
    capacity: "8 KG",
    status: "Running",
    progress: 72,
  },
  {
    name: "Washer 02",
    type: "Washing Machine",
    capacity: "10 KG",
    status: "Running",
    progress: 48,
  },
  {
    name: "Dryer 01",
    type: "Dryer Machine",
    capacity: "8 KG",
    status: "Available",
    progress: 0,
  },
  {
    name: "Dryer 02",
    type: "Dryer Machine",
    capacity: "10 KG",
    status: "Available",
    progress: 0,
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "Overview" | "Machines" | "My Queue" | "History"
  >("Overview");

  const [showBooking, setShowBooking] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [myOrder, setMyOrder] = useState<Order | null>(null);

  const [trackingInput, setTrackingInput] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [loadingOrder, setLoadingOrder] = useState(false);

  const [notification, setNotification] = useState("");
  const [notificationVisible, setNotificationVisible] = useState(false);

  const [previousStatus, setPreviousStatus] = useState("");
  const [previousPickupStatus, setPreviousPickupStatus] = useState("");

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    clothes: "",
    service: "Wash & Fold",
  });

  // --------------------------------------------------
  // Notification
  // --------------------------------------------------

  const showNotification = (message: string) => {
    setNotification(message);
    setNotificationVisible(true);

    setTimeout(() => {
      setNotificationVisible(false);
    }, 3500);
  };

  // --------------------------------------------------
  // Load all orders
  // --------------------------------------------------

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders`);

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch {
      console.log("Could not load orders");
    }
  };

  // --------------------------------------------------
  // Load current order
  // --------------------------------------------------

  const loadMyOrder = async (trackingId?: string) => {
    const id = trackingId || trackingInput.trim();

    if (!id) {
      setTrackingError("Please enter your tracking ID.");
      return;
    }

    setLoadingOrder(true);
    setTrackingError("");

    try {
      const response = await fetch(
        `${API_URL}/api/track/${id}`
      );

      if (!response.ok) {
        setMyOrder(null);
        setTrackingError("Tracking ID not found.");
        return;
      }

      const data: Order = await response.json();

      if (
        previousStatus &&
        previousStatus !== data.status
      ) {
        showNotification(
          `Laundry status changed to ${data.status}`
        );
      }

      if (
        previousPickupStatus &&
        previousPickupStatus !== data.pickup_status
      ) {
        showNotification(
          `Pickup status changed to ${data.pickup_status}`
        );
      }

      setPreviousStatus(data.status);
      setPreviousPickupStatus(data.pickup_status);

      setMyOrder(data);
      setTrackingInput(data.tracking_id);

      localStorage.setItem(
        "laundry_tracking_id",
        data.tracking_id
      );

      localStorage.setItem(
        "laundry_phone",
        data.phone
      );
    } catch {
      setTrackingError(
        "Backend is not connected. Please start FastAPI."
      );
    } finally {
      setLoadingOrder(false);
    }
  };

  // --------------------------------------------------
  // Load history
  // --------------------------------------------------

  const loadHistory = async (phone?: string) => {
    const savedPhone =
      phone ||
      localStorage.getItem("laundry_phone") ||
      "";

    if (!savedPhone) {
      setHistory([]);
      setHistoryError(
        "Book an order first to see your history."
      );
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(
        `${API_URL}/api/history/phone/${encodeURIComponent(
          savedPhone
        )}`
      );

      if (!response.ok) {
        setHistory([]);
        setHistoryError("No order history found.");
        return;
      }

      const data = await response.json();

      setHistory(data.history || []);
    } catch {
      setHistoryError(
        "Unable to load history. Please check the backend."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  // --------------------------------------------------
  // Track order
  // --------------------------------------------------

  const trackOrder = async () => {
    await loadMyOrder();
    setActiveTab("My Queue");
  };

  // --------------------------------------------------
  // Booking
  // --------------------------------------------------

  const submitBooking = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !form.customer_name.trim() ||
      !form.phone.trim() ||
      !form.clothes
    ) {
      showNotification(
        "Please fill all required fields."
      );
      return;
    }

    if (Number(form.clothes) <= 0) {
      showNotification(
        "Number of clothes must be greater than 0."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_name: form.customer_name,
            phone: form.phone,
            clothes: Number(form.clothes),
            service: form.service,
          }),
        }
      );

      if (!response.ok) {
        showNotification(
          "Could not create your order."
        );
        return;
      }

      const data = await response.json();
      const newOrder: Order = data.order;

      localStorage.setItem(
        "laundry_tracking_id",
        newOrder.tracking_id
      );

      localStorage.setItem(
        "laundry_phone",
        newOrder.phone
      );

      setMyOrder(newOrder);
      setTrackingInput(newOrder.tracking_id);

      setPreviousStatus(newOrder.status);
      setPreviousPickupStatus(
        newOrder.pickup_status
      );

      setForm({
        customer_name: "",
        phone: "",
        clothes: "",
        service: "Wash & Fold",
      });

      setShowBooking(false);
      setActiveTab("My Queue");

      await loadOrders();

      showNotification(
        `Order created! Tracking ID: ${newOrder.tracking_id}`
      );
    } catch {
      showNotification(
        "Backend is not running. Start FastAPI first."
      );
    }
  };

  // --------------------------------------------------
  // Initial restore
  // --------------------------------------------------

  useEffect(() => {
    loadOrders();

    const savedId = localStorage.getItem(
      "laundry_tracking_id"
    );

    if (savedId) {
      setTrackingInput(savedId);
      loadMyOrder(savedId);
    }
  }, []);

  // --------------------------------------------------
  // Live polling
  // --------------------------------------------------

  useEffect(() => {
    if (activeTab !== "My Queue" || !myOrder) {
      return;
    }

    const interval = setInterval(() => {
      loadMyOrder(myOrder.tracking_id);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, myOrder]);

  // --------------------------------------------------
  // History tab
  // --------------------------------------------------

  useEffect(() => {
    if (activeTab === "History") {
      loadHistory();
    }
  }, [activeTab]);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const getStatusIndex = (status: string) => {
    return STATUS_STEPS.indexOf(status);
  };

  const formatDate = (date?: string | null) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="page">
      {/* BACKGROUND */}
      <div className="background">
        <div className="orb orbOne" />
        <div className="orb orbTwo" />
        <div className="grid" />
      </div>

      {/* NAVBAR */}
      <header className="navbar">
        <div className="logo">
          <div className="logoIcon">L</div>

          <div>
            <div className="logoName">L&apos;AURA</div>
            <div className="logoSub">
              SMART LAUNDRY
            </div>
          </div>
        </div>

        <nav className="navLinks">
          {[
            "Overview",
            "Machines",
            "My Queue",
            "History",
          ].map((tab) => (
            <button
              key={tab}
              className={
                activeTab === tab
                  ? "navButton active"
                  : "navButton"
              }
              onClick={() =>
                setActiveTab(
                  tab as
                    | "Overview"
                    | "Machines"
                    | "My Queue"
                    | "History"
                )
              }
            >
              {tab}
            </button>
          ))}
        </nav>

        <button
          className="bookButton"
          onClick={() => setShowBooking(true)}
        >
          <span>+</span>
          Book Laundry
        </button>
      </header>

      {/* NOTIFICATION */}
      <div
        className={
          notificationVisible
            ? "notification show"
            : "notification"
        }
      >
        <div className="notificationIcon">✓</div>

        <div>
          <div className="notificationTitle">
            L&apos;AURA
          </div>

          <div className="notificationText">
            {notification}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <section className="content">
        {/* ------------------------------------------ */}
        {/* OVERVIEW */}
        {/* ------------------------------------------ */}

        {activeTab === "Overview" && (
          <>
            <section className="hero">
              <div className="heroText">
                <div className="eyebrow">
                  <span />
                  SMART LAUNDRY MANAGEMENT
                </div>

                <h1>
                  Laundry,
                  <br />
                  <span>Made Smarter.</span>
                </h1>

                <p>
                  Track your laundry in real time,
                  manage your queue, and know exactly
                  when your clothes are ready.
                </p>

                <div className="heroActions">
                  <button
                    className="primaryButton"
                    onClick={() =>
                      setShowBooking(true)
                    }
                  >
                    Book Laundry
                    <span>→</span>
                  </button>

                  <button
                    className="secondaryButton"
                    onClick={() =>
                      setActiveTab("My Queue")
                    }
                  >
                    Track Order
                  </button>
                </div>
              </div>

              <div className="heroVisual">
                <div className="washingCircle">
                  <div className="circleOuter">
                    <div className="circleMiddle">
                      <div className="circleInner">
                        <div className="water">
                          <div className="bubble b1" />
                          <div className="bubble b2" />
                          <div className="bubble b3" />
                          <div className="shirt">✦</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="circleLabel">
                    <strong>24/7</strong>
                    <span>SMART TRACKING</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="statsGrid">
              <div className="statCard">
                <div className="statNumber">
                  {orders.length}
                </div>

                <div className="statLabel">
                  TOTAL ORDERS
                </div>
              </div>

              <div className="statCard">
                <div className="statNumber">
                  {orders.filter(
                    (o) =>
                      o.status !== "Completed"
                  ).length}
                </div>

                <div className="statLabel">
                  ACTIVE ORDERS
                </div>
              </div>

              <div className="statCard">
                <div className="statNumber">
                  {
                    orders.filter(
                      (o) =>
                        o.pickup_status ===
                        "Ready for Pickup"
                    ).length
                  }
                </div>

                <div className="statLabel">
                  READY FOR PICKUP
                </div>
              </div>

              <div className="statCard">
                <div className="statNumber">
                  {orders.reduce(
                    (sum, order) =>
                      sum + order.clothes,
                    0
                  )}
                </div>

                <div className="statLabel">
                  CLOTHES PROCESSED
                </div>
              </div>
            </section>

            <section className="infoSection">
              <div>
                <div className="sectionEyebrow">
                  HOW IT WORKS
                </div>

                <h2>
                  Your laundry.
                  <br />
                  <span>One smart journey.</span>
                </h2>
              </div>

              <div className="steps">
                <div className="step">
                  <div className="stepNumber">
                    01
                  </div>

                  <div>
                    <h3>Book</h3>
                    <p>
                      Create your laundry order
                      in seconds.
                    </p>
                  </div>
                </div>

                <div className="step">
                  <div className="stepNumber">
                    02
                  </div>

                  <div>
                    <h3>Track</h3>
                    <p>
                      Watch your laundry move
                      through every stage.
                    </p>
                  </div>
                </div>

                <div className="step">
                  <div className="stepNumber">
                    03
                  </div>

                  <div>
                    <h3>Pickup</h3>
                    <p>
                      Get notified when your
                      clothes are ready.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ------------------------------------------ */}
        {/* MACHINES */}
        {/* ------------------------------------------ */}

        {activeTab === "Machines" && (
          <section className="dashboardSection">
            <div className="pageHeading">
              <div>
                <div className="sectionEyebrow">
                  LIVE OPERATIONS
                </div>

                <h2>
                  Machine <span>Status</span>
                </h2>

                <p>
                  Real-time laundry machine
                  availability.
                </p>
              </div>

              <div className="liveBadge">
                <span />
                LIVE
              </div>
            </div>

            <div className="machineGrid">
              {MACHINES.map((machine) => (
                <div
                  className="machineCard"
                  key={machine.name}
                >
                  <div className="machineTop">
                    <div className="machineIcon">
                      ◉
                    </div>

                    <div
                      className={
                        machine.status ===
                        "Running"
                          ? "machineStatus running"
                          : "machineStatus"
                      }
                    >
                      <span />
                      {machine.status}
                    </div>
                  </div>

                  <h3>{machine.name}</h3>

                  <p>{machine.type}</p>

                  <div className="machineDetails">
                    <span>Capacity</span>
                    <strong>
                      {machine.capacity}
                    </strong>
                  </div>

                  <div className="progressTrack">
                    <div
                      className="progressFill"
                      style={{
                        width: `${machine.progress}%`,
                      }}
                    />
                  </div>

                  <div className="machineBottom">
                    <span>Progress</span>

                    <strong>
                      {machine.progress}%
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------ */}
        {/* MY QUEUE */}
        {/* ------------------------------------------ */}

        {activeTab === "My Queue" && (
          <section className="dashboardSection">
            <div className="pageHeading">
              <div>
                <div className="sectionEyebrow">
                  ORDER TRACKING
                </div>

                <h2>
                  My <span>Queue</span>
                </h2>

                <p>
                  Track your laundry status
                  in real time.
                </p>
              </div>
            </div>

            <div className="trackingBox">
              <input
                value={trackingInput}
                onChange={(e) =>
                  setTrackingInput(
                    e.target.value
                  )
                }
                placeholder="Enter tracking ID e.g. LAURA-A1B2C3"
              />

              <button
                onClick={trackOrder}
                disabled={loadingOrder}
              >
                {loadingOrder
                  ? "Tracking..."
                  : "Track Order"}
              </button>
            </div>

            {trackingError && (
              <div className="errorBox">
                {trackingError}
              </div>
            )}

            {myOrder && (
              <div className="orderPanel">
                <div className="orderHeader">
                  <div>
                    <div className="smallLabel">
                      TRACKING ID
                    </div>

                    <h3>
                      {myOrder.tracking_id}
                    </h3>
                  </div>

                  <div className="queueBadge">
                    Queue #{myOrder.queue_number}
                  </div>
                </div>

                <div className="orderInfoGrid">
                  <div>
                    <span>Customer</span>
                    <strong>
                      {myOrder.customer_name}
                    </strong>
                  </div>

                  <div>
                    <span>Service</span>
                    <strong>
                      {myOrder.service}
                    </strong>
                  </div>

                  <div>
                    <span>Clothes</span>
                    <strong>
                      {myOrder.clothes}
                    </strong>
                  </div>

                  <div>
                    <span>Pickup</span>
                    <strong>
                      {myOrder.pickup_status}
                    </strong>
                  </div>
                </div>

                <div className="statusArea">
                  <div className="statusTitle">
                    Laundry Progress
                  </div>

                  <div className="statusTimeline">
                    {STATUS_STEPS.map(
                      (step, index) => {
                        const currentIndex =
                          getStatusIndex(
                            myOrder.status
                          );

                        const completed =
                          index <= currentIndex;

                        return (
                          <div
                            className="statusStep"
                            key={step}
                          >
                            <div
                              className={
                                completed
                                  ? "statusDot completed"
                                  : "statusDot"
                              }
                            >
                              {completed
                                ? "✓"
                                : index + 1}
                            </div>

                            {index <
                              STATUS_STEPS.length -
                                1 && (
                              <div
                                className={
                                  index <
                                  currentIndex
                                    ? "statusLine completed"
                                    : "statusLine"
                                }
                              />
                            )}

                            <div className="statusName">
                              {step}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="currentStatus">
                  <div>
                    <span>
                      CURRENT STATUS
                    </span>

                    <strong>
                      {myOrder.status}
                    </strong>
                  </div>

                  <div>
                    <span>
                      PICKUP STATUS
                    </span>

                    <strong>
                      {myOrder.pickup_status}
                    </strong>
                  </div>
                </div>

                <div className="timestamps">
                  <div>
                    <span>Booked</span>
                    <strong>
                      {formatDate(
                        myOrder.created_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Completed</span>
                    <strong>
                      {formatDate(
                        myOrder.completed_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Picked Up</span>
                    <strong>
                      {formatDate(
                        myOrder.picked_up_at
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {!myOrder && !trackingError && (
              <div className="emptyState">
                <div className="emptyIcon">
                  ◌
                </div>

                <h3>
                  No active laundry order
                </h3>

                <p>
                  Enter your tracking ID above
                  or book a new laundry order.
                </p>

                <button
                  className="primaryButton"
                  onClick={() =>
                    setShowBooking(true)
                  }
                >
                  Book Laundry
                  <span>→</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------ */}
        {/* HISTORY */}
        {/* ------------------------------------------ */}

        {activeTab === "History" && (
          <section className="dashboardSection">
            <div className="pageHeading historyHeading">
              <div>
                <div className="sectionEyebrow">
                  CUSTOMER RECORD
                </div>

                <h2>
                  Order <span>History</span>
                </h2>

                <p>
                  All your previous laundry
                  orders in one place.
                </p>
              </div>

              <button
                className="refreshButton"
                onClick={() => loadHistory()}
              >
                ↻ Refresh
              </button>
            </div>

            {historyLoading && (
              <div className="loadingBox">
                Loading your order history...
              </div>
            )}

            {historyError && !historyLoading && (
              <div className="historyEmpty">
                <div className="emptyIcon">
                  ◌
                </div>

                <h3>No history yet</h3>

                <p>{historyError}</p>

                <button
                  className="primaryButton"
                  onClick={() =>
                    setShowBooking(true)
                  }
                >
                  Book Your First Order
                  <span>→</span>
                </button>
              </div>
            )}

            {!historyLoading &&
              !historyError &&
              history.length > 0 && (
                <div className="historyList">
                  {history.map((order) => (
                    <div
                      className="historyCard"
                      key={order.tracking_id}
                    >
                      <div className="historyTop">
                        <div>
                          <span className="smallLabel">
                            TRACKING ID
                          </span>

                          <h3>
                            {order.tracking_id}
                          </h3>
                        </div>

                        <div
                          className={
                            order.status ===
                            "Completed"
                              ? "historyStatus completedStatus"
                              : "historyStatus"
                          }
                        >
                          {order.status}
                        </div>
                      </div>

                      <div className="historyDetails">
                        <div>
                          <span>Queue</span>
                          <strong>
                            #{order.queue_number}
                          </strong>
                        </div>

                        <div>
                          <span>Service</span>
                          <strong>
                            {order.service}
                          </strong>
                        </div>

                        <div>
                          <span>Clothes</span>
                          <strong>
                            {order.clothes}
                          </strong>
                        </div>

                        <div>
                          <span>Pickup</span>
                          <strong>
                            {order.pickup_status}
                          </strong>
                        </div>
                      </div>

                      <div className="historyFooter">
                        <span>
                          {formatDate(
                            order.created_at
                          )}
                        </span>

                        <button
                          onClick={() => {
                            setTrackingInput(
                              order.tracking_id
                            );

                            setMyOrder(order);

                            setPreviousStatus(
                              order.status
                            );

                            setPreviousPickupStatus(
                              order.pickup_status
                            );

                            setActiveTab(
                              "My Queue"
                            );
                          }}
                        >
                          Track Again →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        )}
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div>
          <strong>L&apos;AURA</strong>
          <span>
            Smart Laundry Queue & Pickup Manager
          </span>
        </div>

        <div className="footerRight">
          <span>LIVE SYSTEM</span>
          <div className="onlineDot" />
        </div>
      </footer>

      {/* BOOKING MODAL */}
      {showBooking && (
        <div
          className="modalOverlay"
          onClick={() =>
            setShowBooking(false)
          }
        >
          <div
            className="bookingModal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              className="closeButton"
              onClick={() =>
                setShowBooking(false)
              }
            >
              ×
            </button>

            <div className="sectionEyebrow">
              NEW LAUNDRY ORDER
            </div>

            <h2>
              Book Your <span>Laundry</span>
            </h2>

            <p className="modalSubtitle">
              Enter your details and we&apos;ll
              create your smart laundry queue.
            </p>

            <form onSubmit={submitBooking}>
              <label>
                Your Name
                <input
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customer_name:
                        e.target.value,
                    })
                  }
                  placeholder="Enter your name"
                />
              </label>

              <label>
                Phone Number
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Enter phone number"
                  type="tel"
                />
              </label>

              <div className="formRow">
                <label>
                  Clothes
                  <input
                    value={form.clothes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        clothes:
                          e.target.value,
                      })
                    }
                    placeholder="e.g. 8"
                    type="number"
                    min="1"
                  />
                </label>

                <label>
                  Service
                  <select
                    value={form.service}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        service:
                          e.target.value,
                      })
                    }
                  >
                    <option>
                      Wash & Fold
                    </option>

                    <option>
                      Wash & Iron
                    </option>

                    <option>
                      Dry Cleaning
                    </option>

                    <option>
                      Express Laundry
                    </option>
                  </select>
                </label>
              </div>

              <button
                className="submitButton"
                type="submit"
              >
                Create Laundry Order
                <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL CSS */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #05070b;
          color: #f5f7fb;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(88, 128, 255, 0.1),
              transparent 30%
            ),
            radial-gradient(
              circle at 85% 25%,
              rgba(110, 240, 220, 0.07),
              transparent 30%
            ),
            #05070b;
        }

        .background {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .orb {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
        }

        .orbOne {
          top: 100px;
          left: -180px;
          background: #536dfe;
        }

        .orbTwo {
          right: -180px;
          top: 500px;
          background: #4de6d0;
        }

        .grid {
          position: absolute;
          inset: 0;
          opacity: 0.04;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.4) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.4) 1px,
              transparent 1px
            );
          background-size: 70px 70px;
        }

        .navbar {
          position: relative;
          z-index: 10;
          height: 82px;
          padding: 0 6vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          background: rgba(5, 7, 11, 0.7);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logoIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid
            rgba(255, 255, 255, 0.25);
          border-radius: 12px;
          font-size: 21px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.05);
        }

        .logoName {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 4px;
        }

        .logoSub {
          color: #777e8c;
          font-size: 8px;
          letter-spacing: 2px;
          margin-top: 2px;
        }

        .navLinks {
          display: flex;
          gap: 6px;
        }

        .navButton {
          border: 0;
          background: transparent;
          color: #818795;
          padding: 10px 15px;
          border-radius: 9px;
          transition: 0.25s;
        }

        .navButton:hover {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.05
          );
        }

        .navButton.active {
          color: white;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .bookButton,
        .primaryButton,
        .submitButton {
          border: 0;
          color: #05070b;
          background: #f4f6f8;
          font-weight: 800;
          border-radius: 9px;
          padding: 12px 18px;
          transition: 0.25s;
        }

        .bookButton:hover,
        .primaryButton:hover,
        .submitButton:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 35px rgba(
              255,
              255,
              255,
              0.12
            );
        }

        .bookButton span,
        .primaryButton span,
        .submitButton span {
          margin-left: 10px;
        }

        .content {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: auto;
          padding: 0 28px 80px;
        }

        .hero {
          min-height: 620px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          align-items: center;
          gap: 40px;
        }

        .eyebrow,
        .sectionEyebrow {
          color: #8d96a8;
          font-size: 11px;
          letter-spacing: 2.5px;
          font-weight: 700;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .eyebrow span {
          width: 28px;
          height: 1px;
          background: #f4f6f8;
        }

        .hero h1 {
          font-size: clamp(
            58px,
            8vw,
            104px
          );
          line-height: 0.9;
          letter-spacing: -6px;
          margin: 25px 0;
        }

        .hero h1 span,
        h2 span {
          color: #777f8f;
        }

        .hero p {
          max-width: 540px;
          color: #9299a7;
          font-size: 16px;
          line-height: 1.8;
        }

        .heroActions {
          display: flex;
          gap: 12px;
          margin-top: 30px;
        }

        .primaryButton {
          padding: 14px 20px;
        }

        .secondaryButton {
          border: 1px solid
            rgba(255, 255, 255, 0.14);
          background: rgba(
            255,
            255,
            255,
            0.03
          );
          color: white;
          padding: 14px 20px;
          border-radius: 9px;
          transition: 0.25s;
        }

        .secondaryButton:hover {
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .heroVisual {
          min-height: 500px;
          display: grid;
          place-items: center;
        }

        .washingCircle {
          position: relative;
          width: 410px;
          height: 410px;
          display: grid;
          place-items: center;
        }

        .circleOuter,
        .circleMiddle,
        .circleInner {
          border-radius: 50%;
          display: grid;
          place-items: center;
        }

        .circleOuter {
          width: 410px;
          height: 410px;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          animation: spin 22s linear infinite;
        }

        .circleMiddle {
          width: 330px;
          height: 330px;
          border: 1px solid
            rgba(255, 255, 255, 0.09);
        }

        .circleInner {
          width: 245px;
          height: 245px;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          box-shadow:
            inset 0 0 80px
              rgba(83, 109, 254, 0.08),
            0 0 80px
              rgba(83, 109, 254, 0.08);
        }

        .water {
          width: 175px;
          height: 175px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 40% 30%,
              rgba(255, 255, 255, 0.25),
              rgba(50, 75, 130, 0.16) 45%,
              rgba(5, 7, 11, 0.5)
            );
          position: relative;
          overflow: hidden;
        }

        .shirt {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-size: 52px;
          color: rgba(255, 255, 255, 0.7);
          animation: float 3s ease-in-out infinite;
        }

        .bubble {
          position: absolute;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.25);
        }

        .b1 {
          width: 22px;
          height: 22px;
          top: 30px;
          left: 35px;
        }

        .b2 {
          width: 10px;
          height: 10px;
          top: 65px;
          right: 30px;
        }

        .b3 {
          width: 14px;
          height: 14px;
          bottom: 35px;
          left: 60px;
        }

        .circleLabel {
          position: absolute;
          bottom: -5px;
          right: 25px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 14px 18px;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          background: rgba(5, 7, 11, 0.8);
          backdrop-filter: blur(15px);
        }

        .circleLabel strong {
          font-size: 22px;
        }

        .circleLabel span {
          color: #7d8492;
          font-size: 8px;
          letter-spacing: 2px;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            1fr
          );
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .statCard {
          padding: 28px;
          border-right: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .statCard:last-child {
          border-right: 0;
        }

        .statNumber {
          font-size: 34px;
          font-weight: 800;
        }

        .statLabel {
          margin-top: 7px;
          color: #737b8a;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .infoSection {
          padding: 110px 0;
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 80px;
        }

        .infoSection h2,
        .pageHeading h2 {
          font-size: 48px;
          line-height: 1;
          letter-spacing: -2px;
          margin: 20px 0;
        }

        .steps {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .step {
          display: flex;
          gap: 20px;
          padding: 22px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
        }

        .stepNumber {
          color: #707887;
          font-size: 12px;
          font-weight: 800;
        }

        .step h3 {
          margin: 0 0 7px;
        }

        .step p {
          margin: 0;
          color: #7e8695;
          line-height: 1.6;
        }

        .dashboardSection {
          padding-top: 70px;
        }

        .pageHeading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 40px;
        }

        .pageHeading p {
          color: #7e8695;
        }

        .liveBadge {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid
            rgba(120, 255, 210, 0.18);
          color: #9cebd7;
          padding: 9px 13px;
          border-radius: 100px;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .liveBadge span,
        .onlineDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #77e0c3;
          box-shadow:
            0 0 12px
              rgba(119, 224, 195, 0.8);
        }

        .machineGrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            1fr
          );
          gap: 18px;
        }

        .machineCard,
        .orderPanel,
        .historyCard {
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          border-radius: 16px;
        }

        .machineCard {
          padding: 25px;
        }

        .machineTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .machineIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
        }

        .machineStatus {
          color: #777f8d;
          font-size: 10px;
        }

        .machineStatus.running {
          color: #9cebd7;
        }

        .machineStatus span {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          margin-right: 6px;
        }

        .machineCard h3 {
          margin: 25px 0 6px;
        }

        .machineCard > p {
          color: #747c8b;
          margin: 0 0 24px;
          font-size: 13px;
        }

        .machineDetails,
        .machineBottom {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }

        .machineDetails span,
        .machineBottom span {
          color: #707887;
        }

        .progressTrack {
          height: 5px;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          border-radius: 20px;
          margin: 13px 0;
          overflow: hidden;
        }

        .progressFill {
          height: 100%;
          background: #dce2eb;
          border-radius: 20px;
        }

        .trackingBox {
          display: flex;
          gap: 10px;
          max-width: 700px;
          margin-bottom: 20px;
        }

        .trackingBox input {
          flex: 1;
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 15px;
          color: white;
          outline: none;
        }

        .trackingBox input:focus,
        .bookingModal input:focus,
        .bookingModal select:focus {
          border-color: rgba(
            255,
            255,
            255,
            0.35
          );
        }

        .trackingBox button,
        .refreshButton {
          border: 0;
          border-radius: 10px;
          background: #f4f6f8;
          color: #05070b;
          font-weight: 800;
          padding: 0 20px;
        }

        .errorBox {
          padding: 15px 18px;
          border: 1px solid
            rgba(255, 100, 100, 0.2);
          color: #ffaaaa;
          background: rgba(
            255,
            70,
            70,
            0.05
          );
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .orderPanel {
          padding: 30px;
          margin-top: 25px;
        }

        .orderHeader,
        .historyTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .smallLabel {
          color: #6f7785;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .orderHeader h3,
        .historyTop h3 {
          margin: 7px 0 0;
          font-size: 22px;
          letter-spacing: 1px;
        }

        .queueBadge {
          padding: 9px 13px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          color: #aab1be;
          font-size: 11px;
        }

        .orderInfoGrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            1fr
          );
          gap: 15px;
          margin: 35px 0;
        }

        .orderInfoGrid > div,
        .historyDetails > div {
          padding: 17px;
          border-radius: 11px;
          background: rgba(
            255,
            255,
            255,
            0.035
          );
        }

        .orderInfoGrid span,
        .historyDetails span,
        .currentStatus span,
        .timestamps span {
          display: block;
          color: #707887;
          font-size: 9px;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .orderInfoGrid strong,
        .historyDetails strong {
          font-size: 13px;
        }

        .statusArea {
          padding-top: 25px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .statusTitle {
          color: #858d9c;
          font-size: 11px;
          letter-spacing: 1.5px;
          margin-bottom: 25px;
        }

        .statusTimeline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .statusStep {
          flex: 1;
          position: relative;
          text-align: center;
        }

        .statusDot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.15);
          margin: auto;
          display: grid;
          place-items: center;
          color: #68707f;
          font-size: 11px;
          position: relative;
          z-index: 2;
          background: #080a0f;
        }

        .statusDot.completed {
          background: #f4f6f8;
          color: #05070b;
        }

        .statusLine {
          height: 1px;
          background: rgba(
            255,
            255,
            255,
            0.1
          );
          position: absolute;
          top: 16px;
          left: 50%;
          width: 100%;
          z-index: 1;
        }

        .statusLine.completed {
          background: #dce2eb;
        }

        .statusName {
          color: #747c8b;
          font-size: 10px;
          margin-top: 10px;
        }

        .currentStatus {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 35px;
        }

        .currentStatus > div {
          padding: 20px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .currentStatus strong {
          font-size: 20px;
        }

        .timestamps {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 15px;
          margin-top: 15px;
        }

        .timestamps > div {
          padding: 18px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          border-radius: 10px;
        }

        .timestamps strong {
          font-size: 12px;
          color: #b9c0cb;
        }

        .emptyState,
        .historyEmpty,
        .loadingBox {
          text-align: center;
          padding: 80px 20px;
          border: 1px dashed
            rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          color: #7d8593;
        }

        .emptyIcon {
          font-size: 45px;
          color: #7f8796;
          margin-bottom: 15px;
        }

        .emptyState h3,
        .historyEmpty h3 {
          color: white;
          margin-bottom: 8px;
        }

        .emptyState p,
        .historyEmpty p {
          margin-bottom: 25px;
        }

        .historyHeading {
          align-items: center;
        }

        .refreshButton {
          padding: 11px 17px;
        }

        .historyList {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .historyCard {
          padding: 24px;
          transition: 0.25s;
        }

        .historyCard:hover {
          border-color: rgba(
            255,
            255,
            255,
            0.18
          );
          transform: translateY(-2px);
        }

        .historyStatus {
          padding: 8px 13px;
          border-radius: 100px;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          color: #c0c6d0;
          font-size: 10px;
        }

        .completedStatus {
          color: #9cebd7;
          background: rgba(
            100,
            230,
            190,
            0.08
          );
        }

        .historyDetails {
          display: grid;
          grid-template-columns: repeat(
            4,
            1fr
          );
          gap: 12px;
          margin: 22px 0;
        }

        .historyFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 17px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
          color: #6f7785;
          font-size: 11px;
        }

        .historyFooter button {
          border: 0;
          background: transparent;
          color: white;
          font-weight: 700;
        }

        .footer {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: auto;
          padding: 30px 28px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer strong {
          display: block;
          letter-spacing: 3px;
        }

        .footer span {
          color: #686f7c;
          font-size: 10px;
        }

        .footerRight {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .footerRight > span {
          letter-spacing: 1.5px;
        }

        .notification {
          position: fixed;
          z-index: 100;
          top: 100px;
          right: 30px;
          display: flex;
          gap: 13px;
          align-items: center;
          min-width: 280px;
          padding: 15px 18px;
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 13px;
          background: rgba(
            13,
            16,
            23,
            0.94
          );
          backdrop-filter: blur(20px);
          transform: translateX(130%);
          opacity: 0;
          transition: 0.35s;
        }

        .notification.show {
          transform: translateX(0);
          opacity: 1;
        }

        .notificationIcon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f4f6f8;
          color: #05070b;
          font-weight: 800;
        }

        .notificationTitle {
          font-size: 10px;
          letter-spacing: 2px;
          color: #8d96a8;
        }

        .notificationText {
          margin-top: 3px;
          font-size: 12px;
          color: #e0e4eb;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(
            0,
            0,
            0,
            0.72
          );
          backdrop-filter: blur(12px);
        }

        .bookingModal {
          width: min(550px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          padding: 35px;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          background: #0a0d13;
          box-shadow:
            0 30px 100px rgba(0, 0, 0, 0.55);
          position: relative;
        }

        .bookingModal h2 {
          font-size: 42px;
          margin: 15px 0 8px;
          letter-spacing: -2px;
        }

        .modalSubtitle {
          color: #7e8695;
          line-height: 1.6;
          margin-bottom: 30px;
        }

        .closeButton {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background: rgba(
            255,
            255,
            255,
            0.04
          );
          color: white;
          font-size: 20px;
        }

        .bookingModal form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .bookingModal label {
          color: #aeb5c1;
          font-size: 11px;
          letter-spacing: 0.5px;
        }

        .bookingModal input,
        .bookingModal select {
          width: 100%;
          margin-top: 8px;
          padding: 14px;
          border-radius: 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: white;
          outline: none;
        }

        .bookingModal select option {
          background: #10131a;
          color: white;
        }

        .formRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .submitButton {
          width: 100%;
          padding: 15px;
          margin-top: 8px;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-8px);
          }
        }

        @media (max-width: 1000px) {
          .navLinks {
            display: none;
          }

          .hero {
            grid-template-columns: 1fr;
          }

          .heroVisual {
            min-height: 400px;
          }

          .machineGrid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .statsGrid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .statCard:nth-child(2) {
            border-right: 0;
          }

          .infoSection {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .navbar {
            padding: 0 18px;
          }

          .bookButton {
            padding: 10px 12px;
            font-size: 11px;
          }

          .content {
            padding-left: 18px;
            padding-right: 18px;
          }

          .hero h1 {
            font-size: 58px;
            letter-spacing: -4px;
          }

          .washingCircle,
          .circleOuter {
            width: 300px;
            height: 300px;
          }

          .circleMiddle {
            width: 240px;
            height: 240px;
          }

          .circleInner {
            width: 180px;
            height: 180px;
          }

          .water {
            width: 125px;
            height: 125px;
          }

          .statsGrid,
          .machineGrid,
          .orderInfoGrid,
          .historyDetails,
          .timestamps {
            grid-template-columns: 1fr;
          }

          .statCard {
            border-right: 0;
            border-bottom: 1px solid
              rgba(255, 255, 255, 0.08);
          }

          .formRow {
            grid-template-columns: 1fr;
          }

          .trackingBox {
            flex-direction: column;
          }

          .trackingBox button {
            padding: 13px;
          }

          .statusTimeline {
            overflow-x: auto;
            min-width: 650px;
          }

          .statusArea {
            overflow-x: auto;
          }

          .orderPanel {
            padding: 20px;
          }

          .notification {
            right: 15px;
            left: 15px;
            min-width: 0;
          }

          .pageHeading,
          .historyHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          .footer {
            flex-direction: column;
            gap: 20px;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}