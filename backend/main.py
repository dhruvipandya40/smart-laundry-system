from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import datetime
import uuid


app = FastAPI(title="Smart Laundry Queue Manager")


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# MODELS
# ==========================================

class LaundryOrder(BaseModel):
    customer_name: str
    phone: str
    clothes: int
    service: str


class StatusUpdate(BaseModel):
    status: str


# ==========================================
# IN-MEMORY DATABASE
# ==========================================

orders: List[dict] = []


# ==========================================
# ALLOWED STATUSES
# ==========================================

ALLOWED_STATUSES = [
    "Waiting",
    "Washing",
    "Drying",
    "Ready",
    "Completed"
]


ALLOWED_PICKUP_STATUSES = [
    "Not Ready",
    "Ready for Pickup",
    "Picked Up"
]


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():

    return {
        "message":
        "Smart Laundry Queue Manager Backend is Running!"
    }


# ==========================================
# API STATUS
# ==========================================

@app.get("/api/status")
def status():

    return {
        "status": "online",
        "service":
        "Laundry Queue & Pickup Manager"
    }


# ==========================================
# CREATE NEW LAUNDRY ORDER
# ==========================================

@app.post("/api/orders")
def create_order(order: LaundryOrder):

    queue_number = len(orders) + 1

    tracking_id = (
        "LAURA-"
        + uuid.uuid4().hex[:6].upper()
    )

    new_order = {

        "queue_number":
        queue_number,

        "tracking_id":
        tracking_id,

        "customer_name":
        order.customer_name,

        "phone":
        order.phone,

        "clothes":
        order.clothes,

        "service":
        order.service,

        "status":
        "Waiting",

        "pickup_status":
        "Not Ready",

        "created_at":
        datetime.now().isoformat(),

        "completed_at":
        None,

        "picked_up_at":
        None
    }

    orders.append(new_order)

    return {

        "message":
        "Laundry order created successfully!",

        "order":
        new_order
    }


# ==========================================
# GET ALL ORDERS
# ADMIN
# ==========================================

@app.get("/api/orders")
def get_orders():

    return {

        "total_orders":
        len(orders),

        "orders":
        orders
    }


# ==========================================
# GET SINGLE ORDER BY QUEUE NUMBER
# ==========================================

@app.get("/api/orders/{queue_number}")
def get_single_order(
    queue_number: int
):

    for order in orders:

        if (
            order["queue_number"]
            == queue_number
        ):

            return order

    raise HTTPException(
        status_code=404,
        detail="Order not found"
    )


# ==========================================
# TRACK SINGLE ORDER
# ==========================================

@app.get("/api/track/{tracking_id}")
def track_order(
    tracking_id: str
):

    tracking_id = tracking_id.upper()

    for order in orders:

        if (
            order["tracking_id"]
            == tracking_id
        ):

            return order

    raise HTTPException(
        status_code=404,
        detail="Tracking ID not found"
    )


# ==========================================
# ORDER HISTORY BY PHONE NUMBER
# ==========================================

@app.get(
    "/api/history/phone/{phone}"
)
def order_history_by_phone(
    phone: str
):

    customer_orders = []

    for order in orders:

        if (
            order["phone"]
            == phone
        ):

            customer_orders.append(
                order
            )

    if not customer_orders:

        raise HTTPException(
            status_code=404,
            detail="No order history found for this phone number"
        )

    # Latest orders first
    customer_orders.reverse()

    return {

        "phone":
        phone,

        "total_orders":
        len(customer_orders),

        "history":
        customer_orders
    }


# ==========================================
# OLD HISTORY ENDPOINT
# TRACKING ID
# ==========================================

@app.get(
    "/api/history/{tracking_id}"
)
def order_history_by_tracking(
    tracking_id: str
):

    tracking_id = tracking_id.upper()

    customer_orders = []

    for order in orders:

        if (
            order["tracking_id"]
            == tracking_id
        ):

            customer_orders.append(
                order
            )

    if not customer_orders:

        raise HTTPException(
            status_code=404,
            detail="Order history not found"
        )

    return {

        "tracking_id":
        tracking_id,

        "total_orders":
        len(customer_orders),

        "history":
        customer_orders
    }


# ==========================================
# UPDATE LAUNDRY STATUS
# ==========================================

@app.put(
    "/api/orders/{queue_number}/status"
)
def update_order_status(
    queue_number: int,
    status_update: StatusUpdate
):

    if (
        status_update.status
        not in ALLOWED_STATUSES
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    for order in orders:

        if (
            order["queue_number"]
            == queue_number
        ):

            order["status"] = (
                status_update.status
            )

            # --------------------------------
            # READY
            # --------------------------------

            if (
                status_update.status
                == "Ready"
            ):

                order["pickup_status"] = (
                    "Ready for Pickup"
                )

            # --------------------------------
            # COMPLETED
            # --------------------------------

            elif (
                status_update.status
                == "Completed"
            ):

                order["pickup_status"] = (
                    "Picked Up"
                )

                if not order.get(
                    "completed_at"
                ):

                    order[
                        "completed_at"
                    ] = (
                        datetime.now()
                        .isoformat()
                    )

                if not order.get(
                    "picked_up_at"
                ):

                    order[
                        "picked_up_at"
                    ] = (
                        datetime.now()
                        .isoformat()
                    )

            # --------------------------------
            # WAITING / WASHING / DRYING
            # --------------------------------

            else:

                order["pickup_status"] = (
                    "Not Ready"
                )

            return {

                "message":
                "Order status updated successfully!",

                "order":
                order
            }

    raise HTTPException(
        status_code=404,
        detail="Order not found"
    )


# ==========================================
# UPDATE PICKUP STATUS
# ==========================================

@app.put(
    "/api/orders/{queue_number}/pickup"
)
def update_pickup_status(
    queue_number: int,
    status_update: StatusUpdate
):

    if (
        status_update.status
        not in ALLOWED_PICKUP_STATUSES
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid pickup status"
        )

    for order in orders:

        if (
            order["queue_number"]
            == queue_number
        ):

            order[
                "pickup_status"
            ] = status_update.status

            # --------------------------------
            # PICKED UP
            # --------------------------------

            if (
                status_update.status
                == "Picked Up"
            ):

                order["status"] = (
                    "Completed"
                )

                if not order.get(
                    "completed_at"
                ):

                    order[
                        "completed_at"
                    ] = (
                        datetime.now()
                        .isoformat()
                    )

                order[
                    "picked_up_at"
                ] = (
                    datetime.now()
                    .isoformat()
                )

            return {

                "message":
                "Pickup status updated successfully!",

                "order":
                order
            }

    raise HTTPException(
        status_code=404,
        detail="Order not found"
    )


# ==========================================
# DASHBOARD ANALYTICS
# ==========================================

@app.get("/api/dashboard")
def dashboard():

    total = len(orders)

    waiting = sum(
        1
        for order in orders
        if order["status"]
        == "Waiting"
    )

    washing = sum(
        1
        for order in orders
        if order["status"]
        == "Washing"
    )

    drying = sum(
        1
        for order in orders
        if order["status"]
        == "Drying"
    )

    ready = sum(
        1
        for order in orders
        if order["status"]
        == "Ready"
    )

    completed = sum(
        1
        for order in orders
        if order["status"]
        == "Completed"
    )

    pickup_ready = sum(
        1
        for order in orders
        if order["pickup_status"]
        == "Ready for Pickup"
    )

    picked_up = sum(
        1
        for order in orders
        if order["pickup_status"]
        == "Picked Up"
    )

    return {

        "total":
        total,

        "waiting":
        waiting,

        "washing":
        washing,

        "drying":
        drying,

        "ready":
        ready,

        "completed":
        completed,

        "pickup_ready":
        pickup_ready,

        "picked_up":
        picked_up
    }