from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Key for crisis detection
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-4E9E0D290C22d3e925')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

# Grief topics for user profiles
GRIEF_TOPICS = [
    "Loss of Parent",
    "Loss of Spouse/Partner",
    "Loss of Child",
    "Loss of Sibling",
    "Loss of Friend",
    "Loss of Pet",
    "Pregnancy/Infant Loss",
    "Loss to Suicide",
    "Loss to Illness",
    "Sudden/Unexpected Loss",
    "Other"
]

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    grief_topics: List[str] = []
    is_profile_complete: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    grief_topics: Optional[List[str]] = None
    picture: Optional[str] = None

class UserSession(BaseModel):
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Conversation(BaseModel):
    conversation_id: str
    participants: List[str]  # user_ids
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message: Optional[str] = None

class Message(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    content: Optional[str] = None
    message_type: str = "text"  # text, image, voice
    media_data: Optional[str] = None  # base64 encoded
    is_flagged: bool = False
    crisis_detected: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    content: Optional[str] = None
    message_type: str = "text"
    media_data: Optional[str] = None

class SupportGroup(BaseModel):
    group_id: str
    name: str
    description: str
    topic: str
    member_count: int = 0
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupMessage(BaseModel):
    message_id: str
    group_id: str
    sender_id: str
    sender_name: str
    content: Optional[str] = None
    message_type: str = "text"
    media_data: Optional[str] = None
    is_flagged: bool = False
    crisis_detected: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConnectionRequest(BaseModel):
    request_id: str
    from_user_id: str
    to_user_id: str
    status: str = "pending"  # pending, accepted, rejected
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CrisisCheckResult(BaseModel):
    is_crisis: bool
    support_message: Optional[str] = None
    resources: List[str] = []

# ============== HELPER FUNCTIONS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user)

async def check_crisis_content(message_text: str) -> CrisisCheckResult:
    """Check message for crisis content using LLM"""
    if not message_text or len(message_text.strip()) < 5:
        return CrisisCheckResult(is_crisis=False)
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"crisis_check_{uuid.uuid4().hex[:8]}",
            system_message="""You are a crisis detection assistant for a grief support app. 
Analyze messages for signs of:
- Suicidal ideation or self-harm
- Immediate danger to self or others
- Severe emotional distress requiring immediate intervention

Respond ONLY with a JSON object:
{
    "is_crisis": true/false,
    "severity": "none"/"low"/"medium"/"high",
    "reason": "brief explanation if crisis detected"
}

Be sensitive - this is a grief support context where sadness is expected. 
Only flag actual crisis situations, not general grief expressions."""
        )
        chat.with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Analyze this message for crisis content: \"{message_text}\"")
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        try:
            # Try to extract JSON from response
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            
            result = json.loads(response_text)
            
            if result.get("is_crisis", False):
                return CrisisCheckResult(
                    is_crisis=True,
                    support_message="We noticed you might be going through a difficult time. You're not alone, and help is available.",
                    resources=[
                        "National Suicide Prevention Lifeline: 988",
                        "Crisis Text Line: Text HOME to 741741",
                        "International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/"
                    ]
                )
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse crisis check response: {response}")
        
        return CrisisCheckResult(is_crisis=False)
        
    except Exception as e:
        logger.error(f"Crisis check failed: {e}")
        return CrisisCheckResult(is_crisis=False)

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to validate session
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    session_token = auth_data.get("session_token")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": auth_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data.get("name", existing_user.get("name")),
                "picture": auth_data.get("picture", existing_user.get("picture")),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    else:
        # Create new user
        new_user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data.get("name", "User"),
            "picture": auth_data.get("picture"),
            "bio": None,
            "grief_topics": [],
            "is_profile_complete": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Delete old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Get user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USER ENDPOINTS ==============

@api_router.get("/users/profile")
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return user.model_dump()

@api_router.put("/users/profile")
async def update_profile(
    profile_update: UserProfileUpdate,
    user: User = Depends(get_current_user)
):
    """Update user profile"""
    update_data = {k: v for k, v in profile_update.model_dump().items() if v is not None}
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Check if profile is now complete
        if "bio" in update_data or "grief_topics" in update_data:
            current_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
            bio = update_data.get("bio", current_user.get("bio"))
            topics = update_data.get("grief_topics", current_user.get("grief_topics", []))
            if bio and len(topics) > 0:
                update_data["is_profile_complete"] = True
        
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return updated_user

@api_router.get("/users/browse")
async def browse_users(
    topic: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    user: User = Depends(get_current_user)
):
    """Browse other users, optionally filtered by grief topic"""
    query = {
        "user_id": {"$ne": user.user_id},
        "is_profile_complete": True
    }
    
    if topic:
        query["grief_topics"] = topic
    
    users = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific user's profile"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/grief-topics")
async def get_grief_topics():
    """Get list of available grief topics"""
    return {"topics": GRIEF_TOPICS}

# ============== CONNECTION ENDPOINTS ==============

@api_router.post("/connections/request/{to_user_id}")
async def send_connection_request(
    to_user_id: str,
    message: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Send a connection request to another user"""
    # Check if target user exists
    target_user = await db.users.find_one({"user_id": to_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if request already exists
    existing = await db.connection_requests.find_one({
        "$or": [
            {"from_user_id": user.user_id, "to_user_id": to_user_id},
            {"from_user_id": to_user_id, "to_user_id": user.user_id}
        ],
        "status": {"$in": ["pending", "accepted"]}
    })
    
    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=400, detail="Already connected")
        raise HTTPException(status_code=400, detail="Request already pending")
    
    request_obj = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "from_user_id": user.user_id,
        "to_user_id": to_user_id,
        "status": "pending",
        "message": message,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.connection_requests.insert_one(request_obj)
    return {"message": "Request sent", "request_id": request_obj["request_id"]}

@api_router.get("/connections/requests")
async def get_connection_requests(user: User = Depends(get_current_user)):
    """Get pending connection requests for current user"""
    requests = await db.connection_requests.find(
        {"to_user_id": user.user_id, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    # Batch fetch all user info to avoid N+1 queries
    if requests:
        user_ids = [req["from_user_id"] for req in requests]
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "bio": 1, "grief_topics": 1}
        ).to_list(len(user_ids))
        user_map = {u["user_id"]: u for u in users}
        
        for req in requests:
            req["from_user"] = user_map.get(req["from_user_id"])
    
    return {"requests": requests}

@api_router.post("/connections/respond/{request_id}")
async def respond_to_connection(
    request_id: str,
    accept: bool,
    user: User = Depends(get_current_user)
):
    """Accept or reject a connection request"""
    request_obj = await db.connection_requests.find_one(
        {"request_id": request_id, "to_user_id": user.user_id},
        {"_id": 0}
    )
    
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    
    new_status = "accepted" if accept else "rejected"
    await db.connection_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": new_status}}
    )
    
    # If accepted, create a conversation
    if accept:
        conversation = {
            "conversation_id": f"conv_{uuid.uuid4().hex[:12]}",
            "participants": [request_obj["from_user_id"], user.user_id],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_message": None
        }
        await db.conversations.insert_one(conversation)
        return {"message": "Connection accepted", "conversation_id": conversation["conversation_id"]}
    
    return {"message": "Connection rejected"}

@api_router.get("/connections")
async def get_connections(user: User = Depends(get_current_user)):
    """Get all accepted connections"""
    connections = await db.connection_requests.find(
        {
            "$or": [
                {"from_user_id": user.user_id},
                {"to_user_id": user.user_id}
            ],
            "status": "accepted"
        },
        {"_id": 0}
    ).to_list(100)
    
    # Get user info for each connection
    result = []
    for conn in connections:
        other_user_id = conn["to_user_id"] if conn["from_user_id"] == user.user_id else conn["from_user_id"]
        other_user = await db.users.find_one(
            {"user_id": other_user_id},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "bio": 1, "grief_topics": 1}
        )
        if other_user:
            result.append(other_user)
    
    return {"connections": result}

# ============== CONVERSATION ENDPOINTS ==============

@api_router.get("/conversations")
async def get_conversations(user: User = Depends(get_current_user)):
    """Get all conversations for current user"""
    conversations = await db.conversations.find(
        {"participants": user.user_id},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Get other participant info for each conversation
    for conv in conversations:
        other_user_id = [p for p in conv["participants"] if p != user.user_id][0]
        other_user = await db.users.find_one(
            {"user_id": other_user_id},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        conv["other_user"] = other_user
    
    return {"conversations": conversations}

@api_router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user)
):
    """Get a specific conversation"""
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "participants": user.user_id},
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    other_user_id = [p for p in conv["participants"] if p != user.user_id][0]
    other_user = await db.users.find_one(
        {"user_id": other_user_id},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    )
    conv["other_user"] = other_user
    
    return conv

@api_router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user)
):
    """Get messages in a conversation"""
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "participants": user.user_id},
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Reverse to get chronological order
    messages.reverse()
    
    return {"messages": messages}

@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    message_data: MessageCreate,
    user: User = Depends(get_current_user)
):
    """Send a message in a conversation"""
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "participants": user.user_id},
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check for crisis content
    crisis_result = CrisisCheckResult(is_crisis=False)
    if message_data.content and message_data.message_type == "text":
        crisis_result = await check_crisis_content(message_data.content)
    
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "conversation_id": conversation_id,
        "sender_id": user.user_id,
        "content": message_data.content,
        "message_type": message_data.message_type,
        "media_data": message_data.media_data,
        "is_flagged": crisis_result.is_crisis,
        "crisis_detected": crisis_result.is_crisis,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation
    last_msg = message_data.content or f"[{message_data.message_type}]"
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"updated_at": datetime.now(timezone.utc), "last_message": last_msg[:100]}}
    )
    
    message.pop("_id", None)
    
    response = {"message": message}
    if crisis_result.is_crisis:
        response["crisis_alert"] = {
            "support_message": crisis_result.support_message,
            "resources": crisis_result.resources
        }
    
    return response

# ============== SUPPORT GROUP ENDPOINTS ==============

@api_router.get("/groups")
async def get_groups(
    topic: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get all support groups"""
    query = {}
    if topic:
        query["topic"] = topic
    
    groups = await db.support_groups.find(query, {"_id": 0}).to_list(100)
    
    # Check membership for each group
    memberships = await db.group_memberships.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    member_group_ids = {m["group_id"] for m in memberships}
    
    for group in groups:
        group["is_member"] = group["group_id"] in member_group_ids
    
    return {"groups": groups}

@api_router.post("/groups")
async def create_group(
    name: str,
    description: str,
    topic: str,
    user: User = Depends(get_current_user)
):
    """Create a new support group"""
    group = {
        "group_id": f"grp_{uuid.uuid4().hex[:12]}",
        "name": name,
        "description": description,
        "topic": topic,
        "member_count": 1,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.support_groups.insert_one(group)
    
    # Add creator as member
    membership = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "group_id": group["group_id"],
        "user_id": user.user_id,
        "joined_at": datetime.now(timezone.utc)
    }
    await db.group_memberships.insert_one(membership)
    
    group.pop("_id", None)
    return group

@api_router.post("/groups/{group_id}/join")
async def join_group(group_id: str, user: User = Depends(get_current_user)):
    """Join a support group"""
    group = await db.support_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    existing = await db.group_memberships.find_one({
        "group_id": group_id,
        "user_id": user.user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    
    membership = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "group_id": group_id,
        "user_id": user.user_id,
        "joined_at": datetime.now(timezone.utc)
    }
    await db.group_memberships.insert_one(membership)
    
    await db.support_groups.update_one(
        {"group_id": group_id},
        {"$inc": {"member_count": 1}}
    )
    
    return {"message": "Joined group successfully"}

@api_router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, user: User = Depends(get_current_user)):
    """Leave a support group"""
    result = await db.group_memberships.delete_one({
        "group_id": group_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not a member")
    
    await db.support_groups.update_one(
        {"group_id": group_id},
        {"$inc": {"member_count": -1}}
    )
    
    return {"message": "Left group successfully"}

@api_router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: str,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user)
):
    """Get messages in a group"""
    # Check membership
    membership = await db.group_memberships.find_one({
        "group_id": group_id,
        "user_id": user.user_id
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    messages = await db.group_messages.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    messages.reverse()
    
    return {"messages": messages}

@api_router.post("/groups/{group_id}/messages")
async def send_group_message(
    group_id: str,
    message_data: MessageCreate,
    user: User = Depends(get_current_user)
):
    """Send a message in a group"""
    membership = await db.group_memberships.find_one({
        "group_id": group_id,
        "user_id": user.user_id
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Check for crisis content
    crisis_result = CrisisCheckResult(is_crisis=False)
    if message_data.content and message_data.message_type == "text":
        crisis_result = await check_crisis_content(message_data.content)
    
    message = {
        "message_id": f"gmsg_{uuid.uuid4().hex[:12]}",
        "group_id": group_id,
        "sender_id": user.user_id,
        "sender_name": user.name,
        "content": message_data.content,
        "message_type": message_data.message_type,
        "media_data": message_data.media_data,
        "is_flagged": crisis_result.is_crisis,
        "crisis_detected": crisis_result.is_crisis,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.group_messages.insert_one(message)
    message.pop("_id", None)
    
    response = {"message": message}
    if crisis_result.is_crisis:
        response["crisis_alert"] = {
            "support_message": crisis_result.support_message,
            "resources": crisis_result.resources
        }
    
    return response

# ============== SEED DATA ==============

@api_router.post("/seed-groups")
async def seed_default_groups():
    """Create default support groups if they don't exist"""
    default_groups = [
        {
            "name": "Loss of a Parent",
            "description": "A safe space for those grieving the loss of a mother or father",
            "topic": "Loss of Parent"
        },
        {
            "name": "Widows & Widowers",
            "description": "Support for those who have lost a spouse or life partner",
            "topic": "Loss of Spouse/Partner"
        },
        {
            "name": "Child Loss Support",
            "description": "For parents coping with the devastating loss of a child",
            "topic": "Loss of Child"
        },
        {
            "name": "Pet Loss & Rainbow Bridge",
            "description": "Honoring and grieving our beloved animal companions",
            "topic": "Loss of Pet"
        },
        {
            "name": "Sudden Loss Support",
            "description": "For those dealing with unexpected and sudden loss",
            "topic": "Sudden/Unexpected Loss"
        },
        {
            "name": "Suicide Loss Survivors",
            "description": "A compassionate space for those who have lost someone to suicide",
            "topic": "Loss to Suicide"
        }
    ]
    
    created = 0
    for group_data in default_groups:
        existing = await db.support_groups.find_one({"name": group_data["name"]})
        if not existing:
            group = {
                "group_id": f"grp_{uuid.uuid4().hex[:12]}",
                "name": group_data["name"],
                "description": group_data["description"],
                "topic": group_data["topic"],
                "member_count": 0,
                "created_by": "system",
                "created_at": datetime.now(timezone.utc)
            }
            await db.support_groups.insert_one(group)
            created += 1
    
    return {"message": f"Created {created} groups"}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Grief Support API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
