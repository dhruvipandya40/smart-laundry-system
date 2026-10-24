import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'laundry.db'}"
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_options = {}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

app = FastAPI(title="Smart Laundry Queue Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smart-laundry-system-liart.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TOKEN_HOURS = 24
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

ORDER_STATUSES = {
    "Waiting",
    "Washing",
    "Drying",
    "Ready",
    "Completed",
}

PICKUP_STATUSES = {
    "Pending",
    "Ready for Pickup",
    "Picked Up",
}


# --------------------------------------------------
# DATABASE TABLES
# --------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(300), nullable=False)
    role = Column(String(20), default="customer", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    queue_number = Column(Integer, unique=True, index=True, nullable=False)
    tracking_id = Column(String(30), unique=True, index=True, nullable=False)

    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    phone = Column(String(10), nullable=False)
    clothes = Column(Integer, nullable=False)
    service = Column(String(100), nullable=False)

    status = Column(String(30), default="Waiting", nullable=False)
    pickup_status = Column(String(30), default="Pending", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)


Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class LaundryOrder(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    clothes: int = Field(ge=1, le=500)
    service: str = Field(min_length=1, max_length=100)


class StatusUpdate(BaseModel):
    status: str


# --------------------------------------------------
# DATABASE HELPERS
# --------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    ).hex()
    return f"{salt}${hashed}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hash = stored_hash.split("$", 1)
        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            200_000,
        ).hex()
        return hmac.compare_digest(actual_hash, expected_hash)
    except (ValueError, AttributeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=TOKEN_HOURS)

    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_digest(token),
            expires_at=expires,
        )
    )
    db.commit()
    return token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please log in first.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid login token.")

    session_record = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == token_digest(token))
        .first()
    )

    if not session_record or session_record.expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please log in again.",
        )

    user = db.query(User).filter(User.id == session_record.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user


def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only the administrator can perform this action.",
        )
    return user


# --------------------------------------------------
# RESPONSE HELPERS
# --------------------------------------------------

def public_order(order: Order) -> dict:
    return {
        "queue_number": order.queue_number,
        "tracking_id": order.tracking_id,
        "customer_name": order.customer_name,
        "phone": order.phone,
        "clothes": order.clothes,
        "service": order.service,
        "status": order.status,
        "pickup_status": order.pickup_status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        "picked_up_at": order.picked_up_at.isoformat() if order.picked_up_at else None,
    }


def order_history(db: Session, customer_id: int):
    orders = (
        db.query(Order)
        .filter(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [public_order(order) for order in orders]


def find_order(db: Session, queue_number: int) -> Order:
    order = (
        db.query(Order)
        .filter(Order.queue_number == queue_number)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


def get_next_queue_number(db: Session) -> int:
    last_order = db.query(Order).order_by(Order.queue_number.desc()).first()
    return (last_order.queue_number + 1) if last_order else 1


# --------------------------------------------------
# CREATE DEFAULT ADMIN
# --------------------------------------------------

@app.on_event("startup")
def create_default_admin():
    db = SessionLocal()
    try:
        admin = (
            db.query(User)
            .filter(User.username == ADMIN_USERNAME)
            .first()
        )

        if not admin:
            admin = User(
                name="Administrator",
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                role="admin",
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


# --------------------------------------------------
# GENERAL
# --------------------------------------------------

@app.get("/")
def home():
    return {"message": "Smart Laundry Queue Manager Backend is Running!"}


@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/api/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    name = data.name.strip()

    if not name or not username:
        raise HTTPException(status_code=400, detail="Name and username are required.")

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists.")

    user = User(
        name=name,
        username=username,
        password_hash=hash_password(data.password),
        role="customer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(db, user)

    return {
        "message": "Registration successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
        },
    }


@app.post("/api/auth/login")
def customer_login(data: LoginRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if user.role != "customer":
        raise HTTPException(
            status_code=403,
            detail="Please use the administrator login.",
        )

    token = create_session(db, user)

    return {
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
        },
    }


@app.post("/api/admin/login")
def admin_login(data: LoginRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    admin_username = ADMIN_USERNAME.strip().lower()

    user = db.query(User).filter(User.username == admin_username).first()

    if (
        username != admin_username
        or not user
        or user.role != "admin"
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")

    token = create_session(db, user)

    return {
        "message": "Admin login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
        },
    }


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
    }


@app.post("/api/auth/logout")
def logout(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        db.query(AuthSession).filter(
            AuthSession.token_hash == token_digest(token)
        ).delete(synchronize_session=False)
        db.commit()

    return {"message": "Logged out successfully."}


# --------------------------------------------------
# CREATE AND VIEW ORDERS
# --------------------------------------------------

@app.post("/api/orders")
def create_order(
    data: LaundryOrder,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    customer_id = None

    # Associate the order with a customer when a valid token is supplied.
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        session_record = (
            db.query(AuthSession)
            .filter(AuthSession.token_hash == token_digest(token))
            .first()
        )

        if session_record and session_record.expires_at > datetime.utcnow():
            customer = (
                db.query(User)
                .filter(User.id == session_record.user_id)
                .first()
            )
            if customer and customer.role == "customer":
                customer_id = customer.id
                if not data.customer_name.strip():
                    raise HTTPException(status_code=400, detail="Name is required.")

    queue_number = get_next_queue_number(db)
    tracking_id = secrets.token_hex(5).upper()

    order = Order(
        queue_number=queue_number,
        tracking_id=tracking_id,
        customer_id=customer_id,
        customer_name=data.customer_name.strip(),
        phone=data.phone,
        clothes=data.clothes,
        service=data.service.strip(),
        status="Waiting",
        pickup_status="Pending",
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "message": "Laundry order created successfully!",
        "order": public_order(order),
    }


@app.get("/api/orders")
def get_all_orders(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    orders = db.query(Order).order_by(Order.queue_number.asc()).all()
    return {
        "total_orders": len(orders),
        "orders": [public_order(order) for order in orders],
    }


@app.get("/api/orders/{queue_number}")
def get_order(queue_number: int, db: Session = Depends(get_db)):
    return public_order(find_order(db, queue_number))


@app.get("/api/track/{tracking_id}")
def track_order(tracking_id: str, db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .filter(Order.tracking_id == tracking_id.upper())
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Tracking ID not found.")

    return public_order(order)


# --------------------------------------------------
# CUSTOMER ORDER HISTORY
# --------------------------------------------------

@app.get("/api/my/orders")
def get_my_orders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer account required.")

    history = order_history(db, user.id)
    return {"total_orders": len(history), "orders": history}


@app.get("/api/history/phone/{phone}")
def get_history_by_phone(
    phone: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # A customer can see only their own order history.
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer account required.")

    orders = (
        db.query(Order)
        .filter(
            Order.customer_id == user.id,
            Order.phone == phone,
        )
        .order_by(Order.created_at.desc())
        .all()
    )

    history = [public_order(order) for order in orders]
    return {"phone": phone, "total_orders": len(history), "history": history}


@app.get("/api/history/{tracking_id}")
def get_history_by_tracking(
    tracking_id: str,
    db: Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .filter(Order.tracking_id == tracking_id.upper())
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Tracking ID not found.")

    return {
        "tracking_id": order.tracking_id,
        "total_orders": 1,
        "history": [public_order(order)],
    }


# --------------------------------------------------
# ADMIN: UPDATE ORDER STATUS
# --------------------------------------------------

@app.put("/api/orders/{queue_number}/status")
def update_order_status(
    queue_number: int,
    data: StatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if data.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(sorted(ORDER_STATUSES))}",
        )

    order = find_order(db, queue_number)
    order.status = data.status

    if data.status == "Ready":
        order.pickup_status = "Ready for Pickup"

    if data.status == "Completed":
        order.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    return {
        "message": "Order status updated successfully.",
        "order": public_order(order),
    }


@app.put("/api/orders/{queue_number}/pickup")
def update_pickup_status(
    queue_number: int,
    data: StatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if data.status not in PICKUP_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Pickup status must be one of: {', '.join(sorted(PICKUP_STATUSES))}",
        )

    order = find_order(db, queue_number)

    if data.status == "Picked Up" and order.status != "Ready":
        raise HTTPException(
            status_code=400,
            detail="An order must be Ready before it can be picked up.",
        )

    order.pickup_status = data.status

    if data.status == "Picked Up":
        order.picked_up_at = datetime.utcnow()
        order.status = "Completed"
        if not order.completed_at:
            order.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    return {
        "message": "Pickup status updated successfully.",
        "order": public_order(order),
    }


# --------------------------------------------------
# ADMIN DASHBOARD
# --------------------------------------------------

@app.get("/api/dashboard")
def dashboard(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    orders = db.query(Order).all()

    return {
        "total_orders": len(orders),
        "waiting": sum(order.status == "Waiting" for order in orders),
        "washing": sum(order.status == "Washing" for order in orders),
        "drying": sum(order.status == "Drying" for order in orders),
        "ready": sum(order.status == "Ready" for order in orders),
        "completed": sum(order.status == "Completed" for order in orders),
        "pickup_ready": sum(
            order.pickup_status == "Ready for Pickup" for order in orders
        ),
        "picked_up": sum(
            order.pickup_status == "Picked Up" for order in orders
        ),
    }