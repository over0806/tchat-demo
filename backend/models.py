from pydantic import BaseModel
from typing import List, Optional

class Job(BaseModel):
    id: str
    title: str
    category: str
    location: str
    salary: str
    description: List[str]
    requirements: List[str]
    count: int

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    tab: str  # 'intro' or 'match'
