from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import httpx
from celery_worker import schedule_recovery
from supabase import create_client, Client
import ai_handler # Importa nosso novo handler robusto

# Inicializa App
app = FastAPI(title="Recupa.ai Backend")

# Configuração de CORS
cors_origin = os.environ.get("CORS_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Validate required env vars
_required_env = ["UAZAPI_BASE_URL", "UAZAPI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
for _var in _required_env:
    if not os.environ.get(_var):
        raise RuntimeError(f"Missing required environment variable: {_var}")

# Configurações UAZAPI
UAZAPI_BASE_URL = os.environ["UAZAPI_BASE_URL"]
UAZAPI_API_KEY = os.environ["UAZAPI_API_KEY"]

# Supabase Admin
url: str = os.environ["SUPABASE_URL"]
key: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase: Client = create_client(url, key)

# --- MODELS ---
class WebhookPayload(BaseModel):
    event: str
    email: str
    phone: str
    product_id: str
    checkout_url: str = None
    name: str = "Cliente"

# --- ROTAS WHATSAPP (Frontend -> Backend -> UAZAPI) ---

@app.post("/api/whatsapp/connect/{client_id}")
async def connect_whatsapp(client_id: str):
    instance_key = f"instance_{client_id}"
    
    headers = {
        "apikey": UAZAPI_API_KEY,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        # 1. Init Instance (Cria se não existir)
        try:
            await client.post(
                f"{UAZAPI_BASE_URL}/instance/init",
                headers=headers,
                json={"instanceName": instance_key}
            )
        except Exception as e:
            print(f"Erro ao iniciar instância: {e}")

        # 2. Get QR Code
        try:
            connect_res = await client.post(
                f"{UAZAPI_BASE_URL}/instance/connect",
                headers=headers,
                json={"instanceName": instance_key}
            )
            
            if connect_res.status_code == 200:
                resp_data = connect_res.json()
                qr_code = resp_data.get('base64')
                
                data = {
                    "client_id": client_id,
                    "instance_key": instance_key,
                    "status": "connecting",
                    "qr_code_base64": qr_code
                }
                supabase.table("instances").upsert(data, on_conflict="instance_key").execute()
                return data
            else:
                # Se falhar, tenta pegar do banco caso já exista
                raise HTTPException(status_code=connect_res.status_code, detail=f"Erro UAZAPI: {connect_res.text}")
                
        except Exception as e:
             # Fallback Mock para desenvolvimento sem internet/api
             fake_qr = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
             return {"client_id": client_id, "instance_key": instance_key, "status": "connecting", "qr_code_base64": fake_qr}

@app.get("/api/whatsapp/status/{client_id}")
async def get_whatsapp_status(client_id: str):
    instance_key = f"instance_{client_id}"
    headers = {"apikey": UAZAPI_API_KEY}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"{UAZAPI_BASE_URL}/instance/status",
                headers=headers,
                params={"instanceName": instance_key}
            )
            
            if res.status_code == 200:
                status_data = res.json()
                state = status_data.get('instance', {}).get('state', 'disconnected')
                status = 'connected' if state == 'open' else 'disconnected'
                
                supabase.table("instances").update({"status": status}).eq("instance_key", instance_key).execute()
                return {"status": status}
        except Exception:
            pass
            
    response = supabase.table("instances").select("*").eq("client_id", client_id).execute()
    return response.data[0] if response.data else {"status": "disconnected"}

# --- ROTA WEBHOOK UAZAPI (RECEBIMENTO DE MENSAGENS) ---
# Esta é a rota que você deve configurar na UAZAPI como webhook URL

@app.post("/api/whatsapp/webhook")
async def receive_whatsapp_message(request: Request, background_tasks: BackgroundTasks):
    """
    Recebe notificação da UAZAPI quando uma mensagem chega.
    Processa em background para não travar a API.
    """
    try:
        body = await request.json()
        print(f"[WEBHOOK UAZAPI] Payload recebido: {json.dumps(body)}")

        # A estrutura da UAZAPI varia, mas geralmente é:
        # { "instanceName": "...", "message": { "key": {...}, "message": {"conversation": "texto"} } }
        
        instance_key = body.get("instanceName")
        message_data = body.get("message")
        
        if not message_data:
            return {"status": "ignored", "reason": "no_message_data"}
            
        # Ignora mensagens enviadas por mim mesmo (fromMe)
        if message_data.get("key", {}).get("fromMe"):
            return {"status": "ignored", "reason": "from_me"}

        # Extração do Telefone (RemoteJid)
        remote_jid = message_data.get("key", {}).get("remoteJid", "")
        phone_number = remote_jid.split("@")[0] # Remove @s.whatsapp.net

        # Extração do Texto
        text_content = ""
        if "conversation" in message_data.get("message", {}):
            text_content = message_data["message"]["conversation"]
        elif "extendedTextMessage" in message_data.get("message", {}):
            text_content = message_data["message"]["extendedTextMessage"].get("text", "")
            
        if not text_content:
            return {"status": "ignored", "reason": "no_text_content"}

        # Processa a IA em Background Task (Fire and Forget)
        background_tasks.add_task(
            ai_handler.process_conversation_step,
            phone_number=phone_number,
            incoming_message=text_content,
            instance_key=instance_key
        )

        return {"status": "processing"}

    except Exception as e:
        print(f"[WEBHOOK ERROR] {e}")
        return {"status": "error", "details": str(e)}


# --- ROTA WEBHOOK PLATAFORMAS (Hotmart/Kiwify) ---

@app.post("/api/webhooks/{platform}/{client_id}")
async def handle_platform_webhook(platform: str, client_id: str, payload: Request):
    """
    Recebe notificação de abandono ou compra da Hotmart/Kiwify
    """
    try:
        body = await payload.json()
        print(f"[WEBHOOK {platform.upper()}] {json.dumps(body)}")
        
        event_type = body.get("event") 
        email = body.get("email")
        phone = body.get("phone_number") or body.get("phone_local_code", "") + body.get("phone_number", "")
        external_prod_id = body.get("product_id") or str(body.get("id")) # Hotmart as vezes manda ID numérico
        
        # 2. Buscar Produto no Banco
        prod_res = supabase.table("products").select("id, delay_minutes").eq("external_product_id", str(external_prod_id)).eq("client_id", client_id).execute()
        
        if not prod_res.data:
            print(f"[WEBHOOK] Produto {external_prod_id} não configurado para cliente {client_id}")
            return {"status": "ignored", "reason": "product_not_configured"}
            
        product = prod_res.data[0]
        
        # 3. Lógica de Eventos
        if event_type in ["PURCHASE_APPROVED", "ORDER_APPROVED"]:
            # Kill Switch
            supabase.table("leads").update({"status": "converted_organically"}).eq("email", email).eq("product_id", product['id']).execute()
            return {"status": "success", "action": "kill_switch_activated"}
            
        elif event_type == "CART_ABANDONMENT":
            # Cria Lead
            lead_data = {
                "client_id": client_id,
                "product_id": product['id'],
                "email": email,
                "phone": phone,
                "status": "pending_recovery",
                "name": body.get("name", "Cliente"),
                "checkout_url": body.get("checkout_url", ""),
                "value": body.get("price", 0)
            }
            res = supabase.table("leads").insert(lead_data).execute()
            
            if res.data:
                lead_id = res.data[0]['id']
                # Agenda Task (Celery)
                schedule_recovery.delay(lead_id)
                return {"status": "queued", "lead_id": lead_id}
                
        return {"status": "ignored", "reason": f"unknown_event_{event_type}"}
        
    except Exception as e:
        print(f"[WEBHOOK PLATFORM ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))