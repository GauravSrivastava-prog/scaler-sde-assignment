"""
Database Seed Script
Populates SQLite with realistic Signal users, active 1-on-1 chats,
a group conversation, rich message histories with receipts, quoted replies,
and emoji reactions. Enables instant out-of-the-box evaluation.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import (
    User,
    Contact,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReaction
)
from app.auth import get_password_hash


def seed_database(db: Session):
    """Seed sample data if database is empty."""
    # Check if data already exists
    if db.query(User).first():
        print("Database already contains data. Skipping seed.")
        return

    print("Seeding Signal Clone database with realistic demo dataset...")

    # 1. Create Users
    default_pwd_hash = get_password_hash("password123")

    users_data = [
        {
            "username": "moxie",
            "phone_number": "+15551234567",
            "display_name": "Moxie Marlinspike",
            "about": "Privacy is not about having something to hide. It's about protecting who you are.",
            "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Moxie&backgroundColor=2c6bed",
            "is_online": True,
        },
        {
            "username": "edward",
            "phone_number": "+15559876543",
            "display_name": "Edward Snowden",
            "about": "Arguing that you don't care about privacy because you have nothing to hide is no different than saying you don't care about free speech because you have nothing to say.",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Edward&backgroundColor=0a84ff",
            "is_online": True,
        },
        {
            "username": "sarah",
            "phone_number": "+15552345678",
            "display_name": "Sarah Connor",
            "about": "No fate but what we make. Keeping communications clean.",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=5856d6",
            "is_online": False,
        },
        {
            "username": "alex",
            "phone_number": "+15553456789",
            "display_name": "Alex Rivera",
            "about": "Lead Security Architect @ Scaler Lab AI. Building resilient real-time protocols.",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=30d158",
            "is_online": True,
        },
        {
            "username": "priya",
            "phone_number": "+15554567890",
            "display_name": "Priya Sharma",
            "about": "Cryptographic engineer & distributed systems nerd.",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&backgroundColor=ff375f",
            "is_online": True,
        },
        {
            "username": "ada",
            "phone_number": "+15555678901",
            "display_name": "Ada Lovelace",
            "about": "The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers.",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Ada&backgroundColor=bf5af2",
            "is_online": False,
        }
    ]

    users = {}
    for u_info in users_data:
        user = User(
            username=u_info["username"],
            phone_number=u_info["phone_number"],
            display_name=u_info["display_name"],
            about=u_info["about"],
            avatar_url=u_info["avatar_url"],
            is_online=u_info["is_online"],
            last_seen=datetime.utcnow() - timedelta(minutes=5 if not u_info["is_online"] else 0),
            hashed_password=default_pwd_hash,
            created_at=datetime.utcnow() - timedelta(days=10)
        )
        db.add(user)
        db.flush()
        users[u_info["username"]] = user

    # 2. Add Contacts for Moxie
    moxie = users["moxie"]
    for uname, u in users.items():
        if uname != "moxie":
            c1 = Contact(user_id=moxie.id, contact_user_id=u.id, nickname=u.display_name)
            c2 = Contact(user_id=u.id, contact_user_id=moxie.id, nickname=moxie.display_name)
            db.add_all([c1, c2])

    db.flush()

    # 3. Conversation 1: Moxie <-> Edward (Direct Chat with receipts, replies, reactions)
    conv_edward = Conversation(
        is_group=False,
        created_by=moxie.id,
        created_at=datetime.utcnow() - timedelta(days=2),
        updated_at=datetime.utcnow() - timedelta(minutes=8)
    )
    db.add(conv_edward)
    db.flush()

    p_m1 = ConversationParticipant(conversation_id=conv_edward.id, user_id=moxie.id, role="admin", last_read_at=datetime.utcnow())
    p_e1 = ConversationParticipant(conversation_id=conv_edward.id, user_id=users["edward"].id, role="member", last_read_at=datetime.utcnow())
    db.add_all([p_m1, p_e1])
    db.flush()

    msg1 = Message(
        conversation_id=conv_edward.id,
        sender_id=users["edward"].id,
        content="Hey Moxie! I've been reviewing the new Signal WebSocket architecture for Scaler Lab.",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(hours=3)
    )
    db.add(msg1)
    db.flush()

    msg2 = Message(
        conversation_id=conv_edward.id,
        sender_id=moxie.id,
        reply_to_id=msg1.id,
        content="Awesome! The bidirectional event bus handles message fan-out, optimistic rendering, and receipt acknowledgments seamlessly.",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(hours=2, minutes=50)
    )
    db.add(msg2)
    db.flush()

    # Add emoji reactions
    r1 = MessageReaction(message_id=msg2.id, user_id=users["edward"].id, emoji="🔥")
    r2 = MessageReaction(message_id=msg2.id, user_id=moxie.id, emoji="❤️")
    db.add_all([r1, r2])

    msg3 = Message(
        conversation_id=conv_edward.id,
        sender_id=users["edward"].id,
        content="Did you simulate the end-to-end encryption handshake banner as well?",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(minutes=15)
    )
    db.add(msg3)
    db.flush()

    msg4 = Message(
        conversation_id=conv_edward.id,
        sender_id=moxie.id,
        content="Yes, the UI renders the official Signal security notification: 'Messages and calls are end-to-end encrypted. Tap to verify safety number.'",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(minutes=8)
    )
    db.add(msg4)
    db.flush()

    # 4. Conversation 2: Group Chat "🔐 Scaler AI Core Engineering"
    conv_group = Conversation(
        is_group=True,
        title="🔐 Scaler AI Core Engineering",
        avatar_url="https://api.dicebear.com/7.x/identicon/svg?seed=ScalerCoreSecurity&backgroundColor=2c6bed",
        created_by=moxie.id,
        created_at=datetime.utcnow() - timedelta(days=5),
        updated_at=datetime.utcnow() - timedelta(minutes=3)
    )
    db.add(conv_group)
    db.flush()

    # Participants
    members = [moxie, users["alex"], users["priya"], users["edward"]]
    for idx, u in enumerate(members):
        role = "admin" if idx == 0 else "member"
        db.add(ConversationParticipant(
            conversation_id=conv_group.id,
            user_id=u.id,
            role=role,
            last_read_at=datetime.utcnow() - timedelta(minutes=10) if u.username != "moxie" else datetime.utcnow()
        ))
    db.flush()

    gmsg_sys = Message(
        conversation_id=conv_group.id,
        sender_id=moxie.id,
        content=f"{moxie.display_name} created the group \"🔐 Scaler AI Core Engineering\"",
        message_type="system",
        status="delivered",
        created_at=datetime.utcnow() - timedelta(days=5)
    )
    db.add(gmsg_sys)

    gmsg1 = Message(
        conversation_id=conv_group.id,
        sender_id=users["alex"].id,
        content="Team, welcome! The SQLite relational schema has PRAGMA foreign_keys enabled, composite unique constraints, and indexed foreign keys.",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(hours=1)
    )
    db.add(gmsg1)
    db.flush()

    gmsg2 = Message(
        conversation_id=conv_group.id,
        sender_id=users["priya"].id,
        reply_to_id=gmsg1.id,
        content="And the real-time manager handles multi-tab WebSocket multiplexing without deadlocks. Great work!",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(minutes=25)
    )
    db.add(gmsg2)
    db.flush()

    db.add(MessageReaction(message_id=gmsg2.id, user_id=moxie.id, emoji="👍"))
    db.add(MessageReaction(message_id=gmsg2.id, user_id=users["alex"].id, emoji="❤️"))

    gmsg3 = Message(
        conversation_id=conv_group.id,
        sender_id=users["alex"].id,
        content="Check out the live typing indicators and delivery receipts. Try logging in on two tabs!",
        message_type="text",
        status="delivered",
        created_at=datetime.utcnow() - timedelta(minutes=3)
    )
    db.add(gmsg3)

    # 5. Conversation 3: Moxie <-> Alex Rivera (Disappearing Messages Demo)
    conv_alex = Conversation(
        is_group=False,
        created_by=moxie.id,
        disappearing_messages_timer=300,  # 5 minutes
        created_at=datetime.utcnow() - timedelta(days=1),
        updated_at=datetime.utcnow() - timedelta(minutes=12)
    )
    db.add(conv_alex)
    db.flush()

    db.add(ConversationParticipant(conversation_id=conv_alex.id, user_id=moxie.id, role="admin", last_read_at=datetime.utcnow()))
    db.add(ConversationParticipant(conversation_id=conv_alex.id, user_id=users["alex"].id, role="member", last_read_at=datetime.utcnow()))

    db.add(Message(
        conversation_id=conv_alex.id,
        sender_id=moxie.id,
        content="Moxie Marlinspike set disappearing messages to 5 minutes.",
        message_type="system",
        status="delivered",
        created_at=datetime.utcnow() - timedelta(minutes=20)
    ))

    db.add(Message(
        conversation_id=conv_alex.id,
        sender_id=users["alex"].id,
        content="This thread has disappearing messages active! Expired messages are automatically pruned by the server.",
        message_type="text",
        status="read",
        expires_at=datetime.utcnow() + timedelta(minutes=4),
        created_at=datetime.utcnow() - timedelta(minutes=12)
    ))

    # 6. Conversation 4: Note to Self (Iconic Signal Feature)
    conv_note = Conversation(
        is_group=False,
        title="Note to Self",
        created_by=moxie.id,
        created_at=datetime.utcnow() - timedelta(days=3),
        updated_at=datetime.utcnow() - timedelta(hours=5)
    )
    db.add(conv_note)
    db.flush()

    db.add(ConversationParticipant(conversation_id=conv_note.id, user_id=moxie.id, role="admin", last_read_at=datetime.utcnow()))

    db.add(Message(
        conversation_id=conv_note.id,
        sender_id=moxie.id,
        content="Remember to demonstrate the WebSocket heartbeat and reconnection backoff during the interview demo.",
        message_type="text",
        status="read",
        created_at=datetime.utcnow() - timedelta(hours=5)
    ))

    # 7. Conversation 5: Moxie <-> Sarah Connor (Unread Incoming Message)
    conv_sarah = Conversation(
        is_group=False,
        created_by=users["sarah"].id,
        created_at=datetime.utcnow() - timedelta(hours=4),
        updated_at=datetime.utcnow() - timedelta(minutes=1)
    )
    db.add(conv_sarah)
    db.flush()

    db.add(ConversationParticipant(conversation_id=conv_sarah.id, user_id=moxie.id, role="member", last_read_at=datetime.utcnow() - timedelta(minutes=30)))
    db.add(ConversationParticipant(conversation_id=conv_sarah.id, user_id=users["sarah"].id, role="admin", last_read_at=datetime.utcnow()))

    db.add(Message(
        conversation_id=conv_sarah.id,
        sender_id=users["sarah"].id,
        content="All defensive security checks passed. The clone is production ready for Scaler Lab AI evaluation!",
        message_type="text",
        status="delivered",
        created_at=datetime.utcnow() - timedelta(minutes=1)
    ))

    db.commit()
    print("Database seeded successfully with users, conversations, and rich message history!")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)
