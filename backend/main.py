import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv
from models import ChatRequest, ChatMessage

load_dotenv()

app = FastAPI(title="TCC Chat Backend")

# 允許跨網域請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境變數檢查與日誌
print("=== 正在啟動 TCC Chat 後端伺服器 ===")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL or "YOUR_SUPABASE" in SUPABASE_URL:
    print("⚠️ 警告: SUPABASE_URL 未正確設定，職缺讀取將失敗。")
if not SUPABASE_KEY or "YOUR_SUPABASE" in SUPABASE_KEY:
    print("⚠️ 警告: SUPABASE_KEY 未正確設定，職缺讀取將失敗。")
if not GEMINI_API_KEY or "YOUR_GEMINI" in GEMINI_API_KEY:
    print("ℹ️ 提示: GEMINI_API_KEY 未設定，將自動啟用「模擬模式 (Mock Mode)」。")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
    print("✅ Supabase 客戶端初始化成功 (若 URL 有誤仍可能在查詢時報錯)")
except Exception as e:
    print(f"❌ Supabase 客戶端初始化失敗: {e}")
    supabase = None

@app.get("/")
async def root():
    return {"message": "TCC Chat 後端服務運行中", "endpoints": ["/api/jobs", "/api/chat"]}

@app.get("/api/jobs")
async def get_jobs():
    """取得所有職缺列表 (支援 Mock Mode)"""
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
    
    if not supabase:
        return mock_jobs

    try:
        response = supabase.table("jobs").select("*").execute()
        if not response.data:
            print("DEBUG: Supabase 查詢成功，但資料表是空的。")
            return mock_jobs
        print(f"✅ 成功從 Supabase 獲取 {len(response.data)} 筆職缺！")
        return response.data
    except Exception as e:
        print(f"❌ Supabase 連線或查詢失敗！")
        print(f"DEBUG 詳細錯誤內容: {e}")
        print("ℹ️ 切換至模擬模式以維持 Demo 運行。")
        return mock_jobs

# 簡單的記憶體快取 (針對相同問題與標籤)
# 注意：在正式環境建議使用 Redis
from functools import lru_cache

@lru_cache(maxsize=100)
def get_cached_response(messages_tuple: tuple, tab: str):
    # 此函數僅用於結構化快取邏輯，實際調用在 chat_proxy 中實作
    return None

@app.post("/api/chat")
async def chat_proxy(request: ChatRequest):
    """AI 聊天代理 API"""
    print(f"📩 收到聊天請求: tab={request.tab}, 訊息數={len(request.messages)}")
    # 模擬模式回覆 (當無 GEMINI_API_KEY 時)
    if not GEMINI_API_KEY:
        user_msg = request.messages[-1].text.lower() if request.messages else ""
        
        if request.tab == 'intro':
            if any(k in user_msg for k in ["設計", "理念", "為什麼"]):
                text = "「鸚鵡螺號」的設計靈感來自深海生物，象徵著自然與科技的結合。透過螺旋形狀，我們展示了台泥在循環經濟中的完整布局。🐚"
            elif any(k in user_msg for k in ["地圖", "在哪", "位置"]):
                text = "本展區主要分為：A區-未來能源、B區-低碳建築、C區-資源循環。您現在正位於中央大廳，可以點擊下方按鈕引導前往各區！📍"
            elif any(k in user_msg for k in ["永續", "低碳", "環保"]):
                text = "台泥致力於 2050 淨零排放，透過碳捕捉與水泥窯協同處置技術，我們正將傳統產業轉型為綠色產業。🌿"
            else:
                text = "您好！我是導覽員。關於展場的設計、地圖分布，或是台泥的永續願景，您有什麼感興趣的嗎？🚢"
        
        else: # match tab
            if any(k in user_msg for k in ["福利", "待遇", "薪資"]):
                text = "台泥提供領先業界的薪資水平，並有員工持股信託、優於法規的假勤。詳情歡迎點擊職缺卡片查看！💰"
            elif any(k in user_msg for k in ["培訓", "升遷", "計畫"]):
                text = "我們有完整的全方位培訓機制，尤其是 MA 儲備幹部計畫，會提供跨部門輪崗、海外實習的機會喔！🚀"
            else:
                text = "您好！我是招募顧問。關於職缺的具體福利、培訓計畫，或是如何投遞履歷，我都能為您解答！💼"
        
        return {"text": text}
    
    try:
        # 限制歷史紀錄長度，僅保留最後 6 則訊息以節省 Token
        recent_messages = request.messages[-6:]
        
        system_instruction = (
            "你是一位專業的台泥展場導覽員。請極簡短地介紹展場設計或鸚鵡螺號理念。你可以嵌入圖片（例如：![圖片描述](https://picsum.photos/seed/nautilus/800/450)）。請絕對不要回答職缺相關問題，請引導至『職缺媒合』分頁。請使用繁體中文，語氣親切。"
            if request.tab == 'intro' else
            "你是一位台泥招募顧問。請針對詢問提供「極簡短」的回答（不超過 20 字），並引導使用者查看下方的職缺。請絕對不要在回答中列出職缺名稱。請使用繁體中文，並將「職缺卡片」一詞改為「職缺」。"
        )
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )
        
        # 轉換歷史訊息格式
        history = [
            {"role": "user" if m.role == "user" else "model", "parts": [m.text]}
            for m in recent_messages[:-1]
        ]
        
        chat = model.start_chat(history=history)
        response = chat.send_message(recent_messages[-1].text)
        
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 使用字串 "main:app" 以支援 reload 功能，埠號改為 8080
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)
