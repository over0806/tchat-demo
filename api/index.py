import os
# Version: 1.0.1
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import google.generativeai as genai
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    tab: str

# Config
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except Exception:
    supabase = None

@app.get("/api/jobs")
async def get_jobs():
    mock_jobs = [
        {
            "id": "1", "title": "【MA 儲備幹部】數位轉型組", "category": "MA", 
            "location": "台北市中山區", "salary": "待遇面議", "count": 5,
            "description": ["參與集團數位轉型核心專案", "數據驅動決策分析"],
            "requirements": ["碩士以上", "英文流利"]
        },
        {
            "id": "2", "title": "【環工背景】環境管理工程師", "category": "Environmental", 
            "location": "台北市中山區", "salary": "待遇面議", "count": 2,
            "description": ["碳盤查與減碳路徑規劃", "廢棄物管理計劃"],
            "requirements": ["大學以上", "環境工程相關"]
        }
    ]
    if not supabase: return mock_jobs
    try:
        response = supabase.table("jobs").select("*").execute()
        return response.data if response.data else mock_jobs
    except Exception:
        return mock_jobs

@app.post("/api/chat")
async def chat_proxy(request: ChatRequest):
    if not GEMINI_API_KEY:
        user_msg = request.messages[-1].text.lower() if request.messages else ""
        if request.tab == 'intro':
            if any(k in user_msg for k in ["設計", "理念"]):
                text = "「鸚鵡螺號」的設計靈感來自深海生物，象徵著自然與科技的結合。螺旋形狀展示了台泥在循環經濟中的布局。🐚"
            elif any(k in user_msg for k in ["地圖", "在哪"]):
                text = "本展區分：A區-未來能源、B區-低碳建築、C區-資源循環。您在中央大廳，可按按鈕引導！📍"
            else:
                text = "您好！我是導覽員。想了解設計、地圖或永續願景嗎？🚢"
        else:
            if any(k in user_msg for k in ["福利", "待遇"]):
                text = "台泥提供領先薪資、員工持股信託。點擊職缺卡片看看吧！💰"
            else:
                text = "您好！我是招募顧問。關於福利、培訓或投遞履歷，我都能解答！💼"
        return {"text": text}

    try:
        system_instruction = (
            "你是一位導覽員。短介展場。不要回職缺。" if request.tab == 'intro' else
            "你是一位招募顧問。極短回答（20字內），引導看職缺。"
        )
        model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=system_instruction)
        history = [{"role": "user" if m.role == "user" else "model", "parts": [m.text]} for m in request.messages[-6:-1]]
        chat = model.start_chat(history=history)
        response = chat.send_message(request.messages[-1].text)
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
